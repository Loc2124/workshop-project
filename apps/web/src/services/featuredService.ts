import { z } from 'zod';
import { publicWorkshopDtoSchema } from '@workshop/shared';
import { apiFetch } from '../lib/api-client';
export const featuredSelectionSchema = z.object({
  studioIds: z.array(z.string().uuid()).max(6),
  workshopIds: z.array(z.string().uuid()).max(8),
});
export const featuredItemSchema = z.object({
  type: z.enum(['studio', 'workshop']),
  targetId: z.string().uuid(),
  title: z.string(),
  subtitle: z.string().nullable(),
  imageUrl: z.string().nullable(),
  eligible: z.boolean(),
  sortOrder: z.number().optional(),
});
export const featuredConfigSchema = featuredSelectionSchema.extend({
  items: z.array(featuredItemSchema),
});
export type FeaturedItem = z.infer<typeof featuredItemSchema>;
export const publicFeaturedSchema = z.object({
  studios: z
    .array(
      z.object({
        id: z.string().uuid(),
        slug: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        province: z.string(),
        categoryIds: z.array(z.string()),
        imageUrl: z.string().optional(),
      }),
    )
    .max(6),
  workshops: z
    .array(publicWorkshopDtoSchema.extend({ imageUrl: z.string().optional() }))
    .max(8),
});
export type FeaturedStudio = z.infer<
  typeof publicFeaturedSchema
>['studios'][number];
export const previewKey = (id: string) => `open-slot.featured-preview.${id}`;
export function readFeaturedPreview(id: string) {
  if (!z.string().uuid().safeParse(id).success)
    throw new Error('Bản xem trước không hợp lệ.');
  const raw = localStorage.getItem(previewKey(id));
  if (!raw)
    throw new Error(
      'Bản xem trước không còn tồn tại. Hãy mở lại từ trang quản trị.',
    );
  const data = featuredSelectionSchema
    .extend({ expiresAt: z.number() })
    .parse(JSON.parse(raw));
  if (data.expiresAt < Date.now()) {
    localStorage.removeItem(previewKey(id));
    throw new Error('Bản xem trước đã hết hạn. Hãy mở lại từ trang quản trị.');
  }
  return { studioIds: data.studioIds, workshopIds: data.workshopIds };
}
export async function getPublicFeatured(signal: AbortSignal, preview?: string) {
  return publicFeaturedSchema.parse(
    await (preview
      ? apiFetch('/admin/noi-dung/preview', {
          method: 'POST',
          body: JSON.stringify(readFeaturedPreview(preview)),
          signal,
        })
      : apiFetch('/home/featured', { signal })),
  );
}
