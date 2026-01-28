import { z } from 'zod';

// Rating schema (1-5)
const ratingSchema = z.number().min(1).max(5);

export const reviewRatingsSchema = z.object({
  overall: ratingSchema,
  service: ratingSchema.optional(),
  staff: ratingSchema.optional(),
  cleanliness: ratingSchema.optional(),
  value: ratingSchema.optional(),
});

export const reviewContentSchema = z.object({
  text: z.string().min(10, 'El comentario debe tener al menos 10 caracteres').max(2000),
  photos: z.array(z.string().url()).max(5).optional(),
});

// Client review schemas
export const createReviewSchema = z.object({
  appointmentId: z.string().min(1, 'ID de turno requerido'),
  ratings: reviewRatingsSchema,
  content: reviewContentSchema,
});

export const updateReviewSchema = z.object({
  ratings: reviewRatingsSchema.partial().optional(),
  content: z
    .object({
      text: z.string().min(10).max(2000).optional(),
      photos: z.array(z.string().url()).max(5).optional(),
    })
    .optional(),
});

export const reportReviewSchema = z.object({
  reason: z
    .string()
    .min(10, 'Por favor describí el motivo del reporte')
    .max(500, 'El motivo es demasiado largo'),
});

// Business response schemas
export const respondToReviewSchema = z.object({
  text: z.string().min(10, 'La respuesta debe tener al menos 10 caracteres').max(1000),
});

// Type exports
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type ReportReviewInput = z.infer<typeof reportReviewSchema>;
export type RespondToReviewInput = z.infer<typeof respondToReviewSchema>;
