import { Promotion } from '../../../infrastructure/database/mongodb/models/Promotion.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';

export interface DeactivatePromotionInput {
  promotionId: string;
  businessId: string;
}

export interface DeactivatePromotionResult {
  message: string;
}

/**
 * Deactivates (pauses) a promotion by setting its status to 'paused'.
 */
export async function deactivatePromotion(input: DeactivatePromotionInput): Promise<DeactivatePromotionResult> {
  const promotion = await Promotion.findOne({
    _id: input.promotionId,
    businessId: input.businessId,
  });

  if (!promotion) {
    throw new NotFoundError('Promotion not found');
  }

  promotion.status = 'paused';
  await promotion.save();

  return { message: 'Promotion paused successfully' };
}
