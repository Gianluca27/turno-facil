import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface DeleteTransactionInput {
  transactionId: string;
  businessId: string;
}

export async function deleteTransaction(input: DeleteTransactionInput): Promise<void> {
  const { transactionId, businessId } = input;

  const transaction = await Transaction.findOne({
    _id: transactionId,
    businessId,
  });

  if (!transaction) {
    throw new NotFoundError('Transaction not found');
  }

  // Soft delete by marking as cancelled
  transaction.status = 'cancelled';
  await transaction.save();

  logger.info('Transaction deleted', {
    transactionId: transaction._id,
    businessId,
  });
}
