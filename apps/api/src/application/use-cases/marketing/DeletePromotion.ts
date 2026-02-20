import { Promotion } from '../../../infrastructure/database/mongodb/models/Promotion.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface DeletePromotionInput {
  promotionId: string;
  businessId: string;
}

export interface DeletePromotionResult {
  message: string;
}

/**
 * Deletes a promotion. If the promotion has already been used
 * (currentUses > 0), it performs a soft delete by setting status
 * to 'deleted'. Otherwise, it hard-deletes the document.
 */
export async function deletePromotion(input: DeletePromotionInput): Promise<DeletePromotionResult> {
  const { promotionId, businessId } = input;

  const promotion = await Promotion.findOne({
    _id: promotionId,
    businessId,
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
    businessId,
  });

  return { message: 'Promotion deleted successfully' };
}
