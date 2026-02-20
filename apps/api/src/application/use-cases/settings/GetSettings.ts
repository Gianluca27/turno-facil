import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface GetSettingsInput {
  businessId: string;
}

export interface GetSettingsResult {
  settings: any;
}

/**
 * Retrieves all settings for a business including general info,
 * schedule, booking config, payment config, and subscription details.
 */
export async function getSettings(input: GetSettingsInput): Promise<GetSettingsResult> {
  const { businessId } = input;

  const business = await Business.findById(businessId).select(
    'name type description contact location schedule bookingConfig paymentConfig reviewConfig subscription'
  );

  if (!business) throw new NotFoundError('Business not found');

  logger.info('Settings retrieved', { businessId });

  return { settings: business };
}
