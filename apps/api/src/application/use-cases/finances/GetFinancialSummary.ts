import mongoose from 'mongoose';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { logger } from '../../../utils/logger.js';

export interface GetFinancialSummaryInput {
  businessId: string;
  period?: string;
}

export interface GetFinancialSummaryResult {
  period: string;
  startDate: Date;
  endDate: Date;
  summary: {
    income: { current: number; previous: number; change: number };
    expenses: { current: number; previous: number; change: number };
    profit: { current: number; previous: number; change: number };
    refunds: number;
  };
  appointments: {
    revenue: number;
    count: number;
    tips: number;
    averageTicket: number;
  };
  pending: {
    deposits: number;
    count: number;
  };
}

export async function getFinancialSummary(input: GetFinancialSummaryInput): Promise<GetFinancialSummaryResult> {
  const { businessId, period = 'month' } = input;

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
    case 'quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      previousStartDate = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
      previousEndDate = new Date(now.getFullYear(), quarter * 3, 0);
      break;
    }
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

  logger.debug('Financial summary generated', { businessId, period });

  return {
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
  };
}
