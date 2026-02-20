import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';

export interface GetAppointmentInput {
  appointmentId: string;
  businessId: string;
}

export interface GetAppointmentResult {
  appointment: any;
}

export async function getAppointment(input: GetAppointmentInput): Promise<GetAppointmentResult> {
  const appointment = await Appointment.findOne({
    _id: input.appointmentId,
    businessId: input.businessId,
  })
    .populate('staffId', 'profile')
    .populate('clientId', 'profile phone email');

  if (!appointment) throw new NotFoundError('Appointment not found');

  return { appointment };
}
