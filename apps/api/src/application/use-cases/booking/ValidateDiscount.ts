import mongoose from 'mongoose';
import { Promotion } from '../../../infrastructure/database/mongodb/models/Promotion.js';

export interface DiscountResult {
  _id: mongoose.Types.ObjectId;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscountAmount?: number;
}

/**
 * Validates a discount code against a business's active promotions.
 * Returns the promotion details if valid, null otherwise.
 */
export async function validateDiscount(
  code: string,
  businessId: string,
  _userId: string,
  subtotal: number,
  serviceIds: string[],
): Promise<DiscountResult | null> {
  const now = new Date();

  const promotion = await Promotion.findOne({
    businessId,
    code: code.toUpperCase(),
    status: 'active',
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    $or: [
      { maxUses: { $exists: false } },
      { maxUses: null },
      { $expr: { $lt: ['$currentUses', '$maxUses'] } },
    ],
  });

  if (!promotion) {
    return null;
  }

  // Check total usage limit
  if (promotion.limits.totalUses && promotion.limits.currentUses >= promotion.limits.totalUses) {
    return null;
  }

  // Check minimum purchase amount
  if (promotion.conditions.minPurchase && subtotal < promotion.conditions.minPurchase) {
    return null;
  }

  // Check if promotion applies to specific services
  if (promotion.conditions.services && promotion.conditions.services.length > 0) {
    const hasApplicableService = serviceIds.some(
      (id) => promotion.conditions.services!.map((s: mongoose.Types.ObjectId) => s.toString()).includes(id),
    );
    if (!hasApplicableService) {
      return null;
    }
  }

  return {
    _id: promotion._id,
    code: promotion.code || '',
    discountType: promotion.discount.type,
    discountValue: promotion.discount.amount,
    maxDiscountAmount: promotion.discount.maxDiscount,
  };
}

/**
 * Calculates the actual discount amount based on promotion details.
 */
export function calculateDiscountAmount(discount: DiscountResult, subtotal: number): number {
  if (discount.discountType === 'percentage') {
    let amount = (subtotal * discount.discountValue) / 100;
    if (discount.maxDiscountAmount) {
      amount = Math.min(amount, discount.maxDiscountAmount);
    }
    return amount;
  }
  return discount.discountValue;
}
