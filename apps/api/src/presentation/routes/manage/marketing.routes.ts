import { Router, Response } from 'express';
import { z } from 'zod';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  listPromotions,
  createPromotion,
  getPromotion,
  updatePromotion,
  deactivatePromotion,
  deletePromotion,
  listCampaigns,
  createCampaign,
  getCampaign,
  sendCampaign,
  cancelCampaign,
  deleteCampaign,
  previewAudience,
} from '../../../application/use-cases/marketing/index.js';

const router = Router();

// Validation schemas
const createPromotionSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(3).max(20).toUpperCase(),
  description: z.string().max(500).optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive(),
  maxDiscountAmount: z.number().positive().optional(),
  minPurchaseAmount: z.number().min(0).optional(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  maxUses: z.number().int().positive().optional(),
  usagePerUser: z.number().int().positive().optional(),
  applicableServices: z.array(z.string()).optional(),
  terms: z.string().max(1000).optional(),
});

const updatePromotionSchema = createPromotionSchema.partial().omit({ code: true });

const createCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['email', 'push', 'sms']),
  subject: z.string().max(200).optional(),
  content: z.string().min(1).max(5000),
  targetAudience: z.enum(['all', 'new', 'returning', 'inactive', 'custom']),
  customFilters: z.object({
    minBookings: z.number().int().optional(),
    maxBookings: z.number().int().optional(),
    minSpent: z.number().optional(),
    lastVisitDays: z.number().int().optional(),
    services: z.array(z.string()).optional(),
  }).optional(),
  scheduledFor: z.string().datetime().optional(),
  promotionId: z.string().optional(),
});

// ============== PROMOTIONS ==============

// GET /api/v1/manage/marketing/promotions - List promotions
router.get(
  '/promotions',
  requirePermission('marketing:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const result = await listPromotions({
      businessId: req.currentBusiness!.businessId,
      status,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/marketing/promotions - Create promotion
router.post(
  '/promotions',
  requirePermission('marketing:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = createPromotionSchema.parse(req.body);
    const result = await createPromotion({
      businessId: req.currentBusiness!.businessId,
      data,
    });
    res.status(201).json({ success: true, message: 'Promotion created successfully', data: result });
  })
);

// GET /api/v1/manage/marketing/promotions/:id - Get promotion details
router.get(
  '/promotions/:id',
  requirePermission('marketing:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await getPromotion({
      promotionId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });
    res.json({ success: true, data: result });
  })
);

// PUT /api/v1/manage/marketing/promotions/:id - Update promotion
router.put(
  '/promotions/:id',
  requirePermission('marketing:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = updatePromotionSchema.parse(req.body);
    const result = await updatePromotion({
      promotionId: req.params.id,
      businessId: req.currentBusiness!.businessId,
      data,
    });
    res.json({ success: true, message: 'Promotion updated successfully', data: result });
  })
);

// POST /api/v1/manage/marketing/promotions/:id/deactivate - Deactivate promotion
router.post(
  '/promotions/:id/deactivate',
  requirePermission('marketing:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    await deactivatePromotion({
      promotionId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });
    res.json({ success: true, message: 'Promotion paused successfully' });
  })
);

// DELETE /api/v1/manage/marketing/promotions/:id - Delete promotion
router.delete(
  '/promotions/:id',
  requirePermission('marketing:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    await deletePromotion({
      promotionId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });
    res.json({ success: true, message: 'Promotion deleted successfully' });
  })
);

// ============== CAMPAIGNS ==============

// GET /api/v1/manage/marketing/campaigns - List campaigns
router.get(
  '/campaigns',
  requirePermission('marketing:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { status, type, page = '1', limit = '20' } = req.query as Record<string, string>;
    const result = await listCampaigns({
      businessId: req.currentBusiness!.businessId,
      status,
      type,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/marketing/campaigns - Create campaign
router.post(
  '/campaigns',
  requirePermission('marketing:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = createCampaignSchema.parse(req.body);
    const result = await createCampaign({
      businessId: req.currentBusiness!.businessId,
      data,
    });
    res.status(201).json({ success: true, message: 'Campaign created successfully', data: result });
  })
);

// GET /api/v1/manage/marketing/campaigns/:id - Get campaign details
router.get(
  '/campaigns/:id',
  requirePermission('marketing:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await getCampaign({
      campaignId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });
    res.json({ success: true, data: result });
  })
);

// POST /api/v1/manage/marketing/campaigns/:id/send - Send campaign
router.post(
  '/campaigns/:id/send',
  requirePermission('marketing:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const result = await sendCampaign({
      campaignId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });
    res.json({ success: true, message: `Campaign sent to ${result.sentCount} clients`, data: result });
  })
);

// POST /api/v1/manage/marketing/campaigns/:id/cancel - Cancel scheduled campaign
router.post(
  '/campaigns/:id/cancel',
  requirePermission('marketing:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    await cancelCampaign({
      campaignId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });
    res.json({ success: true, message: 'Campaign cancelled successfully' });
  })
);

// DELETE /api/v1/manage/marketing/campaigns/:id - Delete campaign
router.delete(
  '/campaigns/:id',
  requirePermission('marketing:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    await deleteCampaign({
      campaignId: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });
    res.json({ success: true, message: 'Campaign deleted successfully' });
  })
);

// POST /api/v1/manage/marketing/campaigns/audience/preview - Preview audience
router.post(
  '/campaigns/audience/preview',
  requirePermission('marketing:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { targetAudience, customFilters } = req.body;
    const result = await previewAudience({
      businessId: req.currentBusiness!.businessId,
      targetAudience,
      customFilters,
    });
    res.json({ success: true, data: result });
  })
);

export default router;
