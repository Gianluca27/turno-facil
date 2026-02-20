import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface ConnectMercadoPagoInput {
  businessId: string;
  authCode: string;
  userId: string;
}

export interface ConnectMercadoPagoResult {
  integration: {
    id: string;
    status: 'connected';
    connectedAt: Date | undefined;
    config: {
      publicKey: string | undefined;
    };
  };
}

export async function connectMercadoPago(input: ConnectMercadoPagoInput): Promise<ConnectMercadoPagoResult> {
  const { businessId, authCode, userId } = input;

  // TODO: Exchange auth code for tokens using MercadoPago OAuth (authCode)
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

  business.integrations.mercadoPago = {
    connected: true,
    connectedAt: new Date(),
    accessToken: 'simulated-access-token',
    refreshToken: 'simulated-refresh-token',
    publicKey: 'TEST-public-key',
    userId: 'simulated-user-id',
  };

  await business.save();

  logger.info('MercadoPago connected', {
    businessId,
    connectedBy: userId,
  });

  return {
    integration: {
      id: 'mercadopago',
      status: 'connected',
      connectedAt: business.integrations.mercadoPago?.connectedAt,
      config: {
        publicKey: business.integrations.mercadoPago?.publicKey,
      },
    },
  };
}
