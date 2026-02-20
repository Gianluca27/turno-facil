import mongoose from 'mongoose';
import { Review } from '../../../infrastructure/database/mongodb/models/Review.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { notificationService } from '../../../domain/services/NotificationService.js';
import { logger } from '../../../utils/logger.js';

// ---------- Reply to review ----------

export interface ReplyToReviewInput {
  reviewId: string;
  businessId: string;
  userId: string;
  text: string;
}

export interface ReplyToReviewResult {
  review: any;
}

/**
 * Posts a business reply to a review and sends a notification
 * to the review author.
 */
export async function replyToReview(input: ReplyToReviewInput): Promise<ReplyToReviewResult> {
  const { reviewId, businessId, userId, text } = input;

  const review = await Review.findOne({
    _id: reviewId,
    businessId,
  });

  if (!review) {
    throw new NotFoundError('Review not found');
  }

  review.response = {
    text,
    respondedAt: new Date(),
    respondedBy: new mongoose.Types.ObjectId(userId),
  };

  await review.save();

  // Notify the review author
  await notificationService.sendNotification({
    userId: review.clientId.toString(),
    type: 'general',
    channels: ['push', 'email'],
    businessId,
    data: {
      title: 'Respuesta a tu reseña',
      body: 'El negocio ha respondido a tu reseña',
      reviewId: review._id.toString(),
    },
  });

  logger.info('Review replied', { reviewId: review._id, businessId });

  return { review };
}

// ---------- Update reply ----------

export interface UpdateReplyInput {
  reviewId: string;
  businessId: string;
  text: string;
}

export interface UpdateReplyResult {
  review: any;
}

/**
 * Updates an existing business reply on a review.
 */
export async function updateReply(input: UpdateReplyInput): Promise<UpdateReplyResult> {
  const { reviewId, businessId, text } = input;

  const review = await Review.findOne({
    _id: reviewId,
    businessId,
  });

  if (!review) {
    throw new NotFoundError('Review not found');
  }

  if (!review.response?.text) {
    throw new BadRequestError('No reply to update');
  }

  review.response.text = text;
  review.response.respondedAt = new Date();

  await review.save();

  logger.info('Review reply updated', { reviewId: review._id, businessId });

  return { review };
}

// ---------- Delete reply ----------

export interface DeleteReplyInput {
  reviewId: string;
  businessId: string;
}

/**
 * Removes the business reply from a review.
 */
export async function deleteReply(input: DeleteReplyInput): Promise<void> {
  const { reviewId, businessId } = input;

  const review = await Review.findOne({
    _id: reviewId,
    businessId,
  });

  if (!review) {
    throw new NotFoundError('Review not found');
  }

  review.response = undefined;
  await review.save();

  logger.info('Review reply deleted', { reviewId: review._id, businessId });
}
