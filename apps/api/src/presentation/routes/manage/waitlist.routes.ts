import { Router, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import {
  listWaitlistEntries,
  createWaitlistEntry,
  getWaitlistEntry,
  updateWaitlistEntry,
  notifyWaitlistClient,
  convertWaitlistToAppointment,
  cancelWaitlistEntry,
} from '../../../application/use-cases/waitlist/index.js';

const router = Router();

// Validation schemas
const createWaitlistEntrySchema = z.object({
  clientId: z.string(),
  preferences: z.object({
    services: z.array(z.string()).min(1),
    staffId: z.string().optional(),
    dateRange: z.object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).optional(),
    timeRange: z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    }).optional(),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  }),
  priority: z.enum(['normal', 'vip']).optional(),
  expiresAt: z.string().datetime().optional(),
});

const updateWaitlistEntrySchema = z.object({
  preferences: z.object({
    services: z.array(z.string()).min(1).optional(),
    staffId: z.string().optional().nullable(),
    dateRange: z.object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).optional().nullable(),
    timeRange: z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    }).optional().nullable(),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  }).optional(),
  priority: z.enum(['normal', 'vip']).optional(),
  status: z.enum(['active', 'fulfilled', 'cancelled', 'expired']).optional(),
});

// GET /api/v1/manage/waitlist - Get waitlist entries
router.get(
  '/',
  requirePermission('waitlist:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { status, serviceId, staffId, priority, page = '1', limit = '20' } =
      req.query as Record<string, string>;

    const result = await listWaitlistEntries({
      businessId: req.currentBusiness!.businessId,
      status,
      serviceId,
      staffId,
      priority,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/waitlist - Create waitlist entry
router.post(
  '/',
  requirePermission('waitlist:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = createWaitlistEntrySchema.parse(req.body);

    const result = await createWaitlistEntry({
      businessId: req.currentBusiness!.businessId,
      clientId: data.clientId,
      preferences: data.preferences,
      priority: data.priority,
      expiresAt: data.expiresAt,
    });

    res.status(201).json({ success: true, message: 'Added to waitlist successfully', data: result });
  })
);

// GET /api/v1/manage/waitlist/:id - Get waitlist entry details
router.get(
  '/:id',
  requirePermission('waitlist:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await getWaitlistEntry({
      waitlistId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({ success: true, data: result });
  })
);

// PUT /api/v1/manage/waitlist/:id - Update waitlist entry
router.put(
  '/:id',
  requirePermission('waitlist:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = updateWaitlistEntrySchema.parse(req.body);

    const result = await updateWaitlistEntry({
      waitlistId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      preferences: data.preferences,
      priority: data.priority,
      status: data.status,
    });

    res.json({ success: true, message: 'Waitlist entry updated successfully', data: result });
  })
);

// POST /api/v1/manage/waitlist/:id/notify - Notify client of availability
router.post(
  '/:id/notify',
  requirePermission('waitlist:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { appointmentId, availableSlots } = req.body;

    await notifyWaitlistClient({
      waitlistId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      appointmentId,
      availableSlots,
    });

    res.json({ success: true, message: 'Client notified successfully' });
  })
);

// POST /api/v1/manage/waitlist/:id/convert - Convert to appointment
router.post(
  '/:id/convert',
  requirePermission('waitlist:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { staffId, date, startTime } = req.body;

    const result = await convertWaitlistToAppointment({
      waitlistId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      userId: req.user!.id,
      staffId,
      date,
      startTime,
    });

    res.json({ success: true, message: 'Appointment created from waitlist', data: result });
  })
);

// DELETE /api/v1/manage/waitlist/:id - Remove from waitlist
router.delete(
  '/:id',
  requirePermission('waitlist:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    await cancelWaitlistEntry({
      waitlistId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({ success: true, message: 'Removed from waitlist' });
  })
);

export default router;
