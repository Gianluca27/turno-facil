import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { logger } from '../../../utils/logger.js';

export interface GetDashboardStatsInput {
  businessId: string;
  period: string;
}

export interface GetDashboardStatsResult {
  period: string;
  appointments: any[];
  revenue: {
    total: number;
    count: number;
    average: number;
  };
  topServices: any[];
}

/**
 * Retrieves detailed dashboard statistics for a given period (day/week/month/year),
 * including appointment stats, revenue stats, and top services.
 */
export async function getDashboardStats(input: GetDashboardStatsInput): Promise<GetDashboardStatsResult> {
  const { businessId, period } = input;

  let startDate = new Date();
  switch (period) {
    case 'day':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }

  const [appointmentStats, revenueStats, topServices] = await Promise.all([
    Appointment.aggregate([
      { $match: { businessId, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    Transaction.aggregate([
      {
        $match: {
          businessId,
          type: 'payment',
          status: 'completed',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          average: { $avg: '$amount' },
        },
      },
    ]),
    Appointment.aggregate([
      { $match: { businessId, status: 'completed', createdAt: { $gte: startDate } } },
      { $unwind: '$services' },
      { $group: { _id: '$services.name', count: { $sum: 1 }, revenue: { $sum: '$services.price' } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);

  logger.info('Dashboard stats retrieved', { businessId, period });

  return {
    period,
    appointments: appointmentStats,
    revenue: revenueStats[0] || { total: 0, count: 0, average: 0 },
    topServices,
  };
}
