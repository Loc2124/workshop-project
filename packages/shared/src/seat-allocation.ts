import { cancellationRefund } from './deposit-policy.js';

function money(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error('Số tiền phải là số nguyên không âm.');
  return value;
}

/** Allocate once using the original seat order; never renumber after cancellation. */
export function splitSeatAmount(amount: number, quantity: number): number[] {
  money(amount);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10)
    throw new Error('Số chỗ phải từ 1 đến 10.');
  const share = Math.floor(amount / quantity);
  return Array.from({ length: quantity }, (_, index) =>
    index === quantity - 1 ? amount - share * (quantity - 1) : share,
  );
}

export function originalSeatAmounts(input: {
  totalAmount: number;
  depositAmount: number;
  quantity: number;
}) {
  money(input.totalAmount);
  money(input.depositAmount);
  if (input.depositAmount > input.totalAmount)
    throw new Error('Tiền cọc không được vượt tổng tiền.');
  const totals = splitSeatAmount(input.totalAmount, input.quantity);
  const deposits = splitSeatAmount(input.depositAmount, input.quantity);
  return totals.map((totalAmount, index) => ({
    seq: index + 1,
    totalAmount,
    depositAmount: deposits[index]!,
  }));
}

/** Paid amounts are actual per-seat receipts, not a recalculation of booking totals. */
export function seatCancellationAmounts(input: {
  seats: readonly { seq: number; depositAmount: number; paidAmount: number }[];
  startsAt: string | Date;
  now: number;
  studioChanged: boolean;
}) {
  if (!input.seats.length || input.seats.length > 10)
    throw new Error('Vui lòng chọn từ 1 đến 10 chỗ.');
  if (
    !Number.isFinite(new Date(input.startsAt).getTime()) ||
    !Number.isFinite(input.now)
  )
    throw new Error('Thời gian buổi học không hợp lệ.');
  const seen = new Set<number>();
  return [...input.seats]
    .sort((a, b) => a.seq - b.seq)
    .map((seat) => {
      if (
        !Number.isInteger(seat.seq) ||
        seat.seq < 1 ||
        seat.seq > 10 ||
        seen.has(seat.seq)
      )
        throw new Error('Danh sách chỗ không hợp lệ hoặc bị trùng.');
      seen.add(seat.seq);
      money(seat.depositAmount);
      money(seat.paidAmount);
      const refund = cancellationRefund(
        seat.paidAmount,
        input.startsAt,
        input.now,
        input.studioChanged,
        seat.depositAmount,
      );
      return {
        seq: seat.seq,
        paidAmount: seat.paidAmount,
        refundDueAmount: refund.refundDue,
        retainedAmount: seat.paidAmount - refund.refundDue,
        refundStatus: refund.refundStatus,
      };
    });
}
