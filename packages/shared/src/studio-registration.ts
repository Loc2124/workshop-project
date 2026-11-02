import { z } from 'zod';
import { proposedCategoryNameSchema } from './category-proposal.js';
import { createStudioEvidenceSchema } from './studio-evidence.js';
import { defaultSiteSettings, type SiteSettings } from './settings.js';

export const createStudioRegistrationSchema = (
  policy: SiteSettings['studio'] = defaultSiteSettings.studio,
) =>
  z
    .object({
      draftStudioId: z.string().uuid('Tải ảnh studio trước khi gửi hồ sơ.'),
      name: z
        .string()
        .trim()
        .min(2, 'Tên studio cần có từ 2 đến 120 ký tự.')
        .max(120, 'Tên studio không được quá 120 ký tự.'),
      categoryId: z.string().trim().min(1, 'Chọn lĩnh vực hoạt động.').max(100),
      categoryIds: z
        .array(z.string().trim().min(1).max(100))
        .min(1, 'Chọn ít nhất một loại workshop.')
        .max(100)
        .refine(
          (ids) => new Set(ids).size === ids.length,
          'Loại workshop không được trùng nhau.',
        )
        .optional(),
      proposedCategoryName: proposedCategoryNameSchema,
      description: z
        .string()
        .trim()
        .max(2000, 'Giới thiệu không được quá 2000 ký tự.')
        .nullable()
        .optional(),
      provinceId: z
        .string()
        .trim()
        .min(1, 'Chọn tỉnh hoặc thành phố.')
        .max(100),
      areaId: z.string().uuid().nullable().optional(),
      address: z
        .string()
        .trim()
        .min(1, 'Nhập địa chỉ cụ thể của studio.')
        .max(500, 'Địa chỉ không được quá 500 ký tự.'),
    })
    .extend(createStudioEvidenceSchema(policy).shape)
    .superRefine((input, context) => {
      const hasOther = (input.categoryIds ?? [input.categoryId]).includes(
        'other',
      );
      if (input.categoryIds && hasOther && !input.proposedCategoryName) {
        context.addIssue({
          code: 'custom',
          path: ['proposedCategoryName'],
          message: 'Nhập loại workshop khác để xét duyệt.',
        });
      }
      if (input.proposedCategoryName && !hasOther) {
        context.addIssue({
          code: 'custom',
          path: ['proposedCategoryName'],
          message: 'Chọn “Khác” khi đề xuất loại workshop mới.',
        });
      }
    });
export const studioRegistrationSchema = createStudioRegistrationSchema();
