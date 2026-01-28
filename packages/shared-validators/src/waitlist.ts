import { z } from 'zod';
import { phoneSchema } from './auth';

// Time format
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const waitlistDateRangeSchema = z.object({
  from: z.string().regex(dateRegex, 'Formato de fecha inválido'),
  to: z.string().regex(dateRegex, 'Formato de fecha inválido'),
});

export const waitlistTimeRangeSchema = z.object({
  from: z.string().regex(timeRegex),
  to: z.string().regex(timeRegex),
});

export const waitlistPreferencesSchema = z.object({
  services: z.array(z.string()).optional(),
  staffId: z.string().optional(),
  dateRange: waitlistDateRangeSchema,
  timeRange: waitlistTimeRangeSchema.optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
});

// Client waitlist schemas
export const joinWaitlistSchema = z.object({
  businessId: z.string().min(1, 'Business ID requerido'),
  preferences: waitlistPreferencesSchema,
  notes: z.string().max(500).optional(),
});

// Business waitlist schemas
export const createWaitlistEntrySchema = z.object({
  clientId: z.string().optional(),
  clientName: z.string().min(2).max(100).optional(),
  clientPhone: phoneSchema.optional(),
  preferences: waitlistPreferencesSchema,
  priority: z.enum(['normal', 'vip']).optional().default('normal'),
  notes: z.string().max(500).optional(),
});

export const notifyWaitlistSchema = z.object({
  slot: z.object({
    date: z.string().regex(dateRegex),
    startTime: z.string().regex(timeRegex),
    endTime: z.string().regex(timeRegex),
    staffId: z.string().optional(),
  }),
  expiresInMinutes: z.number().min(5).max(120).optional().default(30),
});

// Type exports
export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
export type CreateWaitlistEntryInput = z.infer<typeof createWaitlistEntrySchema>;
export type NotifyWaitlistInput = z.infer<typeof notifyWaitlistSchema>;
