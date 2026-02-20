import { Waitlist } from '../../../infrastructure/database/mongodb/models/Waitlist.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';

export interface GetWaitlistEntryInput {
  waitlistId: string;
  businessId: string;
}

export interface GetWaitlistEntryResult {
  entry: any;
}

/**
 * Retrieves a single waitlist entry by ID with populated client,
 * services, and staff data.
 */
export async function getWaitlistEntry(input: GetWaitlistEntryInput): Promise<GetWaitlistEntryResult> {
  const { waitlistId, businessId } = input;

  const entry = await Waitlist.findOne({
    _id: waitlistId,
    businessId,
  })
    .populate('clientId', 'profile email phone')
    .populate('preferences.services', 'name duration price category')
    .populate('preferences.staffId', 'profile');

  if (!entry) {
    throw new NotFoundError('Waitlist entry not found');
  }

  return { entry };
}
