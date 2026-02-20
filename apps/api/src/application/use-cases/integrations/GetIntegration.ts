import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { AVAILABLE_INTEGRATIONS, Integration } from './shared.js';

export interface GetIntegrationInput {
  businessId: string;
  integrationId: string;
}

export interface GetIntegrationResult {
  integration: Integration;
}

export async function getIntegration(input: GetIntegrationInput): Promise<GetIntegrationResult> {
  const { businessId, integrationId } = input;

  const integration = AVAILABLE_INTEGRATIONS.find((i) => i.id === integrationId);
  if (!integration) {
    throw new NotFoundError('Integration not found');
  }

  const business = await Business.findById(businessId).select('integrations').lean();
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  const connected = business.integrations?.[integrationId as keyof typeof business.integrations];

  return {
    integration: {
      ...integration,
      status: connected?.connected ? 'connected' : 'disconnected',
      connectedAt: connected?.connectedAt,
    },
  };
}
