import { Router, Response } from 'express';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';

const router = Router();

// GET /api/v1/manage/dashboard - Get dashboard overview
router.get(
  '/',
  requirePermission('business:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;

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

    res.json({
      success: true,
      data: {
        today: {
          total: todayAppointments,
          completed: completedToday,
          cancelled: cancelledToday,
          pending: pendingToday,
          revenue: todayRevenue[0]?.total || 0,
        },
        upcoming: upcomingAppointments,
        weeklyChart: weeklyAppointments,
      },
    });
  })
);

// GET /api/v1/manage/dashboard/today - Get today's detailed view
router.get(
  '/today',
  requirePermission('appointments:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;

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
    const byStatus = {
      pending: appointments.filter((a) => a.status === 'pending'),
      confirmed: appointments.filter((a) => a.status === 'confirmed'),
      checked_in: appointments.filter((a) => a.status === 'checked_in'),
      in_progress: appointments.filter((a) => a.status === 'in_progress'),
      completed: appointments.filter((a) => a.status === 'completed'),
      cancelled: appointments.filter((a) => a.status === 'cancelled'),
      no_show: appointments.filter((a) => a.status === 'no_show'),
    };

    res.json({
      success: true,
      data: {
        appointments,
        byStatus,
        summary: {
          total: appointments.length,
          pending: byStatus.pending.length,
          confirmed: byStatus.confirmed.length,
          completed: byStatus.completed.length,
          cancelled: byStatus.cancelled.length,
        },
      },
    });
  })
);

// GET /api/v1/manage/dashboard/stats - Get detailed statistics
router.get(
  '/stats',
  requirePermission('analytics:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { period = 'week' } = req.query;

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

    res.json({
      success: true,
      data: {
        period,
        appointments: appointmentStats,
        revenue: revenueStats[0] || { total: 0, count: 0, average: 0 },
        topServices,
      },
    });
  })
);

export default router;
