import {
  studioTrustLevelSchema,
  studioVerificationHistorySchema,
  studioReviewStatusSchema,
  studioStatusHistorySchema,
} from '@workshop/shared';
import { z } from 'zod';
import {
  studioRegistrationSchema,
  proposedCategoryNameSchema,
  validateCategoryProposal,
} from '@workshop/shared';

const uuidSchema = z.string().uuid();
const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const studioProfileInputSchema = studioRegistrationSchema.strict();

const studioWorkshopFieldsSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10_000),
    categoryId: z.string().trim().min(1).max(100),
    proposedCategoryName: proposedCategoryNameSchema,
    level: z.enum(['beginner', 'intermediate', 'all']),
    audience: z.array(z.string().trim().min(1).max(100)).max(20),
    takeaway: z.string().trim().max(5000).nullable().optional(),
    durationMinutes: z.number().int().positive().max(2_147_483_647),
    basePrice: z.number().int().min(0).max(2_147_483_647),
    depositPercent: z.number().int().min(0).max(30).optional(),
    publicationStatus: z.enum(['draft', 'published']).optional(),
    requirements: z.string().trim().max(5000).nullable().optional(),
    cancellationPolicy: z.string().trim().max(5000).nullable().optional(),
    paymentPolicy: z.string().trim().max(5000).nullable().optional(),
  })
  .strict();
export const studioWorkshopInputSchema = studioWorkshopFieldsSchema.superRefine(
  validateCategoryProposal,
);
export const studioWorkshopUpdateInputSchema = studioWorkshopFieldsSchema
  .partial()
  .superRefine(validateCategoryProposal)
  .refine((input) => Object.keys(input).length > 0);

const studioSessionFieldsSchema = z
  .object({
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    price: z.number().int().min(0).max(2_147_483_647).optional(),
    capacity: z.number().int().positive().max(2_147_483_647),
  })
  .strict();

export const studioSessionInputSchema = studioSessionFieldsSchema.refine(
  (input) => new Date(input.endsAt) > new Date(input.startsAt),
);

export const studioSessionUpdateInputSchema = studioSessionFieldsSchema
  .partial()
  .refine(
    (input) =>
      Object.keys(input).length > 0 &&
      (!input.startsAt ||
        !input.endsAt ||
        new Date(input.endsAt) > new Date(input.startsAt)),
  );

export const memberStudioSchema = z
  .object({
    reviewedBy: uuidSchema.nullable().optional(),
    reviewedAt: z.string().nullable().optional(),
    isDraft: z.boolean().optional(),
    rejectionReason: z.string().nullable().optional(),
    id: uuidSchema,
    slug: z.string(),
    name: z.string(),
    trustLevel: studioTrustLevelSchema.optional(),
    canCollectDeposit: z.boolean().optional(),
    profileComplete: z.boolean().optional(),
    contactPhone: z.string().nullable().optional(),
    contactEmail: z.string().nullable().optional(),
    photoIds: z.array(z.string().uuid()).optional(),
    facebookUrl: z.string().nullable().optional(),
    instagramUrl: z.string().nullable().optional(),
    googleMapsUrl: z.string().nullable().optional(),
    paymentQrImageId: uuidSchema.nullable().optional(),
    paymentQrImageUrl: z.string().nullable().optional(),
    images: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            key: z.string(),
            url: z.string().url(),
            thumbnailUrl: z.string().url().optional(),
            mediumUrl: z.string().url().optional(),
          })
          .strict(),
      )
      .optional(),
    proposedCategoryName: z.string().nullable().optional(),
    description: z.string().nullable(),
    categoryId: z.string(),
    categoryIds: z.array(z.string()).optional(),
    provinceId: z.string().nullable(),
    province: z.string().nullable(),
    areaId: uuidSchema.nullable(),
    area: z.string().nullable(),
    address: z.string(),
    status: studioReviewStatusSchema,
    role: z.enum(['owner', 'staff']),
    createdAt: z.string(),
  })
  .strict();

export const studioWorkshopSchema = z
  .object({
    id: uuidSchema,
    slug: z.string(),
    studioId: uuidSchema,
    title: z.string(),
    description: z.string(),
    categoryId: z.string(),
    proposedCategoryName: z.string().nullable().optional(),
    level: z.enum(['beginner', 'intermediate', 'all']),
    audience: z.array(z.string()),
    takeaway: z.string().nullable(),
    durationMinutes: z.number().int(),
    basePrice: z.number().int(),
    depositPercent: z.number().int().min(0).max(30).optional(),
    effectiveDepositPercent: z.number().int().min(0).max(30).optional(),
    requirements: z.string().nullable(),
    cancellationPolicy: z.string().nullable(),
    paymentPolicy: z.string().nullable(),
    provinceId: z.string(),
    areaId: uuidSchema.nullable(),
    address: z.string(),
    status: approvalStatusSchema,
    publicationStatus: z.enum(['draft', 'published', 'hidden']).optional(),
    createdAt: z.string(),
  })
  .strict();

export const studioSessionSchema = z
  .object({
    id: uuidSchema,
    workshopId: uuidSchema,
    workshopTitle: z.string(),
    startsAt: z.string(),
    endsAt: z.string(),
    price: z.number().int(),
    capacity: z.number().int(),
    seatsHeld: z.number().int(),
    seatsSold: z.number().int(),
    status: z.enum(['scheduled', 'cancelled', 'completed']),
    createdAt: z.string(),
  })
  .strict();

const reviewHistoryEntrySchema = z
  .object({
    categoryName: z.string().nullable().optional(),
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().nullable(),
    reviewerName: z.string(),
    reviewedAt: z.string(),
  })
  .strict();

export const adminStudioSchema = z
  .object({
    submittedAt: z.string().nullable().optional(),
    statusHistory: z.array(studioStatusHistorySchema).optional(),
    reviewedBy: uuidSchema.nullable().optional(),
    reviewedAt: z.string().nullable().optional(),
    rejectionReason: z.string().nullable().optional(),
    categoryIds: z.array(z.string()).optional(),
    id: uuidSchema,
    ownerUserId: uuidSchema,
    ownerFullName: z.string(),
    name: z.string(),
    trustLevel: studioTrustLevelSchema.optional(),
    canCollectDeposit: z.boolean().optional(),
    profileComplete: z.boolean().optional(),
    contactPhone: z.string().nullable().optional(),
    contactEmail: z.string().nullable().optional(),
    photoIds: z.array(z.string().uuid()).optional(),
    facebookUrl: z.string().nullable().optional(),
    instagramUrl: z.string().nullable().optional(),
    googleMapsUrl: z.string().nullable().optional(),
    paymentQrImageId: uuidSchema.nullable().optional(),
    paymentQrImageUrl: z.string().nullable().optional(),
    images: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            key: z.string(),
            url: z.string().url(),
            thumbnailUrl: z.string().url().optional(),
            mediumUrl: z.string().url().optional(),
          })
          .strict(),
      )
      .optional(),
    verificationActive: z.boolean().optional(),
    verificationHistory: z.array(studioVerificationHistorySchema).optional(),
    proposedCategoryName: z.string().nullable().optional(),
    description: z.string().nullable(),
    address: z.string(),
    provinceId: z.string().nullable(),
    province: z.string().nullable(),
    areaId: uuidSchema.nullable(),
    isHidden: z.boolean().optional(),
    hiddenReason: z.string().nullable().optional(),
    status: studioReviewStatusSchema,
    createdAt: z.string(),
  })
  .strict();

export const adminWorkshopSchema = z
  .object({
    id: uuidSchema,
    slug: z.string(),
    studioId: uuidSchema,
    studioName: z.string(),
    studioStatus: studioReviewStatusSchema,
    title: z.string(),
    description: z.string(),
    categoryId: z.string(),
    proposedCategoryName: z.string().nullable().optional(),
    level: z.string(),
    audience: z.array(z.string()),
    takeaway: z.string().nullable(),
    durationMinutes: z.number().int(),
    basePrice: z.number().int(),
    depositPercent: z.number().int().min(0).max(30).optional(),
    effectiveDepositPercent: z.number().int().min(0).max(30).optional(),
    requirements: z.string().nullable(),
    cancellationPolicy: z.string().nullable(),
    paymentPolicy: z.string().nullable(),
    province: z.string(),
    areaId: uuidSchema.nullable(),
    address: z.string(),
    status: approvalStatusSchema,
    createdAt: z.string(),
    reviewHistory: z.array(reviewHistoryEntrySchema),
  })
  .strict();

export const studioStatusSchema = studioReviewStatusSchema;
export const workshopDecisionSchema = z
  .object({
    status: z.enum(['approved', 'rejected']),
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .strict()
  .superRefine((decision, context) => {
    if (decision.status === 'rejected' && !decision.reason) {
      context.addIssue({
        code: 'custom',
        message: 'A reason is required when rejecting a workshop.',
        path: ['reason'],
      });
    }
    if (decision.status === 'approved' && decision.reason) {
      context.addIssue({
        code: 'custom',
        message: 'A reason is only accepted when rejecting a workshop.',
        path: ['reason'],
      });
    }
  });

export type MemberStudio = z.infer<typeof memberStudioSchema>;
export type StudioProfileInput = z.infer<typeof studioProfileInputSchema>;
export type StudioWorkshopInput = z.infer<typeof studioWorkshopInputSchema>;
export type StudioWorkshopUpdateInput = z.infer<
  typeof studioWorkshopUpdateInputSchema
>;
export type StudioSessionInput = z.infer<typeof studioSessionInputSchema>;
export type StudioSessionUpdateInput = z.infer<
  typeof studioSessionUpdateInputSchema
>;
export type StudioWorkshop = z.infer<typeof studioWorkshopSchema>;
export type StudioSession = z.infer<typeof studioSessionSchema>;
export type AdminStudio = z.infer<typeof adminStudioSchema>;
export type AdminWorkshop = z.infer<typeof adminWorkshopSchema>;
export type StudioApprovalStatus = z.infer<typeof studioStatusSchema>;
export type WorkshopDecision = z.infer<typeof workshopDecisionSchema>;
