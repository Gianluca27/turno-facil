import { z } from 'zod';
import { emailSchema, phoneSchema, nameSchema } from './auth';

// Time format
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Staff schedule schemas
export const staffScheduleSlotSchema = z.object({
  start: z.string().regex(timeRegex),
  end: z.string().regex(timeRegex),
});

export const staffScheduleDaySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  isAvailable: z.boolean(),
  slots: z.array(staffScheduleSlotSchema),
});

export const recurringPatternSchema = z.object({
  frequency: z.enum(['weekly', 'monthly']),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
});

// Staff CRUD schemas
export const createStaffSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  displayName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  specialties: z.array(z.string().max(50)).max(10).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  services: z.array(z.string()).optional(),
  useBusinessSchedule: z.boolean().optional().default(true),
});

export const updateStaffSchema = z.object({
  profile: z
    .object({
      firstName: nameSchema.optional(),
      lastName: nameSchema.optional(),
      displayName: z.string().max(100).optional(),
      bio: z.string().max(500).optional(),
      specialties: z.array(z.string().max(50)).max(10).optional(),
    })
    .optional(),
  contact: z
    .object({
      email: emailSchema.optional(),
      phone: phoneSchema.optional(),
    })
    .optional(),
  services: z.array(z.string()).optional(),
  config: z
    .object({
      bufferTime: z.number().min(0).max(120).optional(),
      maxDailyAppointments: z.number().min(1).max(50).optional(),
      acceptsNewClients: z.boolean().optional(),
    })
    .optional(),
  order: z.number().min(0).optional(),
  status: z.enum(['active', 'inactive', 'vacation']).optional(),
});

export const updateStaffScheduleSchema = z.object({
  useBusinessSchedule: z.boolean(),
  custom: z.array(staffScheduleDaySchema).optional(),
});

export const createExceptionSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  type: z.enum(['vacation', 'sick', 'personal', 'other']),
  reason: z.string().max(200).optional(),
  isRecurring: z.boolean().optional().default(false),
  recurringPattern: recurringPatternSchema.optional(),
});

export const assignServicesSchema = z.object({
  serviceIds: z.array(z.string()),
});

// Type exports
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type UpdateStaffScheduleInput = z.infer<typeof updateStaffScheduleSchema>;
export type CreateExceptionInput = z.infer<typeof createExceptionSchema>;
export type AssignServicesInput = z.infer<typeof assignServicesSchema>;
