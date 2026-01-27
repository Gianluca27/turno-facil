import { z } from 'zod';

// Time format
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const promotionDiscountSchema = z.object({
  type: z.enum(['percentage', 'fixed']),
  amount: z.number().min(0),
  maxDiscount: z.number().min(0).optional(),
});

export const promotionTimeRangeSchema = z.object({
  from: z.string().regex(timeRegex),
  to: z.string().regex(timeRegex),
});

export const promotionConditionsSchema = z.object({
  minPurchase: z.number().min(0).optional(),
  services: z.array(z.string()).optional(),
  staff: z.array(z.string()).optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  timeRange: promotionTimeRangeSchema.optional(),
  firstVisitOnly: z.boolean().optional(),
  minVisits: z.number().min(0).optional(),
  clientSegment: z.enum(['all', 'new', 'returning', 'vip', 'inactive']).optional(),
});

export const promotionLimitsSchema = z.object({
  totalUses: z.number().min(1).optional(),
  usesPerClient: z.number().min(1).optional(),
});

export const createPromotionSchema = z.object({
  name: z.string().min(2, 'Nombre requerido').max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['percentage', 'fixed', 'first_visit', 'loyalty', 'package']),
  code: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Z0-9]+$/, 'El código debe contener solo letras mayúsculas y números')
    .optional(),
  discount: promotionDiscountSchema,
  conditions: promotionConditionsSchema.optional(),
  limits: promotionLimitsSchema.optional(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
});

export const updatePromotionSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  discount: promotionDiscountSchema.partial().optional(),
  conditions: promotionConditionsSchema.partial().optional(),
  limits: promotionLimitsSchema.partial().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  status: z.enum(['active', 'paused']).optional(),
});

export const validateDiscountSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  businessId: z.string().min(1),
  serviceIds: z.array(z.string()).min(1),
});

// Type exports
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;
export type ValidateDiscountInput = z.infer<typeof validateDiscountSchema>;
