import { z } from 'zod';

const isoDateTimeSchema = z.string().datetime({ offset: true });

const sessionFields = {
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  price: z.number().int().min(0).max(2_147_483_647).optional(),
  capacity: z
    .number()
    .int()
    .positive('Số chỗ phải lớn hơn 0')
    .max(2_147_483_647),
  registrationDeadline: isoDateTimeSchema.nullable().optional(),
};

export const createSessionContractSchema = z
  .object(sessionFields)
  .strict()
  .refine(
    (input) => new Date(input.endsAt) > new Date(input.startsAt),
    'Thời gian kết thúc phải sau thời gian bắt đầu',
  )
  .refine(
    (input) =>
      !input.registrationDeadline ||
      new Date(input.registrationDeadline) <= new Date(input.startsAt),
    'Hạn đăng ký phải trước hoặc bằng thời gian bắt đầu',
  );

export const updateSessionContractSchema = z
  .object(sessionFields)
  .partial()
  .strict()
  .refine(
    (input) => Object.keys(input).length > 0,
    'Cần ít nhất một trường để cập nhật buổi học',
  );

export const sessionAttendanceCheckInContractSchema = z
  .object({
    ticketId: z.string().uuid('Mã vé không đúng định dạng'),
    status: z.enum(['attended', 'absent']),
    notes: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
  })
  .strict();

export const sessionScheduleChangeContractSchema = z
  .object({
    sessionId: z.string().uuid('Mã buổi học không đúng định dạng'),
    reason: z
      .string()
      .trim()
      .min(5, 'Lý do phải có ít nhất 5 ký tự')
      .max(1000, 'Lý do tối đa 1000 ký tự'),
    newStartsAt: isoDateTimeSchema.optional(),
    newEndsAt: isoDateTimeSchema.optional(),
    notifyCustomers: z.boolean().default(true),
  })
  .strict();

export type CreateSessionContractInput = z.infer<
  typeof createSessionContractSchema
>;
export type UpdateSessionContractInput = z.infer<
  typeof updateSessionContractSchema
>;
export type SessionAttendanceCheckInContractInput = z.infer<
  typeof sessionAttendanceCheckInContractSchema
>;
export type SessionScheduleChangeContractInput = z.infer<
  typeof sessionScheduleChangeContractSchema
>;
