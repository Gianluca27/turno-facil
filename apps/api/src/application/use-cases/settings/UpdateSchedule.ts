import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface UpdateScheduleInput {
  businessId: string;
  timezone?: string;
  regular?: any;
  exceptions?: any;
}

export interface UpdateScheduleResult {
  schedule: any;
}

/**
 * Updates the business schedule including timezone, regular hours,
 * and schedule exceptions.
 */
export async function updateSchedule(input: UpdateScheduleInput): Promise<UpdateScheduleResult> {
  const { businessId, timezone, regular, exceptions } = input;

  const business = await Business.findByIdAndUpdate(
    businessId,
    {
      $set: {
        'schedule.timezone': timezone,
        'schedule.regular': regular,
        'schedule.exceptions': exceptions,
      },
    },
    { new: true }
  );

  if (!business) throw new NotFoundError('Business not found');

  logger.info('Schedule updated', { businessId });

  return { schedule: business.schedule };
}
