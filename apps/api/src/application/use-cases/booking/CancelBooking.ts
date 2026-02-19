import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { User } from '../../../infrastructure/database/mongodb/models/User.js';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { notificationService } from '../../../domain/services/NotificationService.js';
import { logger } from '../../../utils/logger.js';

export interface CancelBookingInput {
  appointmentId: string;
  userId: string;
  reason?: string;
}

export interface CancelBookingResult {
  appointment: any;
  refundAmount: number;
  penaltyApplied: boolean;
}

/**
 * Cancels an existing booking, applying the business's cancellation
 * policy (penalty window, refund calculation), updating stats, and
 * sending cancellation notifications.
 */
export async function cancelBooking(input: CancelBookingInput): Promise<CancelBookingResult> {
  const { appointmentId, userId, reason } = input;

  const appointment = await Appointment.findOne({
    _id: appointmentId,
    clientId: userId,
    status: { $in: ['pending', 'confirmed'] },
  }).populate('businessId');

  if (!appointment) {
    throw new NotFoundError('Booking not found or cannot be cancelled');
  }

  const business = appointment.businessId as unknown as typeof Business.prototype;

  // Cancellation policy enforcement
  let refundAmount = 0;
  let penaltyApplied = false;

  if (business?.bookingConfig?.cancellationPolicy?.allowCancellation) {
    const hoursUntilAppointment =
      (appointment.startDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilAppointment < business.bookingConfig.cancellationPolicy.hoursBeforeAppointment) {
      if (appointment.pricing.depositPaid) {
        const policy = business.bookingConfig.cancellationPolicy;
        let penaltyTotal = 0;

        if (policy.penaltyType === 'percentage') {
          penaltyTotal = (appointment.pricing.deposit * (policy.penaltyAmount || 100)) / 100;
        } else if (policy.penaltyType === 'fixed') {
          penaltyTotal = Math.min(policy.penaltyAmount || 0, appointment.pricing.deposit);
        }
        // penaltyType === 'none' → penaltyTotal stays 0

        refundAmount = appointment.pricing.deposit - penaltyTotal;
        penaltyApplied = penaltyTotal > 0;
      }
    } else {
      refundAmount = appointment.pricing.deposit;
    }
  }

  appointment.status = 'cancelled';
  appointment.cancellation = {
    cancelledAt: new Date(),
    cancelledBy: 'client',
    reason,
    refunded: refundAmount > 0,
    refundAmount,
  };
  await appointment.save();

  // Update stats
  await User.findByIdAndUpdate(userId, {
    $inc: { 'stats.cancelledAppointments': 1 },
  });

  // Cancel reminders & notify
  await notificationService.cancelReminders(appointmentId);

  await notificationService.sendBookingCancellation({
    userId,
    businessId: appointment.businessId._id?.toString() || appointment.businessId.toString(),
    appointmentId,
    reason,
    cancelledBy: 'client',
  });

  logger.info('Booking cancelled', { appointmentId, userId, reason, penaltyApplied });

  return { appointment, refundAmount, penaltyApplied };
}
