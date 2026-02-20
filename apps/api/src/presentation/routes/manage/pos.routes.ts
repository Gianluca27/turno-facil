import { Router, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import {
  getCashRegister,
  openCashRegister,
  closeCashRegister,
  cashMovement,
  getCashRegisterHistory,
  listPosProducts,
  listPosServices,
  createSale,
  listSales,
  getSale,
  refundSale,
  quickSale,
  getPendingAppointments,
  checkoutAppointment,
  getDailySummary,
} from '../../../application/use-cases/pos/index.js';

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
  price: z.number().min(0).optional(),
  discount: z.number().min(0).max(100).optional(),
  staffId: z.string().optional(),
});

const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  clientId: z.string().optional(),
  clientInfo: z.object({
    name: z.string().min(1).max(100),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }).optional(),
  appointmentId: z.string().optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'mercadopago', 'mixed']),
  payments: z.array(z.object({
    method: z.enum(['cash', 'card', 'transfer', 'mercadopago']),
    amount: z.number().positive(),
    reference: z.string().optional(),
  })).optional(),
  tip: z.number().min(0).optional(),
  globalDiscount: z.number().min(0).max(100).optional(),
  notes: z.string().max(500).optional(),
});

const refundSchema = z.object({
  items: z.array(z.object({
    itemIndex: z.number().int().min(0),
    quantity: z.number().positive(),
  })).optional(),
  reason: z.string().min(1).max(500),
  refundMethod: z.enum(['cash', 'card', 'mercadopago', 'store_credit']),
});

// Cash register routes

router.get('/cash-register', requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await getCashRegister({ businessId: req.currentBusiness!.businessId });
    res.json({ success: true, data: result });
  })
);

router.post('/cash-register/open', requirePermission('pos:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = openCashRegisterSchema.parse(req.body);
    const result = await openCashRegister({
      businessId: req.currentBusiness!.businessId, userId: req.user!.id,
      initialAmount: data.initialAmount, notes: data.notes,
    });
    res.status(201).json({ success: true, message: 'Cash register opened successfully', data: result });
  })
);

router.post('/cash-register/close', requirePermission('pos:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = closeCashRegisterSchema.parse(req.body);
    const result = await closeCashRegister({
      businessId: req.currentBusiness!.businessId, userId: req.user!.id,
      finalAmount: data.finalAmount, notes: data.notes,
    });
    res.json({ success: true, message: 'Cash register closed successfully', data: result });
  })
);

router.post('/cash-register/movement', requirePermission('pos:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = cashMovementSchema.parse(req.body);
    const result = await cashMovement({
      businessId: req.currentBusiness!.businessId, userId: req.user!.id,
      type: data.type, amount: data.amount, reason: data.reason, notes: data.notes,
    });
    res.json({ success: true, message: `Cash ${data.type === 'in' ? 'deposit' : 'withdrawal'} recorded`, data: result });
  })
);

router.get('/cash-register/history', requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { startDate, endDate, page = '1', limit = '20' } = req.query as Record<string, string>;
    const result = await getCashRegisterHistory({
      businessId: req.currentBusiness!.businessId,
      startDate, endDate,
      page: parseInt(page, 10), limit: Math.min(parseInt(limit, 10), 50),
    });
    res.json({ success: true, data: result });
  })
);

// Product & service routes

router.get('/products', requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { category, search } = req.query as Record<string, string>;
    const result = await listPosProducts({ businessId: req.currentBusiness!.businessId, category, search });
    res.json({ success: true, data: result });
  })
);

router.get('/services', requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { categoryId, search } = req.query as Record<string, string>;
    const result = await listPosServices({ businessId: req.currentBusiness!.businessId, categoryId, search });
    res.json({ success: true, data: result });
  })
);

// Sales routes

router.post('/sales', requirePermission('pos:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = createSaleSchema.parse(req.body);
    const result = await createSale({ businessId: req.currentBusiness!.businessId, userId: req.user!.id, ...data });
    res.status(201).json({ success: true, message: 'Sale completed successfully', data: result });
  })
);

router.get('/sales', requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { startDate, endDate, paymentMethod, source, page = '1', limit = '20' } = req.query as Record<string, string>;
    const result = await listSales({
      businessId: req.currentBusiness!.businessId,
      startDate, endDate, paymentMethod, source,
      page: parseInt(page, 10), limit: Math.min(parseInt(limit, 10), 50),
    });
    res.json({ success: true, data: result });
  })
);

router.get('/sales/:id', requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await getSale({ saleId: req.params.id, businessId: req.currentBusiness!.businessId });
    res.json({ success: true, data: result });
  })
);

router.post('/sales/:id/refund', requirePermission('pos:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = refundSchema.parse(req.body);
    const result = await refundSale({
      saleId: req.params.id, businessId: req.currentBusiness!.businessId, userId: req.user!.id,
      items: data.items, reason: data.reason, refundMethod: data.refundMethod,
    });
    res.json({ success: true, message: 'Refund processed successfully', data: result });
  })
);

// Quick action routes

router.post('/quick-sale', requirePermission('pos:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { amount, description, paymentMethod } = req.body;
    const result = await quickSale({
      businessId: req.currentBusiness!.businessId, userId: req.user!.id,
      amount, description, paymentMethod,
    });
    res.status(201).json({ success: true, message: 'Quick sale completed', data: result });
  })
);

router.get('/pending-appointments', requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await getPendingAppointments({ businessId: req.currentBusiness!.businessId });
    res.json({ success: true, data: result });
  })
);

router.post('/checkout-appointment/:id', requirePermission('pos:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { paymentMethod, tip, additionalItems } = req.body;
    const result = await checkoutAppointment({
      appointmentId: req.params.id, businessId: req.currentBusiness!.businessId, userId: req.user!.id,
      paymentMethod, tip, additionalItems,
    });
    res.json({ success: true, message: 'Checkout completed successfully', data: result });
  })
);

// Daily summary route

router.get('/daily-summary', requirePermission('pos:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { date } = req.query as { date?: string };
    const result = await getDailySummary({ businessId: req.currentBusiness!.businessId, date });
    res.json({ success: true, data: result });
  })
);

export default router;
