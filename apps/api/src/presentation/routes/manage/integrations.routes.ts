import { Router, Response } from 'express';
import { z } from 'zod';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { asyncHandler, NotFoundError, BadRequestError } from '../../middleware/errorHandler.js';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { logger } from '../../../utils/logger.js';

const router = Router();

// Integration types
interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'calendar' | 'payment' | 'marketing' | 'communication';
  status: 'connected' | 'disconnected' | 'pending';
  connectedAt?: Date;
  config?: Record<string, unknown>;
}

const AVAILABLE_INTEGRATIONS: Omit<Integration, 'status' | 'connectedAt' | 'config'>[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sincroniza tus turnos con Google Calendar',
    icon: 'google',
    category: 'calendar',
  },
  {
    id: 'mercadopago',
    name: 'MercadoPago',
    description: 'Acepta pagos online con MercadoPago',
    icon: 'mercadopago',
    category: 'payment',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Envía notificaciones por WhatsApp',
    icon: 'whatsapp',
    category: 'communication',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Muestra tu perfil de Instagram',
    icon: 'instagram',
    category: 'marketing',
  },
];

// Validation schemas
const googleCalendarConnectSchema = z.object({
  authCode: z.string().min(1),
});

const mercadoPagoConnectSchema = z.object({
  authCode: z.string().min(1),
});

const webhookTestSchema = z.object({
  type: z.enum(['appointment_created', 'appointment_cancelled', 'payment_received']),
});

// GET /api/v1/manage/integrations - Get all integrations
router.get(
  '/',
  requirePermission('settings:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;

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

    res.json({
      success: true,
      data: { integrations },
    });
  })
);

// GET /api/v1/manage/integrations/:id - Get integration details
router.get(
  '/:id',
  requirePermission('settings:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const integrationId = req.params.id;

    const integration = AVAILABLE_INTEGRATIONS.find((i) => i.id === integrationId);
    if (!integration) {
      throw new NotFoundError('Integration not found');
    }

    const business = await Business.findById(businessId).select('integrations').lean();
    if (!business) {
      throw new NotFoundError('Business not found');
    }

    const connected = business.integrations?.[integrationId as keyof typeof business.integrations];

    res.json({
      success: true,
      data: {
        integration: {
          ...integration,
          status: connected?.connected ? 'connected' : 'disconnected',
          connectedAt: connected?.connectedAt,
        },
      },
    });
  })
);

// POST /api/v1/manage/integrations/google-calendar - Connect Google Calendar
router.post(
  '/google-calendar',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    // Validate input (authCode will be used when implementing real OAuth)
    const data = googleCalendarConnectSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    // TODO: Exchange auth code for tokens using Google OAuth (data.authCode)
    // For now, simulate the connection
    void data.authCode; // Will be used when implementing real OAuth

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
      connectedBy: req.user!.id,
    });

    res.json({
      success: true,
      message: 'Google Calendar connected successfully',
      data: {
        integration: {
          id: 'google-calendar',
          status: 'connected',
          connectedAt: business.integrations.googleCalendar?.connectedAt,
        },
      },
    });
  })
);

// DELETE /api/v1/manage/integrations/google-calendar - Disconnect Google Calendar
router.delete(
  '/google-calendar',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;

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
      disconnectedBy: req.user!.id,
    });

    res.json({
      success: true,
      message: 'Google Calendar disconnected',
    });
  })
);

// POST /api/v1/manage/integrations/mercadopago - Connect MercadoPago
router.post(
  '/mercadopago',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    // Validate input (authCode will be used when implementing real OAuth)
    const data = mercadoPagoConnectSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    // TODO: Exchange auth code for tokens using MercadoPago OAuth (data.authCode)
    // For now, simulate the connection
    void data.authCode; // Will be used when implementing real OAuth

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
      connectedBy: req.user!.id,
    });

    res.json({
      success: true,
      message: 'MercadoPago connected successfully',
      data: {
        integration: {
          id: 'mercadopago',
          status: 'connected',
          connectedAt: business.integrations.mercadoPago?.connectedAt,
          config: {
            publicKey: business.integrations.mercadoPago?.publicKey,
          },
        },
      },
    });
  })
);

// DELETE /api/v1/manage/integrations/mercadopago - Disconnect MercadoPago
router.delete(
  '/mercadopago',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;

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
      disconnectedBy: req.user!.id,
    });

    res.json({
      success: true,
      message: 'MercadoPago disconnected',
    });
  })
);

// POST /api/v1/manage/integrations/test-webhook - Test webhook
router.post(
  '/test-webhook',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = webhookTestSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    const business = await Business.findById(businessId).select('webhookUrl').lean();
    if (!business) {
      throw new NotFoundError('Business not found');
    }

    if (!business.webhookUrl) {
      throw new BadRequestError('No webhook URL configured');
    }

    // Simulate webhook test payload
    const testPayload = {
      event: data.type,
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
      type: data.type,
      url: business.webhookUrl,
    });

    res.json({
      success: true,
      message: 'Test webhook sent',
      data: {
        payload: testPayload,
        url: business.webhookUrl,
      },
    });
  })
);

// PUT /api/v1/manage/integrations/webhook-url - Update webhook URL
router.put(
  '/webhook-url',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { url } = req.body;
    const businessId = req.currentBusiness!.businessId;

    if (url && !/^https?:\/\/.+/.test(url)) {
      throw new BadRequestError('Invalid webhook URL');
    }

    const business = await Business.findByIdAndUpdate(
      businessId,
      { webhookUrl: url || null },
      { new: true }
    );

    if (!business) {
      throw new NotFoundError('Business not found');
    }

    logger.info('Webhook URL updated', {
      businessId,
      url: url || 'removed',
      updatedBy: req.user!.id,
    });

    res.json({
      success: true,
      message: url ? 'Webhook URL updated' : 'Webhook URL removed',
      data: { webhookUrl: url || null },
    });
  })
);

// GET /api/v1/manage/integrations/oauth/google-calendar - Get Google Calendar OAuth URL
router.get(
  '/oauth/google-calendar',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;

    // Generate OAuth URL
    // TODO: Use actual Google OAuth client
    const clientId = process.env.GOOGLE_CLIENT_ID || 'your-client-id';
    const redirectUri = encodeURIComponent(`${process.env.API_URL}/api/v1/oauth/callback/google`);
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar');
    const state = Buffer.from(JSON.stringify({ businessId, provider: 'google-calendar' })).toString('base64');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;

    res.json({
      success: true,
      data: { authUrl },
    });
  })
);

// GET /api/v1/manage/integrations/oauth/mercadopago - Get MercadoPago OAuth URL
router.get(
  '/oauth/mercadopago',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;

    // Generate OAuth URL
    // TODO: Use actual MercadoPago OAuth client
    const clientId = process.env.MERCADOPAGO_CLIENT_ID || 'your-client-id';
    const redirectUri = encodeURIComponent(`${process.env.API_URL}/api/v1/oauth/callback/mercadopago`);
    const state = Buffer.from(JSON.stringify({ businessId, provider: 'mercadopago' })).toString('base64');

    const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&redirect_uri=${redirectUri}&state=${state}`;

    res.json({
      success: true,
      data: { authUrl },
    });
  })
);

export default router;
