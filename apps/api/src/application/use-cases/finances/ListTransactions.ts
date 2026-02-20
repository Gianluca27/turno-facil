import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { logger } from '../../../utils/logger.js';

export interface ListTransactionsInput {
  businessId: string;
  type?: string;
  expenseCategory?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  page: number;
  limit: number;
  sort?: string;
}

export interface ListTransactionsResult {
  transactions: any[];
  totals: {
    income: number;
    expense: number;
    refund: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function listTransactions(input: ListTransactionsInput): Promise<ListTransactionsResult> {
  const {
    businessId,
    type,
    expenseCategory,
    startDate,
    endDate,
    paymentMethod,
    page,
    limit,
    sort = '-createdAt',
  } = input;

  const pageNum = page;
  const limitNum = Math.min(limit, 100);
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

  logger.debug('Transactions listed', { businessId, total, page: pageNum });

  return {
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
  };
}
