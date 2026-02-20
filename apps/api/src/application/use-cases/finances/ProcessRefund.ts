import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface ProcessRefundInput {
  businessId: string;
  userId: string;
  appointmentId: string;
  amount: number;
  reason?: string;
}

export interface ProcessRefundResult {
  refund: any;
  appointment: any;
}

export async function processRefund(input: ProcessRefundInput): Promise<ProcessRefundResult> {
  const { businessId, userId, appointmentId, amount, reason } = input;

  const appointment = await Appointment.findOne({
    _id: appointmentId,
    businessId,
  });

  if (!appointment) {
    throw new NotFoundError('Appointment not found');
  }

  if (!amount || amount <= 0) {
    throw new BadRequestError('Valid refund amount is required');
  }

  if (amount > appointment.pricing.finalTotal) {
    throw new BadRequestError('Refund amount cannot exceed the total paid');
  }

  // Create refund transaction
  const refundTransaction = new Transaction({
    businessId,
    type: 'refund',
    source: 'appointment',
    amount,
    finalTotal: amount,
    currency: 'ARS',
    notes: reason || `Reembolso para turno #${appointment._id}`,
    appointmentId: appointment._id,
    paymentMethod: 'transfer',
    items: [],
    payments: [{ method: 'transfer', amount, processedAt: new Date() }],
    totalRefunded: 0,
    refunds: [],
    status: 'completed',
    processedAt: new Date(),
    processedBy: userId,
  });

  await refundTransaction.save();

  // Update appointment
  if (!appointment.cancellation) {
    appointment.cancellation = {
      cancelledAt: new Date(),
      cancelledBy: 'business',
      reason: reason || 'Refund processed',
      refunded: true,
      refundAmount: amount,
    };
  } else {
    appointment.cancellation.refunded = true;
    appointment.cancellation.refundAmount = (appointment.cancellation.refundAmount || 0) + amount;
  }

  await appointment.save();

  logger.info('Refund processed', {
    appointmentId: appointment._id,
    businessId,
    amount,
    transactionId: refundTransaction._id,
  });

  return {
    refund: refundTransaction,
    appointment,
  };
}
