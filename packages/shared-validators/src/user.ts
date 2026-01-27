import { z } from 'zod';
import { emailSchema, phoneSchema, nameSchema } from './auth';

// Profile schemas
export const updateProfileSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phone: phoneSchema.optional(),
  birthDate: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_say']).optional(),
});

export const updatePreferencesSchema = z.object({
  language: z.string().length(2).optional(),
  timezone: z.string().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notifications: z
    .object({
      push: z.boolean().optional(),
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      marketing: z.boolean().optional(),
    })
    .optional(),
});

// Device registration
export const registerDeviceSchema = z.object({
  deviceId: z.string().min(1, 'Device ID requerido'),
  fcmToken: z.string().min(1, 'FCM token requerido'),
  platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
});

// Payment method
export const addPaymentMethodSchema = z.object({
  type: z.enum(['card', 'mercadopago']),
  token: z.string().min(1, 'Token de pago requerido'),
  isDefault: z.boolean().optional().default(false),
});

// Type exports
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type AddPaymentMethodInput = z.infer<typeof addPaymentMethodSchema>;
