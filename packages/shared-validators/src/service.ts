import { z } from 'zod';

// Service schemas
export const serviceConfigSchema = z.object({
  bufferAfter: z.number().min(0).max(120).optional(),
  maxPerDay: z.number().min(1).max(100).optional(),
  requiresDeposit: z.boolean().optional(),
  depositAmount: z.number().min(0).optional(),
  allowOnlineBooking: z.boolean().optional(),
});

export const serviceAvailabilitySchema = z.object({
  allDays: z.boolean().optional(),
  specificDays: z.array(z.number().min(0).max(6)).optional(),
  specificHours: z
    .array(
      z.object({
        start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      })
    )
    .optional(),
});

export const packageServiceSchema = z.object({
  serviceId: z.string().min(1),
  quantity: z.number().min(1).max(10),
});

export const createServiceSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(2, 'Nombre requerido').max(100).trim(),
  description: z.string().max(500).optional(),
  duration: z.number().min(5, 'Duración mínima: 5 minutos').max(480, 'Duración máxima: 8 horas'),
  price: z.number().min(0, 'El precio no puede ser negativo'),
  currency: z.string().length(3).default('ARS'),
  config: serviceConfigSchema.optional(),
  availability: serviceAvailabilitySchema.optional(),
  image: z.string().url().optional(),
  isPackage: z.boolean().optional().default(false),
  packageServices: z.array(packageServiceSchema).optional(),
});

export const updateServiceSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(2).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  duration: z.number().min(5).max(480).optional(),
  price: z.number().min(0).optional(),
  config: serviceConfigSchema.optional(),
  availability: serviceAvailabilitySchema.optional(),
  image: z.string().url().optional().or(z.literal('')),
  order: z.number().min(0).optional(),
});

export const setDiscountSchema = z.object({
  type: z.enum(['percentage', 'fixed']),
  amount: z.number().min(0),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});

// Type exports
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type SetDiscountInput = z.infer<typeof setDiscountSchema>;
