import { z } from 'zod';
import { studioRegistrationSchema } from '../studio/studio-registration.js';
import { depositSettingsSchema } from '../pricing/deposit-policy.js';
import {
  studioTrustLevelSchema,
  studioVerificationDecisionSchema,
} from '../studio/studio-trust.js';

export const studioProfileContractSchema = z.preprocess((input) => {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return { categoryId: 'other', ...input };
  }
  return input;
}, studioRegistrationSchema);

export const studioDepositSettingsContractSchema = depositSettingsSchema;
export const studioTrustLevelContractSchema = studioTrustLevelSchema;

export const updateStudioContactContractSchema = z
  .object({
    contactPhone: z.string().trim().max(50).nullable().optional(),
    contactEmail: z.string().trim().email('Email không hợp lệ').nullable().optional(),
    facebookUrl: z.string().trim().url('URL Facebook không hợp lệ').nullable().optional(),
    instagramUrl: z.string().trim().url('URL Instagram không hợp lệ').nullable().optional(),
    googleMapsUrl: z.string().trim().url('URL Google Maps không hợp lệ').nullable().optional(),
  })
  .strict();

export const studioVerificationDecisionContractSchema = studioVerificationDecisionSchema;

export type StudioProfileContractInput = z.infer<typeof studioProfileContractSchema>;
export type StudioDepositSettingsContractInput = z.infer<typeof studioDepositSettingsContractSchema>;
export type StudioTrustLevelContract = z.infer<typeof studioTrustLevelContractSchema>;
export type UpdateStudioContactContractInput = z.infer<typeof updateStudioContactContractSchema>;
export type StudioVerificationDecisionContractInput = z.infer<typeof studioVerificationDecisionContractSchema>;
