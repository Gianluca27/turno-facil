import { Promotion } from '../../../infrastructure/database/mongodb/models/Promotion.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';

export interface GetPromotionInput {
  promotionId: string;
  businessId: string;
}

export interface GetPromotionResult {
  promotion: any;
}

/**
 * Retrieves a single promotion by ID, scoped to the business.
 * Populates associated service names and prices.
 */
export async function getPromotion(input: GetPromotionInput): Promise<GetPromotionResult> {
  const promotion = await Promotion.findOne({
    _id: input.promotionId,
    businessId: input.businessId,
  })
    .populate('conditions.services', 'name price');

  if (!promotion) {
    throw new NotFoundError('Promotion not found');
  }

  return { promotion: promotion.toObject() };
}
