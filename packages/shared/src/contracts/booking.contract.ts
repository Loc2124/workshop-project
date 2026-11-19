import { z } from 'zod';

export const createBookingContractSchema = z.object({
  sessionId: z.string().uuid('Mã buổi học không đúng định dạng'),
  quantity: z
    .number()
    .int()
    .min(1, 'Số lượng vé tối thiểu là 1')
    .max(10, 'Tối đa 10 vé mỗi lần đặt'),
  customerName: z
    .string()
    .trim()
    .min(2, 'Tên khách hàng tối thiểu 2 ký tự')
    .optional(),
  customerEmail: z.string().trim().email('Email không hợp lệ').optional(),
  customerPhone: z.string().trim().optional(),
  customerNote: z
    .string()
    .trim()
    .max(500, 'Ghi chú tối đa 500 ký tự')
    .optional(),
});

export type CreateBookingContractInput = z.infer<
  typeof createBookingContractSchema
>;
