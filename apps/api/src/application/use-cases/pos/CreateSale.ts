import mongoose from 'mongoose';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { Product } from '../../../infrastructure/database/mongodb/models/Product.js';
import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { CashRegister } from '../../../infrastructure/database/mongodb/models/CashRegister.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface CreateSaleItem {
  type: 'service' | 'product';
  itemId: string;
  quantity: number;
  price?: number;
  discount?: number;
  staffId?: string;
}

export interface CreateSalePayment {
  method: 'cash' | 'card' | 'transfer' | 'mercadopago';
  amount: number;
  reference?: string;
}

export interface CreateSaleInput {
  businessId: string;
  userId: string;
  items: CreateSaleItem[];
  clientId?: string;
  clientInfo?: {
    name: string;
    phone?: string;
    email?: string;
  };
  appointmentId?: string;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'mercadopago' | 'mixed';
  payments?: CreateSalePayment[];
  tip?: number;
  globalDiscount?: number;
  notes?: string;
}

export interface CreateSaleResult {
  transaction: any;
}

export async function createSale(input: CreateSaleInput): Promise<CreateSaleResult> {
  const {
    businessId,
    userId,
    items,
    clientId,
    clientInfo,
    appointmentId,
    paymentMethod,
    payments,
    tip: inputTip,
    globalDiscount,
    notes,
  } = input;

  // Check cash register is open for cash payments
  if (paymentMethod === 'cash' || payments?.some((p) => p.method === 'cash')) {
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

  for (const item of items) {
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
  const globalDiscountAmount = globalDiscount ? subtotal * (globalDiscount / 100) : 0;
  const afterDiscount = subtotal - globalDiscountAmount;
  const tip = inputTip || 0;
  const finalTotal = afterDiscount + tip;

  // Validate payments for mixed payment
  if (paymentMethod === 'mixed') {
    if (!payments || payments.length < 2) {
      throw new BadRequestError('Mixed payment requires at least 2 payment methods');
    }
    const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(paymentsTotal - finalTotal) > 0.01) {
      throw new BadRequestError(`Payment total (${paymentsTotal}) doesn't match sale total (${finalTotal})`);
    }
  }

  // Create transaction
  const transaction = new Transaction({
    businessId,
    type: 'sale',
    source: appointmentId ? 'appointment' : 'pos',
    appointmentId,
    clientId,
    clientInfo,
    items: processedItems,
    pricing: {
      subtotal,
      globalDiscount: globalDiscount || 0,
      globalDiscountAmount,
      tip,
      total: finalTotal,
    },
    paymentMethod,
    payments: payments || [{
      method: paymentMethod as 'cash' | 'card' | 'transfer' | 'mercadopago',
      amount: finalTotal,
    }],
    finalTotal,
    status: 'completed',
    notes,
    processedBy: new mongoose.Types.ObjectId(userId),
    processedAt: new Date(),
  });

  await transaction.save();

  // Update appointment if linked
  if (appointmentId) {
    await Appointment.findByIdAndUpdate(appointmentId, {
      'payment.status': 'paid',
      'payment.paidAt': new Date(),
      'payment.paidAmount': finalTotal,
      'payment.transactionId': transaction._id.toString(),
    });
  }

  logger.info('POS sale created', {
    transactionId: transaction._id,
    businessId,
    items: processedItems.length,
    total: finalTotal,
  });

  return { transaction };
}
