import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Review } from '../../infrastructure/database/mongodb/models/Review.js';
import { Appointment } from '../../infrastructure/database/mongodb/models/Appointment.js';
import { Business } from '../../infrastructure/database/mongodb/models/Business.js';
import { Staff } from '../../infrastructure/database/mongodb/models/Staff.js';
import { asyncHandler, NotFoundError, BadRequestError } from '../middleware/errorHandler.js';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Validation schemas
const createReviewSchema = z.object({
  appointmentId: z.string().min(1),
  ratings: z.object({
    overall: z.number().min(1).max(5),
    service: z.number().min(1).max(5).optional(),
    staff: z.number().min(1).max(5).optional(),
    cleanliness: z.number().min(1).max(5).optional(),
    value: z.number().min(1).max(5).optional(),
  }),
  content: z.object({
    text: z.string().min(10).max(2000),
    photos: z.array(z.string().url()).max(5).optional(),
  }),
});

const updateReviewSchema = z.object({
  ratings: z.object({
    overall: z.number().min(1).max(5),
    service: z.number().min(1).max(5).optional(),
    staff: z.number().min(1).max(5).optional(),
    cleanliness: z.number().min(1).max(5).optional(),
    value: z.number().min(1).max(5).optional(),
  }).optional(),
  content: z.object({
    text: z.string().min(10).max(2000),
    photos: z.array(z.string().url()).max(5).optional(),
  }).optional(),
});

// POST /api/v1/reviews - Create review
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = createReviewSchema.parse(req.body);

    // Get the appointment
    const appointment = await Appointment.findOne({
      _id: data.appointmentId,
      clientId: req.user!.id,
      status: 'completed',
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found or not eligible for review');
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      appointmentId: data.appointmentId,
    });

    if (existingReview) {
      throw new BadRequestError('You have already reviewed this appointment');
    }

    // Verify appointment was completed recently (within 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (appointment.endDateTime < thirtyDaysAgo) {
      throw new BadRequestError('Review period has expired. Reviews can only be submitted within 30 days of the appointment.');
    }

    // Create review
    const review = new Review({
      businessId: appointment.businessId,
      appointmentId: appointment._id,
      clientId: req.user!.id,
      staffId: appointment.staffId,
      ratings: data.ratings,
      content: {
        text: data.content.text,
        photos: data.content.photos || [],
        services: appointment.services.map((s) => s.name),
      },
      isVerified: true, // Verified because it's linked to a real appointment
      moderation: {
        status: 'pending',
      },
      status: 'active',
    });

    await review.save();

    // Update appointment to mark review submitted
    appointment.review = {
      submitted: true,
      requestedAt: new Date(),
    };
    await appointment.save();

    // Update business stats
    await updateBusinessStats(appointment.businessId.toString());

    // Update staff stats if staffId exists
    if (appointment.staffId) {
      await updateStaffStats(appointment.staffId.toString());
    }

    logger.info('Review created', {
      reviewId: review._id,
      userId: req.user!.id,
      businessId: appointment.businessId,
      rating: data.ratings.overall,
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully. It will be visible after moderation.',
      data: { review },
    });
  })
);

// GET /api/v1/reviews/me - Get my reviews
router.get(
  '/me',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      Review.find({ clientId: req.user!.id })
        .populate('businessId', 'name slug media.logo')
        .populate('staffId', 'profile.firstName profile.lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Review.countDocuments({ clientId: req.user!.id }),
    ]);

    res.json({
      success: true,
      data: {
        reviews,
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

// GET /api/v1/reviews/:id - Get review details
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const review = await Review.findById(req.params.id)
      .populate('businessId', 'name slug media.logo location')
      .populate('staffId', 'profile');

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    res.json({
      success: true,
      data: { review },
    });
  })
);

// PUT /api/v1/reviews/:id - Update review
router.put(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = updateReviewSchema.parse(req.body);

    const review = await Review.findOne({
      _id: req.params.id,
      clientId: req.user!.id,
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Check if review can still be edited (within 48 hours)
    const editDeadline = new Date(review.createdAt);
    editDeadline.setHours(editDeadline.getHours() + 48);

    if (new Date() > editDeadline) {
      throw new BadRequestError('Reviews can only be edited within 48 hours of submission');
    }

    // Update fields
    if (data.ratings) {
      review.ratings = { ...review.ratings, ...data.ratings };
    }

    if (data.content) {
      review.content.text = data.content.text || review.content.text;
      if (data.content.photos) {
        review.content.photos = data.content.photos;
      }
    }

    // Reset moderation status
    review.moderation.status = 'pending';
    review.moderation.reviewedAt = undefined;

    await review.save();

    // Update stats
    await updateBusinessStats(review.businessId.toString());
    if (review.staffId) {
      await updateStaffStats(review.staffId.toString());
    }

    logger.info('Review updated', {
      reviewId: review._id,
      userId: req.user!.id,
    });

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: { review },
    });
  })
);

// DELETE /api/v1/reviews/:id - Delete review
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const review = await Review.findOne({
      _id: req.params.id,
      clientId: req.user!.id,
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Soft delete
    review.status = 'deleted';
    await review.save();

    // Update appointment
    await Appointment.findByIdAndUpdate(review.appointmentId, {
      'review.submitted': false,
    });

    // Update stats
    await updateBusinessStats(review.businessId.toString());
    if (review.staffId) {
      await updateStaffStats(review.staffId.toString());
    }

    logger.info('Review deleted', {
      reviewId: review._id,
      userId: req.user!.id,
    });

    res.json({
      success: true,
      message: 'Review deleted successfully',
    });
  })
);

// POST /api/v1/reviews/:id/helpful - Mark review as helpful
router.post(
  '/:id/helpful',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const review = await Review.findOne({
      _id: req.params.id,
      status: 'active',
      'moderation.status': 'approved',
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Can't vote on your own review
    if (review.clientId.toString() === req.user!.id) {
      throw new BadRequestError('You cannot vote on your own review');
    }

    // Increment helpful votes (simplified - no tracking of who voted)
    review.helpfulVotes = (review.helpfulVotes || 0) + 1;
    await review.save();

    res.json({
      success: true,
      message: 'Review marked as helpful',
      data: { helpfulVotes: review.helpfulVotes },
    });
  })
);

// POST /api/v1/reviews/:id/report - Report review
router.post(
  '/:id/report',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { reason } = req.body;

    if (!reason) {
      throw new BadRequestError('Report reason is required');
    }

    const review = await Review.findOne({
      _id: req.params.id,
      status: 'active',
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Can't report your own review
    if (review.clientId.toString() === req.user!.id) {
      throw new BadRequestError('You cannot report your own review');
    }

    // Increment report count
    review.reportCount = (review.reportCount || 0) + 1;

    // Auto-flag if too many reports
    if (review.reportCount >= 3) {
      review.moderation.status = 'flagged';
    }

    await review.save();

    logger.info('Review reported', {
      reviewId: review._id,
      reportedBy: req.user!.id,
      reason,
    });

    res.json({
      success: true,
      message: 'Report submitted. Thank you for helping keep our community safe.',
    });
  })
);

// GET /api/v1/reviews/pending/appointments - Get appointments pending review
router.get(
  '/pending/appointments',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const pendingReviews = await Appointment.find({
      clientId: req.user!.id,
      status: 'completed',
      endDateTime: { $gte: thirtyDaysAgo },
      'review.submitted': { $ne: true },
    })
      .populate('businessId', 'name slug media.logo')
      .populate('staffId', 'profile.firstName profile.lastName')
      .sort({ endDateTime: -1 })
      .limit(10);

    res.json({
      success: true,
      data: { appointments: pendingReviews },
    });
  })
);

// Helper functions
async function updateBusinessStats(businessId: string): Promise<void> {
  const stats = await Review.aggregate([
    {
      $match: {
        businessId: new mongoose.Types.ObjectId(businessId),
        status: 'active',
        'moderation.status': 'approved',
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$ratings.overall' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const result = stats[0] || { averageRating: 0, totalReviews: 0 };

  await Business.findByIdAndUpdate(businessId, {
    'stats.averageRating': Math.round(result.averageRating * 10) / 10,
    'stats.totalReviews': result.totalReviews,
  });
}

async function updateStaffStats(staffId: string): Promise<void> {
  const stats = await Review.aggregate([
    {
      $match: {
        staffId: new mongoose.Types.ObjectId(staffId),
        status: 'active',
        'moderation.status': 'approved',
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$ratings.overall' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const result = stats[0] || { averageRating: 0, totalReviews: 0 };

  await Staff.findByIdAndUpdate(staffId, {
    'stats.averageRating': Math.round(result.averageRating * 10) / 10,
    'stats.totalReviews': result.totalReviews,
  });
}

export default router;
