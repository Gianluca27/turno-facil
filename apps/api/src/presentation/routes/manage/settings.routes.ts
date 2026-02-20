import { Router, Response } from 'express';
import { z } from 'zod';
import { requirePermission, requireRole, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  getSettings,
  updateGeneralSettings,
  updateSchedule,
  updateBookingConfig,
  updatePaymentConfig,
  getSubscription,
} from '../../../application/use-cases/settings/index.js';

const router = Router();

// GET /api/v1/manage/settings - Get all settings
router.get(
  '/',
  requirePermission('settings:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { settings } = await getSettings({ businessId });
    res.json({ success: true, data: { settings } });
  })
);

// PUT /api/v1/manage/settings/general - Update general settings
const generalSettingsSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  type: z.string().optional(),
  description: z.string().max(1000).optional(),
  contact: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    website: z.string().url().optional(),
    socialMedia: z.object({
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      tiktok: z.string().optional(),
    }).optional(),
  }).optional(),
  location: z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
});

router.put(
  '/general',
  requirePermission('settings:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const data = generalSettingsSchema.parse(req.body);
    const { business } = await updateGeneralSettings({ businessId, data });
    res.json({ success: true, data: { business } });
  })
);

// PUT /api/v1/manage/settings/schedule - Update schedule
router.put(
  '/schedule',
  requirePermission('settings:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const schedule = req.body;
    const { business } = await updateSchedule({ businessId, schedule });
    res.json({ success: true, data: { business } });
  })
);

// PUT /api/v1/manage/settings/booking - Update booking config
const bookingConfigSchema = z.object({
  slotDuration: z.number().min(5).max(240).optional(),
  bufferTime: z.number().min(0).max(60).optional(),
  maxSimultaneous: z.number().min(1).max(50).optional(),
  minAdvance: z.number().min(0).optional(),
  maxAdvance: z.number().min(1).max(365).optional(),
  allowInstantBooking: z.boolean().optional(),
  requireConfirmation: z.boolean().optional(),
  cancellationPolicy: z.object({
    allowCancellation: z.boolean().optional(),
    hoursBeforeAppointment: z.number().min(0).optional(),
    penaltyType: z.enum(['none', 'percentage', 'fixed']).optional(),
    penaltyAmount: z.number().min(0).optional(),
  }).optional(),
  requireDeposit: z.boolean().optional(),
  depositAmount: z.number().min(0).optional(),
  depositType: z.enum(['percentage', 'fixed']).optional(),
  maxBookingsPerClient: z.number().min(1).optional(),
  allowWaitlist: z.boolean().optional(),
});

router.put(
  '/booking',
  requirePermission('settings:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const data = bookingConfigSchema.parse(req.body);
    const { business } = await updateBookingConfig({ businessId, data });
    res.json({ success: true, data: { business } });
  })
);

// PUT /api/v1/manage/settings/payments - Update payment config
router.put(
  '/payments',
  requirePermission('settings:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const data = req.body;
    const { business } = await updatePaymentConfig({ businessId, data });
    res.json({ success: true, data: { business } });
  })
);

// GET /api/v1/manage/settings/subscription - Get subscription info
router.get(
  '/subscription',
  requireRole('owner', 'admin'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { subscription } = await getSubscription({ businessId });
    res.json({ success: true, data: { subscription } });
  })
);

export default router;
