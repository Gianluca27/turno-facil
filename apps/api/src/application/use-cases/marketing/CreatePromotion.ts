import { Promotion } from '../../../infrastructure/database/mongodb/models/Promotion.js';
import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { ConflictError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface CreatePromotionInput {
  businessId: string;
  name: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscountAmount?: number;
  minPurchaseAmount?: number;
  validFrom: string;
  validUntil: string;
  maxUses?: number;
  usagePerUser?: number;
  applicableServices?: string[];
  terms?: string;
}

export interface CreatePromotionResult {
  promotion: any;
}

/**
 * Creates a new promotion for a business.
 * Validates uniqueness of code, date ordering, and service existence.
 */
export async function createPromotion(input: CreatePromotionInput): Promise<CreatePromotionResult> {
  const { businessId } = input;

  // Check if code already exists
  const existingCode = await Promotion.findOne({
    businessId,
    code: input.code,
  });

  if (existingCode) {
    throw new ConflictError('A promotion with this code already exists');
  }

  // Validate dates
  const validFrom = new Date(input.validFrom);
  const validUntil = new Date(input.validUntil);

  if (validUntil <= validFrom) {
    throw new BadRequestError('End date must be after start date');
  }

  // Validate services if provided
  if (input.applicableServices?.length) {
    const services = await Service.countDocuments({
      _id: { $in: input.applicableServices },
      businessId,
    });

    if (services !== input.applicableServices.length) {
      throw new BadRequestError('One or more services not found');
    }
  }

  const promotion = new Promotion({
    businessId,
    name: input.name,
    code: input.code,
    type: input.discountType,
    value: input.discountValue,
    validFrom,
    validUntil,
    conditions: {
      minPurchase: input.minPurchaseAmount,
      maxUses: input.maxUses,
      maxUsesPerClient: input.usagePerUser,
      services: input.applicableServices,
    },
    status: 'active',
    usageCount: 0,
  });

  await promotion.save();

  logger.info('Promotion created', {
    promotionId: promotion._id,
    businessId,
    code: input.code,
  });

  return { promotion: promotion.toObject() };
}
