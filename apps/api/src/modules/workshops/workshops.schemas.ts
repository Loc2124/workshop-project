import { z } from 'zod';
import {
  workshopPolicyFieldsSchema,
  proposedCategoryNameSchema,
  validateCategoryProposal,
  depositPercentSchema,
} from '@workshop/shared';

const postgresInteger = z.number().int().min(0).max(2_147_483_647);

export const workshopInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10_000),
    categoryId: z.string().trim().min(1).max(100),
    proposedCategoryName: proposedCategoryNameSchema,
    level: z.enum(['beginner', 'intermediate', 'all']).default('beginner'),
    audience: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
    takeaway: z.string().trim().max(5000).nullable().optional(),
    durationMinutes: z.number().int().positive().max(2_147_483_647),
    basePrice: postgresInteger,
    depositPercent: depositPercentSchema.optional(),
    requirements: z.string().trim().max(5000).nullable().optional(),
  })
  .extend(workshopPolicyFieldsSchema.shape)
  .strict();

export const createWorkshopSchema = workshopInputSchema.superRefine(
  validateCategoryProposal,
);

export const updateWorkshopSchema = workshopInputSchema
  .partial()
  .superRefine(validateCategoryProposal)
  .refine((input) => Object.keys(input).length > 0);

export type WorkshopInput = z.infer<typeof workshopInputSchema>;
export type WorkshopUpdateInput = z.infer<typeof updateWorkshopSchema>;
