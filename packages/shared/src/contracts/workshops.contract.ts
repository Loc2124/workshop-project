import { z } from 'zod';
import {
  proposedCategoryNameSchema,
  validateCategoryProposal,
} from '../validation/category-proposal.js';
import {
  depositPercentSchema,
  validateWorkshopDeposit,
} from '../pricing/deposit-policy.js';

export const workshopPolicyFieldsSchema = z
  .object({
    cancellationPolicy: z.string().trim().max(5000).nullable().optional(),
    paymentPolicy: z.string().trim().max(5000).nullable().optional(),
  })
  .strict();

export type WorkshopPolicyFields = z.infer<typeof workshopPolicyFieldsSchema>;

const postgresInteger = z.number().int().min(0).max(2_147_483_647);

export const workshopInputContractSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Tiêu đề không được để trống')
      .max(200, 'Tiêu đề tối đa 200 ký tự'),
    description: z
      .string()
      .trim()
      .min(1, 'Mô tả không được để trống')
      .max(10_000, 'Mô tả tối đa 10,000 ký tự'),
    categoryId: z.string().trim().min(1, 'Vui lòng chọn danh mục').max(100),
    proposedCategoryName: proposedCategoryNameSchema.optional(),
    level: z.enum(['beginner', 'intermediate', 'all']).default('beginner'),
    audience: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
    takeaway: z.string().trim().max(5000).nullable().optional(),
    durationMinutes: z
      .number()
      .int()
      .positive('Thời lượng phải là số dương')
      .max(2_147_483_647),
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

export const createWorkshopContractSchema = workshopInputContractSchema
  .superRefine(validateCategoryProposal)
  .superRefine(validateWorkshopDeposit);

export const updateWorkshopContractSchema = workshopInputContractSchema
  .partial()
  .superRefine(validateCategoryProposal)
  .superRefine(validateWorkshopDeposit)
  .refine(
    (input) => Object.keys(input).length > 0,
    'Cần ít nhất một trường để cập nhật',
  );

export const workshopFilterContractSchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    categoryId: z.string().trim().max(100).optional(),
    provinceId: z.string().trim().max(100).optional(),
    level: z.enum(['beginner', 'intermediate', 'all']).optional(),
    status: z.enum(['draft', 'published', 'all']).optional(),
    page: z.number().int().positive().optional().default(1),
    pageSize: z.number().int().positive().max(100).optional().default(20),
    sort: z.string().max(100).optional(),
  })
  .strict();

export type WorkshopInputContract = z.infer<typeof workshopInputContractSchema>;
export type CreateWorkshopContractInput = z.infer<
  typeof createWorkshopContractSchema
>;
export type UpdateWorkshopContractInput = z.infer<
  typeof updateWorkshopContractSchema
>;
export type WorkshopFilterContractInput = z.infer<
  typeof workshopFilterContractSchema
>;
