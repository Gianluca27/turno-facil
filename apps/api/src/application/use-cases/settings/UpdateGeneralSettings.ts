import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface UpdateGeneralSettingsInput {
  businessId: string;
  data: {
    name?: string;
    type?: string;
    description?: string;
    contact?: {
      email?: string;
      phone?: string;
      whatsapp?: string;
      website?: string;
      socialMedia?: {
        instagram?: string;
        facebook?: string;
        tiktok?: string;
      };
    };
    location?: {
      address?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
  };
}

export interface UpdateGeneralSettingsResult {
  business: any;
}

/**
 * Updates the general settings of a business including name, type,
 * description, contact info, and location.
 */
export async function updateGeneralSettings(input: UpdateGeneralSettingsInput): Promise<UpdateGeneralSettingsResult> {
  const { businessId, data } = input;

  const business = await Business.findByIdAndUpdate(
    businessId,
    { $set: data },
    { new: true }
  );

  if (!business) throw new NotFoundError('Business not found');

  logger.info('General settings updated', { businessId });

  return { business };
}
