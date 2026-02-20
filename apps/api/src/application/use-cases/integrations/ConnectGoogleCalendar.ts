import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface ConnectGoogleCalendarInput {
  businessId: string;
  authCode: string;
  userId: string;
}

export interface ConnectGoogleCalendarResult {
  integration: {
    id: string;
    status: 'connected';
    connectedAt: Date | undefined;
  };
}

export async function connectGoogleCalendar(input: ConnectGoogleCalendarInput): Promise<ConnectGoogleCalendarResult> {
  const { businessId, authCode, userId } = input;

  // TODO: Exchange auth code for tokens using Google OAuth (authCode)
  // For now, simulate the connection
  void authCode; // Will be used when implementing real OAuth

  const business = await Business.findById(businessId);
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  if (!business.integrations) {
    business.integrations = {
      googleCalendar: { connected: false },
      mercadoPago: { connected: false },
    };
  }

  business.integrations.googleCalendar = {
    connected: true,
    connectedAt: new Date(),
    accessToken: 'simulated-access-token',
    refreshToken: 'simulated-refresh-token',
    calendarId: 'primary',
    syncEnabled: true,
  };

  await business.save();

  logger.info('Google Calendar connected', {
    businessId,
    connectedBy: userId,
  });

  return {
    integration: {
      id: 'google-calendar',
      status: 'connected',
      connectedAt: business.integrations.googleCalendar?.connectedAt,
    },
  };
}
