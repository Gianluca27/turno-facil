import { Promotion } from '../../../infrastructure/database/mongodb/models/Promotion.js';

export interface ListPromotionsInput {
  businessId: string;
  status?: string;
  page: number;
  limit: number;
}

export interface ListPromotionsResult {
  promotions: Record<string, unknown>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Lists promotions for a business with pagination and optional status filter.
 * Calculates usageRate and isActive for each promotion.
 */
export async function listPromotions(input: ListPromotionsInput): Promise<ListPromotionsResult> {
  const { businessId, status } = input;

  const pageNum = input.page;
  const limitNum = Math.min(input.limit, 50);
  const skip = (pageNum - 1) * limitNum;

  const query: Record<string, unknown> = { businessId };

  if (status) {
    query.status = status;
  }

  const [promotions, total] = await Promise.all([
    Promotion.find(query)
      .populate('conditions.services', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Promotion.countDocuments(query),
  ]);

  // Calculate usage stats
  const promotionsWithStats = promotions.map((p) => ({
    ...p,
    usageRate: p.limits?.totalUses ? Math.round(((p.limits.currentUses || 0) / p.limits.totalUses) * 100) : null,
    isActive: p.status === 'active' && new Date(p.validFrom) <= new Date() && new Date(p.validUntil) >= new Date(),
  }));

  return {
    promotions: promotionsWithStats,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
}
