import { calculateDiscountAmount, DiscountResult } from '../../../application/use-cases/booking/ValidateDiscount';

describe('calculateDiscountAmount', () => {
  const baseDiscount: DiscountResult = {
    _id: 'promo1' as any,
    code: 'TEST10',
    discountType: 'percentage',
    discountValue: 10,
  };

  describe('percentage discounts', () => {
    it('should calculate 10% of subtotal', () => {
      expect(calculateDiscountAmount(baseDiscount, 1000)).toBe(100);
    });

    it('should calculate 50% of subtotal', () => {
      const discount = { ...baseDiscount, discountValue: 50 };
      expect(calculateDiscountAmount(discount, 1000)).toBe(500);
    });

    it('should return 0 for 0 subtotal', () => {
      expect(calculateDiscountAmount(baseDiscount, 0)).toBe(0);
    });

    it('should cap at maxDiscountAmount when specified', () => {
      const discount = { ...baseDiscount, discountValue: 50, maxDiscountAmount: 200 };
      expect(calculateDiscountAmount(discount, 1000)).toBe(200);
    });

    it('should not cap if discount is less than maxDiscountAmount', () => {
      const discount = { ...baseDiscount, discountValue: 10, maxDiscountAmount: 200 };
      expect(calculateDiscountAmount(discount, 1000)).toBe(100);
    });

    it('should handle fractional percentages', () => {
      const discount = { ...baseDiscount, discountValue: 15 };
      expect(calculateDiscountAmount(discount, 333)).toBeCloseTo(49.95);
    });
  });

  describe('fixed discounts', () => {
    it('should return the fixed value', () => {
      const discount: DiscountResult = {
        ...baseDiscount,
        discountType: 'fixed',
        discountValue: 500,
      };
      expect(calculateDiscountAmount(discount, 1000)).toBe(500);
    });

    it('should return fixed value regardless of subtotal', () => {
      const discount: DiscountResult = {
        ...baseDiscount,
        discountType: 'fixed',
        discountValue: 200,
      };
      expect(calculateDiscountAmount(discount, 100)).toBe(200);
      expect(calculateDiscountAmount(discount, 5000)).toBe(200);
    });
  });
});
