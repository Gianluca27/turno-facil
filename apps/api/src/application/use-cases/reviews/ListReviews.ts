import mongoose from 'mongoose';
import { Review } from '../../../infrastructure/database/mongodb/models/Review.js';
import { logger } from '../../../utils/logger.js';

export interface ListReviewsInput {
  businessId: string;
  rating?: number;
  hasReply?: string;
  staffId?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
  page: number;
  limit: number;
}

export interface ReviewStats {
  totalReviews: number;
  avgRating: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  responseRate: number;
  pendingReplies: number;
}

export interface ListReviewsResult {
  reviews: any[];
  stats: ReviewStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Lists reviews for a business with filtering, pagination, sorting,
 * and aggregated statistics (total, average rating, distribution,
 * response rate, pending replies).
 */
export async function listReviews(input: ListReviewsInput): Promise<ListReviewsResult> {
  const {
    businessId,
    rating,
    hasReply,
    staffId,
    startDate,
    endDate,
    sort = '-createdAt',
    page,
    limit,
  } = input;

  const pageNum = page;
  const limitNum = Math.min(limit, 50);
  const skip = (pageNum - 1) * limitNum;

  // ---------- Build query ----------
  const query: Record<string, unknown> = {
    businessId,
    status: { $in: ['published', 'pending'] },
  };

  if (rating) {
    query['ratings.overall'] = rating;
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

  // ---------- Sort ----------
  const sortOrder = sort.startsWith('-') ? -1 : 1;
  const sortField = sort.replace('-', '');

  // ---------- Fetch reviews + count ----------
  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate('clientId', 'profile.firstName profile.lastName profile.avatar')
      .populate('staffId', 'profile.firstName profile.lastName')
      .populate('appointmentId', 'services date startTime')
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Review.countDocuments(query),
  ]);

  // ---------- Aggregate stats ----------
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
        withReply: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ['$response.text', null] }, { $ne: ['$response.text', ''] }] },
              1,
              0,
            ],
          },
        },
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

  // ---------- Pending replies ----------
  const pendingReplies = await Review.countDocuments({
    businessId,
    status: 'published',
    $or: [
      { 'response.text': { $exists: false } },
      { 'response.text': '' },
    ],
  });

  logger.info('Reviews listed', { businessId, total });

  return {
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
      responseRate:
        reviewStats.totalReviews > 0
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
  };
}
