import mongoose from 'mongoose';
import { Review } from '../../../infrastructure/database/mongodb/models/Review.js';
import { logger } from '../../../utils/logger.js';

export interface GetReviewStatsInput {
  businessId: string;
  months: number;
}

export interface KeywordEntry {
  word: string;
  count: number;
}

export interface GetReviewStatsResult {
  monthly: Array<{
    month: string;
    count: number;
    avgRating: number;
  }>;
  staffRatings: any[];
  keywords: {
    positive: KeywordEntry[];
    negative: KeywordEntry[];
  };
}

/**
 * Generates a review statistics summary including monthly breakdown,
 * per-staff ratings (via $lookup), and keyword frequency analysis
 * for positive and negative reviews.
 */
export async function getReviewStats(input: GetReviewStatsInput): Promise<GetReviewStatsResult> {
  const { businessId, months } = input;

  const monthsNum = Math.min(months, 12);
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsNum);

  // ---------- Monthly breakdown ----------
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

  // ---------- Staff ratings with $lookup ----------
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

  // ---------- Keyword analysis ----------
  const recentReviews = await Review.find({
    businessId,
    status: 'published',
  })
    .select('content.text ratings.overall')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const positiveKeywords: Record<string, number> = {};
  const negativeKeywords: Record<string, number> = {};

  const keywords = [
    'excelente', 'profesional', 'amable', 'limpio', 'puntual', 'recomiendo',
    'malo', 'lento', 'caro', 'sucio', 'impuntual', 'espera',
  ];

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

  logger.info('Review stats generated', { businessId, months: monthsNum });

  return {
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
  };
}
