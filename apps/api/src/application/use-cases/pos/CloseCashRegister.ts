import mongoose from 'mongoose';
import { CashRegister } from '../../../infrastructure/database/mongodb/models/CashRegister.js';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface CloseCashRegisterInput {
  businessId: string;
  userId: string;
  finalAmount: number;
  notes?: string;
}

export interface CloseCashRegisterResult {
  register: any;
  summary: {
    initialAmount: number;
    expectedAmount: number;
    finalAmount: number;
    difference: number;
    movements: {
      in: number;
      out: number;
    };
    salesByMethod: Record<string, { total: number; count: number }>;
  };
}

export async function closeCashRegister(input: CloseCashRegisterInput): Promise<CloseCashRegisterResult> {
  const { businessId, userId, finalAmount, notes } = input;

  const register = await CashRegister.findOne({
    businessId,
    status: 'open',
  });

  if (!register) {
    throw new NotFoundError('No open cash register found');
  }

  // Calculate expected amount
  const movements = register.movements || [];
  const cashIn = movements
    .filter((m) => m.type === 'in')
    .reduce((sum, m) => sum + m.amount, 0);
  const cashOut = movements
    .filter((m) => m.type === 'out')
    .reduce((sum, m) => sum + m.amount, 0);

  // Get cash sales
  const cashSales = await Transaction.aggregate([
    {
      $match: {
        businessId: new mongoose.Types.ObjectId(businessId),
        createdAt: { $gte: register.openedAt },
        type: 'sale',
        status: { $in: ['completed', 'partial_refund'] },
        $or: [
          { paymentMethod: 'cash' },
          { 'payments.method': 'cash' },
        ],
      },
    },
    {
      $unwind: { path: '$payments', preserveNullAndEmptyArrays: true },
    },
    {
      $group: {
        _id: null,
        cashTotal: {
          $sum: {
            $cond: [
              { $eq: ['$payments.method', 'cash'] },
              '$payments.amount',
              { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$finalTotal', 0] },
            ],
          },
        },
      },
    },
  ]);

  const cashSalesTotal = cashSales[0]?.cashTotal || 0;

  // Get cash refunds
  const cashRefunds = await Transaction.aggregate([
    {
      $match: {
        businessId: new mongoose.Types.ObjectId(businessId),
        createdAt: { $gte: register.openedAt },
        type: 'refund',
        status: 'completed',
        'refundDetails.refundMethod': 'cash',
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$refundDetails.refundAmount' },
      },
    },
  ]);

  const cashRefundsTotal = cashRefunds[0]?.total || 0;

  const expectedAmount = register.initialAmount + cashIn - cashOut + cashSalesTotal - cashRefundsTotal;
  const difference = finalAmount - expectedAmount;

  register.status = 'closed';
  register.closedAt = new Date();
  register.closedBy = new mongoose.Types.ObjectId(userId);
  register.finalAmount = finalAmount;
  register.expectedAmount = expectedAmount;
  register.difference = difference;
  register.closingNotes = notes;

  await register.save();

  // Generate summary
  const salesSummary = await Transaction.aggregate([
    {
      $match: {
        businessId: new mongoose.Types.ObjectId(businessId),
        createdAt: { $gte: register.openedAt, $lte: register.closedAt },
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

  logger.info('Cash register closed', {
    registerId: register._id,
    businessId,
    expectedAmount,
    finalAmount,
    difference,
  });

  return {
    register,
    summary: {
      initialAmount: register.initialAmount,
      expectedAmount,
      finalAmount,
      difference,
      movements: {
        in: cashIn,
        out: cashOut,
      },
      salesByMethod: Object.fromEntries(
        salesSummary.map((s) => [s._id, { total: s.total, count: s.count }])
      ),
    },
  };
}
