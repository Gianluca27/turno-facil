import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface DisconnectMercadoPagoInput {
  businessId: string;
  userId: string;
}

export interface DisconnectMercadoPagoResult {
  message: string;
}

export async function disconnectMercadoPago(input: DisconnectMercadoPagoInput): Promise<DisconnectMercadoPagoResult> {
  const { businessId, userId } = input;

  const business = await Business.findById(businessId);
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  if (business.integrations?.mercadoPago) {
    business.integrations.mercadoPago = {
      connected: false,
    };
    await business.save();
  }

  logger.info('MercadoPago disconnected', {
    businessId,
    disconnectedBy: userId,
  });

  return { message: 'MercadoPago disconnected' };
}
