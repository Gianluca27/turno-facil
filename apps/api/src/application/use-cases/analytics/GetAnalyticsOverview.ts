import mongoose from 'mongoose';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Review } from '../../../infrastructure/database/mongodb/models/Review.js';
import { ClientBusinessRelation } from '../../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';
import { logger } from '../../../utils/logger.js';

export interface GetAnalyticsOverviewInput {
  businessId: string;
  period?: 'week' | 'month' | 'quarter' | 'year';
}

export interface GetAnalyticsOverviewResult {
  period: string;
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    completionRate: number;
    change: number;
  };
  revenue: {
    total: number;
    tips: number;
    averageTicket: number;
    change: number;
  };
  clients: {
    new: number;
    change: number;
  };
  reviews: {
    count: number;
    avgRating: number;
    change: number;
  };
}

export async function getAnalyticsOverview(
  input: GetAnalyticsOverviewInput
): Promise<GetAnalyticsOverviewResult> {
  const { businessId, period = 'month' } = input;

  const now = new Date();
  let startDate: Date;
  let previousStart: Date;
  let previousEnd: Date;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      previousEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      previousStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
      previousEnd = new Date(now.getFullYear(), quarter * 3, 0);
      break;
    }
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      previousStart = new Date(now.getFullYear() - 1, 0, 1);
      previousEnd = new Date(now.getFullYear() - 1, 11, 31);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  }

  const businessObjId = new mongoose.Types.ObjectId(businessId);

  // Current period stats
  const [currentAppointments, previousAppointments] = await Promise.all([
    Appointment.aggregate([
      {
        $match: {
          businessId: businessObjId,
          createdAt: { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.finalTotal', 0] } },
          tips: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.tip', 0] } },
        },
      },
    ]),
    Appointment.aggregate([
      {
        $match: {
          businessId: businessObjId,
          createdAt: { $gte: previousStart, $lte: previousEnd },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.finalTotal', 0] } },
        },
      },
    ]),
  ]);

  // New clients
  const [currentNewClients, previousNewClients] = await Promise.all([
    ClientBusinessRelation.countDocuments({
      businessId: businessObjId,
      createdAt: { $gte: startDate, $lte: now },
    }),
    ClientBusinessRelation.countDocuments({
      businessId: businessObjId,
      createdAt: { $gte: previousStart, $lte: previousEnd },
    }),
  ]);

  // Reviews
  const [currentReviews, previousReviews] = await Promise.all([
    Review.aggregate([
      {
        $match: {
          businessId: businessObjId,
          createdAt: { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgRating: { $avg: '$ratings.overall' },
        },
      },
    ]),
    Review.aggregate([
      {
        $match: {
          businessId: businessObjId,
          createdAt: { $gte: previousStart, $lte: previousEnd },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgRating: { $avg: '$ratings.overall' },
        },
      },
    ]),
  ]);

  // Calculate changes
  const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const current = currentAppointments[0] || { total: 0, completed: 0, cancelled: 0, noShow: 0, revenue: 0, tips: 0 };
  const previous = previousAppointments[0] || { total: 0, completed: 0, revenue: 0 };

  logger.info('Analytics overview retrieved', { businessId, period });

  return {
    period,
    appointments: {
      total: current.total,
      completed: current.completed,
      cancelled: current.cancelled,
      noShow: current.noShow,
      completionRate: current.total > 0 ? Math.round((current.completed / current.total) * 100) : 0,
      change: calculateChange(current.total, previous.total),
    },
    revenue: {
      total: current.revenue,
      tips: current.tips,
      averageTicket: current.completed > 0 ? Math.round(current.revenue / current.completed) : 0,
      change: calculateChange(current.revenue, previous.revenue),
    },
    clients: {
      new: currentNewClients,
      change: calculateChange(currentNewClients, previousNewClients),
    },
    reviews: {
      count: currentReviews[0]?.count || 0,
      avgRating: Math.round((currentReviews[0]?.avgRating || 0) * 10) / 10,
      change: calculateChange(currentReviews[0]?.count || 0, previousReviews[0]?.count || 0),
    },
  };
}
