import mongoose from 'mongoose';
import { Waitlist } from '../../../infrastructure/database/mongodb/models/Waitlist.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface UpdateWaitlistEntryInput {
  waitlistId: string;
  businessId: string;
  preferences?: {
    services?: string[];
    staffId?: string | null;
    dateRange?: {
      start: string;
      end: string;
    } | null;
    timeRange?: {
      start: string;
      end: string;
    } | null;
    daysOfWeek?: number[];
  };
  priority?: string;
  status?: string;
}

export interface UpdateWaitlistEntryResult {
  entry: any;
}

/**
 * Updates a waitlist entry's preferences, priority, or status.
 * Handles ObjectId conversions for services and staff references.
 */
export async function updateWaitlistEntry(input: UpdateWaitlistEntryInput): Promise<UpdateWaitlistEntryResult> {
  const { waitlistId, businessId, preferences, priority, status } = input;

  const entry = await Waitlist.findOne({
    _id: waitlistId,
    businessId,
  });

  if (!entry) {
    throw new NotFoundError('Waitlist entry not found');
  }

  // ---------- Update preferences ----------
  if (preferences) {
    if (preferences.services) {
      entry.preferences.services = preferences.services.map(
        (id) => new mongoose.Types.ObjectId(id),
      );
    }
    if (preferences.staffId !== undefined) {
      entry.preferences.staffId = preferences.staffId
        ? new mongoose.Types.ObjectId(preferences.staffId)
        : undefined;
    }
    if (preferences.dateRange !== undefined) {
      entry.preferences.dateRange = preferences.dateRange
        ? {
            from: new Date(preferences.dateRange.start),
            to: new Date(preferences.dateRange.end),
          }
        : undefined;
    }
    if (preferences.timeRange !== undefined) {
      entry.preferences.timeRange = preferences.timeRange
        ? {
            from: preferences.timeRange.start,
            to: preferences.timeRange.end,
          }
        : undefined;
    }
    if (preferences.daysOfWeek !== undefined) {
      entry.preferences.daysOfWeek = preferences.daysOfWeek;
    }
  }

  if (priority) {
    (entry as any).priority = priority;
  }

  if (status) {
    (entry as any).status = status;
  }

  await entry.save();

  logger.info('Waitlist entry updated', { waitlistId: entry._id, businessId });

  return { entry };
}
