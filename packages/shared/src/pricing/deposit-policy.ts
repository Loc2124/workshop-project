import { z } from 'zod';

export const MAX_DEPOSIT_PERCENT = 50;
export const BOOKING_HOLD_MINUTES = 15;
export const depositModeSchema = z.enum(['none', 'optional', 'required']);
export type DepositMode = z.infer<typeof depositModeSchema>;
export const depositPercentSchema = z
  .number()
  .int('Mức cọc phải là số nguyên.')
  .min(1, 'Mức cọc từ 1 đến 50%.')
  .max(50, 'Mức cọc tối đa là 50%');
export const depositSettingsSchema = z
  .object({
    depositMode: depositModeSchema,
    depositPercent: depositPercentSchema.nullable(),
    releaseIfUnconfirmed: z.boolean().default(false),
    releaseBeforeMinutes: z.number().int().min(15).max(1440).default(120),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.depositMode !== 'none' && value.depositPercent === null)
      context.addIssue({
        code: 'custom',
        path: ['depositPercent'],
        message: 'Vui lòng nhập mức cọc từ 1 đến 50%.',
      });
    if (value.depositMode === 'none' && value.depositPercent !== null)
      context.addIssue({
        code: 'custom',
        path: ['depositPercent'],
        message: 'Không cọc thì không cần nhập mức cọc.',
      });
  });
export function effectiveDepositPercent(
  configured: number,
  eligible: boolean,
): number {
  return eligible && configured > 0
    ? depositPercentSchema.parse(configured)
    : 0;
}
export function calculateDeposit(total: number, percent: number): number {
  if (!Number.isSafeInteger(total) || total < 0)
    throw new Error('Số tiền không hợp lệ.');
  if (percent === 0) return 0;
  const rate = depositPercentSchema.parse(percent);
  return (
    Math.floor(total / 100) * rate + Math.round(((total % 100) * rate) / 100)
  );
}
export function bookingPaymentChoice(
  mode: DepositMode,
  choice?: 'deposit' | 'in_studio',
) {
  if (mode === 'none') {
    if (choice === 'deposit')
      throw new Error('Studio này chỉ nhận thanh toán tại studio.');
    return 'in_studio' as const;
  }
  if (mode === 'required') {
    if (choice === 'in_studio')
      throw new Error('Buổi học này cần đặt cọc để giữ chỗ.');
    return 'deposit' as const;
  }
  if (!choice) throw new Error('Vui lòng chọn cách thanh toán.');
  return choice;
}
export function cancellationRefund(
  paid: number,
  startsAt: string | Date,
  now = Date.now(),
  studioChanged = false,
  depositAmount = paid,
) {
  if (paid <= 0)
    return { refundDue: 0, refundStatus: 'not_applicable' as const };
  const refundable =
    studioChanged || new Date(startsAt).getTime() - now >= 24 * 60 * 60 * 1000;
  const refundDue = refundable ? paid : Math.max(0, paid - depositAmount);
  return {
    refundDue,
    refundStatus: refundDue > 0 ? ('pending' as const) : ('forfeited' as const),
  };
}

export function requiresAttendanceConfirmation(input: {
  enabled: boolean;
  paymentMode: string;
  startsAt: string | Date;
  createdAt: string | Date;
  releaseBeforeMinutes: number;
}) {
  return (
    input.enabled &&
    input.paymentMode !== 'payos_deposit' &&
    new Date(input.createdAt).getTime() <
      new Date(input.startsAt).getTime() - input.releaseBeforeMinutes * 60000
  );
}
export function depositPaymentCopy(mode: DepositMode, percent: number) {
  if (mode === 'none') return 'Thanh toán trực tiếp tại studio khi đến học.';
  return mode === 'optional'
    ? `Cọc trước ${percent}% để giữ chỗ hoặc trả toàn bộ tại studio. Phần còn lại sau cọc thanh toán tại studio.`
    : `Cần đặt cọc ${percent}% để giữ chỗ. Phần còn lại thanh toán tại studio.`;
}

export function validateWorkshopDeposit(
  value: {
    depositModeOverride?: string | null;
    depositPercent?: number | null;
  },
  ctx: z.RefinementCtx,
) {
  if (
    value.depositModeOverride === undefined &&
    value.depositPercent === undefined
  )
    return;
  if (
    value.depositModeOverride === 'optional' ||
    value.depositModeOverride === 'required'
  ) {
    if (value.depositPercent == null)
      ctx.addIssue({
        code: 'custom',
        path: ['depositPercent'],
        message: 'Vui lòng nhập mức cọc từ 1 đến 50%.',
      });
  } else if (value.depositPercent != null)
    ctx.addIssue({
      code: 'custom',
      path: ['depositModeOverride'],
      message: 'Vui lòng chọn chế độ cọc hoặc dùng cấu hình studio.',
    });
}
