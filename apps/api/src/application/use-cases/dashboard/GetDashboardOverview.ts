import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { logger } from '../../../utils/logger.js';

export interface GetDashboardOverviewInput {
  businessId: string;
}

export interface GetDashboardOverviewResult {
  today: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
    revenue: number;
  };
  upcoming: any[];
  weeklyChart: any[];
}

/**
 * Retrieves the dashboard overview including today's appointment stats,
 * today's revenue, upcoming appointments, and weekly chart data.
 */
export async function getDashboardOverview(input: GetDashboardOverviewInput): Promise<GetDashboardOverviewResult> {
  const { businessId } = input;

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Today's stats
  const [todayAppointments, completedToday, cancelledToday, pendingToday] = await Promise.all([
    Appointment.countDocuments({
      businessId,
      date: { $gte: today, $lt: tomorrow },
      status: { $ne: 'cancelled' },
    }),
    Appointment.countDocuments({
      businessId,
      date: { $gte: today, $lt: tomorrow },
      status: 'completed',
    }),
    Appointment.countDocuments({
      businessId,
      date: { $gte: today, $lt: tomorrow },
      status: 'cancelled',
    }),
    Appointment.countDocuments({
      businessId,
      date: { $gte: today, $lt: tomorrow },
      status: { $in: ['pending', 'confirmed'] },
    }),
  ]);

  // Today's revenue
  const todayRevenue = await Transaction.aggregate([
    {
      $match: {
        businessId,
        type: 'payment',
        status: 'completed',
        createdAt: { $gte: today, $lt: tomorrow },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  // Upcoming appointments (next 5)
  const upcomingAppointments = await Appointment.find({
    businessId,
    startDateTime: { $gte: new Date() },
    status: { $in: ['pending', 'confirmed'] },
  })
    .populate('staffId', 'profile.firstName profile.lastName')
    .sort({ startDateTime: 1 })
    .limit(5)
    .lean();

  // Week stats
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const weeklyAppointments = await Appointment.aggregate([
    {
      $match: {
        businessId,
        date: { $gte: weekStart, $lt: weekEnd },
        status: { $ne: 'cancelled' },
      },
    },
    {
      $group: {
        _id: { $dayOfWeek: '$date' },
        count: { $sum: 1 },
      },
    },
  ]);

  logger.info('Dashboard overview retrieved', { businessId });

  return {
    today: {
      total: todayAppointments,
      completed: completedToday,
      cancelled: cancelledToday,
      pending: pendingToday,
      revenue: todayRevenue[0]?.total || 0,
    },
    upcoming: upcomingAppointments,
    weeklyChart: weeklyAppointments,
  };
}
