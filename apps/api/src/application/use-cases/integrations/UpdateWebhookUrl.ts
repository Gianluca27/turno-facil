import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface UpdateWebhookUrlInput {
  businessId: string;
  url?: string;
  userId: string;
}

export interface UpdateWebhookUrlResult {
  message: string;
  webhookUrl: string | null;
}

export async function updateWebhookUrl(input: UpdateWebhookUrlInput): Promise<UpdateWebhookUrlResult> {
  const { businessId, url, userId } = input;

  if (url && !/^https?:\/\/.+/.test(url)) {
    throw new BadRequestError('Invalid webhook URL');
  }

  const business = await Business.findByIdAndUpdate(
    businessId,
    { webhookUrl: url || null },
    { new: true }
  );

  if (!business) {
    throw new NotFoundError('Business not found');
  }

  logger.info('Webhook URL updated', {
    businessId,
    url: url || 'removed',
    updatedBy: userId,
  });

  return {
    message: url ? 'Webhook URL updated' : 'Webhook URL removed',
    webhookUrl: url || null,
  };
}
