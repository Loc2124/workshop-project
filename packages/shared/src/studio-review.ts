import { z } from 'zod';

export const studioReviewStatusSchema = z.enum([
  'pending',
  'needs_changes',
  'approved',
  'rejected',
  'suspended',
]);
export const studioReviewDecisionSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('approved') }).strict(),
  z
    .object({
      status: z.enum(['needs_changes', 'rejected', 'suspended']),
      reason: z
        .string()
        .trim()
        .min(10, 'Lý do cần ít nhất 10 ký tự.')
        .max(1000, 'Lý do tối đa 1000 ký tự.'),
    })
    .strict(),
]);
export type StudioReviewStatus = z.infer<typeof studioReviewStatusSchema>;
export type StudioReviewDecision = z.infer<typeof studioReviewDecisionSchema>;
export function canReviewStudio(
  from: StudioReviewStatus,
  to: StudioReviewStatus,
) {
  return from === 'pending'
    ? ['approved', 'needs_changes', 'rejected'].includes(to)
    : from === 'approved'
      ? to === 'suspended'
      : from === 'suspended'
        ? to === 'approved'
        : false;
}
export const studioStatusHistorySchema = z
  .object({
    id: z.string(),
    fromStatus: z.string().nullable(),
    toStatus: z.string(),
    actorId: z.string().uuid().nullable(),
    actorName: z.string(),
    reason: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();
