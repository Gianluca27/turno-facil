import { z } from 'zod';

// Time format
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const campaignContentSchema = z.object({
  title: z.string().min(2, 'Título requerido').max(100),
  body: z.string().min(10, 'Contenido requerido').max(2000),
  image: z.string().url().optional(),
  actionUrl: z.string().url().optional(),
  htmlTemplate: z.string().optional(),
  templateId: z.string().optional(),
});

export const customFiltersSchema = z.object({
  lastVisitDaysAgo: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    })
    .optional(),
  totalVisits: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    })
    .optional(),
  totalSpent: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    })
    .optional(),
  services: z.array(z.string()).optional(),
  staff: z.array(z.string()).optional(),
});

export const campaignAudienceSchema = z.object({
  type: z.enum(['all', 'segment', 'custom']),
  segment: z.enum(['new', 'returning', 'vip', 'inactive', 'birthday']).optional(),
  customFilters: customFiltersSchema.optional(),
  clientIds: z.array(z.string()).optional(),
});

export const recurringScheduleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  time: z.string().regex(timeRegex),
});

export const campaignScheduleSchema = z.object({
  type: z.enum(['immediate', 'scheduled', 'recurring']),
  sendAt: z.string().datetime().optional(),
  recurring: recurringScheduleSchema.optional(),
});

export const createCampaignSchema = z.object({
  name: z.string().min(2, 'Nombre requerido').max(100),
  type: z.enum(['push', 'email', 'sms', 'whatsapp']),
  content: campaignContentSchema,
  audience: campaignAudienceSchema,
  schedule: campaignScheduleSchema,
});

export const updateCampaignSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  content: campaignContentSchema.partial().optional(),
  audience: campaignAudienceSchema.partial().optional(),
  schedule: campaignScheduleSchema.partial().optional(),
});

// Auto notification settings
export const autoNotificationSettingsSchema = z.object({
  confirmationEnabled: z.boolean().optional(),
  reminder24hEnabled: z.boolean().optional(),
  reminder2hEnabled: z.boolean().optional(),
  reviewRequestEnabled: z.boolean().optional(),
  reviewRequestDelayHours: z.number().min(0).max(168).optional(),
  birthdayEnabled: z.boolean().optional(),
  birthdayMessage: z.string().max(500).optional(),
  inactiveClientEnabled: z.boolean().optional(),
  inactiveClientDays: z.number().min(7).max(365).optional(),
  inactiveClientMessage: z.string().max(500).optional(),
});

// Type exports
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type AutoNotificationSettingsInput = z.infer<typeof autoNotificationSettingsSchema>;
