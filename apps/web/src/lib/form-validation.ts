import { z } from 'zod';
import { parseCalendarDate } from './calendar-date';

export const searchQuerySchema = z
  .string()
  .trim()
  .max(200, 'Từ khóa tìm kiếm không được quá 200 ký tự.');
export const workshopSelectionSchema = z.string().uuid('Chọn workshop hợp lệ.');
export const homeSearchFormSchema = z.object({
  query: searchQuerySchema,
  date: z
    .string()
    .refine(
      (value) => value === '' || parseCalendarDate(value) !== undefined,
      'Chọn ngày trải nghiệm hợp lệ.',
    ),
  provinceId: z.string().min(1).max(100).optional(),
});

export const bookingFormSchema = z
  .object({
    workshopId: z.string().trim().min(1),
    sessionId: z.string().trim().min(1),
    quantity: z.number().int().min(1).max(10),
    availableSeats: z.number().int().min(0),
  })
  .refine((input) => input.quantity <= input.availableSeats, {
    path: ['quantity'],
    message: 'Số người vượt quá số chỗ còn lại.',
  })
  .transform((input) => ({
    workshopId: input.workshopId,
    sessionId: input.sessionId,
    quantity: input.quantity,
  }));

export const requiredPriceFormSchema = z
  .string()
  .trim()
  .min(1, 'Nhập giá cơ sở của workshop bằng số nguyên VND.')
  .regex(/^\d+$/, 'Giá cơ sở phải là số nguyên VND.')
  .transform(Number)
  .pipe(z.number().int().min(0).max(2_147_483_647));
