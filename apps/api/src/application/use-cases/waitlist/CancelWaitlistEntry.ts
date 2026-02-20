import { Waitlist } from '../../../infrastructure/database/mongodb/models/Waitlist.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface CancelWaitlistEntryInput {
  waitlistId: string;
  businessId: string;
}

/**
 * Cancels (soft-deletes) a waitlist entry by setting its status
 * to 'cancelled'.
 */
export async function cancelWaitlistEntry(input: CancelWaitlistEntryInput): Promise<void> {
  const { waitlistId, businessId } = input;

  const entry = await Waitlist.findOne({
    _id: waitlistId,
    businessId,
  });

  if (!entry) {
    throw new NotFoundError('Waitlist entry not found');
  }

  entry.status = 'cancelled';
  await entry.save();

  logger.info('Waitlist entry cancelled', { waitlistId: entry._id, businessId });
}
