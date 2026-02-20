import { Router, Response } from 'express';
import { z } from 'zod';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  listIntegrations,
  getIntegration,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  connectMercadoPago,
  disconnectMercadoPago,
  testWebhook,
  updateWebhookUrl,
  getOAuthUrl,
} from '../../../application/use-cases/integrations/index.js';

const router = Router();

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
    const { integrations } = await listIntegrations({ businessId });
    res.json({ success: true, data: { integrations } });
  })
);

// GET /api/v1/manage/integrations/oauth/google-calendar - Get Google Calendar OAuth URL
router.get(
  '/oauth/google-calendar',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { authUrl } = await getOAuthUrl({ businessId, provider: 'google-calendar' });
    res.json({ success: true, data: { authUrl } });
  })
);

// GET /api/v1/manage/integrations/oauth/mercadopago - Get MercadoPago OAuth URL
router.get(
  '/oauth/mercadopago',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { authUrl } = await getOAuthUrl({ businessId, provider: 'mercadopago' });
    res.json({ success: true, data: { authUrl } });
  })
);

// GET /api/v1/manage/integrations/:id - Get integration details
router.get(
  '/:id',
  requirePermission('settings:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { integration } = await getIntegration({ integrationId: req.params.id, businessId });
    res.json({ success: true, data: { integration } });
  })
);

// POST /api/v1/manage/integrations/google-calendar - Connect Google Calendar
router.post(
  '/google-calendar',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { authCode } = googleCalendarConnectSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;
    const { integration } = await connectGoogleCalendar({ businessId, userId: req.user!.id, authCode });
    res.json({ success: true, data: { integration } });
  })
);

// DELETE /api/v1/manage/integrations/google-calendar - Disconnect Google Calendar
router.delete(
  '/google-calendar',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    await disconnectGoogleCalendar({ businessId, userId: req.user!.id });
    res.json({ success: true });
  })
);

// POST /api/v1/manage/integrations/mercadopago - Connect MercadoPago
router.post(
  '/mercadopago',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { authCode } = mercadoPagoConnectSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;
    const { integration } = await connectMercadoPago({ businessId, userId: req.user!.id, authCode });
    res.json({ success: true, data: { integration } });
  })
);

// DELETE /api/v1/manage/integrations/mercadopago - Disconnect MercadoPago
router.delete(
  '/mercadopago',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    await disconnectMercadoPago({ businessId, userId: req.user!.id });
    res.json({ success: true });
  })
);

// POST /api/v1/manage/integrations/test-webhook - Test webhook
router.post(
  '/test-webhook',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { type } = webhookTestSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;
    const { payload, url } = await testWebhook({ businessId, type });
    res.json({ success: true, data: { payload, url } });
  })
);

// PUT /api/v1/manage/integrations/webhook-url - Update webhook URL
router.put(
  '/webhook-url',
  requirePermission('settings:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { webhookUrl } = await updateWebhookUrl({ businessId, userId: req.user!.id, url: req.body.url });
    res.json({ success: true, data: { webhookUrl } });
  })
);

export default router;
