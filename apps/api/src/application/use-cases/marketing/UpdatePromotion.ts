import { Promotion } from '../../../infrastructure/database/mongodb/models/Promotion.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface UpdatePromotionInput {
  promotionId: string;
  businessId: string;
  data: {
    name?: string;
    description?: string;
    discountType?: 'percentage' | 'fixed';
    discountValue?: number;
    maxDiscountAmount?: number;
    minPurchaseAmount?: number;
    validFrom?: string;
    validUntil?: string;
    maxUses?: number;
    usagePerUser?: number;
    applicableServices?: string[];
    terms?: string;
  };
}

export interface UpdatePromotionResult {
  promotion: any;
}

/**
 * Updates an existing promotion. Finds the promotion by ID,
 * applies partial updates via Object.assign, and saves.
 */
export async function updatePromotion(input: UpdatePromotionInput): Promise<UpdatePromotionResult> {
  const { promotionId, businessId, data } = input;

  const promotion = await Promotion.findOne({
    _id: promotionId,
    businessId,
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
    businessId,
  });

  return { promotion: promotion.toObject() };
}
