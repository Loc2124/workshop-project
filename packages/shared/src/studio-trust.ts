import { z } from 'zod';

export const studioTrustLevelSchema = z.enum([
  'unapproved',
  'approved',
  'verified',
]);
export const verificationMethodSchema = z.enum([
  'identity_address',
  'business_registration',
]);
export const studioVerificationDecisionSchema = z.discriminatedUnion(
  'verified',
  [
    z
      .object({
        verified: z.literal(true),
        method: verificationMethodSchema,
        confirmed: z.literal(true),
      })
      .strict(),
    z
      .object({
        verified: z.literal(false),
        reason: z
          .string()
          .trim()
          .min(1, 'Nhập lý do thu hồi xác minh.')
          .max(500),
      })
      .strict(),
  ],
);
export const studioVerificationHistorySchema = z
  .object({
    action: z.enum(['verified', 'revoked']),
    method: verificationMethodSchema.nullable(),
    reason: z.string().nullable(),
    reviewerName: z.string(),
    createdAt: z.string(),
  })
  .strict();
export type StudioTrustLevel = z.infer<typeof studioTrustLevelSchema>;
export type StudioVerificationDecision = z.infer<
  typeof studioVerificationDecisionSchema
>;
