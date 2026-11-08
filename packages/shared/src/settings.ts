import { z } from 'zod';
export const SETTINGS_KEY = 'site';
export const SETTINGS_PHOTO_LIMIT = 20;
export const SETTINGS_IMAGE_MB_LIMIT = 20;
const integer = (min: number, max: number, label: string) =>
  z
    .number({ error: `Nhập ${label} bằng số.` })
    .int(`${label} phải là số nguyên.`)
    .min(min, `${label} phải từ ${min} đến ${max}.`)
    .max(max, `${label} phải từ ${min} đến ${max}.`);
export const siteSettingsSchema = z
  .object({
    studio: z
      .object({
        minPhotos: integer(1, SETTINGS_PHOTO_LIMIT, 'Số ảnh tối thiểu'),
        maxPhotos: integer(1, SETTINGS_PHOTO_LIMIT, 'Số ảnh tối đa'),
        maxImageMb: integer(1, SETTINGS_IMAGE_MB_LIMIT, 'Dung lượng ảnh'),
      })
      .strict()
      .refine((v) => v.minPhotos <= v.maxPhotos, {
        path: ['maxPhotos'],
        message: 'Số ảnh tối đa phải lớn hơn hoặc bằng số ảnh tối thiểu.',
      }),
    support: z
      .object({
        hotline: z
          .string()
          .trim()
          .min(1, 'Nhập hotline hỗ trợ.')
          .max(30, 'Hotline không được quá 30 ký tự.')
          .regex(/^[+\d][\d\s().-]{5,29}$/, 'Nhập hotline hợp lệ.'),
        workingHours: z.string().trim().min(1, 'Nhập giờ làm việc.').max(100),
        email: z
          .string()
          .trim()
          .min(1, 'Nhập email hỗ trợ.')
          .max(254)
          .email('Nhập email hỗ trợ hợp lệ.')
          .transform((v) => v.toLowerCase()),
      })
      .strict(),
    booking: z
      .object({
        cancellationHours: integer(24, 24, 'Mốc hoàn cọc miễn phí là 24 giờ'),
        maxActiveSlots: integer(1, 100, 'Số slot tối đa'),
      })
      .strict(),
  })
  .strict();
export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export const defaultSiteSettings: SiteSettings = {
  studio: { minPhotos: 3, maxPhotos: 8, maxImageMb: 10 },
  support: {
    hotline: '1900 8889',
    workingHours: '8:30–21:00',
    email: 'hotro@openslot.vn',
  },
  booking: { cancellationHours: 24, maxActiveSlots: 5 },
};
