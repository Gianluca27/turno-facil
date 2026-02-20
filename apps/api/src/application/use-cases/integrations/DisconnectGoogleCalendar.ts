import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface DisconnectGoogleCalendarInput {
  businessId: string;
  userId: string;
}

export interface DisconnectGoogleCalendarResult {
  message: string;
}

export async function disconnectGoogleCalendar(input: DisconnectGoogleCalendarInput): Promise<DisconnectGoogleCalendarResult> {
  const { businessId, userId } = input;

  const business = await Business.findById(businessId);
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  if (business.integrations?.googleCalendar) {
    business.integrations.googleCalendar = {
      connected: false,
      syncEnabled: false,
    };
    await business.save();
  }

  logger.info('Google Calendar disconnected', {
    businessId,
    disconnectedBy: userId,
  });

  return { message: 'Google Calendar disconnected' };
}
