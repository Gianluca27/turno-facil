import { Campaign } from '../../../infrastructure/database/mongodb/models/Campaign.js';

export interface ListCampaignsInput {
  businessId: string;
  status?: string;
  type?: string;
  page: number;
  limit: number;
}

export interface ListCampaignsResult {
  campaigns: Record<string, unknown>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Lists campaigns for a business with pagination and optional
 * status/type filters.
 */
export async function listCampaigns(input: ListCampaignsInput): Promise<ListCampaignsResult> {
  const { businessId, status, type } = input;

  const pageNum = input.page;
  const limitNum = Math.min(input.limit, 50);
  const skip = (pageNum - 1) * limitNum;

  const query: Record<string, unknown> = { businessId };

  if (status) {
    query.status = status;
  }

  if (type) {
    query.type = type;
  }

  const [campaigns, total] = await Promise.all([
    Campaign.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Campaign.countDocuments(query),
  ]);

  return {
    campaigns,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
}
