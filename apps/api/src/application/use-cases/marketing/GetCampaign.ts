import { Campaign } from '../../../infrastructure/database/mongodb/models/Campaign.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';

export interface GetCampaignInput {
  campaignId: string;
  businessId: string;
}

export interface GetCampaignResult {
  campaign: any;
}

/**
 * Retrieves a single campaign by ID, scoped to the business.
 */
export async function getCampaign(input: GetCampaignInput): Promise<GetCampaignResult> {
  const campaign = await Campaign.findOne({
    _id: input.campaignId,
    businessId: input.businessId,
  });

  if (!campaign) {
    throw new NotFoundError('Campaign not found');
  }

  return { campaign: campaign.toObject() };
}
