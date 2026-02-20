import { Router, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import {
  listReviews,
  getReview,
  replyToReview,
  updateReply,
  deleteReply,
  reportReview,
  getReviewStats,
  requestReview,
} from '../../../application/use-cases/reviews/index.js';

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
    const { rating, hasReply, staffId, startDate, endDate, sort, page = '1', limit = '20' } =
      req.query as Record<string, string>;

    const result = await listReviews({
      businessId: req.currentBusiness!.businessId,
      rating: rating ? parseInt(rating, 10) : undefined,
      hasReply,
      staffId,
      startDate,
      endDate,
      sort,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    res.json({ success: true, data: result });
  })
);

// GET /api/v1/manage/reviews/stats/summary - Get review statistics
router.get(
  '/stats/summary',
  requirePermission('reviews:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { months = '6' } = req.query as { months?: string };

    const result = await getReviewStats({
      businessId: req.currentBusiness!.businessId,
      months: parseInt(months, 10),
    });

    res.json({ success: true, data: result });
  })
);

// GET /api/v1/manage/reviews/:id - Get review details
router.get(
  '/:id',
  requirePermission('reviews:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await getReview({
      reviewId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/reviews/:id/reply - Reply to review
router.post(
  '/:id/reply',
  requirePermission('reviews:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = replySchema.parse(req.body);

    const result = await replyToReview({
      reviewId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      userId: req.user!.id,
      text: data.text,
    });

    res.json({ success: true, message: 'Reply posted successfully', data: result });
  })
);

// PUT /api/v1/manage/reviews/:id/reply - Update reply
router.put(
  '/:id/reply',
  requirePermission('reviews:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = replySchema.parse(req.body);

    const result = await updateReply({
      reviewId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      text: data.text,
    });

    res.json({ success: true, message: 'Reply updated successfully', data: result });
  })
);

// DELETE /api/v1/manage/reviews/:id/reply - Delete reply
router.delete(
  '/:id/reply',
  requirePermission('reviews:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    await deleteReply({
      reviewId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({ success: true, message: 'Reply deleted successfully' });
  })
);

// POST /api/v1/manage/reviews/:id/report - Report a review
router.post(
  '/:id/report',
  requirePermission('reviews:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = reportSchema.parse(req.body);

    await reportReview({
      reviewId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      userId: req.user!.id,
      reason: data.reason,
      details: data.details,
    });

    res.json({ success: true, message: 'Review reported successfully. Our team will review it.' });
  })
);

// POST /api/v1/manage/reviews/request - Request review from client
router.post(
  '/request',
  requirePermission('reviews:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    await requestReview({
      businessId: req.currentBusiness!.businessId,
      appointmentId: req.body.appointmentId,
    });

    res.json({ success: true, message: 'Review request sent successfully' });
  })
);

export default router;
