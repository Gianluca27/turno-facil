import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Review } from '../../../infrastructure/database/mongodb/models/Review.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { notificationService } from '../../../domain/services/NotificationService.js';
import { logger } from '../../../utils/logger.js';

export interface RequestReviewInput {
  businessId: string;
  appointmentId: string;
}

/**
 * Sends a review request notification to the client of a completed
 * appointment. Validates the appointment is completed and that no
 * review already exists.
 */
export async function requestReview(input: RequestReviewInput): Promise<void> {
  const { businessId, appointmentId } = input;

  if (!appointmentId) {
    throw new BadRequestError('Appointment ID is required');
  }

  const appointment = await Appointment.findOne({
    _id: appointmentId,
    businessId,
    status: 'completed',
  });

  if (!appointment) {
    throw new NotFoundError('Completed appointment not found');
  }

  // Check if review already exists
  const existingReview = await Review.findOne({
    appointmentId,
    businessId,
  });

  if (existingReview) {
    throw new BadRequestError('A review already exists for this appointment');
  }

  if (!appointment.clientId) {
    throw new BadRequestError('Appointment has no associated client');
  }

  // Send review request notification
  await notificationService.sendNotification({
    userId: appointment.clientId.toString(),
    type: 'review_request',
    channels: ['push', 'email'],
    businessId,
    appointmentId,
    data: {
      serviceName: appointment.services[0]?.name || 'servicio',
    },
  });

  logger.info('Review request sent', {
    appointmentId,
    businessId,
    clientId: appointment.clientId,
  });
}
