import { Router, Response } from 'express';
import { z } from 'zod';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler, NotFoundError } from '../../middleware/errorHandler.js';
import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';

const router = Router();

const serviceSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  categoryId: z.string().optional(),
  category: z.string().optional(), // For backward compatibility
  duration: z.number().min(5).max(480),
  price: z.number().min(0),
  config: z.object({
    bufferAfter: z.number().min(0).default(0),
    maxPerDay: z.number().min(1).optional(),
    requiresDeposit: z.boolean().default(false),
    depositAmount: z.number().min(0).default(0),
    allowOnlineBooking: z.boolean().default(true),
  }).optional(),
  image: z.string().optional(),
  staffIds: z.array(z.string()).optional(), // Staff to assign this service to
});

// GET /api/v1/manage/services - List services
router.get(
  '/',
  requirePermission('services:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const services = await Service.find({
      businessId: req.currentBusiness!.businessId,
      status: { $ne: 'deleted' },
    }).sort({ order: 1, name: 1 });

    res.json({ success: true, data: { services } });
  })
);

// POST /api/v1/manage/services - Create service
router.post(
  '/',
  requirePermission('services:create'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { staffIds, ...serviceData } = serviceSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    const service = new Service({
      ...serviceData,
      businessId,
      status: 'active',
    });

    await service.save();

    // If staffIds provided, assign this service to those staff members
    if (staffIds && staffIds.length > 0) {
      await Staff.updateMany(
        { _id: { $in: staffIds }, businessId },
        { $addToSet: { services: service._id } }
      );
    }

    res.status(201).json({ success: true, data: { service } });
  })
);

// GET /api/v1/manage/services/:id - Get service
router.get(
  '/:id',
  requirePermission('services:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const service = await Service.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!service) throw new NotFoundError('Service not found');

    res.json({ success: true, data: { service } });
  })
);

// PUT /api/v1/manage/services/:id - Update service
router.put(
  '/:id',
  requirePermission('services:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = serviceSchema.partial().parse(req.body);

    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!service) throw new NotFoundError('Service not found');

    res.json({ success: true, data: { service } });
  })
);

// DELETE /api/v1/manage/services/:id - Delete service
router.delete(
  '/:id',
  requirePermission('services:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId },
      { status: 'deleted' },
      { new: true }
    );

    if (!service) throw new NotFoundError('Service not found');

    res.json({ success: true, message: 'Service deleted' });
  })
);

// PUT /api/v1/manage/services/:id/status - Toggle service status
router.put(
  '/:id/status',
  requirePermission('services:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      throw new NotFoundError('Invalid status');
    }

    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, businessId: req.currentBusiness!.businessId },
      { status },
      { new: true }
    );

    if (!service) throw new NotFoundError('Service not found');

    res.json({ success: true, data: { service } });
  })
);

// GET /api/v1/manage/service-categories - List categories
router.get(
  '-categories',
  requirePermission('services:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const business = await Business.findById(req.currentBusiness!.businessId).select('serviceCategories');
    res.json({ success: true, data: { categories: business?.serviceCategories || [] } });
  })
);

// POST /api/v1/manage/service-categories - Create category
router.post(
  '-categories',
  requirePermission('services:create'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { name, description } = req.body;

    const business = await Business.findByIdAndUpdate(
      req.currentBusiness!.businessId,
      { $push: { serviceCategories: { name, description, order: 0, isActive: true } } },
      { new: true }
    );

    res.json({ success: true, data: { categories: business?.serviceCategories } });
  })
);

export default router;
