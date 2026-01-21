import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Review } from '../../../infrastructure/database/mongodb/models/Review.js';
import { ClientBusinessRelation } from '../../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';
import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';

const router = Router();

// GET /api/v1/manage/analytics/overview - Get analytics overview
router.get(
  '/overview',
  requirePermission('analytics:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { period = 'month' } = req.query as { period?: string };
    const businessId = req.currentBusiness!.businessId;

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
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        previousStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
        previousEnd = new Date(now.getFullYear(), quarter * 3, 0);
        break;
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
        firstVisitAt: { $gte: startDate, $lte: now },
      }),
      ClientBusinessRelation.countDocuments({
        businessId: businessObjId,
        firstVisitAt: { $gte: previousStart, $lte: previousEnd },
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
            avgRating: { $avg: '$rating' },
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
            avgRating: { $avg: '$rating' },
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

    res.json({
      success: true,
      data: {
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
      },
    });
  })
);

// GET /api/v1/manage/analytics/appointments - Appointment analytics
router.get(
  '/appointments',
  requirePermission('analytics:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { startDate, endDate, groupBy = 'day' } = req.query as Record<string, string>;
    const businessId = req.currentBusiness!.businessId;

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

    // Appointments over time
    const appointmentsOverTime = await Appointment.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
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
          businessId: new mongoose.Types.ObjectId(businessId),
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
          businessId: new mongoose.Types.ObjectId(businessId),
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
          businessId: new mongoose.Types.ObjectId(businessId),
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
          businessId: new mongoose.Types.ObjectId(businessId),
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
    const timeSeriesData: Record<string, { date: string; booked: number; completed: number; cancelled: number; revenue: number }> = {};
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

    res.json({
      success: true,
      data: {
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
      },
    });
  })
);

// GET /api/v1/manage/analytics/services - Service analytics
router.get(
  '/services',
  requirePermission('analytics:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query as Record<string, string>;
    const businessId = req.currentBusiness!.businessId;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();

    // Service performance
    const servicePerformance = await Appointment.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          status: 'completed',
          endDateTime: { $gte: start, $lte: end },
        },
      },
      { $unwind: '$services' },
      {
        $group: {
          _id: '$services.serviceId',
          name: { $first: '$services.name' },
          bookings: { $sum: 1 },
          revenue: { $sum: '$services.price' },
          avgPrice: { $avg: '$services.price' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Get service details
    const serviceIds = servicePerformance.map((s) => s._id);
    const services = await Service.find({ _id: { $in: serviceIds } }).select('name category duration').lean();
    const serviceMap = new Map(services.map((s) => [s._id.toString(), s]));

    const enrichedServices = servicePerformance.map((s) => {
      const service = serviceMap.get(s._id?.toString());
      return {
        ...s,
        category: service?.category,
        duration: service?.duration,
      };
    });

    // Category breakdown
    const categoryBreakdown = await Appointment.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          status: 'completed',
          endDateTime: { $gte: start, $lte: end },
        },
      },
      { $unwind: '$services' },
      {
        $lookup: {
          from: 'services',
          localField: 'services.serviceId',
          foreignField: '_id',
          as: 'serviceDetails',
        },
      },
      { $unwind: '$serviceDetails' },
      {
        $group: {
          _id: '$serviceDetails.category',
          bookings: { $sum: 1 },
          revenue: { $sum: '$services.price' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        services: enrichedServices,
        categories: categoryBreakdown,
        topServices: enrichedServices.slice(0, 5),
      },
    });
  })
);

// GET /api/v1/manage/analytics/staff - Staff analytics
router.get(
  '/staff',
  requirePermission('analytics:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query as Record<string, string>;
    const businessId = req.currentBusiness!.businessId;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();

    // Staff performance
    const staffPerformance = await Appointment.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
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
          businessId: new mongoose.Types.ObjectId(businessId),
          staffId: { $exists: true },
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$staffId',
          reviewCount: { $sum: 1 },
          avgRating: { $avg: '$rating' },
        },
      },
    ]);

    const reviewMap = new Map(staffReviews.map((r) => [r._id?.toString(), r]));

    // Get staff details
    const staffIds = staffPerformance.map((s) => s._id);
    const staffMembers = await Staff.find({ _id: { $in: staffIds } }).select('profile').lean();
    const staffMap = new Map(staffMembers.map((s) => [s._id.toString(), s]));

    const enrichedStaff = staffPerformance.map((s) => {
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

    res.json({
      success: true,
      data: {
        staff: enrichedStaff,
        topPerformers: enrichedStaff.slice(0, 3),
      },
    });
  })
);

// GET /api/v1/manage/analytics/clients - Client analytics
router.get(
  '/clients',
  requirePermission('analytics:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query as Record<string, string>;
    const businessId = req.currentBusiness!.businessId;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();

    // Client acquisition
    const acquisition = await ClientBusinessRelation.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          firstVisitAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$firstVisitAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Client retention
    const totalClients = await ClientBusinessRelation.countDocuments({
      businessId: new mongoose.Types.ObjectId(businessId),
    });

    const returningClients = await ClientBusinessRelation.countDocuments({
      businessId: new mongoose.Types.ObjectId(businessId),
      totalBookings: { $gte: 2 },
    });

    const loyalClients = await ClientBusinessRelation.countDocuments({
      businessId: new mongoose.Types.ObjectId(businessId),
      totalBookings: { $gte: 5 },
    });

    // Top clients
    const topClients = await ClientBusinessRelation.find({
      businessId: new mongoose.Types.ObjectId(businessId),
    })
      .sort({ totalSpent: -1 })
      .limit(10)
      .populate('clientId', 'profile.firstName profile.lastName email phone')
      .lean();

    // Client segments by visit frequency
    const segments = await ClientBusinessRelation.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
        },
      },
      {
        $bucket: {
          groupBy: '$totalBookings',
          boundaries: [0, 1, 2, 5, 10, 20, 100],
          default: '100+',
          output: {
            count: { $sum: 1 },
            totalRevenue: { $sum: '$totalSpent' },
          },
        },
      },
    ]);

    const segmentLabels: Record<string | number, string> = {
      0: 'Nuevos (0)',
      1: 'Primera visita (1)',
      2: 'Repetidores (2-4)',
      5: 'Frecuentes (5-9)',
      10: 'Leales (10-19)',
      20: 'VIP (20+)',
      '100+': 'Super VIP',
    };

    res.json({
      success: true,
      data: {
        acquisition,
        retention: {
          total: totalClients,
          returning: returningClients,
          loyal: loyalClients,
          retentionRate: totalClients > 0 ? Math.round((returningClients / totalClients) * 100) : 0,
          loyaltyRate: totalClients > 0 ? Math.round((loyalClients / totalClients) * 100) : 0,
        },
        topClients: topClients.map((c) => ({
          clientId: c.clientId?._id || c.clientId,
          name: c.clientId?.profile
            ? `${c.clientId.profile.firstName} ${c.clientId.profile.lastName}`
            : 'Cliente',
          email: c.clientId?.email,
          totalBookings: c.totalBookings,
          totalSpent: c.totalSpent,
          lastVisit: c.lastVisitAt,
        })),
        segments: segments.map((s) => ({
          segment: segmentLabels[s._id] || `${s._id}+`,
          count: s.count,
          totalRevenue: s.totalRevenue,
        })),
      },
    });
  })
);

// GET /api/v1/manage/analytics/trends - Business trends
router.get(
  '/trends',
  requirePermission('analytics:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { months = '6' } = req.query as { months?: string };
    const businessId = req.currentBusiness!.businessId;
    const monthsNum = Math.min(parseInt(months, 10), 12);

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsNum);

    // Monthly trends
    const monthlyTrends = await Appointment.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
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
          businessId: new mongoose.Types.ObjectId(businessId),
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
          businessId: new mongoose.Types.ObjectId(businessId),
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
          avgRating: { $avg: '$rating' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Create monthly map
    const months_data: Record<string, {
      month: string;
      appointments: number;
      completed: number;
      revenue: number;
      newClients: number;
      reviews: number;
      avgRating: number;
    }> = {};

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    monthlyTrends.forEach((m) => {
      const key = `${m._id.year}-${m._id.month}`;
      months_data[key] = {
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
      if (months_data[key]) {
        months_data[key].newClients = m.count;
      }
    });

    reviewsPerMonth.forEach((m) => {
      const key = `${m._id.year}-${m._id.month}`;
      if (months_data[key]) {
        months_data[key].reviews = m.count;
        months_data[key].avgRating = Math.round(m.avgRating * 10) / 10;
      }
    });

    res.json({
      success: true,
      data: {
        trends: Object.values(months_data),
      },
    });
  })
);

export default router;
