import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { AVAILABLE_INTEGRATIONS, Integration } from './shared.js';

export interface ListIntegrationsInput {
  businessId: string;
}

export interface ListIntegrationsResult {
  integrations: Integration[];
}

export async function listIntegrations(input: ListIntegrationsInput): Promise<ListIntegrationsResult> {
  const { businessId } = input;

  const business = await Business.findById(businessId).select('integrations').lean();
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  const connectedIntegrations = business.integrations || {};

  const integrations: Integration[] = AVAILABLE_INTEGRATIONS.map((integration) => {
    const connected = connectedIntegrations[integration.id as keyof typeof connectedIntegrations];
    return {
      ...integration,
      status: connected?.connected ? 'connected' : 'disconnected',
      connectedAt: connected?.connectedAt,
    };
  });

  return { integrations };
}
