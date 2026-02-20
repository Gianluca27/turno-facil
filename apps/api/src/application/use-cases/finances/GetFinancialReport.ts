import mongoose from 'mongoose';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { logger } from '../../../utils/logger.js';

export interface GetFinancialReportInput {
  businessId: string;
  startDate: string;
  endDate: string;
}

export interface GetFinancialReportResult {
  period: { startDate: string; endDate: string };
  totals: {
    income: number;
    expenses: number;
    profit: number;
    margin: number;
  };
  incomeByType: Array<{ _id: string; total: number; count: number }>;
  expensesByCategory: Array<{ _id: string; total: number; count: number }>;
  paymentMethods: Array<{ _id: string; total: number; count: number }>;
  dailyBreakdown: Array<{ date: string; income: number; expenses: number; profit: number }>;
  appointments: {
    totalRevenue: number;
    totalTips: number;
    totalDeposits: number;
    count: number;
  };
}

export async function getFinancialReport(input: GetFinancialReportInput): Promise<GetFinancialReportResult> {
  const { businessId, startDate, endDate } = input;

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

  logger.debug('Financial report generated', { businessId, startDate, endDate });

  return {
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
  };
}
