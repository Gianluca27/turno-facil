import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { validateDiscount, calculateDiscountAmount } from './ValidateDiscount.js';

export interface PriceItem {
  serviceId: unknown;
  name: string;
  price: number;
  finalPrice: number;
  discount: number;
  duration: number;
}

export interface PriceCalculation {
  items: PriceItem[];
  subtotal: number;
  discountAmount: number;
  promotion: { code: string; discountType: string; discountValue: number } | null;
  total: number;
  deposit: number;
  totalDuration: number;
}

export interface CalculatePriceInput {
  businessId: string;
  serviceIds: string[];
  discountCode?: string;
  userId: string;
}

/**
 * Calculates the full price breakdown for a set of services,
 * optionally applying a discount code, and determining the deposit.
 */
export async function calculatePrice(input: CalculatePriceInput): Promise<PriceCalculation> {
  const { businessId, serviceIds, discountCode, userId } = input;

  if (!businessId || !serviceIds?.length) {
    throw new BadRequestError('Business and services are required');
  }

  const services = await Service.find({
    _id: { $in: serviceIds },
    businessId,
    status: 'active',
  });

  let subtotal = 0;
  let totalDuration = 0;
  const items: PriceItem[] = services.map((service) => {
    const price = service.finalPrice;
    subtotal += price;
    totalDuration += service.duration;

    return {
      serviceId: service._id,
      name: service.name,
      price: service.price,
      finalPrice: price,
      discount: service.price - price,
      duration: service.duration,
    };
  });

  let discountAmount = 0;
  let promotion: PriceCalculation['promotion'] = null;

  if (discountCode) {
    const result = await validateDiscount(discountCode, businessId, userId, subtotal, serviceIds);
    if (result) {
      promotion = {
        code: result.code,
        discountType: result.discountType,
        discountValue: result.discountValue,
      };
      discountAmount = calculateDiscountAmount(result, subtotal);
    }
  }

  const total = Math.max(0, subtotal - discountAmount);

  const business = await Business.findById(businessId).select('bookingConfig');
  const deposit = business?.bookingConfig?.requireDeposit
    ? business.bookingConfig.depositType === 'percentage'
      ? (total * business.bookingConfig.depositAmount) / 100
      : Math.min(business.bookingConfig.depositAmount, total)
    : 0;

  return { items, subtotal, discountAmount, promotion, total, deposit, totalDuration };
}
