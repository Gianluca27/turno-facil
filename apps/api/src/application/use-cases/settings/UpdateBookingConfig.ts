import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface UpdateBookingConfigInput {
  businessId: string;
  data: {
    slotDuration?: number;
    bufferTime?: number;
    maxSimultaneous?: number;
    minAdvance?: number;
    maxAdvance?: number;
    allowInstantBooking?: boolean;
    requireConfirmation?: boolean;
    cancellationPolicy?: {
      allowCancellation?: boolean;
      hoursBeforeAppointment?: number;
      penaltyType?: 'none' | 'percentage' | 'fixed';
      penaltyAmount?: number;
    };
    requireDeposit?: boolean;
    depositAmount?: number;
    depositType?: 'percentage' | 'fixed';
    maxBookingsPerClient?: number;
    allowWaitlist?: boolean;
  };
}

export interface UpdateBookingConfigResult {
  bookingConfig: any;
}

/**
 * Updates the booking configuration for a business, flattening nested
 * objects into dot-notation keys for proper MongoDB $set operations.
 */
export async function updateBookingConfig(input: UpdateBookingConfigInput): Promise<UpdateBookingConfigResult> {
  const { businessId, data } = input;

  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'object' && value !== null) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        updateData[`bookingConfig.${key}.${subKey}`] = subValue;
      }
    } else {
      updateData[`bookingConfig.${key}`] = value;
    }
  }

  const business = await Business.findByIdAndUpdate(
    businessId,
    { $set: updateData },
    { new: true }
  );

  if (!business) throw new NotFoundError('Business not found');

  logger.info('Booking config updated', { businessId });

  return { bookingConfig: business.bookingConfig };
}
