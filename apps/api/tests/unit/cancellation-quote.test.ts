import { describe, expect, it } from 'vitest';
import {
  createCancellationQuote,
  cancellationQuoteMatches,
  type CancellationSnapshot,
} from '../../src/modules/bookings/cancellation-quote.js';
const secret = 'test-only-signing-secret';
const snapshot: CancellationSnapshot = {
  id: 'booking-a',
  userId: 'customer-a',
  quantity: 1,
  paidAmount: 200000,
  depositAmount: 10000,
  status: 'paid',
  reservationStatus: 'confirmed',
  startsAt: '2026-11-08T14:00:00+07:00',
  endsAt: '2026-11-08T16:00:00+07:00',
  sessionStatus: 'scheduled',
  reschedulePending: false,
};
const boundary = Date.parse(snapshot.startsAt as string) - 24 * 3600000;
describe('signed cancellation terms', () => {
  it('binds a partial quote to the original seat selection and settled refunds', () => {
    const now = boundary + 1;
    const partial = {
      ...snapshot,
      selectionKey: 'revision-1:2',
      seats: [
        {
          paidAmount: 200000,
          depositAmount: 10000,
          refundDueAmount: 190000,
          refundedAmount: 50000,
        },
      ],
    };
    const quote = createCancellationQuote(partial, now, secret);
    expect(quote).toMatchObject({
      refundDueAmount: 140000,
      retainedAmount: 10000,
      alreadyRefundedAmount: 50000,
    });
    expect(
      cancellationQuoteMatches(quote.quoteToken, partial, now, secret),
    ).toBe(true);
    expect(
      cancellationQuoteMatches(
        quote.quoteToken,
        { ...partial, selectionKey: 'revision-1:3' },
        now,
        secret,
      ),
    ).toBe(false);
    expect(
      cancellationQuoteMatches(
        quote.quoteToken,
        { ...partial, seats: [{ ...partial.seats[0], refundedAmount: 60000 }] },
        now,
        secret,
      ),
    ).toBe(false);
  });
  it('requires a new confirmation when the 24-hour boundary changes the refund, without rejecting the exact boundary', () => {
    const before = createCancellationQuote(snapshot, boundary - 1000, secret);
    expect(before).toMatchObject({
      refundDueAmount: 200000,
      retainedAmount: 0,
    });
    expect(
      cancellationQuoteMatches(before.quoteToken, snapshot, boundary, secret),
    ).toBe(true);
    expect(
      cancellationQuoteMatches(
        before.quoteToken,
        snapshot,
        boundary + 1,
        secret,
      ),
    ).toBe(false);
    expect(
      createCancellationQuote(snapshot, boundary + 1, secret),
    ).toMatchObject({ refundDueAmount: 190000, retainedAmount: 10000 });
  });
  it('expires after five minutes even if the amount has not changed', () => {
    const now = boundary - 3600000,
      quote = createCancellationQuote(snapshot, now, secret);
    expect(
      cancellationQuoteMatches(
        quote.quoteToken,
        snapshot,
        now + 299999,
        secret,
      ),
    ).toBe(true);
    expect(
      cancellationQuoteMatches(
        quote.quoteToken,
        snapshot,
        now + 300000,
        secret,
      ),
    ).toBe(false);
  });
  it('rejects altered tokens and another customer, booking, payment, quantity or schedule', () => {
    const now = boundary - 3600000,
      quote = createCancellationQuote(snapshot, now, secret);
    for (const changed of [
      { userId: 'customer-b' },
      { id: 'booking-b' },
      { paidAmount: 10000 },
      { quantity: 2 },
      { startsAt: '2026-11-08T15:00:00+07:00' },
      { reschedulePending: true },
      { scheduleVersion: 2 },
      { hasAttendance: true },
      { hasAttended: true },
    ])
      expect(
        cancellationQuoteMatches(
          quote.quoteToken,
          { ...snapshot, ...changed },
          now,
          secret,
        ),
      ).toBe(false);
    expect(
      cancellationQuoteMatches(quote.quoteToken + 'x', snapshot, now, secret),
    ).toBe(false);
    expect(cancellationQuoteMatches('bad-token', snapshot, now, secret)).toBe(
      false,
    );
  });
});
