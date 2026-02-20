import { Router, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import {
  getFinancialSummary,
  listTransactions,
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  getFinancialReport,
  getCashFlow,
  processRefund,
  getCategories,
} from '../../../application/use-cases/finances/index.js';

const router = Router();

// Validation schemas
const createTransactionSchema = z.object({
  type: z.enum(['payment', 'sale', 'refund', 'deposit', 'tip', 'expense']),
  category: z.string().min(1).max(50).optional(),
  amount: z.number().positive(),
  notes: z.string().max(500).optional(),
  appointmentId: z.string().optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'mercadopago', 'mixed', 'other']).optional(),
  source: z.enum(['appointment', 'pos', 'online', 'manual']).optional(),
});

const updateTransactionSchema = z.object({
  expenseCategory: z.string().min(1).max(50).optional(),
  notes: z.string().max(500).optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'mercadopago', 'mixed', 'other']).optional(),
});

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const refundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().optional(),
});

// GET /api/v1/manage/finances/summary - Get financial summary
router.get(
  '/summary',
  requirePermission('finances:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { period } = req.query as { period?: string };

    const result = await getFinancialSummary({
      businessId: req.currentBusiness!.businessId,
      period,
    });

    res.json({ success: true, data: result });
  })
);

// GET /api/v1/manage/finances/transactions - Get transactions
router.get(
  '/transactions',
  requirePermission('finances:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const {
      type,
      expenseCategory,
      startDate,
      endDate,
      paymentMethod,
      page = '1',
      limit = '20',
      sort,
    } = req.query as Record<string, string>;

    const result = await listTransactions({
      businessId: req.currentBusiness!.businessId,
      type,
      expenseCategory,
      startDate,
      endDate,
      paymentMethod,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort,
    });

    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/finances/transactions - Create transaction
router.post(
  '/transactions',
  requirePermission('finances:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = createTransactionSchema.parse(req.body);

    const result = await createTransaction({
      businessId: req.currentBusiness!.businessId,
      userId: req.user!.id,
      type: data.type,
      category: data.category,
      amount: data.amount,
      notes: data.notes,
      appointmentId: data.appointmentId,
      paymentMethod: data.paymentMethod,
      source: data.source,
    });

    res.status(201).json({ success: true, message: 'Transaction created successfully', data: result });
  })
);

// GET /api/v1/manage/finances/transactions/:id - Get transaction details
router.get(
  '/transactions/:id',
  requirePermission('finances:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await getTransaction({
      transactionId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({ success: true, data: result });
  })
);

// PUT /api/v1/manage/finances/transactions/:id - Update transaction
router.put(
  '/transactions/:id',
  requirePermission('finances:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = updateTransactionSchema.parse(req.body);

    const result = await updateTransaction({
      transactionId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      expenseCategory: data.expenseCategory,
      notes: data.notes,
      paymentMethod: data.paymentMethod,
    });

    res.json({ success: true, message: 'Transaction updated successfully', data: result });
  })
);

// DELETE /api/v1/manage/finances/transactions/:id - Delete transaction
router.delete(
  '/transactions/:id',
  requirePermission('finances:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    await deleteTransaction({
      transactionId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({ success: true, message: 'Transaction deleted successfully' });
  })
);

// GET /api/v1/manage/finances/report - Get financial report
router.get(
  '/report',
  requirePermission('finances:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = dateRangeSchema.parse(req.query);

    const result = await getFinancialReport({
      businessId: req.currentBusiness!.businessId,
      startDate,
      endDate,
    });

    res.json({ success: true, data: result });
  })
);

// GET /api/v1/manage/finances/cash-flow - Get cash flow data
router.get(
  '/cash-flow',
  requirePermission('finances:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { months } = req.query as { months?: string };

    const result = await getCashFlow({
      businessId: req.currentBusiness!.businessId,
      months: months ? parseInt(months, 10) : undefined,
    });

    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/finances/transactions/:id/refund - Process refund
router.post(
  '/transactions/:id/refund',
  requirePermission('finances:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { amount, reason } = refundSchema.parse(req.body);

    const result = await processRefund({
      appointmentId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      amount,
      reason,
      userId: req.user!.id,
    });

    res.json({ success: true, message: 'Refund processed successfully', data: result });
  })
);

// GET /api/v1/manage/finances/categories - Get transaction categories
router.get(
  '/categories',
  requirePermission('finances:read'),
  asyncHandler(async (_req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await getCategories();

    res.json({ success: true, data: result });
  })
);

export default router;
