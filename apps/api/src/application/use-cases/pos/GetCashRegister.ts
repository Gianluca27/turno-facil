import mongoose from 'mongoose';
import { CashRegister } from '../../../infrastructure/database/mongodb/models/CashRegister.js';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';

export interface GetCashRegisterInput {
  businessId: string;
}

export interface GetCashRegisterResult {
  isOpen: boolean;
  register: {
    currentCash: number;
    movements: { in: number; out: number };
    sales: Record<string, { total: number; count: number }>;
    [key: string]: unknown;
  } | null;
}

export async function getCashRegister(input: GetCashRegisterInput): Promise<GetCashRegisterResult> {
  const { businessId } = input;

  const currentRegister = await CashRegister.findOne({
    businessId,
    status: 'open',
  })
    .populate('openedBy', 'profile.firstName profile.lastName')
    .lean();

  if (!currentRegister) {
    return {
      isOpen: false,
      register: null,
    };
  }

  // Calculate current totals
  const movements = currentRegister.movements || [];
  const cashIn = movements
    .filter((m) => m.type === 'in')
    .reduce((sum, m) => sum + m.amount, 0);
  const cashOut = movements
    .filter((m) => m.type === 'out')
    .reduce((sum, m) => sum + m.amount, 0);

  // Get sales summary for the session
  const salesSummary = await Transaction.aggregate([
    {
      $match: {
        businessId: new mongoose.Types.ObjectId(businessId),
        createdAt: { $gte: currentRegister.openedAt },
        type: 'sale',
        status: { $in: ['completed', 'partial_refund'] },
      },
    },
    {
      $group: {
        _id: '$paymentMethod',
        total: { $sum: '$finalTotal' },
        count: { $sum: 1 },
      },
    },
  ]);

  const salesByMethod = Object.fromEntries(
    salesSummary.map((s) => [s._id, { total: s.total, count: s.count }])
  ) as Record<string, { total: number; count: number }>;

  return {
    isOpen: true,
    register: {
      ...currentRegister,
      currentCash: currentRegister.initialAmount + cashIn - cashOut + (salesByMethod.cash?.total || 0),
      movements: {
        in: cashIn,
        out: cashOut,
      },
      sales: salesByMethod,
    },
  };
}
