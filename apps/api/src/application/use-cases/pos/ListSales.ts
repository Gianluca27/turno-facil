import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';

export interface ListSalesInput {
  businessId: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  source?: string;
  page?: string;
  limit?: string;
}

export interface ListSalesResult {
  sales: Record<string, unknown>[];
  summary: {
    totalSales: number;
    totalTips: number;
    count: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function listSales(input: ListSalesInput): Promise<ListSalesResult> {
  const {
    businessId,
    startDate,
    endDate,
    paymentMethod,
    source,
    page = '1',
    limit = '20',
  } = input;

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

  return {
    sales,
    summary: summary[0] || { totalSales: 0, totalTips: 0, count: 0 },
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
}
