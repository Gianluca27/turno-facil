import { z } from 'zod';
import { phoneSchema } from './auth';

// Time format regex
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Client booking schemas
export const createAppointmentSchema = z.object({
  businessId: z.string().min(1, 'Business ID requerido'),
  serviceIds: z.array(z.string()).min(1, 'Seleccioná al menos un servicio'),
  staffId: z.string().min(1, 'Staff ID requerido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  startTime: z.string().regex(timeRegex, 'Formato de hora inválido (HH:MM)'),
  notes: z.string().max(500).optional(),
  discountCode: z.string().max(20).optional(),
});

export const rescheduleAppointmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(timeRegex),
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const checkAvailabilitySchema = z.object({
  businessId: z.string().min(1),
  serviceIds: z.array(z.string()).min(1),
  staffId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const calculatePriceSchema = z.object({
  businessId: z.string().min(1),
  serviceIds: z.array(z.string()).min(1),
  discountCode: z.string().optional(),
});

// Business-side appointment schemas
export const createManualAppointmentSchema = z.object({
  clientName: z.string().min(2, 'Nombre requerido').max(100),
  clientPhone: phoneSchema,
  clientEmail: z.string().email().optional().or(z.literal('')),
  serviceIds: z.array(z.string()).min(1),
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(timeRegex),
  notes: z.string().max(500).optional(),
});

export const updateAppointmentSchema = z.object({
  staffId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(timeRegex).optional(),
  notes: z.string().max(500).optional(),
});

export const completeAppointmentSchema = z.object({
  paymentMethod: z.enum(['cash', 'card', 'mercadopago', 'transfer']),
  paidAmount: z.number().min(0),
  tip: z.number().min(0).optional(),
});

export const sendReminderSchema = z.object({
  channel: z.enum(['push', 'sms', 'email', 'whatsapp']).optional().default('push'),
  message: z.string().max(500).optional(),
});

// Availability block
export const blockAvailabilitySchema = z.object({
  staffId: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().max(200).optional(),
  allDay: z.boolean().optional().default(false),
});

// Type exports
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type CheckAvailabilityInput = z.infer<typeof checkAvailabilitySchema>;
export type CalculatePriceInput = z.infer<typeof calculatePriceSchema>;
export type CreateManualAppointmentInput = z.infer<typeof createManualAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type CompleteAppointmentInput = z.infer<typeof completeAppointmentSchema>;
export type BlockAvailabilityInput = z.infer<typeof blockAvailabilitySchema>;
