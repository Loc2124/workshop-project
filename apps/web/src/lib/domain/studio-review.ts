import { z } from 'zod';
import {
  studioPhoneSchema,
  defaultSiteSettings,
  type SiteSettings,
} from '@workshop/shared';
import type { AdminStudio } from '../../types/management';

export function studioReviewMissing(
  studio: Pick<
    AdminStudio,
    'contactPhone' | 'contactEmail' | 'photoIds' | 'images' | 'profileComplete'
  >,
  policy: SiteSettings['studio'] = defaultSiteSettings.studio,
) {
  const missing: string[] = [];
  if (!studioPhoneSchema.safeParse(studio.contactPhone).success)
    missing.push('SĐT');
  if (!z.string().trim().email().safeParse(studio.contactEmail).success)
    missing.push('email');
  const photoIds = new Set(studio.photoIds ?? []);
  const photoCount = new Set(
    studio.images
      ?.filter((image) => photoIds.has(image.id))
      .map((image) => image.id) ?? [],
  ).size;
  if (
    photoCount < policy.minPhotos ||
    photoCount > policy.maxPhotos ||
    photoCount !== photoIds.size ||
    (studio.profileComplete === false && !missing.length)
  )
    missing.push(
      `ảnh (${photoCount}/${photoCount > policy.maxPhotos ? policy.maxPhotos : policy.minPhotos})`,
    );
  return missing;
}
export function formatReviewDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value;
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
}
