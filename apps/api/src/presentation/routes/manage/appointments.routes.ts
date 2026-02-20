import { Router, Response } from 'express';
import { z } from 'zod';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  listAppointments,
  createManualAppointment,
  getAppointment,
  updateAppointmentStatus,
} from '../../../application/use-cases/appointment-management/index.js';

const router = Router();

// GET /api/v1/manage/appointments - List appointments
router.get(
  '/',
  requirePermission('appointments:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { date, from, to, staffId, status, page = '1', limit = '50' } = req.query;
    const result = await listAppointments({
      businessId: req.currentBusiness!.businessId,
      date: date as string | undefined,
      from: from as string | undefined,
      to: to as string | undefined,
      staffId: staffId as string | undefined,
      status: status as string | undefined,
      page: parseInt(page as string),
      limit: Math.min(parseInt(limit as string), 100),
    });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/appointments - Create manual appointment
router.post(
  '/',
  requirePermission('appointments:create'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const schema = z.object({
      clientName: z.string().min(2),
      clientPhone: z.string().min(8),
      clientEmail: z.string().email().optional(),
      staffId: z.string(),
      serviceIds: z.array(z.string()).min(1),
      date: z.string(),
      startTime: z.string(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const result = await createManualAppointment({
      ...data,
      businessId: req.currentBusiness!.businessId,
      createdByUserId: req.user!.id,
    });
    res.status(201).json({ success: true, data: result });
  })
);

// GET /api/v1/manage/appointments/:id - Get appointment details
router.get(
  '/:id',
  requirePermission('appointments:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await getAppointment({
      appointmentId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/appointments/:id/confirm - Confirm appointment
router.post(
  '/:id/confirm',
  requirePermission('appointments:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await updateAppointmentStatus({
      appointmentId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      action: 'confirm',
    });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/appointments/:id/check-in - Check-in client
router.post(
  '/:id/check-in',
  requirePermission('appointments:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await updateAppointmentStatus({
      appointmentId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      action: 'check-in',
    });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/appointments/:id/start - Start service
router.post(
  '/:id/start',
  requirePermission('appointments:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await updateAppointmentStatus({
      appointmentId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      action: 'start',
    });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/appointments/:id/complete - Complete appointment
router.post(
  '/:id/complete',
  requirePermission('appointments:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await updateAppointmentStatus({
      appointmentId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      action: 'complete',
    });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/appointments/:id/cancel - Cancel appointment
router.post(
  '/:id/cancel',
  requirePermission('appointments:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { reason } = req.body;
    const result = await updateAppointmentStatus({
      appointmentId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      action: 'cancel',
      reason,
    });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/appointments/:id/no-show - Mark as no-show
router.post(
  '/:id/no-show',
  requirePermission('appointments:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await updateAppointmentStatus({
      appointmentId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      action: 'no-show',
    });
    res.json({ success: true, data: result });
  })
);

export default router;
