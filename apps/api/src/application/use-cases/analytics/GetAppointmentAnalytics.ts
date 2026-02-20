import mongoose from 'mongoose';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { logger } from '../../../utils/logger.js';

export interface GetAppointmentAnalyticsInput {
  businessId: string;
  startDate?: string;
  endDate?: string;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}

export interface TimeSeriesEntry {
  date: string;
  booked: number;
  completed: number;
  cancelled: number;
  revenue: number;
}

export interface GetAppointmentAnalyticsResult {
  timeSeries: TimeSeriesEntry[];
  byHourOfDay: Array<{ hour: string; count: number }>;
  byDayOfWeek: Array<{ day: string; dayNumber: number; count: number; revenue: number }>;
  bySource: Array<{ _id: string; count: number }>;
  cancellations: {
    byInitiator: Array<{ _id: string; count: number }>;
  };
}

export async function getAppointmentAnalytics(
  input: GetAppointmentAnalyticsInput
): Promise<GetAppointmentAnalyticsResult> {
  const { businessId, startDate, endDate, groupBy = 'day' } = input;

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();

  let dateFormat: string;
  switch (groupBy) {
    case 'hour':
      dateFormat = '%Y-%m-%d %H:00';
      break;
    case 'week':
      dateFormat = '%Y-W%V';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  const businessObjId = new mongoose.Types.ObjectId(businessId);

  // Appointments over time
  const appointmentsOverTime = await Appointment.aggregate([
    {
      $match: {
        businessId: businessObjId,
        startDateTime: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: dateFormat, date: '$startDateTime' } },
          status: '$status',
        },
        count: { $sum: 1 },
        revenue: { $sum: '$pricing.finalTotal' },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]);

  // By hour of day
  const byHourOfDay = await Appointment.aggregate([
    {
      $match: {
        businessId: businessObjId,
        startDateTime: { $gte: start, $lte: end },
        status: { $in: ['completed', 'confirmed', 'pending'] },
      },
    },
    {
      $group: {
        _id: { $hour: '$startDateTime' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // By day of week
  const byDayOfWeek = await Appointment.aggregate([
    {
      $match: {
        businessId: businessObjId,
        startDateTime: { $gte: start, $lte: end },
        status: { $in: ['completed', 'confirmed', 'pending'] },
      },
    },
    {
      $group: {
        _id: { $dayOfWeek: '$startDateTime' },
        count: { $sum: 1 },
        revenue: { $sum: '$pricing.finalTotal' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // By source
  const bySource = await Appointment.aggregate([
    {
      $match: {
        businessId: businessObjId,
        startDateTime: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
      },
    },
  ]);

  // Cancellation reasons
  const cancellationReasons = await Appointment.aggregate([
    {
      $match: {
        businessId: businessObjId,
        status: 'cancelled',
        startDateTime: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$cancellation.cancelledBy',
        count: { $sum: 1 },
      },
    },
  ]);

  // Transform data
  const timeSeriesData: Record<string, TimeSeriesEntry> = {};
  appointmentsOverTime.forEach((item) => {
    const date = item._id.date;
    if (!timeSeriesData[date]) {
      timeSeriesData[date] = { date, booked: 0, completed: 0, cancelled: 0, revenue: 0 };
    }
    timeSeriesData[date].booked += item.count;
    if (item._id.status === 'completed') {
      timeSeriesData[date].completed = item.count;
      timeSeriesData[date].revenue = item.revenue;
    } else if (item._id.status === 'cancelled') {
      timeSeriesData[date].cancelled = item.count;
    }
  });

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  logger.info('Appointment analytics retrieved', { businessId, groupBy });

  return {
    timeSeries: Object.values(timeSeriesData),
    byHourOfDay: byHourOfDay.map((h) => ({
      hour: `${h._id}:00`,
      count: h.count,
    })),
    byDayOfWeek: byDayOfWeek.map((d) => ({
      day: dayNames[d._id - 1] || 'Unknown',
      dayNumber: d._id,
      count: d.count,
      revenue: d.revenue,
    })),
    bySource,
    cancellations: {
      byInitiator: cancellationReasons,
    },
  };
}
