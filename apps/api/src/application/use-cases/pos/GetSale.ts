import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';

export interface GetSaleInput {
  businessId: string;
  saleId: string;
}

export interface GetSaleResult {
  sale: any;
}

export async function getSale(input: GetSaleInput): Promise<GetSaleResult> {
  const { businessId, saleId } = input;

  const sale = await Transaction.findOne({
    _id: saleId,
    businessId,
    type: 'sale',
  })
    .populate('clientId', 'profile email phone')
    .populate('processedBy', 'profile')
    .populate('appointmentId');

  if (!sale) {
    throw new NotFoundError('Sale not found');
  }

  return { sale };
}
