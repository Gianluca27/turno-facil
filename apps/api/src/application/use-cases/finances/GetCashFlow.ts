import mongoose from 'mongoose';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { logger } from '../../../utils/logger.js';

export interface GetCashFlowInput {
  businessId: string;
  months?: number;
}

export interface GetCashFlowResult {
  months: Array<{ month: string; income: number; expenses: number; net: number }>;
}

export async function getCashFlow(input: GetCashFlowInput): Promise<GetCashFlowResult> {
  const { businessId, months = 6 } = input;
  const monthsNum = Math.min(months, 12);

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

  logger.debug('Cash flow generated', { businessId, months: monthsNum });

  return {
    months: Object.values(monthlyData),
  };
}
