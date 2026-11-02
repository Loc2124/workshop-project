import { z } from 'zod';
import { defaultSiteSettings, type SiteSettings } from './settings.js';

export const MIN_STUDIO_PHOTOS = defaultSiteSettings.studio.minPhotos;
export const MAX_STUDIO_PHOTOS = defaultSiteSettings.studio.maxPhotos;
export const MAX_STUDIO_PHOTO_BYTES =
  defaultSiteSettings.studio.maxImageMb * 1024 * 1024;
export const studioPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s().-]/g, ''))
  .refine(
    (value) => /^(?:0[1-9]\d{8,9}|\+84[1-9]\d{8,9})$/.test(value),
    'Nhập số điện thoại Việt Nam hợp lệ.',
  );
const optionalLink = (hosts: string[]) =>
  z
    .string()
    .trim()
    .max(1000)
    .url('Nhập liên kết HTTPS hợp lệ.')
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          hosts.includes(url.hostname.toLowerCase())
        );
      } catch {
        return false;
      }
    }, 'Liên kết không đúng dịch vụ hoặc không dùng HTTPS.')
    .nullable()
    .optional();

export const createStudioEvidenceSchema = (
  policy: SiteSettings['studio'] = defaultSiteSettings.studio,
) =>
  z
    .object({
      contactPhone: studioPhoneSchema,
      contactEmail: z
        .string()
        .trim()
        .min(1, 'Nhập email liên hệ của studio.')
        .max(254)
        .email('Nhập email hợp lệ.')
        .transform((email) => email.toLowerCase()),
      photoIds: z
        .array(z.string().uuid())
        .min(
          policy.minPhotos,
          `Cần ít nhất ${policy.minPhotos} ảnh thật của studio.`,
        )
        .max(policy.maxPhotos, `Chọn tối đa ${policy.maxPhotos} ảnh.`)
        .refine(
          (ids) => new Set(ids).size === ids.length,
          'Ảnh không được trùng nhau.',
        ),
      facebookUrl: optionalLink([
        'facebook.com',
        'www.facebook.com',
        'm.facebook.com',
        'fb.com',
      ]),
      instagramUrl: optionalLink(['instagram.com', 'www.instagram.com']),
      googleMapsUrl: optionalLink([
        'google.com',
        'www.google.com',
        'maps.google.com',
        'maps.app.goo.gl',
        'goo.gl',
      ]).refine((value) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return (
            url.hostname === 'maps.app.goo.gl' ||
            url.hostname === 'maps.google.com' ||
            url.pathname.startsWith('/maps')
          );
        } catch {
          return false;
        }
      }, 'Nhập liên kết Google Maps.'),
    })
    .strict();
export const studioEvidenceSchema = createStudioEvidenceSchema();
export type StudioEvidenceInput = z.infer<typeof studioEvidenceSchema>;
