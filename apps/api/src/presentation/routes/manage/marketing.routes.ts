import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Promotion } from '../../../infrastructure/database/mongodb/models/Promotion.js';
import { Campaign } from '../../../infrastructure/database/mongodb/models/Campaign.js';
import { ClientBusinessRelation } from '../../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';
import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { asyncHandler, NotFoundError, BadRequestError, ConflictError } from '../../middleware/errorHandler.js';
import { requirePermission, BusinessAuthenticatedRequest } from '../../middleware/auth.js';
import { notificationService } from '../../../domain/services/NotificationService.js';
import { addJob, QUEUE_NAMES, EmailJobData } from '../../../infrastructure/jobs/queues.js';
import { logger } from '../../../utils/logger.js';

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

// GET /api/v1/manage/marketing/promotions - Get all promotions
router.get(
  '/promotions',
  requirePermission('marketing:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { status, page = '1', limit = '20' } = req.query as Record<string, string>;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    const query: Record<string, unknown> = { businessId };

    if (status) {
      query.status = status;
    }

    const [promotions, total] = await Promise.all([
      Promotion.find(query)
        .populate('conditions.services', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Promotion.countDocuments(query),
    ]);

    // Calculate usage stats
    const promotionsWithStats = promotions.map((p) => ({
      ...p,
      usageRate: p.limits?.totalUses ? Math.round(((p.limits.currentUses || 0) / p.limits.totalUses) * 100) : null,
      isActive: p.status === 'active' && new Date(p.validFrom) <= new Date() && new Date(p.validUntil) >= new Date(),
    }));

    res.json({
      success: true,
      data: {
        promotions: promotionsWithStats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  })
);

// POST /api/v1/manage/marketing/promotions - Create promotion
router.post(
  '/promotions',
  requirePermission('marketing:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = createPromotionSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    // Check if code already exists
    const existingCode = await Promotion.findOne({
      businessId,
      code: data.code,
    });

    if (existingCode) {
      throw new ConflictError('A promotion with this code already exists');
    }

    // Validate dates
    const validFrom = new Date(data.validFrom);
    const validUntil = new Date(data.validUntil);

    if (validUntil <= validFrom) {
      throw new BadRequestError('End date must be after start date');
    }

    // Validate services if provided
    if (data.applicableServices?.length) {
      const services = await Service.countDocuments({
        _id: { $in: data.applicableServices },
        businessId,
      });

      if (services !== data.applicableServices.length) {
        throw new BadRequestError('One or more services not found');
      }
    }

    const promotion = new Promotion({
      businessId,
      name: data.name,
      code: data.code,
      type: data.discountType,
      value: data.discountValue,
      validFrom,
      validUntil,
      conditions: {
        minPurchase: data.minPurchaseAmount,
        maxUses: data.maxUses,
        maxUsesPerClient: data.usagePerUser,
        services: data.applicableServices,
      },
      status: 'active',
      usageCount: 0,
    });

    await promotion.save();

    logger.info('Promotion created', {
      promotionId: promotion._id,
      businessId,
      code: data.code,
    });

    res.status(201).json({
      success: true,
      message: 'Promotion created successfully',
      data: { promotion },
    });
  })
);

// GET /api/v1/manage/marketing/promotions/:id - Get promotion details
router.get(
  '/promotions/:id',
  requirePermission('marketing:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const promotion = await Promotion.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    })
      .populate('conditions.services', 'name price');

    if (!promotion) {
      throw new NotFoundError('Promotion not found');
    }

    res.json({
      success: true,
      data: { promotion },
    });
  })
);

// PUT /api/v1/manage/marketing/promotions/:id - Update promotion
router.put(
  '/promotions/:id',
  requirePermission('marketing:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = updatePromotionSchema.parse(req.body);

    const promotion = await Promotion.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!promotion) {
      throw new NotFoundError('Promotion not found');
    }

    // Update fields
    Object.assign(promotion, {
      ...data,
      validFrom: data.validFrom ? new Date(data.validFrom) : promotion.validFrom,
      validUntil: data.validUntil ? new Date(data.validUntil) : promotion.validUntil,
    });

    await promotion.save();

    logger.info('Promotion updated', {
      promotionId: promotion._id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({
      success: true,
      message: 'Promotion updated successfully',
      data: { promotion },
    });
  })
);

// POST /api/v1/manage/marketing/promotions/:id/deactivate - Deactivate promotion
router.post(
  '/promotions/:id/deactivate',
  requirePermission('marketing:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const promotion = await Promotion.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!promotion) {
      throw new NotFoundError('Promotion not found');
    }

    promotion.status = 'paused';
    await promotion.save();

    res.json({
      success: true,
      message: 'Promotion paused successfully',
    });
  })
);

// DELETE /api/v1/manage/marketing/promotions/:id - Delete promotion
router.delete(
  '/promotions/:id',
  requirePermission('marketing:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const promotion = await Promotion.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!promotion) {
      throw new NotFoundError('Promotion not found');
    }

    if (promotion.limits.currentUses > 0) {
      // Soft delete if already used
      promotion.status = 'deleted';
      await promotion.save();
    } else {
      await promotion.deleteOne();
    }

    logger.info('Promotion deleted', {
      promotionId: promotion._id,
      businessId: req.currentBusiness!.businessId,
    });

    res.json({
      success: true,
      message: 'Promotion deleted successfully',
    });
  })
);

// ============== CAMPAIGNS ==============

// GET /api/v1/manage/marketing/campaigns - Get all campaigns
router.get(
  '/campaigns',
  requirePermission('marketing:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const businessId = req.currentBusiness!.businessId;
    const { status, type, page = '1', limit = '20' } = req.query as Record<string, string>;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    const query: Record<string, unknown> = { businessId };

    if (status) {
      query.status = status;
    }

    if (type) {
      query.type = type;
    }

    const [campaigns, total] = await Promise.all([
      Campaign.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Campaign.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        campaigns,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  })
);

// POST /api/v1/manage/marketing/campaigns - Create campaign
router.post(
  '/campaigns',
  requirePermission('marketing:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = createCampaignSchema.parse(req.body);
    const businessId = req.currentBusiness!.businessId;

    // Calculate target audience count
    const audienceQuery = await buildAudienceQuery(businessId, data.targetAudience, data.customFilters);
    const audienceCount = await ClientBusinessRelation.countDocuments(audienceQuery);

    if (audienceCount === 0) {
      throw new BadRequestError('No clients match the selected criteria');
    }

    // Map targetAudience to audience structure
    const audienceType = data.targetAudience === 'all' ? 'all' :
                         data.targetAudience === 'custom' ? 'custom' : 'segment';
    const audienceSegment = ['new', 'returning', 'inactive'].includes(data.targetAudience)
                            ? data.targetAudience as 'new' | 'returning' | 'inactive'
                            : undefined;

    const campaign = new Campaign({
      businessId,
      name: data.name,
      type: data.type,
      content: {
        title: data.subject || data.name,
        body: data.content,
      },
      audience: {
        type: audienceType,
        segment: audienceSegment,
        customFilters: data.customFilters ? {
          lastVisitDaysAgo: data.customFilters.lastVisitDays,
          totalVisits: data.customFilters.minBookings,
          totalSpent: data.customFilters.minSpent,
          services: data.customFilters.services,
        } : undefined,
      },
      schedule: {
        type: data.scheduledFor ? 'scheduled' : 'immediate',
        sendAt: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
      },
      status: data.scheduledFor ? 'scheduled' : 'draft',
      stats: {
        totalRecipients: audienceCount,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        failed: 0,
      },
    });

    await campaign.save();

    logger.info('Campaign created', {
      campaignId: campaign._id,
      businessId,
      type: data.type,
      targetAudience: data.targetAudience,
    });

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: {
        campaign,
        audienceCount,
      },
    });
  })
);

// GET /api/v1/manage/marketing/campaigns/:id - Get campaign details
router.get(
  '/campaigns/:id',
  requirePermission('marketing:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    res.json({
      success: true,
      data: { campaign },
    });
  })
);

// POST /api/v1/manage/marketing/campaigns/:id/send - Send campaign
router.post(
  '/campaigns/:id/send',
  requirePermission('marketing:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
      status: { $in: ['draft', 'scheduled'] },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found or already sent');
    }

    const businessId = req.currentBusiness!.businessId;

    // Get target audience - convert customFilters to expected format
    const customFiltersConverted = campaign.audience?.customFilters ? {
      lastVisitDaysAgo: campaign.audience.customFilters.lastVisitDaysAgo?.min,
      totalVisits: campaign.audience.customFilters.totalVisits?.min,
      totalSpent: campaign.audience.customFilters.totalSpent?.min,
      services: campaign.audience.customFilters.services?.map(s => s.toString()),
      staff: campaign.audience.customFilters.staff?.map(s => s.toString()),
    } : undefined;

    const audienceQuery = await buildAudienceQuery(
      businessId,
      campaign.audience?.type === 'segment' ? campaign.audience?.segment : campaign.audience?.type,
      customFiltersConverted
    );

    const clients = await ClientBusinessRelation.find(audienceQuery)
      .populate('clientId', 'email phone profile.firstName devices')
      .lean();

    if (clients.length === 0) {
      throw new BadRequestError('No clients to send to');
    }

    // Update campaign status
    campaign.status = 'sending';
    campaign.sentAt = new Date();
    campaign.stats.totalRecipients = clients.length;
    await campaign.save();

    // Queue messages based on campaign type
    let sentCount = 0;

    for (const client of clients) {
      const user = client.clientId as unknown as {
        _id: mongoose.Types.ObjectId;
        email?: string;
        phone?: string;
        profile?: { firstName?: string };
        devices?: { fcmToken: string }[];
      };

      if (!user) continue;

      try {
        switch (campaign.type) {
          case 'email':
            if (user.email) {
              await addJob<EmailJobData>(QUEUE_NAMES.EMAILS, {
                to: user.email,
                subject: campaign.content?.title || campaign.name,
                html: (campaign.content?.htmlTemplate || campaign.content?.body || '').replace('{{nombre}}', user.profile?.firstName || 'Cliente'),
              });
              sentCount++;
            }
            break;

          case 'push':
            if (user.devices?.length) {
              await notificationService.sendNotification({
                userId: user._id.toString(),
                type: 'promotion',
                channels: ['push'],
                businessId,
                data: {
                  title: campaign.content?.title || campaign.name,
                  body: (campaign.content?.body || '').substring(0, 200),
                  campaignId: campaign._id.toString(),
                },
              });
              sentCount++;
            }
            break;

          case 'sms':
            if (user.phone) {
              await addJob(QUEUE_NAMES.SMS, {
                to: user.phone,
                body: (campaign.content?.body || '').replace('{{nombre}}', user.profile?.firstName || '').substring(0, 160),
              });
              sentCount++;
            }
            break;
        }
      } catch (error) {
        logger.error('Failed to send campaign message', {
          campaignId: campaign._id,
          userId: user._id,
          error,
        });
      }
    }

    // Update final stats
    campaign.status = 'sent';
    campaign.stats.sent = sentCount;
    await campaign.save();

    logger.info('Campaign sent', {
      campaignId: campaign._id,
      businessId,
      sentCount,
    });

    res.json({
      success: true,
      message: `Campaign sent to ${sentCount} clients`,
      data: {
        sentCount,
        targetCount: clients.length,
      },
    });
  })
);

// POST /api/v1/manage/marketing/campaigns/:id/cancel - Cancel scheduled campaign
router.post(
  '/campaigns/:id/cancel',
  requirePermission('marketing:write'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
      status: 'scheduled',
    });

    if (!campaign) {
      throw new NotFoundError('Scheduled campaign not found');
    }

    campaign.status = 'cancelled';
    await campaign.save();

    res.json({
      success: true,
      message: 'Campaign cancelled successfully',
    });
  })
);

// DELETE /api/v1/manage/marketing/campaigns/:id - Delete campaign
router.delete(
  '/campaigns/:id',
  requirePermission('marketing:delete'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      businessId: req.currentBusiness!.businessId,
      status: { $in: ['draft', 'cancelled'] },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found or cannot be deleted');
    }

    await campaign.deleteOne();

    res.json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  })
);

// GET /api/v1/manage/marketing/campaigns/audience/preview - Preview audience
router.post(
  '/campaigns/audience/preview',
  requirePermission('marketing:read'),
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { targetAudience, customFilters } = req.body;
    const businessId = req.currentBusiness!.businessId;

    const audienceQuery = await buildAudienceQuery(businessId, targetAudience, customFilters);

    const [count, sample] = await Promise.all([
      ClientBusinessRelation.countDocuments(audienceQuery),
      ClientBusinessRelation.find(audienceQuery)
        .populate('clientId', 'profile.firstName profile.lastName email')
        .limit(5)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        count,
        sample: sample.map((c) => {
          const client = c.clientId as unknown as { profile?: { firstName?: string; lastName?: string }; email?: string } | null;
          return {
            name: client?.profile
              ? `${client.profile.firstName || ''} ${client.profile.lastName || ''}`.trim() || 'Cliente'
              : 'Cliente',
            email: client?.email,
            totalBookings: c.stats.totalVisits,
            totalSpent: c.stats.totalSpent,
          };
        }),
      },
    });
  })
);

// Helper function to build audience query
async function buildAudienceQuery(
  businessId: string,
  targetAudience: string | undefined,
  customFilters?: {
    lastVisitDaysAgo?: number;
    totalVisits?: number;
    totalSpent?: number;
    services?: string[];
    staff?: string[];
  }
): Promise<Record<string, unknown>> {
  const query: Record<string, unknown> = {
    businessId: new mongoose.Types.ObjectId(businessId),
  };

  const now = new Date();

  switch (targetAudience) {
    case 'new':
      // Clients with only 1 booking
      query.totalBookings = 1;
      break;

    case 'returning':
      // Clients with 2+ bookings
      query.totalBookings = { $gte: 2 };
      break;

    case 'inactive':
      // Clients who haven't visited in 60+ days
      const inactiveDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      query.lastVisitAt = { $lt: inactiveDate };
      break;

    case 'custom':
      if (customFilters) {
        if (customFilters.totalVisits !== undefined) {
          query.totalBookings = { ...query.totalBookings as object, $gte: customFilters.totalVisits };
        }
        if (customFilters.totalSpent !== undefined) {
          query.totalSpent = { $gte: customFilters.totalSpent };
        }
        if (customFilters.lastVisitDaysAgo !== undefined) {
          const lastVisitDate = new Date(now.getTime() - customFilters.lastVisitDaysAgo * 24 * 60 * 60 * 1000);
          query.lastVisitAt = { $gte: lastVisitDate };
        }
      }
      break;

    case 'all':
    default:
      // All clients with valid email/phone
      break;
  }

  return query;
}

export default router;
