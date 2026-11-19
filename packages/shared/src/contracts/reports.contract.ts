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

export const createReportContractSchema = z
  .object({
    targetType: reportTargetSchema,
    targetId: z.string().uuid('Mã đối tượng không đúng định dạng'),
    reason: z.enum([
      'misleading',
      'inappropriate',
      'fraud',
      'spam',
      'safety',
      'other',
    ]),
    detail: z
      .string()
      .trim()
      .min(10, 'Nội dung báo cáo tối thiểu 10 ký tự')
      .max(2000, 'Nội dung báo cáo tối đa 2000 ký tự'),
    attachmentIds: z
      .array(z.string().uuid())
      .max(4, 'Tối đa 4 ảnh đính kèm')
      .default([]),
  })
  .strict()
  .refine(
    (input) => new Set(input.attachmentIds).size === input.attachmentIds.length,
    { message: 'Ảnh đính kèm không được trùng.' },
  );

export type CreateReportContractInput = z.infer<
  typeof createReportContractSchema
>;

export const reportAttachmentUploadUrlContractSchema = z
  .object({
    byteSize: z
      .number()
      .int()
      .min(30, 'Kích thước file tối thiểu 30 bytes')
      .max(1048576, 'Dung lượng ảnh tối đa 1MB (1,048,576 bytes)'),
  })
  .strict();

export type ReportAttachmentUploadUrlContractInput = z.infer<
  typeof reportAttachmentUploadUrlContractSchema
>;

export const reportDecisionContractSchema = z
  .object({
    action: z.enum(['start', 'hide', 'suspend', 'dismiss', 'resolve']),
    expectedStatus: reportStatusSchema,
    reason: z
      .string()
      .trim()
      .min(10, 'Lý do xử lý tối thiểu 10 ký tự')
      .max(1000, 'Lý do xử lý tối đa 1000 ký tự'),
  })
  .strict();

export type ReportDecisionContractInput = z.infer<
  typeof reportDecisionContractSchema
>;

// Aliases for backwards-compatibility
export const createReportSchema = createReportContractSchema;
export type CreateReportInput = CreateReportContractInput;
