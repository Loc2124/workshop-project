export { studioProvinces } from './provinces.js';
import { studioTrustLevelSchema } from './studio-trust.js';
import { z } from 'zod';
export {
  proposedCategoryNameSchema,
  validateCategoryProposal,
} from './category-proposal.js';
export { studioRegistrationSchema } from './studio-registration.js';
export {
  splitSeatAmount,
  originalSeatAmounts,
  seatCancellationAmounts,
} from './seat-allocation.js';
export {
  studioEvidenceSchema,
  createStudioEvidenceSchema,
  studioPhoneSchema,
  MIN_STUDIO_PHOTOS,
  MAX_STUDIO_PHOTOS,
  MAX_STUDIO_PHOTO_BYTES,
} from './studio-evidence.js';
export type { StudioEvidenceInput } from './studio-evidence.js';
export {
  depositPercentSchema,
  validateWorkshopDeposit,
  BOOKING_HOLD_MINUTES,
  depositModeSchema,
  depositSettingsSchema,
  bookingPaymentChoice,
  cancellationRefund,
  requiresAttendanceConfirmation,
  depositPaymentCopy,
  MAX_DEPOSIT_PERCENT,
  effectiveDepositPercent,
  calculateDeposit,
} from './deposit-policy.js';
export {
  studioTrustLevelSchema,
  studioVerificationDecisionSchema,
  studioVerificationHistorySchema,
  verificationMethodSchema,
} from './studio-trust.js';
export type {
  StudioTrustLevel,
  StudioVerificationDecision,
} from './studio-trust.js';
export {
  newPasswordSchema,
  passwordRequirements,
  registrationInputSchema,
} from './password-policy.js';

const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const workshopSessionDtoSchema = z
  .object({
    id: z.string().min(1),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
    price: z.number().int().nonnegative(),
    availableSeats: z.number().int().nonnegative(),
    status: z.enum(['scheduled', 'cancelled', 'completed']).optional(),
    registrationDeadline: isoDateTimeSchema.nullable().optional(),
  })
  .strict();

export const publicWorkshopDtoSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    studioId: z.string().min(1),
    studioSlug: z.string().min(1),
    title: z.string(),
    description: z.string(),
    categoryId: z.string().min(1),
    level: z.enum(['beginner', 'intermediate', 'all']),
    audience: z.array(z.string()),
    takeaway: z.string().nullable(),
    durationMinutes: z.number().int().positive(),
    basePrice: z.number().int().nonnegative(),
    depositPercent: z.number().int().min(0).max(50).optional(),
    effectiveDepositPercent: z.number().int().min(0).max(50).optional(),
    depositMode: z.enum(['none', 'optional', 'required']).optional(),
    included: z.array(z.string()).optional(),
    studioContactPhone: z.string().nullable().optional(),
    studioContactEmail: z.string().nullable().optional(),
    requirements: z.string().nullable(),
    cancellationPolicy: z.string().nullable(),
    paymentPolicy: z.string().nullable(),
    district: z.string().nullable(),
    province: z.string(),
    provinceId: z.string().min(1),
    areaId: z.string().nullable(),
    address: z.string(),
    isSimulated: z.boolean(),
    isDiscontinued: z.boolean().optional(),
    studioName: z.string(),
    studioDescription: z.string().nullable(),
    studioTrustLevel: studioTrustLevelSchema.optional(),
    imageUrl: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    mediumUrl: z.string().optional(),
    nextStartsAt: isoDateTimeSchema.optional(),
    rating: z.number().optional(),
    reviewCount: z.number().optional(),
    sessions: z.array(workshopSessionDtoSchema),
  })
  .strict();

export const catalogResponseSchema = z
  .object({
    items: z.array(publicWorkshopDtoSchema),
    pagination: z
      .object({
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        total: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const publicWorkshopResponseSchema = z
  .object({ workshop: publicWorkshopDtoSchema })
  .strict();

export const publicStudioResponseSchema = z
  .object({
    studio: z
      .object({
        id: z.string().min(1),
        slug: z.string().min(1),
        categoryId: z.string().min(1),
        trustLevel: studioTrustLevelSchema.optional(),
        canCollectDeposit: z.boolean().optional(),
        rating: z.number().optional(),
        reviewCount: z.number().optional(),
        contactPhone: z.string().nullable().optional(),
        contactEmail: z.string().nullable().optional(),
        facebookUrl: z.string().nullable().optional(),
        instagramUrl: z.string().nullable().optional(),
        googleMapsUrl: z.string().nullable().optional(),
        photoUrls: z.array(z.string()).optional(),
        photoImages: z
          .array(
            z
              .object({
                url: z.string(),
                thumbnailUrl: z.string().optional(),
                mediumUrl: z.string().optional(),
              })
              .strict(),
          )
          .optional(),
        name: z.string(),
        description: z.string().nullable(),
        province: z.string(),
        provinceId: z.string().min(1),
        areaId: z.string().nullable(),
        areaName: z.string().nullable(),
        address: z.string(),
        workshops: z.array(publicWorkshopDtoSchema),
      })
      .strict(),
  })
  .strict();

export const workshopPolicyFieldsSchema = z
  .object({
    cancellationPolicy: z.string().trim().max(5000).nullable().optional(),
    paymentPolicy: z.string().trim().max(5000).nullable().optional(),
  })
  .strict();

export type WorkshopSessionDto = z.infer<typeof workshopSessionDtoSchema>;
export type PublicWorkshopDto = z.infer<typeof publicWorkshopDtoSchema>;
export type CatalogResponseDto = z.infer<typeof catalogResponseSchema>;
export type PublicStudioResponseDto = z.infer<
  typeof publicStudioResponseSchema
>;
export type WorkshopPolicyFields = z.infer<typeof workshopPolicyFieldsSchema>;
export * from './studio-review.js';
export * from './reports.js';
export * from './message-templates.js';
export * from './settings.js';
export { createStudioRegistrationSchema } from './studio-registration.js';
export * from './vietnam-banks.js';
export * from './reviews.js';
