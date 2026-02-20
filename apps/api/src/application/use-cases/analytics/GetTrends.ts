import mongoose from 'mongoose';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { ClientBusinessRelation } from '../../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';
import { Review } from '../../../infrastructure/database/mongodb/models/Review.js';
import { logger } from '../../../utils/logger.js';

export interface GetTrendsInput {
  businessId: string;
  months?: string;
}

export interface TrendEntry {
  month: string;
  appointments: number;
  completed: number;
  revenue: number;
  newClients: number;
  reviews: number;
  avgRating: number;
}

export interface GetTrendsResult {
  trends: TrendEntry[];
}

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export async function getTrends(input: GetTrendsInput): Promise<GetTrendsResult> {
  const { businessId, months = '6' } = input;
  const monthsNum = Math.min(parseInt(months, 10), 12);

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsNum);

  const businessObjId = new mongoose.Types.ObjectId(businessId);

  // Monthly trends
  const monthlyTrends = await Appointment.aggregate([
    {
      $match: {
        businessId: businessObjId,
        startDateTime: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$startDateTime' },
          month: { $month: '$startDateTime' },
        },
        appointments: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.finalTotal', 0] } },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  // New clients per month
  const newClientsPerMonth = await ClientBusinessRelation.aggregate([
    {
      $match: {
        businessId: businessObjId,
        firstVisitAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$firstVisitAt' },
          month: { $month: '$firstVisitAt' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  // Reviews per month
  const reviewsPerMonth = await Review.aggregate([
    {
      $match: {
        businessId: businessObjId,
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        count: { $sum: 1 },
        avgRating: { $avg: '$ratings.overall' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  // Create monthly map
  const monthsData: Record<string, TrendEntry> = {};

  monthlyTrends.forEach((m) => {
    const key = `${m._id.year}-${m._id.month}`;
    monthsData[key] = {
      month: `${monthNames[m._id.month - 1]} ${m._id.year}`,
      appointments: m.appointments,
      completed: m.completed,
      revenue: m.revenue,
      newClients: 0,
      reviews: 0,
      avgRating: 0,
    };
  });

  newClientsPerMonth.forEach((m) => {
    const key = `${m._id.year}-${m._id.month}`;
    if (monthsData[key]) {
      monthsData[key].newClients = m.count;
    }
  });

  reviewsPerMonth.forEach((m) => {
    const key = `${m._id.year}-${m._id.month}`;
    if (monthsData[key]) {
      monthsData[key].reviews = m.count;
      monthsData[key].avgRating = Math.round(m.avgRating * 10) / 10;
    }
  });

  logger.info('Business trends retrieved', { businessId, months: monthsNum });

  return {
    trends: Object.values(monthsData),
  };
}
