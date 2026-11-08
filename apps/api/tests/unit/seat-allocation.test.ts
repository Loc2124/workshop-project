import { expect, it } from 'vitest';
import {
  calculateDeposit,
  originalSeatAmounts,
  seatCancellationAmounts,
  splitSeatAmount,
} from '@workshop/shared';

it('keeps the original sequence and assigns the remainder only to the last seat', () => {
  expect(
    originalSeatAmounts({
      totalAmount: 200001,
      depositAmount: 10000,
      quantity: 3,
    }),
  ).toEqual([
    { seq: 1, totalAmount: 66667, depositAmount: 3333 },
    { seq: 2, totalAmount: 66667, depositAmount: 3333 },
    { seq: 3, totalAmount: 66667, depositAmount: 3334 },
  ]);
});
it.each([0, 1, 2, 10000, 200001, 2147483647, Number.MAX_SAFE_INTEGER])(
  'preserves every dong when splitting %s across one to ten seats',
  (amount) => {
    for (let quantity = 1; quantity <= 10; quantity++) {
      const shares = splitSeatAmount(amount, quantity);
      expect(shares).toHaveLength(quantity);
      expect(shares.reduce((sum, share) => sum + share, 0)).toBe(amount);
      expect(
        shares.every((share) => Number.isSafeInteger(share) && share >= 0),
      ).toBe(true);
      expect(new Set(shares.slice(0, -1)).size).toBeLessThanOrEqual(1);
    }
  },
);
it.each([5, 20, 50])(
  'uses the original %s%% deposit shares for a fully paid cancellation inside 24h',
  (percent) => {
    const total = 200001,
      deposit = calculateDeposit(total, percent);
    const original = originalSeatAmounts({
      totalAmount: total,
      depositAmount: deposit,
      quantity: 3,
    });
    const results = seatCancellationAmounts({
      seats: original.map((s) => ({ ...s, paidAmount: s.totalAmount })),
      startsAt: '2026-11-09T14:00:00+07:00',
      now: Date.parse('2026-11-09T10:00:00+07:00'),
      studioChanged: false,
    });
    expect(results.reduce((sum, s) => sum + s.retainedAmount, 0)).toBe(deposit);
    expect(results.reduce((sum, s) => sum + s.refundDueAmount, 0)).toBe(
      total - deposit,
    );
  },
);
it('cancels only selected original seats without redistributing the last-seat remainder', () => {
  const input = {
    seats: [{ seq: 3, depositAmount: 3334, paidAmount: 3334 }],
    startsAt: '2026-11-09T14:00:00+07:00',
    now: Date.parse('2026-11-09T10:00:00+07:00'),
    studioChanged: false,
  };
  expect(seatCancellationAmounts(input)).toEqual([
    {
      seq: 3,
      paidAmount: 3334,
      refundDueAmount: 0,
      retainedAmount: 3334,
      refundStatus: 'forfeited',
    },
  ]);
});
it.each([0, 1])(
  'treats the exact 24-hour boundary and one millisecond later separately (%s)',
  (after) => {
    const start = Date.parse('2026-11-09T14:00:00+07:00');
    const [seat] = seatCancellationAmounts({
      seats: [{ seq: 2, depositAmount: 3333, paidAmount: 66667 }],
      startsAt: new Date(start),
      now: start - 86400000 + after,
      studioChanged: false,
    });
    expect(seat.refundDueAmount).toBe(after ? 63334 : 66667);
  },
);
it('refunds every selected receipt after a studio change, without requiring a deposit', () => {
  const seats = [
    { seq: 3, depositAmount: 3334, paidAmount: 66667 },
    { seq: 1, depositAmount: 0, paidAmount: 66667 },
  ];
  const result = seatCancellationAmounts({
    seats,
    startsAt: '2026-11-09T14:00:00+07:00',
    now: Date.parse('2026-11-09T13:00:00+07:00'),
    studioChanged: true,
  });
  expect(result.map((s) => s.seq)).toEqual([1, 3]);
  expect(
    result.every((s) => s.retainedAmount === 0 && s.refundDueAmount === 66667),
  ).toBe(true);
});
it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid money %s',
  (amount) => {
    expect(() => splitSeatAmount(amount, 3)).toThrow();
  },
);
it('rejects duplicate seats and a deposit above the original total', () => {
  expect(() =>
    originalSeatAmounts({ totalAmount: 100, depositAmount: 101, quantity: 3 }),
  ).toThrow();
  expect(() =>
    seatCancellationAmounts({
      seats: [
        { seq: 1, depositAmount: 0, paidAmount: 0 },
        { seq: 1, depositAmount: 0, paidAmount: 0 },
      ],
      startsAt: new Date(),
      now: Date.now(),
      studioChanged: false,
    }),
  ).toThrow();
});
