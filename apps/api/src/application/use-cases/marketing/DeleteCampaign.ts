import { Campaign } from '../../../infrastructure/database/mongodb/models/Campaign.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';

export interface DeleteCampaignInput {
  campaignId: string;
  businessId: string;
}

export interface DeleteCampaignResult {
  message: string;
}

/**
 * Deletes a campaign. Only campaigns in 'draft' or 'cancelled' status
 * can be deleted.
 */
export async function deleteCampaign(input: DeleteCampaignInput): Promise<DeleteCampaignResult> {
  const campaign = await Campaign.findOne({
    _id: input.campaignId,
    businessId: input.businessId,
    status: { $in: ['draft', 'cancelled'] },
  });

  if (!campaign) {
    throw new NotFoundError('Campaign not found or cannot be deleted');
  }

  await campaign.deleteOne();

  return { message: 'Campaign deleted successfully' };
}
