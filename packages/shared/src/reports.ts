import { z } from 'zod';
export const reportReasons = {
  misleading: 'Thông tin sai lệch',
  inappropriate: 'Nội dung không phù hợp',
  fraud: 'Nghi ngờ lừa đảo',
  spam: 'Spam hoặc quảng cáo',
  safety: 'Vấn đề an toàn',
  other: 'Lý do khác',
} as const;
export const reportStatusSchema = z.enum([
  'new',
  'in_progress',
  'resolved',
  'dismissed',
]);
export const reportTargetSchema = z.enum(['studio', 'workshop', 'review']);
export const createReportSchema = z
  .object({
    targetType: reportTargetSchema,
    targetId: z.string().uuid(),
    reason: z.enum([
      'misleading',
      'inappropriate',
      'fraud',
      'spam',
      'safety',
      'other',
    ]),
    detail: z.string().trim().min(10).max(2000),
    attachmentIds: z.array(z.string().uuid()).max(4).default([]),
  })
  .strict()
  .refine(
    (input) => new Set(input.attachmentIds).size === input.attachmentIds.length,
    { message: 'Ảnh đính kèm không được trùng.' },
  );
