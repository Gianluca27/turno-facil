import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface GetSubscriptionInput {
  businessId: string;
}

export interface GetSubscriptionResult {
  subscription: any;
}

/**
 * Retrieves the subscription information for a business.
 */
export async function getSubscription(input: GetSubscriptionInput): Promise<GetSubscriptionResult> {
  const { businessId } = input;

  const business = await Business.findById(businessId).select('subscription');

  if (!business) throw new NotFoundError('Business not found');

  logger.info('Subscription info retrieved', { businessId });

  return { subscription: business.subscription };
}
