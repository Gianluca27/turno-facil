import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';

export interface GetTransactionInput {
  transactionId: string;
  businessId: string;
}

export interface GetTransactionResult {
  transaction: any;
}

export async function getTransaction(input: GetTransactionInput): Promise<GetTransactionResult> {
  const { transactionId, businessId } = input;

  const transaction = await Transaction.findOne({
    _id: transactionId,
    businessId,
  })
    .populate('appointmentId')
    .populate('processedBy', 'profile.firstName profile.lastName email');

  if (!transaction) {
    throw new NotFoundError('Transaction not found');
  }

  return { transaction };
}
