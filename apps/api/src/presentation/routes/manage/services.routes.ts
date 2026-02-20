import { Router, Response } from 'express';
import { z } from 'zod';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  createService,
  updateService,
  deleteService,
  listServices,
  getService,
  updateServiceStatus,
  listCategories,
  createCategory,
} from '../../../application/use-cases/services/index.js';

const router = Router();

const serviceSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  categoryId: z.string().optional(),
  category: z.string().optional(),
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
  staffIds: z.array(z.string()).optional(),
});

// GET /api/v1/manage/services - List services
router.get(
  '/',
  requirePermission('services:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await listServices({ businessId: req.currentBusiness!.businessId });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/services - Create service
router.post(
  '/',
  requirePermission('services:create'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = serviceSchema.parse(req.body);
    const result = await createService({ ...data, businessId: req.currentBusiness!.businessId });
    res.status(201).json({ success: true, data: result });
  })
);

// GET /api/v1/manage/services/:id - Get service
router.get(
  '/:id',
  requirePermission('services:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await getService({ serviceId: req.params.id, businessId: req.currentBusiness!.businessId });
    res.json({ success: true, data: result });
  })
);

// PUT /api/v1/manage/services/:id - Update service
router.put(
  '/:id',
  requirePermission('services:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = serviceSchema.partial().parse(req.body);
    const result = await updateService({ serviceId: req.params.id, businessId: req.currentBusiness!.businessId, data });
    res.json({ success: true, data: result });
  })
);

// DELETE /api/v1/manage/services/:id - Delete service
router.delete(
  '/:id',
  requirePermission('services:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    await deleteService({ serviceId: req.params.id, businessId: req.currentBusiness!.businessId });
    res.json({ success: true, message: 'Service deleted' });
  })
);

// PUT /api/v1/manage/services/:id/status - Toggle service status
router.put(
  '/:id/status',
  requirePermission('services:update'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await updateServiceStatus({
      serviceId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      status: req.body.status,
    });
    res.json({ success: true, data: result });
  })
);

// GET /api/v1/manage/service-categories - List categories
router.get(
  '-categories',
  requirePermission('services:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await listCategories({ businessId: req.currentBusiness!.businessId });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/service-categories - Create category
router.post(
  '-categories',
  requirePermission('services:create'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { name, description } = req.body;
    const result = await createCategory({ businessId: req.currentBusiness!.businessId, name, description });
    res.json({ success: true, data: result });
  })
);

export default router;
