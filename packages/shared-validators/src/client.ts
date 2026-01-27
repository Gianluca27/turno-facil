import { z } from 'zod';
import { emailSchema, phoneSchema, nameSchema } from './auth';

// Client management schemas
export const createClientSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  email: emailSchema.optional(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export const updateClientSchema = z.object({
  customName: z.string().max(100).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  notes: z.string().max(1000).optional(),
  allergies: z.array(z.string().max(100)).max(20).optional(),
  preferences: z.string().max(1000).optional(),
});

export const blockClientSchema = z.object({
  reason: z.string().min(5, 'Motivo requerido').max(500),
});

export const sendMessageSchema = z.object({
  channel: z.enum(['push', 'sms', 'email', 'whatsapp']),
  message: z.string().min(1, 'Mensaje requerido').max(1000),
});

export const addNoteSchema = z.object({
  note: z.string().min(1, 'Nota requerida').max(1000),
});

// Communication preferences
export const updateCommunicationPreferencesSchema = z.object({
  allowMarketing: z.boolean().optional(),
  allowReminders: z.boolean().optional(),
  preferredChannel: z.enum(['push', 'sms', 'email', 'whatsapp']).optional(),
});

// Type exports
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type BlockClientInput = z.infer<typeof blockClientSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type AddNoteInput = z.infer<typeof addNoteSchema>;
export type UpdateCommunicationPreferencesInput = z.infer<typeof updateCommunicationPreferencesSchema>;
