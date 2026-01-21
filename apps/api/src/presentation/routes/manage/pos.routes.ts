import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { Product } from '../../../infrastructure/database/mongodb/models/Product.js';
import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';
import { CashRegister } from '../../../infrastructure/database/mongodb/models/CashRegister.js';
import { asyncHandler, NotFoundError, BadRequestError, ConflictError } from '../../middleware/errorHandler.js';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { mercadoPagoService } from '../../../infrastructure/external/mercadopago/MercadoPagoService.js';
import { logger } from '../../../utils/logger.js';

const router = Router();

// Validation schemas
const openCashRegisterSchema = z.object({
  initialAmount: z.number().min(0),
  notes: z.string().max(500).optional(),
});

const closeCashRegisterSchema = z.object({
  finalAmount: z.number().min(0),
  notes: z.string().max(500).optional(),
});

const cashMovementSchema = z.object({
  type: z.enum(['in', 'out']),
  amount: z.number().positive(),
  reason: z.string().min(1).max(200),
  notes: z.string().max(500).optional(),
});

const saleItemSchema = z.object({
  type: z.enum(['service', 'product']),
  itemId: z.string(),
  quantity: z.number().positive().default(1),
  price: z.number().min(0).optional(), // Override price
  discount: z.number().min(0).max(100).optional(), // Percentage discount
  staffId: z.string().optional(), // For services
});

const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  clientId: z.string().optional(),
  clientInfo: z.object({
    name: z.string().min(1).max(100),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }).optional(),
  appointmentId: z.string().optional(), // Link to existing appointment
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'mercadopago', 'mixed']),
  payments: z.array(z.object({
    method: z.enum(['cash', 'card', 'transfer', 'mercadopago']),
    amount: z.number().positive(),
    reference: z.string().optional(),
  })).optional(),
  tip: z.number().min(0).optional(),
  globalDiscount: z.number().min(0).max(100).optional(), // Percentage
  notes: z.string().max(500).optional(),
});

const refundSchema = z.object({
  items: z.array(z.object({
    itemIndex: z.number().int().min(0),
    quantity: z.number().positive(),
  })).optional(), // If not provided, full refund
  reason: z.string().min(1).max(500),
  refundMethod: z.enum(['cash', 'card', 'mercadopago', 'store_credit']),
});

// =====================================================
// CASH REGISTER MANAGEMENT
// =====================================================

// GET /api/v1/manage/pos/cash-register - Get current cash register status
router.get(
  '/cash-register',
  requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;

    const currentRegister = await CashRegister.findOne({
      businessId,
      status: 'open',
    })
      .populate('openedBy', 'profile.firstName profile.lastName')
      .lean();

    if (!currentRegister) {
      return res.json({
        success: true,
        data: {
          isOpen: false,
          register: null,
        },
      });
    }

    // Calculate current totals
    const movements = currentRegister.movements || [];
    const cashIn = movements
      .filter((m) => m.type === 'in')
      .reduce((sum, m) => sum + m.amount, 0);
    const cashOut = movements
      .filter((m) => m.type === 'out')
      .reduce((sum, m) => sum + m.amount, 0);

    // Get sales summary for the session
    const salesSummary = await Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          createdAt: { $gte: currentRegister.openedAt },
          type: 'sale',
          status: { $in: ['completed', 'partial_refund'] },
        },
      },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$finalTotal' },
          count: { $sum: 1 },
        },
      },
    ]);

    const salesByMethod = Object.fromEntries(
      salesSummary.map((s) => [s._id, { total: s.total, count: s.count }])
    );

    res.json({
      success: true,
      data: {
        isOpen: true,
        register: {
          ...currentRegister,
          currentCash: currentRegister.initialAmount + cashIn - cashOut + (salesByMethod.cash?.total || 0),
          movements: {
            in: cashIn,
            out: cashOut,
          },
          sales: salesByMethod,
        },
      },
    });
  })
);

// POST /api/v1/manage/pos/cash-register/open - Open cash register
router.post(
  '/cash-register/open',
  requirePermission('pos:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = openCashRegisterSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    // Check if there's already an open register
    const existingOpen = await CashRegister.findOne({
      businessId,
      status: 'open',
    });

    if (existingOpen) {
      throw new ConflictError('There is already an open cash register. Please close it first.');
    }

    const register = new CashRegister({
      businessId,
      openedAt: new Date(),
      openedBy: req.user!.id,
      initialAmount: data.initialAmount,
      status: 'open',
      movements: [],
      notes: data.notes,
    });

    await register.save();

    logger.info('Cash register opened', {
      registerId: register._id,
      businessId,
      initialAmount: data.initialAmount,
    });

    res.status(201).json({
      success: true,
      message: 'Cash register opened successfully',
      data: { register },
    });
  })
);

// POST /api/v1/manage/pos/cash-register/close - Close cash register
router.post(
  '/cash-register/close',
  requirePermission('pos:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = closeCashRegisterSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    const register = await CashRegister.findOne({
      businessId,
      status: 'open',
    });

    if (!register) {
      throw new NotFoundError('No open cash register found');
    }

    // Calculate expected amount
    const movements = register.movements || [];
    const cashIn = movements
      .filter((m) => m.type === 'in')
      .reduce((sum, m) => sum + m.amount, 0);
    const cashOut = movements
      .filter((m) => m.type === 'out')
      .reduce((sum, m) => sum + m.amount, 0);

    // Get cash sales
    const cashSales = await Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          createdAt: { $gte: register.openedAt },
          type: 'sale',
          status: { $in: ['completed', 'partial_refund'] },
          $or: [
            { paymentMethod: 'cash' },
            { 'payments.method': 'cash' },
          ],
        },
      },
      {
        $unwind: { path: '$payments', preserveNullAndEmptyArrays: true },
      },
      {
        $group: {
          _id: null,
          cashTotal: {
            $sum: {
              $cond: [
                { $eq: ['$payments.method', 'cash'] },
                '$payments.amount',
                { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$finalTotal', 0] },
              ],
            },
          },
        },
      },
    ]);

    const cashSalesTotal = cashSales[0]?.cashTotal || 0;

    // Get cash refunds
    const cashRefunds = await Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          createdAt: { $gte: register.openedAt },
          type: 'refund',
          status: 'completed',
          'refundDetails.refundMethod': 'cash',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$refundDetails.refundAmount' },
        },
      },
    ]);

    const cashRefundsTotal = cashRefunds[0]?.total || 0;

    const expectedAmount = register.initialAmount + cashIn - cashOut + cashSalesTotal - cashRefundsTotal;
    const difference = data.finalAmount - expectedAmount;

    register.status = 'closed';
    register.closedAt = new Date();
    register.closedBy = new mongoose.Types.ObjectId(req.user!.id);
    register.finalAmount = data.finalAmount;
    register.expectedAmount = expectedAmount;
    register.difference = difference;
    register.closingNotes = data.notes;

    await register.save();

    // Generate summary
    const salesSummary = await Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          createdAt: { $gte: register.openedAt, $lte: register.closedAt },
          type: 'sale',
          status: { $in: ['completed', 'partial_refund'] },
        },
      },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$finalTotal' },
          count: { $sum: 1 },
        },
      },
    ]);

    logger.info('Cash register closed', {
      registerId: register._id,
      businessId,
      expectedAmount,
      finalAmount: data.finalAmount,
      difference,
    });

    res.json({
      success: true,
      message: 'Cash register closed successfully',
      data: {
        register,
        summary: {
          initialAmount: register.initialAmount,
          expectedAmount,
          finalAmount: data.finalAmount,
          difference,
          movements: {
            in: cashIn,
            out: cashOut,
          },
          salesByMethod: Object.fromEntries(
            salesSummary.map((s) => [s._id, { total: s.total, count: s.count }])
          ),
        },
      },
    });
  })
);

// POST /api/v1/manage/pos/cash-register/movement - Add cash movement
router.post(
  '/cash-register/movement',
  requirePermission('pos:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = cashMovementSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    const register = await CashRegister.findOne({
      businessId,
      status: 'open',
    });

    if (!register) {
      throw new NotFoundError('No open cash register found');
    }

    const movement = {
      type: data.type,
      amount: data.amount,
      reason: data.reason,
      notes: data.notes,
      recordedAt: new Date(),
      recordedBy: new mongoose.Types.ObjectId(req.user!.id),
    };

    register.movements.push(movement);
    await register.save();

    logger.info('Cash movement recorded', {
      registerId: register._id,
      businessId,
      type: data.type,
      amount: data.amount,
      reason: data.reason,
    });

    res.json({
      success: true,
      message: `Cash ${data.type === 'in' ? 'deposit' : 'withdrawal'} recorded`,
      data: { movement },
    });
  })
);

// GET /api/v1/manage/pos/cash-register/history - Get cash register history
router.get(
  '/cash-register/history',
  requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const {
      startDate,
      endDate,
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    const query: Record<string, unknown> = {
      businessId,
      status: 'closed',
    };

    if (startDate || endDate) {
      query.closedAt = {};
      if (startDate) {
        (query.closedAt as Record<string, Date>).$gte = new Date(startDate);
      }
      if (endDate) {
        (query.closedAt as Record<string, Date>).$lte = new Date(endDate + 'T23:59:59');
      }
    }

    const [registers, total] = await Promise.all([
      CashRegister.find(query)
        .populate('openedBy', 'profile.firstName profile.lastName')
        .populate('closedBy', 'profile.firstName profile.lastName')
        .sort({ closedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      CashRegister.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        registers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  })
);

// =====================================================
// SALES (POINT OF SALE)
// =====================================================

// GET /api/v1/manage/pos/products - Get products for POS
router.get(
  '/products',
  requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { category, search } = req.query as Record<string, string>;

    const query: Record<string, unknown> = {
      businessId,
      status: 'active',
      stock: { $gt: 0 },
    };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: search },
      ];
    }

    const products = await Product.find(query)
      .select('name sku barcode price stock category images')
      .sort({ name: 1 })
      .lean();

    // Get categories
    const categories = await Product.distinct('category', { businessId, status: 'active' });

    res.json({
      success: true,
      data: {
        products,
        categories,
      },
    });
  })
);

// GET /api/v1/manage/pos/services - Get services for POS
router.get(
  '/services',
  requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { categoryId, search } = req.query as Record<string, string>;

    const query: Record<string, unknown> = {
      businessId,
      status: 'active',
    };

    if (categoryId) {
      query.categoryId = categoryId;
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const services = await Service.find(query)
      .select('name price duration categoryId')
      .populate('categoryId', 'name')
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      data: { services },
    });
  })
);

// POST /api/v1/manage/pos/sales - Create a sale
router.post(
  '/sales',
  requirePermission('pos:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = createSaleSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    // Check cash register is open for cash payments
    if (data.paymentMethod === 'cash' || data.payments?.some((p) => p.method === 'cash')) {
      const openRegister = await CashRegister.findOne({ businessId, status: 'open' });
      if (!openRegister) {
        throw new BadRequestError('Cash register must be open for cash payments');
      }
    }

    // Process items
    const processedItems: Array<{
      type: 'service' | 'product';
      itemId: mongoose.Types.ObjectId;
      name: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      total: number;
      staffId?: mongoose.Types.ObjectId;
    }> = [];

    let subtotal = 0;

    for (const item of data.items) {
      if (item.type === 'product') {
        const product = await Product.findOne({
          _id: item.itemId,
          businessId,
          status: 'active',
        });

        if (!product) {
          throw new NotFoundError(`Product not found: ${item.itemId}`);
        }

        if (product.stock < item.quantity) {
          throw new BadRequestError(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
        }

        const unitPrice = item.price ?? product.price;
        const discount = item.discount || 0;
        const itemTotal = unitPrice * item.quantity * (1 - discount / 100);

        processedItems.push({
          type: 'product',
          itemId: product._id,
          name: product.name,
          quantity: item.quantity,
          unitPrice,
          discount,
          total: itemTotal,
        });

        subtotal += itemTotal;

        // Update stock
        product.stock -= item.quantity;
        await product.save();
      } else {
        const service = await Service.findOne({
          _id: item.itemId,
          businessId,
          status: 'active',
        });

        if (!service) {
          throw new NotFoundError(`Service not found: ${item.itemId}`);
        }

        const unitPrice = item.price ?? service.price;
        const discount = item.discount || 0;
        const itemTotal = unitPrice * item.quantity * (1 - discount / 100);

        processedItems.push({
          type: 'service',
          itemId: service._id,
          name: service.name,
          quantity: item.quantity,
          unitPrice,
          discount,
          total: itemTotal,
          staffId: item.staffId ? new mongoose.Types.ObjectId(item.staffId) : undefined,
        });

        subtotal += itemTotal;
      }
    }

    // Apply global discount
    const globalDiscountAmount = data.globalDiscount ? subtotal * (data.globalDiscount / 100) : 0;
    const afterDiscount = subtotal - globalDiscountAmount;
    const tip = data.tip || 0;
    const finalTotal = afterDiscount + tip;

    // Validate payments for mixed payment
    if (data.paymentMethod === 'mixed') {
      if (!data.payments || data.payments.length < 2) {
        throw new BadRequestError('Mixed payment requires at least 2 payment methods');
      }
      const paymentsTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(paymentsTotal - finalTotal) > 0.01) {
        throw new BadRequestError(`Payment total (${paymentsTotal}) doesn't match sale total (${finalTotal})`);
      }
    }

    // Create transaction
    const transaction = new Transaction({
      businessId,
      type: 'sale',
      source: data.appointmentId ? 'appointment' : 'pos',
      appointmentId: data.appointmentId,
      clientId: data.clientId,
      clientInfo: data.clientInfo,
      items: processedItems,
      pricing: {
        subtotal,
        globalDiscount: data.globalDiscount || 0,
        globalDiscountAmount,
        tip,
        total: finalTotal,
      },
      paymentMethod: data.paymentMethod,
      payments: data.payments || [{
        method: data.paymentMethod as 'cash' | 'card' | 'transfer' | 'mercadopago',
        amount: finalTotal,
      }],
      finalTotal,
      status: 'completed',
      notes: data.notes,
      processedBy: new mongoose.Types.ObjectId(req.user!.id),
      processedAt: new Date(),
    });

    await transaction.save();

    // Update appointment if linked
    if (data.appointmentId) {
      await Appointment.findByIdAndUpdate(data.appointmentId, {
        paymentStatus: 'paid',
        $push: {
          transactions: {
            transactionId: transaction._id,
            type: 'payment',
            amount: finalTotal,
            date: new Date(),
          },
        },
      });
    }

    logger.info('POS sale created', {
      transactionId: transaction._id,
      businessId,
      items: processedItems.length,
      total: finalTotal,
    });

    res.status(201).json({
      success: true,
      message: 'Sale completed successfully',
      data: { transaction },
    });
  })
);

// GET /api/v1/manage/pos/sales - Get sales history
router.get(
  '/sales',
  requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const {
      startDate,
      endDate,
      paymentMethod,
      source,
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    const query: Record<string, unknown> = {
      businessId,
      type: 'sale',
    };

    if (startDate || endDate) {
      query.processedAt = {};
      if (startDate) {
        (query.processedAt as Record<string, Date>).$gte = new Date(startDate);
      }
      if (endDate) {
        (query.processedAt as Record<string, Date>).$lte = new Date(endDate + 'T23:59:59');
      }
    }

    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    if (source) {
      query.source = source;
    }

    const [sales, total, summary] = await Promise.all([
      Transaction.find(query)
        .populate('clientId', 'profile.firstName profile.lastName')
        .populate('processedBy', 'profile.firstName profile.lastName')
        .sort({ processedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Transaction.countDocuments(query),
      Transaction.aggregate([
        { $match: { ...query, status: { $in: ['completed', 'partial_refund'] } } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$finalTotal' },
            totalTips: { $sum: '$pricing.tip' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        sales,
        summary: summary[0] || { totalSales: 0, totalTips: 0, count: 0 },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  })
);

// GET /api/v1/manage/pos/sales/:id - Get sale details
router.get(
  '/sales/:id',
  requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const sale = await Transaction.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
      type: 'sale',
    })
      .populate('clientId', 'profile email phone')
      .populate('processedBy', 'profile')
      .populate('appointmentId');

    if (!sale) {
      throw new NotFoundError('Sale not found');
    }

    res.json({
      success: true,
      data: { sale },
    });
  })
);

// POST /api/v1/manage/pos/sales/:id/refund - Refund a sale
router.post(
  '/sales/:id/refund',
  requirePermission('pos:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = refundSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    const sale = await Transaction.findOne({
      _id: req.params.id,
      businessId,
      type: 'sale',
      status: { $in: ['completed', 'partial_refund'] },
    });

    if (!sale) {
      throw new NotFoundError('Sale not found or already fully refunded');
    }

    let refundAmount = 0;
    const refundedItems: Array<{
      itemIndex: number;
      name: string;
      quantity: number;
      amount: number;
    }> = [];

    if (data.items) {
      // Partial refund
      for (const refundItem of data.items) {
        const saleItem = sale.items[refundItem.itemIndex];
        if (!saleItem) {
          throw new BadRequestError(`Invalid item index: ${refundItem.itemIndex}`);
        }

        const alreadyRefunded = saleItem.refundedQuantity || 0;
        const availableForRefund = saleItem.quantity - alreadyRefunded;

        if (refundItem.quantity > availableForRefund) {
          throw new BadRequestError(`Cannot refund more than ${availableForRefund} for ${saleItem.name}`);
        }

        const itemRefundAmount = (saleItem.total / saleItem.quantity) * refundItem.quantity;
        refundAmount += itemRefundAmount;

        refundedItems.push({
          itemIndex: refundItem.itemIndex,
          name: saleItem.name,
          quantity: refundItem.quantity,
          amount: itemRefundAmount,
        });

        // Update refunded quantity
        sale.items[refundItem.itemIndex].refundedQuantity = alreadyRefunded + refundItem.quantity;

        // Restore stock for products
        if (saleItem.type === 'product') {
          await Product.findByIdAndUpdate(saleItem.itemId, {
            $inc: { stock: refundItem.quantity },
          });
        }
      }

      // Check if fully refunded
      const fullyRefunded = sale.items.every(
        (item) => (item.refundedQuantity || 0) >= item.quantity
      );
      sale.status = fullyRefunded ? 'refunded' : 'partial_refund';
    } else {
      // Full refund
      refundAmount = sale.finalTotal - (sale.totalRefunded || 0);

      for (let i = 0; i < sale.items.length; i++) {
        const item = sale.items[i];
        const remainingQty = item.quantity - (item.refundedQuantity || 0);
        if (remainingQty > 0) {
          refundedItems.push({
            itemIndex: i,
            name: item.name,
            quantity: remainingQty,
            amount: (item.total / item.quantity) * remainingQty,
          });
          sale.items[i].refundedQuantity = item.quantity;

          // Restore stock for products
          if (item.type === 'product') {
            await Product.findByIdAndUpdate(item.itemId, {
              $inc: { stock: remainingQty },
            });
          }
        }
      }

      sale.status = 'refunded';
    }

    sale.totalRefunded = (sale.totalRefunded || 0) + refundAmount;
    sale.refunds = sale.refunds || [];
    sale.refunds.push({
      amount: refundAmount,
      items: refundedItems,
      reason: data.reason,
      method: data.refundMethod,
      processedAt: new Date(),
      processedBy: new mongoose.Types.ObjectId(req.user!.id),
    });

    await sale.save();

    // Create refund transaction record
    const refundTransaction = new Transaction({
      businessId,
      type: 'refund',
      relatedTransactionId: sale._id,
      clientId: sale.clientId,
      clientInfo: sale.clientInfo,
      items: refundedItems.map((ri) => ({
        ...sale.items[ri.itemIndex],
        quantity: ri.quantity,
        total: ri.amount,
      })),
      refundDetails: {
        originalTransactionId: sale._id,
        refundAmount,
        refundMethod: data.refundMethod,
        reason: data.reason,
      },
      finalTotal: refundAmount,
      status: 'completed',
      processedBy: new mongoose.Types.ObjectId(req.user!.id),
      processedAt: new Date(),
    });

    await refundTransaction.save();

    // Process MercadoPago refund if applicable
    if (data.refundMethod === 'mercadopago' && sale.mercadoPagoPaymentId) {
      try {
        await mercadoPagoService.createRefund(sale.mercadoPagoPaymentId, refundAmount);
      } catch (error) {
        logger.error('MercadoPago refund failed', {
          transactionId: sale._id,
          paymentId: sale.mercadoPagoPaymentId,
          error,
        });
        // Continue anyway - manual reconciliation may be needed
      }
    }

    logger.info('Refund processed', {
      originalTransactionId: sale._id,
      refundTransactionId: refundTransaction._id,
      businessId,
      refundAmount,
      method: data.refundMethod,
    });

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        refundAmount,
        refundedItems,
        originalTransaction: sale,
        refundTransaction,
      },
    });
  })
);

// =====================================================
// QUICK ACTIONS
// =====================================================

// POST /api/v1/manage/pos/quick-sale - Quick sale for walk-in
router.post(
  '/quick-sale',
  requirePermission('pos:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { amount, description, paymentMethod = 'cash' } = req.body;

    if (!amount || amount <= 0) {
      throw new BadRequestError('Valid amount is required');
    }

    const businessId = req.currentBusiness!.businessId;

    // Check cash register for cash payments
    if (paymentMethod === 'cash') {
      const openRegister = await CashRegister.findOne({ businessId, status: 'open' });
      if (!openRegister) {
        throw new BadRequestError('Cash register must be open for cash payments');
      }
    }

    const transaction = new Transaction({
      businessId,
      type: 'sale',
      source: 'pos',
      items: [{
        type: 'service',
        name: description || 'Quick sale',
        quantity: 1,
        unitPrice: amount,
        discount: 0,
        total: amount,
      }],
      pricing: {
        subtotal: amount,
        globalDiscount: 0,
        globalDiscountAmount: 0,
        tip: 0,
        total: amount,
      },
      paymentMethod,
      payments: [{ method: paymentMethod, amount }],
      finalTotal: amount,
      status: 'completed',
      processedBy: new mongoose.Types.ObjectId(req.user!.id),
      processedAt: new Date(),
    });

    await transaction.save();

    logger.info('Quick sale created', {
      transactionId: transaction._id,
      businessId,
      amount,
    });

    res.status(201).json({
      success: true,
      message: 'Quick sale completed',
      data: { transaction },
    });
  })
);

// GET /api/v1/manage/pos/pending-appointments - Get pending appointments for checkout
router.get(
  '/pending-appointments',
  requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointments = await Appointment.find({
      businessId,
      date: today,
      status: 'completed',
      paymentStatus: { $in: ['pending', 'partial'] },
    })
      .populate('clientId', 'profile.firstName profile.lastName')
      .populate('staffId', 'profile.firstName profile.lastName')
      .select('clientInfo services pricing date startTime endTime')
      .sort({ endTime: -1 })
      .lean();

    res.json({
      success: true,
      data: { appointments },
    });
  })
);

// POST /api/v1/manage/pos/checkout-appointment/:id - Checkout an appointment
router.post(
  '/checkout-appointment/:id',
  requirePermission('pos:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { paymentMethod, tip, additionalItems } = req.body;
    const businessId = req.currentBusiness!.businessId;

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      businessId,
      status: 'completed',
      paymentStatus: { $in: ['pending', 'partial'] },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found or already paid');
    }

    // Calculate remaining amount
    const paidAmount = appointment.pricing.depositPaid ? appointment.pricing.deposit : 0;
    const appointmentTotal = appointment.pricing.total;
    let remainingAmount = appointmentTotal - paidAmount;

    // Process additional items (products)
    const items: Array<{
      type: 'service' | 'product';
      itemId?: mongoose.Types.ObjectId;
      name: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      total: number;
      staffId?: mongoose.Types.ObjectId;
    }> = [];

    // Add appointment services
    for (const service of appointment.services) {
      items.push({
        type: 'service',
        itemId: service.serviceId,
        name: service.name,
        quantity: 1,
        unitPrice: service.price,
        discount: service.discount || 0,
        total: service.price - (service.price * (service.discount || 0) / 100),
        staffId: appointment.staffId,
      });
    }

    // Add additional products
    if (additionalItems && additionalItems.length > 0) {
      for (const addItem of additionalItems) {
        const product = await Product.findOne({
          _id: addItem.productId,
          businessId,
          status: 'active',
        });

        if (!product) {
          throw new NotFoundError(`Product not found: ${addItem.productId}`);
        }

        if (product.stock < addItem.quantity) {
          throw new BadRequestError(`Insufficient stock for ${product.name}`);
        }

        const itemTotal = product.price * addItem.quantity;
        items.push({
          type: 'product',
          itemId: product._id,
          name: product.name,
          quantity: addItem.quantity,
          unitPrice: product.price,
          discount: 0,
          total: itemTotal,
        });

        remainingAmount += itemTotal;
        product.stock -= addItem.quantity;
        await product.save();
      }
    }

    const tipAmount = tip || 0;
    const finalTotal = remainingAmount + tipAmount;

    const transaction = new Transaction({
      businessId,
      type: 'sale',
      source: 'appointment',
      appointmentId: appointment._id,
      clientId: appointment.clientId,
      clientInfo: appointment.clientInfo,
      items,
      pricing: {
        subtotal: appointmentTotal + (additionalItems?.reduce((sum: number, ai: { quantity: number; price: number }) => sum + ai.quantity * ai.price, 0) || 0),
        previousPayments: paidAmount,
        tip: tipAmount,
        total: finalTotal,
      },
      paymentMethod,
      payments: [{ method: paymentMethod, amount: finalTotal }],
      finalTotal,
      status: 'completed',
      processedBy: new mongoose.Types.ObjectId(req.user!.id),
      processedAt: new Date(),
    });

    await transaction.save();

    // Update appointment
    appointment.paymentStatus = 'paid';
    appointment.pricing.tip = tipAmount;
    appointment.pricing.finalTotal = appointment.pricing.total + tipAmount;
    await appointment.save();

    logger.info('Appointment checkout completed', {
      appointmentId: appointment._id,
      transactionId: transaction._id,
      businessId,
      total: finalTotal,
    });

    res.json({
      success: true,
      message: 'Checkout completed successfully',
      data: { transaction },
    });
  })
);

// GET /api/v1/manage/pos/daily-summary - Get daily POS summary
router.get(
  '/daily-summary',
  requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { date } = req.query as { date?: string };

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const [salesByMethod, salesByType, topProducts, topServices, hourlyBreakdown] = await Promise.all([
      // Sales by payment method
      Transaction.aggregate([
        {
          $match: {
            businessId: new mongoose.Types.ObjectId(businessId),
            type: 'sale',
            status: { $in: ['completed', 'partial_refund'] },
            processedAt: { $gte: targetDate, $lt: nextDay },
          },
        },
        {
          $group: {
            _id: '$paymentMethod',
            total: { $sum: '$finalTotal' },
            count: { $sum: 1 },
          },
        },
      ]),

      // Sales by type (service vs product)
      Transaction.aggregate([
        {
          $match: {
            businessId: new mongoose.Types.ObjectId(businessId),
            type: 'sale',
            status: { $in: ['completed', 'partial_refund'] },
            processedAt: { $gte: targetDate, $lt: nextDay },
          },
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.type',
            total: { $sum: '$items.total' },
            count: { $sum: '$items.quantity' },
          },
        },
      ]),

      // Top products
      Transaction.aggregate([
        {
          $match: {
            businessId: new mongoose.Types.ObjectId(businessId),
            type: 'sale',
            status: { $in: ['completed', 'partial_refund'] },
            processedAt: { $gte: targetDate, $lt: nextDay },
          },
        },
        { $unwind: '$items' },
        { $match: { 'items.type': 'product' } },
        {
          $group: {
            _id: '$items.name',
            quantity: { $sum: '$items.quantity' },
            revenue: { $sum: '$items.total' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),

      // Top services
      Transaction.aggregate([
        {
          $match: {
            businessId: new mongoose.Types.ObjectId(businessId),
            type: 'sale',
            status: { $in: ['completed', 'partial_refund'] },
            processedAt: { $gte: targetDate, $lt: nextDay },
          },
        },
        { $unwind: '$items' },
        { $match: { 'items.type': 'service' } },
        {
          $group: {
            _id: '$items.name',
            quantity: { $sum: '$items.quantity' },
            revenue: { $sum: '$items.total' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),

      // Hourly breakdown
      Transaction.aggregate([
        {
          $match: {
            businessId: new mongoose.Types.ObjectId(businessId),
            type: 'sale',
            status: { $in: ['completed', 'partial_refund'] },
            processedAt: { $gte: targetDate, $lt: nextDay },
          },
        },
        {
          $group: {
            _id: { $hour: '$processedAt' },
            total: { $sum: '$finalTotal' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id': 1 } },
      ]),
    ]);

    // Calculate totals
    const totalSales = salesByMethod.reduce((sum, s) => sum + s.total, 0);
    const totalTransactions = salesByMethod.reduce((sum, s) => sum + s.count, 0);

    // Get refunds
    const refunds = await Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          type: 'refund',
          status: 'completed',
          processedAt: { $gte: targetDate, $lt: nextDay },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$finalTotal' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        date: targetDate.toISOString().split('T')[0],
        overview: {
          totalSales,
          totalTransactions,
          averageTicket: totalTransactions > 0 ? totalSales / totalTransactions : 0,
          refunds: refunds[0] || { total: 0, count: 0 },
          netSales: totalSales - (refunds[0]?.total || 0),
        },
        byPaymentMethod: Object.fromEntries(
          salesByMethod.map((s) => [s._id, { total: s.total, count: s.count }])
        ),
        byType: Object.fromEntries(
          salesByType.map((s) => [s._id, { total: s.total, count: s.count }])
        ),
        topProducts: topProducts.map((p) => ({
          name: p._id,
          quantity: p.quantity,
          revenue: p.revenue,
        })),
        topServices: topServices.map((s) => ({
          name: s._id,
          quantity: s.quantity,
          revenue: s.revenue,
        })),
        hourlyBreakdown: hourlyBreakdown.map((h) => ({
          hour: `${h._id.toString().padStart(2, '0')}:00`,
          total: h.total,
          count: h.count,
        })),
      },
    });
  })
);

export default router;
