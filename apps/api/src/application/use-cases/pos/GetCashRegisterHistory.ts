import { CashRegister } from '../../../infrastructure/database/mongodb/models/CashRegister.js';

export interface GetCashRegisterHistoryInput {
  businessId: string;
  startDate?: string;
  endDate?: string;
  page?: string;
  limit?: string;
}

export interface GetCashRegisterHistoryResult {
  registers: Record<string, unknown>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function getCashRegisterHistory(input: GetCashRegisterHistoryInput): Promise<GetCashRegisterHistoryResult> {
  const { businessId, startDate, endDate, page = '1', limit = '20' } = input;

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

  return {
    registers,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
}
