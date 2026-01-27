import { Router, Request, Response } from 'express';
import { Promotion } from '../../infrastructure/database/mongodb/models/Promotion.js';
import { ClientBusinessRelation } from '../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';
import { asyncHandler, NotFoundError, BadRequestError } from '../middleware/errorHandler.js';
import { authenticateUser, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// GET /api/v1/promotions - Get available promotions (public, with optional auth)
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { businessId, type, page = '1', limit = '20' } = req.query;

    const now = new Date();
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    const query: Record<string, unknown> = {
      status: 'active',
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      // Only show promotions with public codes (not null)
      code: { $ne: null },
    };

    if (businessId) {
      query.businessId = businessId;
    }

    if (type) {
      query.type = type;
    }

    // Filter by client segment if authenticated
    const authReq = req as AuthenticatedRequest;
    if (authReq.user && businessId) {
      const clientRelation = await ClientBusinessRelation.findOne({
        clientId: authReq.user.id,
        businessId,
      });

      // Include promotions for all or specific segments
      query.$or = [
        { 'conditions.clientSegment': 'all' },
        { 'conditions.clientSegment': { $exists: false } },
      ];

      if (clientRelation) {
        const segments: string[] = [];

        // Determine client segment based on their history
        if (clientRelation.stats.totalVisits === 0) {
          segments.push('new');
        } else if (clientRelation.stats.totalVisits >= 5) {
          segments.push('returning', 'vip');
        } else {
          segments.push('returning');
        }

        // Check if inactive (no visit in 60+ days)
        if (clientRelation.stats.lastVisit) {
          const sixtyDaysAgo = new Date();
          sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
          if (clientRelation.stats.lastVisit < sixtyDaysAgo) {
            segments.push('inactive');
          }
        }

        (query.$or as Record<string, unknown>[]).push({
          'conditions.clientSegment': { $in: segments },
        });
      } else {
        // New client - show first visit promotions
        (query.$or as Record<string, unknown>[]).push({
          'conditions.clientSegment': 'new',
        });
        (query.$or as Record<string, unknown>[]).push({
          'conditions.firstVisitOnly': true,
        });
      }
    }

    const [promotions, total] = await Promise.all([
      Promotion.find(query)
        .populate('businessId', 'name slug media.logo')
        .select('-limits.currentUses') // Hide usage details
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Promotion.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        promotions,
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

// GET /api/v1/promotions/featured - Get featured promotions
router.get(
  '/featured',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { lat, lng, distance = '10000' } = req.query;

    const now = new Date();

    let query: Record<string, unknown> = {
      status: 'active',
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      code: { $ne: null },
    };

    // If location provided, filter by nearby businesses
    if (lat && lng) {
      const { Business } = await import('../../infrastructure/database/mongodb/models/Business.js');

      const nearbyBusinessIds = await Business.find({
        status: 'active',
        'location.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng as string), parseFloat(lat as string)],
            },
            $maxDistance: parseInt(distance as string),
          },
        },
      })
        .select('_id')
        .limit(50)
        .lean();

      query.businessId = { $in: nearbyBusinessIds.map((b) => b._id) };
    }

    const promotions = await Promotion.find(query)
      .populate('businessId', 'name slug media.logo location type')
      .select('-limits.currentUses')
      .sort({ 'discount.amount': -1 })
      .limit(10);

    res.json({
      success: true,
      data: { promotions },
    });
  })
);

// POST /api/v1/promotions/validate - Validate promotion code
router.post(
  '/validate',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code, businessId, serviceIds, subtotal } = req.body;

    if (!code || !businessId) {
      throw new BadRequestError('Code and businessId are required');
    }

    const now = new Date();

    const promotion = await Promotion.findOne({
      businessId,
      code: code.toUpperCase(),
      status: 'active',
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    });

    if (!promotion) {
      res.json({
        success: true,
        data: {
          valid: false,
          message: 'Código de descuento inválido o expirado',
        },
      });
      return;
    }

    // Check total usage limit
    if (promotion.limits.totalUses && promotion.limits.currentUses >= promotion.limits.totalUses) {
      res.json({
        success: true,
        data: {
          valid: false,
          message: 'Este código ya alcanzó su límite de usos',
        },
      });
      return;
    }

    // Note: Per-user usage limit tracking requires additional implementation
    // For now, we only check total usage limit

    // Check minimum purchase amount
    if (promotion.conditions.minPurchase && subtotal && subtotal < promotion.conditions.minPurchase) {
      res.json({
        success: true,
        data: {
          valid: false,
          message: `El monto mínimo para este código es $${promotion.conditions.minPurchase}`,
        },
      });
      return;
    }

    // Check if applies to selected services
    if (promotion.conditions.services && promotion.conditions.services.length > 0 && serviceIds) {
      const applicableServiceIds = promotion.conditions.services.map((s) => s.toString());
      const hasApplicable = serviceIds.some((id: string) => applicableServiceIds.includes(id));

      if (!hasApplicable) {
        res.json({
          success: true,
          data: {
            valid: false,
            message: 'Este código no aplica a los servicios seleccionados',
          },
        });
        return;
      }
    }

    // Check first visit only
    if (promotion.conditions.firstVisitOnly) {
      const existingRelation = await ClientBusinessRelation.findOne({
        clientId: req.user!.id,
        businessId,
        'stats.totalVisits': { $gt: 0 },
      });

      if (existingRelation) {
        res.json({
          success: true,
          data: {
            valid: false,
            message: 'Este código es solo para primera visita',
          },
        });
        return;
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (subtotal) {
      if (promotion.discount.type === 'percentage') {
        discountAmount = (subtotal * promotion.discount.amount) / 100;
        if (promotion.discount.maxDiscount) {
          discountAmount = Math.min(discountAmount, promotion.discount.maxDiscount);
        }
      } else {
        discountAmount = promotion.discount.amount;
      }
    }

    logger.info('Promotion code validated', {
      code,
      businessId,
      userId: req.user!.id,
      valid: true,
    });

    res.json({
      success: true,
      data: {
        valid: true,
        promotion: {
          id: promotion._id,
          code: promotion.code,
          name: promotion.name,
          description: promotion.description,
          discountType: promotion.discount.type,
          discountValue: promotion.discount.amount,
          maxDiscount: promotion.discount.maxDiscount,
        },
        discountAmount,
        message: promotion.discount.type === 'percentage'
          ? `${promotion.discount.amount}% de descuento aplicado`
          : `$${promotion.discount.amount} de descuento aplicado`,
      },
    });
  })
);

// GET /api/v1/promotions/:id - Get promotion details
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const promotion = await Promotion.findOne({
      _id: req.params.id,
      status: 'active',
    })
      .populate('businessId', 'name slug media.logo location contact')
      .populate('conditions.services', 'name price duration')
      .select('-limits.currentUses');

    if (!promotion) {
      throw new NotFoundError('Promotion not found');
    }

    // Check if promotion is still valid
    const now = new Date();
    const isValid = promotion.validFrom <= now && promotion.validUntil >= now;

    res.json({
      success: true,
      data: {
        promotion,
        isValid,
        daysRemaining: isValid
          ? Math.ceil((promotion.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      },
    });
  })
);

export default router;
