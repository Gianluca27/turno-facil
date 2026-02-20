import mongoose from 'mongoose';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { CashRegister } from '../../../infrastructure/database/mongodb/models/CashRegister.js';
import { BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface QuickSaleInput {
  businessId: string;
  userId: string;
  amount: number;
  description?: string;
  paymentMethod?: string;
}

export interface QuickSaleResult {
  transaction: any;
}

export async function quickSale(input: QuickSaleInput): Promise<QuickSaleResult> {
  const { businessId, userId, amount, description, paymentMethod = 'cash' } = input;

  if (!amount || amount <= 0) {
    throw new BadRequestError('Valid amount is required');
  }

  // Check cash register for cash payments
  if (paymentMethod === 'cash') {
    const openRegister = await CashRegister.findOne({ businessId, status: 'open' });
    if (!openRegister) {
      throw new BadRequestError('Cash register must be open for cash payments');
    }
  }

  const transaction = new Transaction({
    businessId,
    type: 'sale',
    source: 'pos',
    items: [{
      type: 'service',
      name: description || 'Quick sale',
      quantity: 1,
      unitPrice: amount,
      discount: 0,
      total: amount,
    }],
    pricing: {
      subtotal: amount,
      globalDiscount: 0,
      globalDiscountAmount: 0,
      tip: 0,
      total: amount,
    },
    paymentMethod,
    payments: [{ method: paymentMethod, amount }],
    finalTotal: amount,
    status: 'completed',
    processedBy: new mongoose.Types.ObjectId(userId),
    processedAt: new Date(),
  });

  await transaction.save();

  logger.info('Quick sale created', {
    transactionId: transaction._id,
    businessId,
    amount,
  });

  return { transaction };
}
