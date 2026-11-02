import { z } from 'zod';
import { studioRegistrationSchema } from '@workshop/shared';

export const studioProfileSchema = z.preprocess((input) => {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return { categoryId: 'other', ...input };
  }
  return input;
}, studioRegistrationSchema);

export type StudioProfileInput = z.infer<typeof studioProfileSchema>;
