import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface UpdateTransactionInput {
  transactionId: string;
  businessId: string;
  expenseCategory?: string;
  notes?: string;
  paymentMethod?: string;
}

export interface UpdateTransactionResult {
  transaction: any;
}

export async function updateTransaction(input: UpdateTransactionInput): Promise<UpdateTransactionResult> {
  const { transactionId, businessId, expenseCategory, notes, paymentMethod } = input;

  const transaction = await Transaction.findOne({
    _id: transactionId,
    businessId,
  });

  if (!transaction) {
    throw new NotFoundError('Transaction not found');
  }

  // Only allow updating certain fields
  if (expenseCategory && transaction.type === 'expense') {
    if (!transaction.expense) {
      transaction.expense = { category: expenseCategory, description: notes || '' };
    } else {
      transaction.expense.category = expenseCategory;
    }
  }
  if (notes !== undefined) transaction.notes = notes;
  if (paymentMethod) transaction.paymentMethod = paymentMethod as any;

  await transaction.save();

  logger.info('Transaction updated', {
    transactionId: transaction._id,
    businessId,
  });

  return { transaction };
}
