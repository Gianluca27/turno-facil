import mongoose from 'mongoose';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Review } from '../../../infrastructure/database/mongodb/models/Review.js';
import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';
import { logger } from '../../../utils/logger.js';

export interface GetStaffAnalyticsInput {
  businessId: string;
  startDate?: string;
  endDate?: string;
}

export interface StaffAnalyticsEntry {
  staffId: mongoose.Types.ObjectId;
  name: string;
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    completionRate: number;
  };
  revenue: number;
  tips: number;
  avgTicket: number;
  hoursWorked: number;
  revenuePerHour: number;
  reviews: {
    count: number;
    avgRating: number;
  };
}

export interface GetStaffAnalyticsResult {
  staff: StaffAnalyticsEntry[];
  topPerformers: StaffAnalyticsEntry[];
}

export async function getStaffAnalytics(
  input: GetStaffAnalyticsInput
): Promise<GetStaffAnalyticsResult> {
  const { businessId, startDate, endDate } = input;

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();

  const businessObjId = new mongoose.Types.ObjectId(businessId);

  // Staff performance
  const staffPerformance = await Appointment.aggregate([
    {
      $match: {
        businessId: businessObjId,
        endDateTime: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$staffId',
        staffName: { $first: '$staffInfo.name' },
        totalAppointments: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.finalTotal', 0] } },
        tips: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.tip', 0] } },
        totalDuration: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalDuration', 0] } },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  // Staff reviews
  const staffReviews = await Review.aggregate([
    {
      $match: {
        businessId: businessObjId,
        staffId: { $exists: true },
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$staffId',
        reviewCount: { $sum: 1 },
        avgRating: { $avg: '$ratings.overall' },
      },
    },
  ]);

  const reviewMap = new Map(staffReviews.map((r) => [r._id?.toString(), r]));

  // Get staff details
  const staffIds = staffPerformance.map((s) => s._id);
  const staffMembers = await Staff.find({ _id: { $in: staffIds } }).select('profile').lean();
  const staffMap = new Map(staffMembers.map((s) => [s._id.toString(), s]));

  const enrichedStaff: StaffAnalyticsEntry[] = staffPerformance.map((s) => {
    const staff = staffMap.get(s._id?.toString());
    const reviews = reviewMap.get(s._id?.toString());
    return {
      staffId: s._id,
      name: s.staffName || `${staff?.profile?.firstName || ''} ${staff?.profile?.lastName || ''}`.trim(),
      appointments: {
        total: s.totalAppointments,
        completed: s.completed,
        cancelled: s.cancelled,
        noShow: s.noShow,
        completionRate: s.totalAppointments > 0 ? Math.round((s.completed / s.totalAppointments) * 100) : 0,
      },
      revenue: s.revenue,
      tips: s.tips,
      avgTicket: s.completed > 0 ? Math.round(s.revenue / s.completed) : 0,
      hoursWorked: Math.round(s.totalDuration / 60),
      revenuePerHour: s.totalDuration > 0 ? Math.round((s.revenue / s.totalDuration) * 60) : 0,
      reviews: {
        count: reviews?.reviewCount || 0,
        avgRating: Math.round((reviews?.avgRating || 0) * 10) / 10,
      },
    };
  });

  logger.info('Staff analytics retrieved', { businessId });

  return {
    staff: enrichedStaff,
    topPerformers: enrichedStaff.slice(0, 3),
  };
}
