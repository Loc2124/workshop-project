import { describe, expect, it } from 'vitest';
import {
  bookingPaymentChoice,
  calculateDeposit,
  cancellationRefund,
  depositSettingsSchema,
  depositPercentSchema,
  requiresAttendanceConfirmation,
} from '@workshop/shared';

describe('studio deposit policy', () => {
  for (const percent of [5, 20, 50]) {
    it(`supports ${percent}% for both deposit modes and rounds VND`, () => {
      for (const mode of ['optional', 'required'] as const)
        expect(
          depositSettingsSchema.parse({
            depositMode: mode,
            depositPercent: percent,
          }).depositPercent,
        ).toBe(percent);
      expect(calculateDeposit(200000, percent)).toBe((200000 * percent) / 100);
      expect(calculateDeposit(101, percent)).toBe(
        Math.round((101 * percent) / 100),
      );
    });
  }
  it('rejects 51 on the shared client/server schema with the required message', () => {
    const result = depositPercentSchema.safeParse(51);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toBe('Mức cọc tối đa là 50%');
    expect(depositPercentSchema.safeParse(0).success).toBe(false);
    expect(depositPercentSchema.safeParse(1.5).success).toBe(false);
    expect(depositPercentSchema.safeParse(1).success).toBe(true);
  });
  it('requires an explicitly entered percentage without a hard default', () => {
    for (const depositMode of ['optional', 'required'])
      expect(
        depositSettingsSchema.safeParse({ depositMode, depositPercent: null })
          .success,
      ).toBe(false);
    expect(
      depositSettingsSchema.safeParse({
        depositMode: 'none',
        depositPercent: null,
      }).success,
    ).toBe(true);
  });
  it('enforces the complete payment matrix including forged choices', () => {
    expect(bookingPaymentChoice('none')).toBe('in_studio');
    expect(() => bookingPaymentChoice('none', 'deposit')).toThrow();
    expect(bookingPaymentChoice('optional', 'deposit')).toBe('deposit');
    expect(bookingPaymentChoice('optional', 'in_studio')).toBe('in_studio');
    expect(() => bookingPaymentChoice('optional')).toThrow();
    expect(bookingPaymentChoice('required')).toBe('deposit');
    expect(() => bookingPaymentChoice('required', 'in_studio')).toThrow();
  });
});
describe('cancellation policy', () => {
  const start = '2026-11-08T07:00:00Z',
    at = (hours: number) => Date.parse(start) - hours * 3600000;
  it('never charges an unpaid customer regardless of the cancellation time', () => {
    for (const hours of [48, 24, 23, 1, 0, -1])
      expect(cancellationRefund(0, start, at(hours))).toEqual({
        refundDue: 0,
        refundStatus: 'not_applicable',
      });
  });
  it('refunds paid deposits at or before the 24h boundary', () => {
    for (const hours of [48, 24])
      expect(cancellationRefund(10000, start, at(hours))).toEqual({
        refundDue: 10000,
        refundStatus: 'pending',
      });
  });
  it('refunds all money already received when the customer cancels before 24h', () =>
    expect(cancellationRefund(200000, start, at(25))).toEqual({
      refundDue: 200000,
      refundStatus: 'pending',
    }));
  it('forfeits paid deposits when cancelling inside 24h', () => {
    for (const hours of [23, 1, 0])
      expect(cancellationRefund(10000, start, at(hours))).toEqual({
        refundDue: 0,
        refundStatus: 'forfeited',
      });
  });
  it('refunds the deposit if the studio changed the schedule', () =>
    expect(cancellationRefund(10000, start, at(1), true)).toEqual({
      refundDue: 10000,
      refundStatus: 'pending',
    }));
  it('retains only the booked deposit when a fully paid customer cancels inside 24h', () => {
    expect(cancellationRefund(200000, start, at(5), false, 10000)).toEqual({
      refundDue: 190000,
      refundStatus: 'pending',
    });
    expect(cancellationRefund(200000, start, at(5), false, 40000)).toEqual({
      refundDue: 160000,
      refundStatus: 'pending',
    });
  });
  it('refunds all money from a no-deposit booking even inside 24h', () => {
    expect(cancellationRefund(200000, start, at(5), false, 0)).toEqual({
      refundDue: 200000,
      refundStatus: 'pending',
    });
  });
  it('never refunds money not received and preserves the exact 24h boundary', () => {
    expect(cancellationRefund(5000, start, at(1), false, 10000)).toEqual({
      refundDue: 0,
      refundStatus: 'forfeited',
    });
    expect(
      cancellationRefund(200000, start, at(24), false, 10000).refundDue,
    ).toBe(200000);
    expect(
      cancellationRefund(200000, start, at(24) + 1, false, 10000).refundDue,
    ).toBe(190000);
    expect(
      cancellationRefund(200000, start, at(1), true, 10000).refundDue,
    ).toBe(200000);
  });
});

describe('attendance confirmation for new bookings', () => {
  const startsAt = '2026-11-08T14:00:00+07:00';
  const input = {
    enabled: true,
    paymentMode: 'in_studio',
    startsAt,
    createdAt: '2026-11-08T11:59:59.999+07:00',
    releaseBeforeMinutes: 120,
  };
  it('requires confirmation before the cutoff, without the former 15-minute exemption', () => {
    expect(requiresAttendanceConfirmation(input)).toBe(true);
  });
  it.each(['2026-11-08T12:00:00+07:00', '2026-11-08T12:30:00+07:00'])(
    'exempts a new studio-payment booking created at %s',
    (createdAt) => {
      expect(requiresAttendanceConfirmation({ ...input, createdAt })).toBe(
        false,
      );
    },
  );
  it('does not require another confirmation for deposit bookings or when the studio disabled release', () => {
    expect(requiresAttendanceConfirmation({ ...input, enabled: false })).toBe(
      false,
    );
    expect(
      requiresAttendanceConfirmation({
        ...input,
        paymentMode: 'payos_deposit',
      }),
    ).toBe(false);
  });
});
