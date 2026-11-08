import { z } from 'zod';
import {
  workshopPolicyFieldsSchema,
  proposedCategoryNameSchema,
  validateCategoryProposal,
  depositPercentSchema,
  validateWorkshopDeposit,
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
    depositPercent: depositPercentSchema.nullable().optional(),
    depositModeOverride: z
      .enum(['none', 'optional', 'required'])
      .nullable()
      .optional(),
    included: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
    publicationStatus: z.enum(['draft', 'published']).optional(),
    isDiscontinued: z.boolean().optional(),
    requirements: z.string().trim().max(5000).nullable().optional(),
  })
  .extend(workshopPolicyFieldsSchema.shape)
  .strict();

export const createWorkshopSchema = workshopInputSchema
  .superRefine(validateCategoryProposal)
  .superRefine(validateWorkshopDeposit);

export const updateWorkshopSchema = workshopInputSchema
  .partial()
  .superRefine(validateCategoryProposal)
  .superRefine(validateWorkshopDeposit)
  .refine((input) => Object.keys(input).length > 0);

export type WorkshopInput = z.infer<typeof workshopInputSchema>;
export type WorkshopUpdateInput = z.infer<typeof updateWorkshopSchema>;
