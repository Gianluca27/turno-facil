import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface UpdatePaymentConfigInput {
  businessId: string;
  acceptedMethods?: string[];
  requirePaymentOnBooking?: boolean;
}

export interface UpdatePaymentConfigResult {
  paymentConfig: any;
}

/**
 * Updates the payment configuration for a business,
 * including accepted payment methods and booking payment requirements.
 */
export async function updatePaymentConfig(input: UpdatePaymentConfigInput): Promise<UpdatePaymentConfigResult> {
  const { businessId, acceptedMethods, requirePaymentOnBooking } = input;

  const business = await Business.findByIdAndUpdate(
    businessId,
    {
      $set: {
        'paymentConfig.acceptedMethods': acceptedMethods,
        'paymentConfig.requirePaymentOnBooking': requirePaymentOnBooking,
      },
    },
    { new: true }
  );

  if (!business) throw new NotFoundError('Business not found');

  logger.info('Payment config updated', { businessId });

  return { paymentConfig: business.paymentConfig };
}
