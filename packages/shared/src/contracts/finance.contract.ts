import { z } from 'zod';

export const cancelBookingContractSchema = z
  .object({
    quoteToken: z.string().min(1).max(2000).optional(),
    reason: z.string().trim().max(500, 'Lý do hủy tối đa 500 ký tự').optional(),
  })
  .strict()
  .default({});

export const refundObligationRepaymentContractSchema = z
  .object({
    obligationId: z.string().uuid('Mã nghĩa vụ hoàn tiền không hợp lệ'),
    amount: z.number().int().positive('Số tiền hoàn trả phải lớn hơn 0'),
    referenceCode: z.string().trim().min(1, 'Mã giao dịch đối soát không được để trống').max(100),
    note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
  })
  .strict();

export const payoutAccountContractSchema = z
  .object({
    bankCode: z.string().trim().min(1, 'Vui lòng chọn ngân hàng').max(50),
    accountNumber: z.string().trim().min(5, 'Số tài khoản không hợp lệ').max(30),
    accountName: z.string().trim().min(2, 'Tên chủ tài khoản tối thiểu 2 ký tự').max(100),
  })
  .strict();

export const payoutRequestContractSchema = z
  .object({
    studioId: z.string().uuid('Mã studio không đúng định dạng'),
    amount: z.number().int().positive('Số tiền rút phải lớn hơn 0'),
    payoutAccountId: z.string().uuid('Mã tài khoản thanh toán không đúng định dạng').optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const transferExecutionContractSchema = z
  .object({
    payoutId: z.string().uuid('Mã payout không đúng định dạng'),
    transferRef: z.string().trim().min(1, 'Mã giao dịch không được để trống').max(100),
    status: z.enum(['succeeded', 'failed']),
    failureReason: z.string().trim().max(500).optional(),
  })
  .strict();

export type CancelBookingContractInput = z.infer<typeof cancelBookingContractSchema>;
export type RefundObligationRepaymentContractInput = z.infer<typeof refundObligationRepaymentContractSchema>;
export type PayoutAccountContractInput = z.infer<typeof payoutAccountContractSchema>;
export type PayoutRequestContractInput = z.infer<typeof payoutRequestContractSchema>;
export type TransferExecutionContractInput = z.infer<typeof transferExecutionContractSchema>;
