import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface TestWebhookInput {
  businessId: string;
  type: 'appointment_created' | 'appointment_cancelled' | 'payment_received';
}

export interface TestWebhookResult {
  payload: Record<string, unknown>;
  url: string;
}

export async function testWebhook(input: TestWebhookInput): Promise<TestWebhookResult> {
  const { businessId, type } = input;

  const business = await Business.findById(businessId).select('webhookUrl').lean();
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  if (!business.webhookUrl) {
    throw new BadRequestError('No webhook URL configured');
  }

  // Simulate webhook test payload
  const testPayload: Record<string, unknown> = {
    event: type,
    timestamp: new Date().toISOString(),
    businessId,
    test: true,
    data: {
      id: 'test-' + Date.now(),
      message: 'This is a test webhook',
    },
  };

  // TODO: Actually send the webhook
  logger.info('Webhook test sent', {
    businessId,
    type,
    url: business.webhookUrl,
  });

  return {
    payload: testPayload,
    url: business.webhookUrl,
  };
}
