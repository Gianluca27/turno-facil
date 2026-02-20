import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

type AppointmentAction = 'confirm' | 'check-in' | 'start' | 'complete' | 'cancel' | 'no-show';

interface StatusTransition {
  fromStatuses: string[];
  toStatus: string;
  errorMessage: string;
}

const STATUS_TRANSITIONS: Record<AppointmentAction, StatusTransition> = {
  'confirm': {
    fromStatuses: ['pending'],
    toStatus: 'confirmed',
    errorMessage: 'Appointment not found or already confirmed',
  },
  'check-in': {
    fromStatuses: ['pending', 'confirmed'],
    toStatus: 'checked_in',
    errorMessage: 'Appointment not found',
  },
  'start': {
    fromStatuses: ['checked_in'],
    toStatus: 'in_progress',
    errorMessage: 'Appointment not found or not checked in',
  },
  'complete': {
    fromStatuses: ['checked_in', 'in_progress'],
    toStatus: 'completed',
    errorMessage: 'Appointment not found',
  },
  'cancel': {
    fromStatuses: ['pending', 'confirmed'],
    toStatus: 'cancelled',
    errorMessage: 'Appointment not found or cannot be cancelled',
  },
  'no-show': {
    fromStatuses: ['pending', 'confirmed', 'checked_in'],
    toStatus: 'no_show',
    errorMessage: 'Appointment not found',
  },
};

export interface UpdateAppointmentStatusInput {
  appointmentId: string;
  businessId: string;
  action: AppointmentAction;
  reason?: string;
}

export interface UpdateAppointmentStatusResult {
  appointment: any;
}

export async function updateAppointmentStatus(input: UpdateAppointmentStatusInput): Promise<UpdateAppointmentStatusResult> {
  const { appointmentId, businessId, action, reason } = input;
  const transition = STATUS_TRANSITIONS[action];

  const updateData: Record<string, unknown> = { status: transition.toStatus };

  if (action === 'cancel' && reason) {
    updateData.cancellation = {
      cancelledAt: new Date(),
      cancelledBy: 'business',
      reason,
      refunded: false,
      refundAmount: 0,
    };
  }

  const appointment = await Appointment.findOneAndUpdate(
    { _id: appointmentId, businessId, status: { $in: transition.fromStatuses } },
    updateData,
    { new: true },
  );

  if (!appointment) throw new NotFoundError(transition.errorMessage);

  logger.info('Appointment status updated', { appointmentId, businessId, action, newStatus: transition.toStatus });

  return { appointment };
}
