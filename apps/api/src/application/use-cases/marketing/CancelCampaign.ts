import { Campaign } from '../../../infrastructure/database/mongodb/models/Campaign.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';

export interface CancelCampaignInput {
  campaignId: string;
  businessId: string;
}

export interface CancelCampaignResult {
  message: string;
}

/**
 * Cancels a scheduled campaign by setting its status to 'cancelled'.
 * Only campaigns with status 'scheduled' can be cancelled.
 */
export async function cancelCampaign(input: CancelCampaignInput): Promise<CancelCampaignResult> {
  const campaign = await Campaign.findOne({
    _id: input.campaignId,
    businessId: input.businessId,
    status: 'scheduled',
  });

  if (!campaign) {
    throw new NotFoundError('Scheduled campaign not found');
  }

  campaign.status = 'cancelled';
  await campaign.save();

  return { message: 'Campaign cancelled successfully' };
}
