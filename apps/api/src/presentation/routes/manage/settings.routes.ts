import { Router, Response } from 'express';
import { z } from 'zod';
import { requirePermission, requireRole, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler, NotFoundError } from '../../middleware/errorHandler.js';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';

const router = Router();

// GET /api/v1/manage/settings - Get all settings
router.get(
  '/',
  requirePermission('settings:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const business = await Business.findById(req.currentBusiness!.businessId).select(
      'name type description contact location schedule bookingConfig paymentConfig reviewConfig subscription'
    );

    if (!business) throw new NotFoundError('Business not found');

    res.json({ success: true, data: { settings: business } });
  })
);

// PUT /api/v1/manage/settings/general - Update general settings
router.put(
  '/general',
  requirePermission('settings:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const schema = z.object({
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

    const data = schema.parse(req.body);

    const business = await Business.findByIdAndUpdate(
      req.currentBusiness!.businessId,
      { $set: data },
      { new: true }
    );

    if (!business) throw new NotFoundError('Business not found');

    res.json({ success: true, data: { business } });
  })
);

// PUT /api/v1/manage/settings/schedule - Update schedule
router.put(
  '/schedule',
  requirePermission('settings:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { timezone, regular, exceptions } = req.body;

    const business = await Business.findByIdAndUpdate(
      req.currentBusiness!.businessId,
      { $set: { 'schedule.timezone': timezone, 'schedule.regular': regular, 'schedule.exceptions': exceptions } },
      { new: true }
    );

    if (!business) throw new NotFoundError('Business not found');

    res.json({ success: true, data: { schedule: business.schedule } });
  })
);

// PUT /api/v1/manage/settings/booking - Update booking config
router.put(
  '/booking',
  requirePermission('settings:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const schema = z.object({
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

    const data = schema.parse(req.body);

    const updateData: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        for (const [subKey, subValue] of Object.entries(value)) {
          updateData[`bookingConfig.${key}.${subKey}`] = subValue;
        }
      } else {
        updateData[`bookingConfig.${key}`] = value;
      }
    }

    const business = await Business.findByIdAndUpdate(
      req.currentBusiness!.businessId,
      { $set: updateData },
      { new: true }
    );

    if (!business) throw new NotFoundError('Business not found');

    res.json({ success: true, data: { bookingConfig: business.bookingConfig } });
  })
);

// PUT /api/v1/manage/settings/payments - Update payment config
router.put(
  '/payments',
  requirePermission('settings:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { acceptedMethods, requirePaymentOnBooking } = req.body;

    const business = await Business.findByIdAndUpdate(
      req.currentBusiness!.businessId,
      { $set: { 'paymentConfig.acceptedMethods': acceptedMethods, 'paymentConfig.requirePaymentOnBooking': requirePaymentOnBooking } },
      { new: true }
    );

    if (!business) throw new NotFoundError('Business not found');

    res.json({ success: true, data: { paymentConfig: business.paymentConfig } });
  })
);

// GET /api/v1/manage/settings/subscription - Get subscription info
router.get(
  '/subscription',
  requireRole('owner', 'admin'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const business = await Business.findById(req.currentBusiness!.businessId).select('subscription');

    if (!business) throw new NotFoundError('Business not found');

    res.json({ success: true, data: { subscription: business.subscription } });
  })
);

export default router;
