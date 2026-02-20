import { Campaign } from '../../../infrastructure/database/mongodb/models/Campaign.js';
import { ClientBusinessRelation } from '../../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';
import { BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import { buildAudienceQuery } from './shared.js';

export interface CreateCampaignInput {
  businessId: string;
  name: string;
  type: 'email' | 'push' | 'sms';
  subject?: string;
  content: string;
  targetAudience: 'all' | 'new' | 'returning' | 'inactive' | 'custom';
  customFilters?: {
    minBookings?: number;
    maxBookings?: number;
    minSpent?: number;
    lastVisitDays?: number;
    services?: string[];
  };
  scheduledFor?: string;
  promotionId?: string;
}

export interface CreateCampaignResult {
  campaign: any;
  audienceCount: number;
}

/**
 * Creates a new marketing campaign. Calculates the target audience
 * count using buildAudienceQuery, maps the audience structure,
 * and persists the campaign document.
 */
export async function createCampaign(input: CreateCampaignInput): Promise<CreateCampaignResult> {
  const { businessId } = input;

  // Calculate target audience count
  const audienceQuery = await buildAudienceQuery(businessId, input.targetAudience, input.customFilters);
  const audienceCount = await ClientBusinessRelation.countDocuments(audienceQuery);

  if (audienceCount === 0) {
    throw new BadRequestError('No clients match the selected criteria');
  }

  // Map targetAudience to audience structure
  const audienceType = input.targetAudience === 'all' ? 'all' :
                       input.targetAudience === 'custom' ? 'custom' : 'segment';
  const audienceSegment = ['new', 'returning', 'inactive'].includes(input.targetAudience)
                          ? input.targetAudience as 'new' | 'returning' | 'inactive'
                          : undefined;

  const campaign = new Campaign({
    businessId,
    name: input.name,
    type: input.type,
    content: {
      title: input.subject || input.name,
      body: input.content,
    },
    audience: {
      type: audienceType,
      segment: audienceSegment,
      customFilters: input.customFilters ? {
        lastVisitDaysAgo: input.customFilters.lastVisitDays,
        totalVisits: input.customFilters.minBookings,
        totalSpent: input.customFilters.minSpent,
        services: input.customFilters.services,
      } : undefined,
    },
    schedule: {
      type: input.scheduledFor ? 'scheduled' : 'immediate',
      sendAt: input.scheduledFor ? new Date(input.scheduledFor) : undefined,
    },
    status: input.scheduledFor ? 'scheduled' : 'draft',
    stats: {
      totalRecipients: audienceCount,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
    },
  });

  await campaign.save();

  logger.info('Campaign created', {
    campaignId: campaign._id,
    businessId,
    type: input.type,
    targetAudience: input.targetAudience,
  });

  return {
    campaign: campaign.toObject(),
    audienceCount,
  };
}
