import { Review } from '../../../infrastructure/database/mongodb/models/Review.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';

export interface GetReviewInput {
  reviewId: string;
  businessId: string;
}

export interface GetReviewResult {
  review: any;
}

/**
 * Retrieves a single review by ID with populated client, staff,
 * and appointment data.
 */
export async function getReview(input: GetReviewInput): Promise<GetReviewResult> {
  const { reviewId, businessId } = input;

  const review = await Review.findOne({
    _id: reviewId,
    businessId,
  })
    .populate('clientId', 'profile.firstName profile.lastName profile.avatar email')
    .populate('staffId', 'profile')
    .populate('appointmentId');

  if (!review) {
    throw new NotFoundError('Review not found');
  }

  return { review };
}
