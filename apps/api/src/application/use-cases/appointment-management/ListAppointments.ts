import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';

export interface ListAppointmentsInput {
  businessId: string;
  date?: string;
  from?: string;
  to?: string;
  staffId?: string;
  status?: string;
  page: number;
  limit: number;
}

export interface ListAppointmentsResult {
  appointments: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function listAppointments(input: ListAppointmentsInput): Promise<ListAppointmentsResult> {
  const { businessId, date, from, to, staffId, status, page, limit } = input;

  const query: Record<string, unknown> = { businessId };

  if (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    query.date = { $gte: d, $lt: nextDay };
  } else if (from || to) {
    const dateRange: Record<string, Date> = {};
    if (from) dateRange.$gte = new Date(from);
    if (to) dateRange.$lte = new Date(to);
    query.date = dateRange;
  }

  if (staffId) query.staffId = staffId;
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const [appointments, total] = await Promise.all([
    Appointment.find(query)
      .populate('staffId', 'profile')
      .populate('clientId', 'profile phone')
      .sort({ startDateTime: 1 })
      .skip(skip)
      .limit(limit),
    Appointment.countDocuments(query),
  ]);

  return {
    appointments,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}
