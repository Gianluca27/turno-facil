import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Review } from '../../../infrastructure/database/mongodb/models/Review.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { asyncHandler, NotFoundError, BadRequestError } from '../../middleware/errorHandler.js';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { notificationService } from '../../../domain/services/NotificationService.js';
import { logger } from '../../../utils/logger.js';

const router = Router();

// Validation schemas
const replySchema = z.object({
  text: z.string().min(1).max(1000),
});

const reportSchema = z.object({
  reason: z.enum(['spam', 'inappropriate', 'fake', 'irrelevant', 'other']),
  details: z.string().max(500).optional(),
});

// GET /api/v1/manage/reviews - Get all reviews
router.get(
  '/',
  requirePermission('reviews:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const {
      rating,
      hasReply,
      staffId,
      startDate,
      endDate,
      sort = '-createdAt',
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    const query: Record<string, unknown> = {
      businessId,
      status: { $in: ['published', 'pending'] },
    };

    if (rating) {
      query['ratings.overall'] = parseInt(rating, 10);
    }

    if (hasReply === 'true') {
      query['response.text'] = { $exists: true, $ne: '' };
    } else if (hasReply === 'false') {
      query.$or = [
        { 'response.text': { $exists: false } },
        { 'response.text': '' },
      ];
    }

    if (staffId) {
      query.staffId = staffId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        (query.createdAt as Record<string, Date>).$gte = new Date(startDate);
      }
      if (endDate) {
        (query.createdAt as Record<string, Date>).$lte = new Date(endDate + 'T23:59:59');
      }
    }

    const sortOrder = sort.startsWith('-') ? -1 : 1;
    const sortField = sort.replace('-', '');

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate('userId', 'profile.firstName profile.lastName profile.avatar')
        .populate('staffId', 'profile.firstName profile.lastName')
        .populate('appointmentId', 'services date startTime')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Review.countDocuments(query),
    ]);

    // Get stats
    const stats = await Review.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          status: 'published',
        },
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          avgRating: { $avg: '$ratings.overall' },
          rating5: { $sum: { $cond: [{ $eq: ['$ratings.overall', 5] }, 1, 0] } },
          rating4: { $sum: { $cond: [{ $eq: ['$ratings.overall', 4] }, 1, 0] } },
          rating3: { $sum: { $cond: [{ $eq: ['$ratings.overall', 3] }, 1, 0] } },
          rating2: { $sum: { $cond: [{ $eq: ['$ratings.overall', 2] }, 1, 0] } },
          rating1: { $sum: { $cond: [{ $eq: ['$ratings.overall', 1] }, 1, 0] } },
          withReply: { $sum: { $cond: [{ $and: [{ $ne: ['$response.text', null] }, { $ne: ['$response.text', ''] }] }, 1, 0] } },
        },
      },
    ]);

    const reviewStats = stats[0] || {
      totalReviews: 0,
      avgRating: 0,
      rating5: 0,
      rating4: 0,
      rating3: 0,
      rating2: 0,
      rating1: 0,
      withReply: 0,
    };

    // Pending replies count
    const pendingReplies = await Review.countDocuments({
      businessId,
      status: 'published',
      $or: [
        { 'response.text': { $exists: false } },
        { 'response.text': '' },
      ],
    });

    res.json({
      success: true,
      data: {
        reviews,
        stats: {
          totalReviews: reviewStats.totalReviews,
          avgRating: Math.round(reviewStats.avgRating * 10) / 10,
          distribution: {
            5: reviewStats.rating5,
            4: reviewStats.rating4,
            3: reviewStats.rating3,
            2: reviewStats.rating2,
            1: reviewStats.rating1,
          },
          responseRate: reviewStats.totalReviews > 0
            ? Math.round((reviewStats.withReply / reviewStats.totalReviews) * 100)
            : 0,
          pendingReplies,
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  })
);

// GET /api/v1/manage/reviews/:id - Get review details
router.get(
  '/:id',
  requirePermission('reviews:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const review = await Review.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    })
      .populate('userId', 'profile.firstName profile.lastName profile.avatar email')
      .populate('staffId', 'profile')
      .populate('appointmentId');

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    res.json({
      success: true,
      data: { review },
    });
  })
);

// POST /api/v1/manage/reviews/:id/reply - Reply to review
router.post(
  '/:id/reply',
  requirePermission('reviews:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = replySchema.parse(req.body);

    const review = await Review.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    review.response = {
      text: data.text,
      respondedAt: new Date(),
      respondedBy: new mongoose.Types.ObjectId(req.user!.id),
    };

    await review.save();

    // Notify the user about the reply
    await notificationService.sendNotification({
      userId: review.userId.toString(),
      type: 'general',
      channels: ['push', 'email'],
      businessId: req.currentBusiness!.businessId,
      data: {
        title: 'Respuesta a tu reseña',
        body: 'El negocio ha respondido a tu reseña',
        reviewId: review._id.toString(),
      },
    });

    logger.info('Review replied', {
      reviewId: review._id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({
      success: true,
      message: 'Reply posted successfully',
      data: { review },
    });
  })
);

// PUT /api/v1/manage/reviews/:id/reply - Update reply
router.put(
  '/:id/reply',
  requirePermission('reviews:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = replySchema.parse(req.body);

    const review = await Review.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    if (!review.response?.text) {
      throw new BadRequestError('No reply to update');
    }

    review.response.text = data.text;
    review.response.respondedAt = new Date();

    await review.save();

    logger.info('Review reply updated', {
      reviewId: review._id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({
      success: true,
      message: 'Reply updated successfully',
      data: { review },
    });
  })
);

// DELETE /api/v1/manage/reviews/:id/reply - Delete reply
router.delete(
  '/:id/reply',
  requirePermission('reviews:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const review = await Review.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    review.response = undefined;
    await review.save();

    logger.info('Review reply deleted', {
      reviewId: review._id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({
      success: true,
      message: 'Reply deleted successfully',
    });
  })
);

// POST /api/v1/manage/reviews/:id/report - Report a review
router.post(
  '/:id/report',
  requirePermission('reviews:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = reportSchema.parse(req.body);

    const review = await Review.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    if (review.reported) {
      throw new BadRequestError('Review has already been reported');
    }

    review.reported = true;
    review.reportReason = data.reason;
    review.reportDetails = data.details;
    review.reportedAt = new Date();
    review.reportedBy = new mongoose.Types.ObjectId(req.user!.id);

    await review.save();

    logger.info('Review reported', {
      reviewId: review._id,
      businessId: req.currentBusiness!.businessId,
      reason: data.reason,
    });

    res.json({
      success: true,
      message: 'Review reported successfully. Our team will review it.',
    });
  })
);

// GET /api/v1/manage/reviews/stats/summary - Get review statistics
router.get(
  '/stats/summary',
  requirePermission('reviews:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { months = '6' } = req.query as { months?: string };

    const monthsNum = Math.min(parseInt(months, 10), 12);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsNum);

    // Monthly breakdown
    const monthlyBreakdown = await Review.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          status: 'published',
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

    // Staff ratings
    const staffRatings = await Review.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          status: 'published',
          staffId: { $exists: true },
        },
      },
      {
        $group: {
          _id: '$staffId',
          count: { $sum: 1 },
          avgRating: { $avg: '$ratings.overall' },
        },
      },
      {
        $lookup: {
          from: 'staff',
          localField: '_id',
          foreignField: '_id',
          as: 'staffDetails',
        },
      },
      { $unwind: '$staffDetails' },
      {
        $project: {
          staffId: '$_id',
          name: {
            $concat: [
              '$staffDetails.profile.firstName',
              ' ',
              '$staffDetails.profile.lastName',
            ],
          },
          count: 1,
          avgRating: { $round: ['$avgRating', 1] },
        },
      },
      { $sort: { avgRating: -1 } },
    ]);

    // Common keywords (simplified - in production use NLP)
    const recentReviews = await Review.find({
      businessId,
      status: 'published',
    })
      .select('content.text ratings.overall')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Simple keyword extraction
    const positiveKeywords: Record<string, number> = {};
    const negativeKeywords: Record<string, number> = {};

    const keywords = ['excelente', 'profesional', 'amable', 'limpio', 'puntual', 'recomiendo',
      'malo', 'lento', 'caro', 'sucio', 'impuntual', 'espera'];

    recentReviews.forEach((review) => {
      if (!review.content?.text) return;
      const text = review.content.text.toLowerCase();
      keywords.forEach((keyword) => {
        if (text.includes(keyword)) {
          if (review.ratings?.overall >= 4) {
            positiveKeywords[keyword] = (positiveKeywords[keyword] || 0) + 1;
          } else if (review.ratings?.overall <= 2) {
            negativeKeywords[keyword] = (negativeKeywords[keyword] || 0) + 1;
          }
        }
      });
    });

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    res.json({
      success: true,
      data: {
        monthly: monthlyBreakdown.map((m) => ({
          month: `${monthNames[m._id.month - 1]} ${m._id.year}`,
          count: m.count,
          avgRating: Math.round(m.avgRating * 10) / 10,
        })),
        staffRatings,
        keywords: {
          positive: Object.entries(positiveKeywords)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word, count]) => ({ word, count })),
          negative: Object.entries(negativeKeywords)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word, count]) => ({ word, count })),
        },
      },
    });
  })
);

// POST /api/v1/manage/reviews/request - Request review from client
router.post(
  '/request',
  requirePermission('reviews:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      throw new BadRequestError('Appointment ID is required');
    }

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      businessId: req.currentBusiness!.businessId,
      status: 'completed',
    });

    if (!appointment) {
      throw new NotFoundError('Completed appointment not found');
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      appointmentId,
      businessId: req.currentBusiness!.businessId,
    });

    if (existingReview) {
      throw new BadRequestError('A review already exists for this appointment');
    }

    // Send review request notification
    await notificationService.sendNotification({
      userId: appointment.clientId.toString(),
      type: 'review_request',
      channels: ['push', 'email'],
      businessId: req.currentBusiness!.businessId,
      appointmentId: appointmentId,
      data: {
        serviceName: appointment.services[0]?.name || 'servicio',
      },
    });

    logger.info('Review request sent', {
      appointmentId,
      businessId: req.currentBusiness!.businessId,
      clientId: appointment.clientId,
    });

    res.json({
      success: true,
      message: 'Review request sent successfully',
    });
  })
);

export default router;
