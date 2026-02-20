import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { logger } from '../../../utils/logger.js';

export interface GetTodayViewInput {
  businessId: string;
}

export interface GetTodayViewResult {
  appointments: any[];
  byStatus: Record<string, any[]>;
  summary: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
}

/**
 * Retrieves all of today's appointments grouped by status
 * with a summary count for each status.
 */
export async function getTodayView(input: GetTodayViewInput): Promise<GetTodayViewResult> {
  const { businessId } = input;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const appointments = await Appointment.find({
    businessId,
    date: { $gte: today, $lt: tomorrow },
  })
    .populate('staffId', 'profile')
    .sort({ startDateTime: 1 })
    .lean();

  // Group by status
  const byStatus: Record<string, any[]> = {
    pending: appointments.filter((a) => a.status === 'pending'),
    confirmed: appointments.filter((a) => a.status === 'confirmed'),
    checked_in: appointments.filter((a) => a.status === 'checked_in'),
    in_progress: appointments.filter((a) => a.status === 'in_progress'),
    completed: appointments.filter((a) => a.status === 'completed'),
    cancelled: appointments.filter((a) => a.status === 'cancelled'),
    no_show: appointments.filter((a) => a.status === 'no_show'),
  };

  logger.info('Today view retrieved', { businessId, total: appointments.length });

  return {
    appointments,
    byStatus,
    summary: {
      total: appointments.length,
      pending: byStatus.pending.length,
      confirmed: byStatus.confirmed.length,
      completed: byStatus.completed.length,
      cancelled: byStatus.cancelled.length,
    },
  };
}
