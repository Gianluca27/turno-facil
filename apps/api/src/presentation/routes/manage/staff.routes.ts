import { Router, Response } from 'express';
import { z } from 'zod';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler, NotFoundError } from '../../middleware/errorHandler.js';
import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';

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
    const staff = await Staff.find({
      businessId: req.currentBusiness!.businessId,
      status: { $ne: 'deleted' },
    })
      .populate('services', 'name')
      .sort({ order: 1, 'profile.firstName': 1 });

    res.json({ success: true, data: { staff } });
  })
);

// POST /api/v1/manage/staff - Create staff member
router.post(
  '/',
  requirePermission('staff:create'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = staffSchema.parse(req.body);

    const staff = new Staff({
      ...data,
      businessId: req.currentBusiness!.businessId,
      schedule: { useBusinessSchedule: true, custom: [] },
      status: 'active',
    });

    await staff.save();

    res.status(201).json({ success: true, data: { staff } });
  })
);

// GET /api/v1/manage/staff/:id - Get staff member
router.get(
  '/:id',
  requirePermission('staff:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const staff = await Staff.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    }).populate('services', 'name duration price');

    if (!staff) throw new NotFoundError('Staff member not found');

    res.json({ success: true, data: { staff } });
  })
);

// PUT /api/v1/manage/staff/:id - Update staff member
router.put(
  '/:id',
  requirePermission('staff:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = staffSchema.partial().parse(req.body);

    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId },
      { $set: data },
      { new: true }
    );

    if (!staff) throw new NotFoundError('Staff member not found');

    res.json({ success: true, data: { staff } });
  })
);

// DELETE /api/v1/manage/staff/:id - Delete staff member
router.delete(
  '/:id',
  requirePermission('staff:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId },
      { status: 'deleted' },
      { new: true }
    );

    if (!staff) throw new NotFoundError('Staff member not found');

    res.json({ success: true, message: 'Staff member deleted' });
  })
);

// PUT /api/v1/manage/staff/:id/schedule - Update staff schedule
router.put(
  '/:id/schedule',
  requirePermission('staff:schedule'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { useBusinessSchedule, custom } = req.body;

    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId },
      { $set: { schedule: { useBusinessSchedule, custom: custom || [] } } },
      { new: true }
    );

    if (!staff) throw new NotFoundError('Staff member not found');

    res.json({ success: true, data: { staff } });
  })
);

// POST /api/v1/manage/staff/:id/exception - Add exception (vacation, etc)
router.post(
  '/:id/exception',
  requirePermission('staff:schedule'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { startDate, endDate, type, reason } = req.body;

    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId },
      { $push: { exceptions: { startDate: new Date(startDate), endDate: new Date(endDate), type, reason, isRecurring: false } } },
      { new: true }
    );

    if (!staff) throw new NotFoundError('Staff member not found');

    res.json({ success: true, data: { staff } });
  })
);

// PUT /api/v1/manage/staff/:id/services - Assign services
router.put(
  '/:id/services',
  requirePermission('staff:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { serviceIds } = req.body;

    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId },
      { $set: { services: serviceIds } },
      { new: true }
    ).populate('services', 'name');

    if (!staff) throw new NotFoundError('Staff member not found');

    res.json({ success: true, data: { staff } });
  })
);

export default router;
