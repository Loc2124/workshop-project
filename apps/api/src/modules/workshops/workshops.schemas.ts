import { z } from 'zod';

export const workshopInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1),
    category: z.string().trim().min(1).max(100),
    level: z.enum(['beginner', 'intermediate', 'all']).default('beginner'),
    audience: z.array(z.string().trim().min(1)).default([]),
    takeaway: z.string().trim().nullable().optional(),
    durationMinutes: z.number().int().positive(),
    basePrice: z.number().int().nonnegative(),
    requirements: z.string().trim().nullable().optional(),
    policy: z.string().trim().nullable().optional(),
    district: z.string().trim().min(1).max(100),
    address: z.string().trim().nullable().optional(),
  })
  .strict();

export const createWorkshopSchema = workshopInputSchema;

export const updateWorkshopSchema = workshopInputSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0);

export type WorkshopInput = z.infer<typeof workshopInputSchema>;
export type WorkshopUpdateInput = z.infer<typeof updateWorkshopSchema>;
