import { z } from 'zod';

export const createReviewContractSchema = z.object({
  rating: z.coerce
    .number()
    .int('Số sao phải là số nguyên')
    .min(1, 'Đánh giá tối thiểu 1 sao')
    .max(5, 'Đánh giá tối đa 5 sao'),
  comment: z
    .string()
    .max(1000, 'Nội dung nhận xét tối đa 1000 ký tự')
    .optional()
    .nullable()
    .transform((val) => (val?.trim() ? val.trim() : null)),
});

export type CreateReviewContractInput = z.infer<
  typeof createReviewContractSchema
>;

export const replyReviewContractSchema = z.object({
  replyComment: z
    .string()
    .trim()
    .min(1, 'Nội dung phản hồi không được để trống')
    .max(1000, 'Nội dung phản hồi tối đa 1000 ký tự'),
});

export type ReplyReviewContractInput = z.infer<
  typeof replyReviewContractSchema
>;

export const reviewDtoContractSchema = z.object({
  id: z.string(),
  bookingId: z.string().optional(),
  workshopId: z.string().optional(),
  workshopTitle: z.string().optional(),
  author: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  createdAt: z.string(),
  replyComment: z.string().nullable().optional(),
  repliedAt: z.string().nullable().optional(),
});

export type ReviewDtoContract = z.infer<typeof reviewDtoContractSchema>;

export const reviewEligibilityContractSchema = z.object({
  eligible: z.boolean(),
  reason: z.string().optional(),
  reviewed: z.boolean(),
  review: reviewDtoContractSchema.nullable().optional(),
});

export type ReviewEligibilityContract = z.infer<
  typeof reviewEligibilityContractSchema
>;

// Aliases for backwards-compatibility
export const createReviewSchema = createReviewContractSchema;
export type CreateReviewInput = CreateReviewContractInput;
export const replyReviewSchema = replyReviewContractSchema;
export type ReplyReviewInput = ReplyReviewContractInput;
export const reviewDtoSchema = reviewDtoContractSchema;
export type ReviewDto = ReviewDtoContract;
export const reviewEligibilitySchema = reviewEligibilityContractSchema;
export type ReviewEligibilityDto = ReviewEligibilityContract;
