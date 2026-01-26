import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { asyncHandler, NotFoundError, BadRequestError } from '../../middleware/errorHandler.js';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { logger } from '../../../utils/logger.js';

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

// Expense categories
const EXPENSE_CATEGORIES = [
  'salarios',
  'alquiler',
  'servicios',
  'productos',
  'equipamiento',
  'marketing',
  'impuestos',
  'mantenimiento',
  'otros',
];

// Income categories
const INCOME_CATEGORIES = [
  'servicios',
  'productos',
  'propinas',
  'gift_cards',
  'otros',
];

// GET /api/v1/manage/finances/summary - Get financial summary
router.get(
  '/summary',
  requirePermission('finances:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { period = 'month' } = req.query as { period?: string };
    const businessId = req.currentBusiness!.businessId;

    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;
    let previousEndDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        previousStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
        previousEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        previousStartDate = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
        previousEndDate = new Date(now.getFullYear(), quarter * 3, 0);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
        previousEndDate = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    // Current period aggregation
    const currentPeriod = await Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          createdAt: { $gte: startDate, $lte: now },
          status: { $in: ['completed', 'pending'] },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Previous period aggregation
    const previousPeriod = await Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          createdAt: { $gte: previousStartDate, $lte: previousEndDate },
          status: { $in: ['completed', 'pending'] },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Calculate totals
    const getTotalByType = (data: { _id: string; total: number }[], type: string) =>
      data.find((d) => d._id === type)?.total || 0;

    // Income types: payment, sale, deposit, tip
    const currentIncome = getTotalByType(currentPeriod, 'payment') +
      getTotalByType(currentPeriod, 'sale') +
      getTotalByType(currentPeriod, 'deposit') +
      getTotalByType(currentPeriod, 'tip');
    const currentExpenses = getTotalByType(currentPeriod, 'expense');
    const currentRefunds = getTotalByType(currentPeriod, 'refund');

    const previousIncome = getTotalByType(previousPeriod, 'payment') +
      getTotalByType(previousPeriod, 'sale') +
      getTotalByType(previousPeriod, 'deposit') +
      getTotalByType(previousPeriod, 'tip');
    const previousExpenses = getTotalByType(previousPeriod, 'expense');

    const currentProfit = currentIncome - currentExpenses - currentRefunds;
    const previousProfit = previousIncome - previousExpenses;

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    // Get appointments revenue
    const appointmentsRevenue = await Appointment.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          status: 'completed',
          endDateTime: { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.finalTotal' },
          count: { $sum: 1 },
          tips: { $sum: '$pricing.tip' },
        },
      },
    ]);

    // Get pending payments
    const pendingPayments = await Appointment.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          status: { $in: ['pending', 'confirmed', 'completed'] },
          'pricing.depositPaid': false,
          'pricing.deposit': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.deposit' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        period,
        startDate,
        endDate: now,
        summary: {
          income: {
            current: currentIncome,
            previous: previousIncome,
            change: calculateChange(currentIncome, previousIncome),
          },
          expenses: {
            current: currentExpenses,
            previous: previousExpenses,
            change: calculateChange(currentExpenses, previousExpenses),
          },
          profit: {
            current: currentProfit,
            previous: previousProfit,
            change: calculateChange(currentProfit, previousProfit),
          },
          refunds: currentRefunds,
        },
        appointments: {
          revenue: appointmentsRevenue[0]?.total || 0,
          count: appointmentsRevenue[0]?.count || 0,
          tips: appointmentsRevenue[0]?.tips || 0,
          averageTicket: appointmentsRevenue[0]?.count
            ? Math.round((appointmentsRevenue[0]?.total || 0) / appointmentsRevenue[0].count)
            : 0,
        },
        pending: {
          deposits: pendingPayments[0]?.total || 0,
          count: pendingPayments[0]?.count || 0,
        },
      },
    });
  })
);

// GET /api/v1/manage/finances/transactions - Get transactions
router.get(
  '/transactions',
  requirePermission('finances:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const {
      type,
      expenseCategory,
      startDate,
      endDate,
      paymentMethod,
      page = '1',
      limit = '20',
      sort = '-createdAt',
    } = req.query as Record<string, string>;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const query: Record<string, unknown> = { businessId };

    if (type) {
      query.type = type;
    }

    if (expenseCategory) {
      query['expense.category'] = expenseCategory;
    }

    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        (query.createdAt as Record<string, Date>).$gte = new Date(startDate);
      }
      if (endDate) {
        (query.createdAt as Record<string, Date>).$lte = new Date(endDate + 'T23:59:59');
      }
    }

    const sortOrder = sort.startsWith('-') ? -1 : 1;
    const sortField = sort.replace('-', '');

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('appointmentId', 'clientInfo services startTime date')
        .populate('processedBy', 'profile.firstName profile.lastName')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Transaction.countDocuments(query),
    ]);

    // Calculate totals for the filtered results
    const totals = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]);

    // Income types: payment, sale, deposit, tip
    const incomeTotal = (totals.find((t) => t._id === 'payment')?.total || 0) +
      (totals.find((t) => t._id === 'sale')?.total || 0) +
      (totals.find((t) => t._id === 'deposit')?.total || 0) +
      (totals.find((t) => t._id === 'tip')?.total || 0);

    res.json({
      success: true,
      data: {
        transactions,
        totals: {
          income: incomeTotal,
          expense: totals.find((t) => t._id === 'expense')?.total || 0,
          refund: totals.find((t) => t._id === 'refund')?.total || 0,
        },
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

// POST /api/v1/manage/finances/transactions - Create transaction
router.post(
  '/transactions',
  requirePermission('finances:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = createTransactionSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    // Validate category based on type
    if (data.type === 'expense' && data.category && !EXPENSE_CATEGORIES.includes(data.category)) {
      throw new BadRequestError(`Invalid expense category. Valid categories: ${EXPENSE_CATEGORIES.join(', ')}`);
    }

    // Validate appointment exists if provided
    if (data.appointmentId) {
      const appointment = await Appointment.findOne({
        _id: data.appointmentId,
        businessId,
      });
      if (!appointment) {
        throw new NotFoundError('Appointment not found');
      }
    }

    const transaction = new Transaction({
      businessId,
      type: data.type,
      source: data.source || 'manual',
      amount: data.amount,
      finalTotal: data.amount,
      currency: 'ARS',
      notes: data.notes,
      appointmentId: data.appointmentId,
      paymentMethod: data.paymentMethod || 'cash',
      items: [],
      payments: data.paymentMethod ? [{ method: data.paymentMethod, amount: data.amount, processedAt: new Date() }] : [],
      totalRefunded: 0,
      refunds: [],
      status: 'completed',
      processedBy: req.user!.id,
      processedAt: new Date(),
      ...(data.type === 'expense' && data.category ? { expense: { category: data.category } } : {}),
    });

    await transaction.save();

    logger.info('Transaction created', {
      transactionId: transaction._id,
      businessId,
      type: data.type,
      amount: data.amount,
    });

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: { transaction },
    });
  })
);

// GET /api/v1/manage/finances/transactions/:id - Get transaction details
router.get(
  '/transactions/:id',
  requirePermission('finances:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    })
      .populate('appointmentId')
      .populate('processedBy', 'profile.firstName profile.lastName email');

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    res.json({
      success: true,
      data: { transaction },
    });
  })
);

// PUT /api/v1/manage/finances/transactions/:id - Update transaction
router.put(
  '/transactions/:id',
  requirePermission('finances:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = updateTransactionSchema.parse(req.body);

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Only allow updating certain fields
    if (data.expenseCategory && transaction.type === 'expense') {
      if (!transaction.expense) {
        transaction.expense = { category: data.expenseCategory, description: data.notes || '' };
      } else {
        transaction.expense.category = data.expenseCategory;
      }
    }
    if (data.notes !== undefined) transaction.notes = data.notes;
    if (data.paymentMethod) transaction.paymentMethod = data.paymentMethod;

    await transaction.save();

    logger.info('Transaction updated', {
      transactionId: transaction._id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: { transaction },
    });
  })
);

// DELETE /api/v1/manage/finances/transactions/:id - Delete transaction
router.delete(
  '/transactions/:id',
  requirePermission('finances:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Soft delete by marking as cancelled
    transaction.status = 'cancelled';
    await transaction.save();

    logger.info('Transaction deleted', {
      transactionId: transaction._id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
    });
  })
);

// GET /api/v1/manage/finances/report - Get financial report
router.get(
  '/report',
  requirePermission('finances:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = dateRangeSchema.parse(req.query);
    const businessId = req.currentBusiness!.businessId;

    const start = new Date(startDate);
    const end = new Date(endDate + 'T23:59:59');

    // Income by type (payment, sale, deposit, tip are income types)
    const incomeByType = await Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          type: { $in: ['payment', 'sale', 'deposit', 'tip'] },
          status: 'completed',
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Expenses by category
    const expensesByCategory = await Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          type: 'expense',
          status: 'completed',
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$expense.category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Daily breakdown
    const dailyBreakdown = await Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          status: 'completed',
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    // Transform daily breakdown
    const dailyData: Record<string, { date: string; income: number; expenses: number; profit: number }> = {};
    const incomeTypes = ['payment', 'sale', 'deposit', 'tip'];
    dailyBreakdown.forEach((item) => {
      const date = item._id.date;
      if (!dailyData[date]) {
        dailyData[date] = { date, income: 0, expenses: 0, profit: 0 };
      }
      if (incomeTypes.includes(item._id.type)) {
        dailyData[date].income += item.total;
      } else if (item._id.type === 'expense') {
        dailyData[date].expenses = item.total;
      }
      dailyData[date].profit = dailyData[date].income - dailyData[date].expenses;
    });

    // Payment methods breakdown
    const paymentMethods = await Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          type: { $in: ['payment', 'sale', 'deposit', 'tip'] },
          status: 'completed',
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Appointments revenue
    const appointmentsStats = await Appointment.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          status: 'completed',
          endDateTime: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pricing.finalTotal' },
          totalTips: { $sum: '$pricing.tip' },
          totalDeposits: { $sum: { $cond: ['$pricing.depositPaid', '$pricing.deposit', 0] } },
          count: { $sum: 1 },
        },
      },
    ]);

    // Calculate totals
    const totalIncome = incomeByType.reduce((sum, cat) => sum + cat.total, 0);
    const totalExpenses = expensesByCategory.reduce((sum, cat) => sum + cat.total, 0);

    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        totals: {
          income: totalIncome,
          expenses: totalExpenses,
          profit: totalIncome - totalExpenses,
          margin: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0,
        },
        incomeByType,
        expensesByCategory,
        paymentMethods,
        dailyBreakdown: Object.values(dailyData),
        appointments: appointmentsStats[0] || {
          totalRevenue: 0,
          totalTips: 0,
          totalDeposits: 0,
          count: 0,
        },
      },
    });
  })
);

// GET /api/v1/manage/finances/cash-flow - Get cash flow data
router.get(
  '/cash-flow',
  requirePermission('finances:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { months = '6' } = req.query as { months?: string };
    const businessId = req.currentBusiness!.businessId;
    const monthsNum = Math.min(parseInt(months, 10), 12);

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsNum + 1, 1);

    const cashFlow = await Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          status: 'completed',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Transform to monthly data
    const monthlyData: Record<string, { month: string; income: number; expenses: number; net: number }> = {};

    for (let i = 0; i < monthsNum; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - monthsNum + 1 + i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = {
        month: key,
        income: 0,
        expenses: 0,
        net: 0,
      };
    }

    const incomeTypes = ['payment', 'sale', 'deposit', 'tip'];
    cashFlow.forEach((item) => {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      if (monthlyData[key]) {
        if (incomeTypes.includes(item._id.type)) {
          monthlyData[key].income += item.total;
        } else if (item._id.type === 'expense' || item._id.type === 'refund') {
          monthlyData[key].expenses += item.total;
        }
        monthlyData[key].net = monthlyData[key].income - monthlyData[key].expenses;
      }
    });

    res.json({
      success: true,
      data: {
        months: Object.values(monthlyData),
      },
    });
  })
);

// POST /api/v1/manage/finances/refund/:appointmentId - Process refund
router.post(
  '/refund/:appointmentId',
  requirePermission('finances:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { amount, reason } = req.body;
    const businessId = req.currentBusiness!.businessId;

    const appointment = await Appointment.findOne({
      _id: req.params.appointmentId,
      businessId,
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    if (!amount || amount <= 0) {
      throw new BadRequestError('Valid refund amount is required');
    }

    if (amount > appointment.pricing.finalTotal) {
      throw new BadRequestError('Refund amount cannot exceed the total paid');
    }

    // Create refund transaction
    const refundTransaction = new Transaction({
      businessId,
      type: 'refund',
      source: 'appointment',
      amount,
      finalTotal: amount,
      currency: 'ARS',
      notes: reason || `Reembolso para turno #${appointment._id}`,
      appointmentId: appointment._id,
      paymentMethod: 'transfer',
      items: [],
      payments: [{ method: 'transfer', amount, processedAt: new Date() }],
      totalRefunded: 0,
      refunds: [],
      status: 'completed',
      processedAt: new Date(),
      processedBy: req.user!.id,
    });

    await refundTransaction.save();

    // Update appointment
    if (!appointment.cancellation) {
      appointment.cancellation = {
        cancelledAt: new Date(),
        cancelledBy: 'business',
        reason: reason || 'Refund processed',
        refunded: true,
        refundAmount: amount,
      };
    } else {
      appointment.cancellation.refunded = true;
      appointment.cancellation.refundAmount = (appointment.cancellation.refundAmount || 0) + amount;
    }

    await appointment.save();

    logger.info('Refund processed', {
      appointmentId: appointment._id,
      businessId,
      amount,
      transactionId: refundTransaction._id,
    });

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        refund: refundTransaction,
        appointment,
      },
    });
  })
);

// GET /api/v1/manage/finances/categories - Get transaction categories
router.get(
  '/categories',
  requirePermission('finances:read'),
  asyncHandler(async (_req: BusinessAuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: {
        income: INCOME_CATEGORIES,
        expense: EXPENSE_CATEGORIES,
      },
    });
  })
);

export default router;
