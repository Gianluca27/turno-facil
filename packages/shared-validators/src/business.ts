import { z } from 'zod';
import { emailSchema, phoneSchema } from './auth';

// Common business validators
export const businessNameSchema = z.string().min(2).max(100).trim();
export const businessTypeSchema = z.string().min(2).max(50).trim();

// Contact schema
export const contactSchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
  whatsapp: phoneSchema.optional(),
  website: z.string().url().optional().or(z.literal('')),
  socialMedia: z
    .object({
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      tiktok: z.string().optional(),
    })
    .optional(),
});

// Location schema
export const locationSchema = z.object({
  address: z.string().min(5, 'Dirección requerida'),
  city: z.string().min(2, 'Ciudad requerida'),
  state: z.string().min(2, 'Provincia requerida'),
  country: z.string().default('Argentina'),
  postalCode: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  placeId: z.string().optional(),
});

// Time slot schema
export const timeSlotSchema = z.object({
  open: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido (HH:MM)'),
  close: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido (HH:MM)'),
});

// Schedule day schema
export const scheduleDaySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  isOpen: z.boolean(),
  slots: z.array(timeSlotSchema),
});

// Schedule exception schema
export const scheduleExceptionSchema = z.object({
  date: z.string().datetime(),
  isOpen: z.boolean(),
  slots: z.array(timeSlotSchema).optional(),
  reason: z.string().optional(),
});

// Booking config schema
export const bookingConfigSchema = z.object({
  slotDuration: z.number().min(5).max(480).optional(),
  bufferTime: z.number().min(0).max(120).optional(),
  maxSimultaneous: z.number().min(1).max(50).optional(),
  minAdvance: z.number().min(0).max(168).optional(), // hours
  maxAdvance: z.number().min(1).max(365).optional(), // days
  allowInstantBooking: z.boolean().optional(),
  requireConfirmation: z.boolean().optional(),
  cancellationPolicy: z
    .object({
      allowCancellation: z.boolean().optional(),
      hoursBeforeAppointment: z.number().min(0).max(168).optional(),
      penaltyType: z.enum(['none', 'percentage', 'fixed']).optional(),
      penaltyAmount: z.number().min(0).optional(),
    })
    .optional(),
  requireDeposit: z.boolean().optional(),
  depositAmount: z.number().min(0).optional(),
  depositType: z.enum(['percentage', 'fixed']).optional(),
  maxBookingsPerClient: z.number().min(1).max(20).optional(),
  allowWaitlist: z.boolean().optional(),
});

// Business CRUD schemas
export const createBusinessSchema = z.object({
  name: businessNameSchema,
  type: businessTypeSchema,
  description: z.string().max(1000).optional(),
  contact: contactSchema,
  location: locationSchema,
});

export const updateBusinessSchema = z.object({
  name: businessNameSchema.optional(),
  type: businessTypeSchema.optional(),
  description: z.string().max(1000).optional(),
  contact: contactSchema.partial().optional(),
});

export const updateScheduleSchema = z.object({
  timezone: z.string().optional(),
  regular: z.array(scheduleDaySchema).optional(),
  exceptions: z.array(scheduleExceptionSchema).optional(),
});

// Service category schemas
export const createCategorySchema = z.object({
  name: z.string().min(2).max(50).trim(),
  description: z.string().max(200).optional(),
  order: z.number().min(0).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2).max(50).trim().optional(),
  description: z.string().max(200).optional(),
  order: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

// Team invitation
export const inviteTeamMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(['admin', 'manager', 'staff', 'receptionist']),
  permissions: z.array(z.string()).optional(),
});

// Type exports
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type BookingConfigInput = z.infer<typeof bookingConfigSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;
