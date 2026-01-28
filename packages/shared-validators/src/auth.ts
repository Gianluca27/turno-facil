import { z } from 'zod';

// Common validators
export const emailSchema = z.string().email('Email inválido').toLowerCase().trim();

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(100, 'La contraseña es demasiado larga')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
  );

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{6,14}$/, 'Número de teléfono inválido')
  .transform((val) => {
    // Normalize to E.164 format for Argentina
    if (val.startsWith('+')) return val;
    if (val.startsWith('54')) return `+${val}`;
    if (val.startsWith('0')) return `+54${val.slice(1)}`;
    return `+54${val}`;
  });

export const nameSchema = z
  .string()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(50, 'El nombre es demasiado largo')
  .trim();

// Auth schemas
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const phoneLoginSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6, 'El código debe tener 6 dígitos'),
  verificationId: z.string().min(1, 'ID de verificación requerido'),
});

export const socialLoginSchema = z.object({
  provider: z.enum(['google', 'facebook', 'apple']),
  token: z.string().min(1, 'Token requerido'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: passwordSchema,
});

// Business auth schemas
export const businessRegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  businessName: z.string().min(2, 'Nombre del negocio requerido').max(100).trim(),
  businessType: z.string().min(2, 'Tipo de negocio requerido').trim(),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PhoneLoginInput = z.infer<typeof phoneLoginSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type SocialLoginInput = z.infer<typeof socialLoginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type BusinessRegisterInput = z.infer<typeof businessRegisterSchema>;
