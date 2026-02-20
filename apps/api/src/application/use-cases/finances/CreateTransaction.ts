import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export const EXPENSE_CATEGORIES = [
  'salarios',
  'alquiler',
  'servicios',
  'productos',
  'equipamiento',
  'marketing',
  'impuestos',
  'mantenimiento',
  'otros',
];

export interface CreateTransactionInput {
  businessId: string;
  userId: string;
  type: string;
  category?: string;
  amount: number;
  notes?: string;
  appointmentId?: string;
  paymentMethod?: string;
  source?: string;
}

export interface CreateTransactionResult {
  transaction: any;
}

export async function createTransaction(input: CreateTransactionInput): Promise<CreateTransactionResult> {
  const { businessId, userId, type, category, amount, notes, appointmentId, paymentMethod, source } = input;

  // Validate category based on type
  if (type === 'expense' && category && !EXPENSE_CATEGORIES.includes(category)) {
    throw new BadRequestError(`Invalid expense category. Valid categories: ${EXPENSE_CATEGORIES.join(', ')}`);
  }

  // Validate appointment exists if provided
  if (appointmentId) {
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      businessId,
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }
  }

  const transaction = new Transaction({
    businessId,
    type,
    source: source || 'manual',
    amount,
    finalTotal: amount,
    currency: 'ARS',
    notes,
    appointmentId,
    paymentMethod: paymentMethod || 'cash',
    items: [],
    payments: paymentMethod ? [{ method: paymentMethod, amount, processedAt: new Date() }] : [],
    totalRefunded: 0,
    refunds: [],
    status: 'completed',
    processedBy: userId,
    processedAt: new Date(),
    ...(type === 'expense' && category ? { expense: { category } } : {}),
  });

  await transaction.save();

  logger.info('Transaction created', {
    transactionId: transaction._id,
    businessId,
    type,
    amount,
  });

  return { transaction };
}
