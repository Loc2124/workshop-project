import { z } from 'zod';

export const proposedCategoryNameSchema = z
  .string()
  .trim()
  .min(2, 'Tên danh mục cần có ít nhất 2 ký tự.')
  .max(80, 'Tên danh mục không được quá 80 ký tự.')
  .transform((name) => name.replace(/\s+/g, ' '))
  .nullable()
  .optional();

export function validateCategoryProposal(
  input: { categoryId?: string; proposedCategoryName?: string | null },
  context: z.RefinementCtx,
) {
  if (input.proposedCategoryName && input.categoryId !== 'other') {
    context.addIssue({
      code: 'custom',
      path: ['categoryId'],
      message: 'Chọn “Khác” khi đề xuất danh mục mới.',
    });
  }
}
