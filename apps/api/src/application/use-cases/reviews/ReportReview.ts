import mongoose from 'mongoose';
import { Review } from '../../../infrastructure/database/mongodb/models/Review.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface ReportReviewInput {
  reviewId: string;
  businessId: string;
  userId: string;
  reason: string;
  details?: string;
}

/**
 * Reports a review for moderation. Sets moderation status to 'flagged',
 * records the reason and reporter, and increments the report count.
 */
export async function reportReview(input: ReportReviewInput): Promise<void> {
  const { reviewId, businessId, userId, reason, details } = input;

  const review = await Review.findOne({
    _id: reviewId,
    businessId,
  });

  if (!review) {
    throw new NotFoundError('Review not found');
  }

  if (review.moderation.status === 'flagged') {
    throw new BadRequestError('Review has already been reported');
  }

  review.moderation.status = 'flagged';
  review.moderation.reason = `${reason}${details ? ': ' + details : ''}`;
  review.moderation.reviewedAt = new Date();
  review.moderation.reviewedBy = new mongoose.Types.ObjectId(userId);
  review.reportCount = (review.reportCount || 0) + 1;

  await review.save();

  logger.info('Review reported', { reviewId: review._id, businessId, reason });
}
