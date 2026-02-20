import { Router, Response } from 'express';
import { z } from 'zod';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  createStaff,
  updateStaff,
  deleteStaff,
  listStaff,
  getStaff,
  updateSchedule,
  addException,
  assignServices,
} from '../../../application/use-cases/staff/index.js';

const router = Router();

const staffSchema = z.object({
  profile: z.object({
    firstName: z.string().min(2).max(50),
    lastName: z.string().min(2).max(50),
    displayName: z.string().max(100).optional(),
    bio: z.string().max(500).optional(),
    specialties: z.array(z.string()).optional(),
  }),
  contact: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }).optional(),
  services: z.array(z.string()).optional(),
});

// GET /api/v1/manage/staff - List staff
router.get(
  '/',
  requirePermission('staff:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await listStaff({ businessId: req.currentBusiness!.businessId });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/staff - Create staff member
router.post(
  '/',
  requirePermission('staff:create'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = staffSchema.parse(req.body);
    const result = await createStaff({ ...data, businessId: req.currentBusiness!.businessId });
    res.status(201).json({ success: true, data: result });
  })
);

// GET /api/v1/manage/staff/:id - Get staff member
router.get(
  '/:id',
  requirePermission('staff:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await getStaff({ staffId: req.params.id, businessId: req.currentBusiness!.businessId });
    res.json({ success: true, data: result });
  })
);

// PUT /api/v1/manage/staff/:id - Update staff member
router.put(
  '/:id',
  requirePermission('staff:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = staffSchema.partial().parse(req.body);
    const result = await updateStaff({ staffId: req.params.id, businessId: req.currentBusiness!.businessId, data });
    res.json({ success: true, data: result });
  })
);

// DELETE /api/v1/manage/staff/:id - Delete staff member
router.delete(
  '/:id',
  requirePermission('staff:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    await deleteStaff({ staffId: req.params.id, businessId: req.currentBusiness!.businessId });
    res.json({ success: true, message: 'Staff member deleted' });
  })
);

// PUT /api/v1/manage/staff/:id/schedule - Update staff schedule
router.put(
  '/:id/schedule',
  requirePermission('staff:schedule'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { useBusinessSchedule, custom } = req.body;
    const result = await updateSchedule({
      staffId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      useBusinessSchedule,
      custom,
    });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/staff/:id/exception - Add exception (vacation, etc)
router.post(
  '/:id/exception',
  requirePermission('staff:schedule'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { startDate, endDate, type, reason } = req.body;
    const result = await addException({
      staffId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      startDate,
      endDate,
      type,
      reason,
    });
    res.json({ success: true, data: result });
  })
);

// PUT /api/v1/manage/staff/:id/services - Assign services
router.put(
  '/:id/services',
  requirePermission('staff:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { serviceIds } = req.body;
    const result = await assignServices({
      staffId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      serviceIds,
    });
    res.json({ success: true, data: result });
  })
);

export default router;
