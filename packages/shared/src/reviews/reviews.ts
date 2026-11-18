import { z } from 'zod';

export const createReviewSchema = z.object({
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

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const replyReviewSchema = z.object({
  replyComment: z
    .string()
    .trim()
    .min(1, 'Nội dung phản hồi không được để trống')
    .max(1000, 'Nội dung phản hồi tối đa 1000 ký tự'),
});

export type ReplyReviewInput = z.infer<typeof replyReviewSchema>;

export const reviewDtoSchema = z.object({
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

export type ReviewDto = z.infer<typeof reviewDtoSchema>;

export const reviewEligibilitySchema = z.object({
  eligible: z.boolean(),
  reason: z.string().optional(),
  reviewed: z.boolean(),
  review: reviewDtoSchema.nullable().optional(),
});

export type ReviewEligibilityDto = z.infer<typeof reviewEligibilitySchema>;
