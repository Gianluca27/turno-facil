import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';

export interface GetPendingAppointmentsInput {
  businessId: string;
}

export interface GetPendingAppointmentsResult {
  appointments: Record<string, unknown>[];
}

export async function getPendingAppointments(input: GetPendingAppointmentsInput): Promise<GetPendingAppointmentsResult> {
  const { businessId } = input;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const appointments = await Appointment.find({
    businessId,
    date: today,
    status: 'completed',
    'payment.status': { $in: ['pending', 'partial'] },
  })
    .populate('clientId', 'profile.firstName profile.lastName')
    .populate('staffId', 'profile.firstName profile.lastName')
    .select('clientInfo services pricing date startTime endTime')
    .sort({ endTime: -1 })
    .lean();

  return { appointments };
}
