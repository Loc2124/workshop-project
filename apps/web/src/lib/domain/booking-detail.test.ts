import { describe, expect, it } from 'vitest';
import type { CustomerBooking } from '@/services/customerBookingService';
import { bookingDetailState, bookingScheduleLabel } from './booking-detail';

const booking = {
  totalAmount: 200000,
  depositAmount: 10000,
  paidAmount: 0,
  paymentMode: 'payos_deposit',
  paymentStatus: 'pending',
  reservationStatus: 'pending',
  holdExpiresAt: '2026-11-07T07:10:00Z',
  startsAt: '2026-11-08T01:00:00Z',
  endsAt: '2026-11-08T03:00:00Z',
  sessionRecordStatus: 'scheduled',
  payments: [{ kind: 'deposit', status: 'created', amount: 10000 }],
} as CustomerBooking;
const now = Date.parse('2026-11-07T07:00:00Z');

describe('booking detail payment and cancellation states', () => {
  it.each([
    { hasAttendance: true, hasAttended: false, paidAmount: 0, allowed: true },
    {
      hasAttendance: true,
      hasAttended: false,
      paidAmount: 200000,
      allowed: false,
    },
    { hasAttendance: true, hasAttended: true, paidAmount: 0, allowed: false },
  ])(
    'preserves cancellation rules after attendance %j',
    ({ allowed, ...attendance }) => {
      expect(
        bookingDetailState(
          { ...booking, reservationStatus: 'confirmed', ...attendance },
          now,
        ).canCancel,
      ).toBe(allowed);
    },
  );
  it('projects the studio balance without treating the deposit as received', () => {
    expect(bookingDetailState(booking, now)).toMatchObject({
      projectedStudioAmount: 190000,
      actualBalance: 200000,
      depositPaid: false,
      canPay: true,
      remainingSeconds: 600,
    });
  });
  it('locks payment exactly at expiry but waits for server confirmation of expired state', () => {
    const atDeadline = Date.parse(booking.holdExpiresAt);
    expect(bookingDetailState(booking, atDeadline)).toMatchObject({
      canPay: false,
      deadlinePassed: true,
      expired: false,
      remainingSeconds: 0,
    });
    expect(
      bookingDetailState({ ...booking, paymentStatus: 'expired' }, atDeadline),
    ).toMatchObject({ canPay: false, expired: true, canCancel: false });
  });
  it('shows received money only from server payment data and preserves the balance after class ends', () => {
    const paid = {
      ...booking,
      paidAmount: 10000,
      reservationStatus: 'confirmed',
      payments: [{ ...booking.payments[0], status: 'paid' }],
    };
    expect(bookingDetailState(paid, now)).toMatchObject({
      confirmed: true,
      depositPaid: true,
      canPay: false,
      actualBalance: 190000,
    });
    expect(bookingDetailState(paid, Date.parse(paid.endsAt))).toMatchObject({
      confirmed: true,
      actualBalance: 190000,
      canPay: false,
    });
  });
  it('does not confirm a late payment that needs reconciliation', () => {
    expect(
      bookingDetailState(
        { ...booking, paymentStatus: 'refund_needed', paidAmount: 10000 },
        now,
      ),
    ).toMatchObject({ confirmed: false, canPay: false, canCancel: false });
  });
  it('uses the replacement QR and accepts a verified original QR payment for remaining seats', () => {
    const revised = {
      ...booking,
      depositAmount: 20000,
      payments: [
        {
          ...booking.payments[0],
          amount: 30000,
          isCurrent: false,
          checkoutUrl: 'https://old.example',
        },
        {
          ...booking.payments[0],
          amount: 20000,
          isCurrent: true,
          checkoutUrl: 'https://new.example',
        },
      ],
    };
    expect(bookingDetailState(revised, now).deposit?.checkoutUrl).toBe(
      'https://new.example',
    );
    expect(
      bookingDetailState({ ...revised, paymentAllowed: false }, now).canPay,
    ).toBe(false);
    const paid = {
      ...revised,
      paidAmount: 20000,
      reservationStatus: 'confirmed',
      payments: revised.payments.map((p, index) => ({
        ...p,
        status: index === 0 ? 'paid' : 'cancelled',
      })),
    };
    expect(bookingDetailState(paid, now)).toMatchObject({
      depositPaid: true,
      canPay: false,
      confirmed: true,
    });
  });
  it('retains cancellation ability on failure and disables payment after successful cancellation', () => {
    expect(bookingDetailState(booking, now).canCancel).toBe(true);
    expect(
      bookingDetailState(
        {
          ...booking,
          reservationStatus: 'cancelled',
          paymentStatus: 'cancelled',
        },
        now,
      ),
    ).toMatchObject({ cancelled: true, canPay: false, canCancel: false });
  });
  it('formats the full Vietnam schedule and includes both dates overnight', () => {
    expect(
      bookingScheduleLabel('2026-11-07T01:00:00Z', '2026-11-07T03:00:00Z'),
    ).toBe('08:00–10:00 · 07/11/2026');
    expect(
      bookingScheduleLabel('2026-11-07T16:00:00Z', '2026-11-07T18:00:00Z'),
    ).toBe('23:00 · 07/11/2026 – 01:00 · 08/11/2026');
  });
});
