import { z } from 'zod';
import { SETTINGS_PHOTO_LIMIT } from '@workshop/shared';

export const emptyStudioDraft = {
  name: '',
  draftStudioId: '',
  contactPhone: '',
  contactEmail: '',
  photoIds: [] as string[],
  facebookUrl: '',
  instagramUrl: '',
  googleMapsUrl: '',
  categoryId: '',
  categoryIds: [] as string[],
  proposedCategoryName: '',
  description: '',
  provinceId: '',
  address: '',
};
export const studioDraftSchema = z
  .object({
    values: z
      .object({
        name: z.string().max(120),
        draftStudioId: z.union([z.string().uuid(), z.literal('')]).optional(),
        contactPhone: z.string().max(24).optional(),
        contactEmail: z.string().max(254).optional(),
        photoIds: z
          .array(z.string().uuid())
          .max(SETTINGS_PHOTO_LIMIT)
          .optional(),
        facebookUrl: z.string().max(1000).optional(),
        instagramUrl: z.string().max(1000).optional(),
        googleMapsUrl: z.string().max(1000).optional(),
        categoryId: z.string().max(100),
        categoryIds: z.array(z.string().max(100)).max(100).optional(),
        proposedCategoryName: z.string().max(80).optional(),
        description: z.string().max(2000),
        provinceId: z.string().max(100),
        address: z.string().max(500),
      })
      .strict(),
    step: z.union([z.literal(0), z.literal(1)]),
  })
  .strict();
export type StudioDraftValues = typeof emptyStudioDraft;
export const studioDraftKey = (userId?: string) =>
  `open-slot.studio-application.${userId ?? 'guest'}`;
export const studioDraftReturnKey = 'open-slot.studio-application.auth-return';

export function readStudioDraft(
  storage: Pick<Storage, 'getItem'>,
  key: string,
): { values: StudioDraftValues; step: 0 | 1 } {
  try {
    const result = studioDraftSchema.safeParse(
      JSON.parse(storage.getItem(key) ?? 'null'),
    );
    if (result.success)
      return {
        ...result.data,
        values: {
          ...emptyStudioDraft,
          ...result.data.values,
          proposedCategoryName: result.data.values.proposedCategoryName ?? '',
          categoryIds:
            result.data.values.categoryIds ??
            (result.data.values.categoryId
              ? [result.data.values.categoryId]
              : []),
        },
      };
  } catch {
    /* A malformed or unavailable draft starts empty. */
  }
  return { values: { ...emptyStudioDraft }, step: 0 };
}
