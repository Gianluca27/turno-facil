import { z } from 'zod';

// Transaction schemas
export const createTransactionSchema = z.object({
  appointmentId: z.string().optional(),
  clientId: z.string().optional(),
  staffId: z.string().optional(),
  type: z.enum(['payment', 'refund', 'deposit', 'tip']),
  amount: z.number().min(0),
  paymentMethod: z.enum(['cash', 'card', 'mercadopago', 'transfer', 'other']),
  breakdown: z
    .object({
      services: z
        .array(
          z.object({
            serviceId: z.string(),
            name: z.string(),
            amount: z.number(),
          })
        )
        .optional(),
      discount: z.number().optional(),
      discountCode: z.string().optional(),
      tip: z.number().optional(),
      tax: z.number().optional(),
    })
    .optional(),
  notes: z.string().max(500).optional(),
});

export const createExpenseSchema = z.object({
  amount: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  category: z.string().min(1, 'Categoría requerida').max(50),
  description: z.string().max(500).optional(),
  receipt: z.string().url().optional(),
  paymentMethod: z.enum(['cash', 'card', 'mercadopago', 'transfer', 'other']).optional(),
  notes: z.string().max(500).optional(),
});

export const updateExpenseSchema = z.object({
  amount: z.number().min(0.01).optional(),
  category: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  receipt: z.string().url().optional().or(z.literal('')),
  notes: z.string().max(500).optional(),
});

// POS schemas
export const checkoutSchema = z.object({
  appointmentId: z.string().min(1, 'ID de turno requerido'),
  services: z
    .array(
      z.object({
        serviceId: z.string(),
        price: z.number().min(0).optional(),
      })
    )
    .optional(),
  discountCode: z.string().optional(),
  discountAmount: z.number().min(0).optional(),
  tip: z.number().min(0).optional(),
  paymentMethod: z.enum(['cash', 'card', 'mercadopago', 'transfer']),
});

export const quickSaleSchema = z.object({
  clientId: z.string().optional(),
  clientName: z.string().max(100).optional(),
  items: z.array(
    z.object({
      name: z.string().min(1).max(100),
      price: z.number().min(0),
      quantity: z.number().min(1).max(99),
    })
  ),
  paymentMethod: z.enum(['cash', 'card', 'mercadopago', 'transfer']),
  notes: z.string().max(500).optional(),
});

export const dailyCloseSchema = z.object({
  actualCash: z.number().min(0),
  notes: z.string().max(500).optional(),
});

// Type exports
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type QuickSaleInput = z.infer<typeof quickSaleSchema>;
export type DailyCloseInput = z.infer<typeof dailyCloseSchema>;
