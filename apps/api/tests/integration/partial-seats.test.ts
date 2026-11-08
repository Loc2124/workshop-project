import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import {
  app,
  account,
  publicWorkshop,
  session,
  placeBooking,
  mockWebhook,
  settleBookingRefund,
  type Account,
} from '../helpers/partial-booking-fixtures.js';
import { query, closePool } from '../../src/db/pool.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { MockProvider } from '../../src/modules/payments/providers/mock.provider.js';
import { releaseExpiredBookingHolds } from '../../src/modules/bookings/booking-expiry-job.js';
vi.setConfig({ testTimeout: 120000, hookTimeout: 60000 });
beforeAll(async () => {
  assertSafeTestDatabase();
  await migrateDatabase(process.env.DATABASE_URL_TEST!);
});
afterAll(async () => closePool());

it('keeps the original last-seat rounding through repeated partial cancellations', async () => {
  const { workshopId } = await publicWorkshop(5),
    slot = await session(workshopId, 3),
    customer = await account();
  await query('UPDATE sessions SET price=66667 WHERE id=$1', [slot]);
  const created = await placeBooking(customer, slot, 3),
    id = created.body.booking.id;
  expect(created.status).toBe(201);
  expect(created.body.booking.depositAmount).toBe(10000);
  expect((await cancel(customer, id, [2])).status).toBe(200);
  expect((await detail(customer, id)).depositAmount).toBe(6667);
  expect((await cancel(customer, id, [1])).status).toBe(200);
  expect(await detail(customer, id)).toMatchObject({
    quantity: 1,
    totalAmount: 66667,
    depositAmount: 3334,
    originalQuantity: 3,
    originalDepositAmount: 10000,
    holdExpiresAt: created.body.booking.holdExpiresAt,
  });
  expect((await confirm(customer, created.body.booking.orderCode)).status).toBe(
    200,
  );
  expect(await detail(customer, id)).toMatchObject({
    reservationStatus: 'confirmed',
    paidAmount: 3334,
    receivedAmount: 10000,
    refundDueAmount: 6666,
  });
  expect(
    (
      await query(
        'SELECT seq,deposit_amount,paid_amount FROM tickets WHERE booking_id=$1 ORDER BY seq',
        [id],
      )
    ).rows,
  ).toEqual([{ seq: 3, deposit_amount: 3334, paid_amount: 3334 }]);
});

it('refuses a remainder below the configured payment minimum without cancelling seats', async () => {
  const previous = process.env.PAYMENT_MIN_AMOUNT;
  process.env.PAYMENT_MIN_AMOUNT = '15000';
  try {
    const { workshopId } = await publicWorkshop(5),
      slot = await session(workshopId, 3),
      customer = await account(),
      created = await placeBooking(customer, slot, 3),
      id = created.body.booking.id;
    expect(created.status).toBe(201);
    const response = await request(app)
      .post(`/bookings/${id}/seats/cancellation-quote`)
      .set('Cookie', customer.cookie)
      .send({ sequences: [1, 2] });
    expect(response.status).toBe(422);
    expect(response.body.error.message).toContain('thấp hơn mức hỗ trợ');
    expect(await detail(customer, id)).toMatchObject({
      quantity: 3,
      depositAmount: 30000,
      seatRevision: 0,
      holdExpiresAt: created.body.booking.holdExpiresAt,
    });
    expect(
      (await query('SELECT seats_held FROM sessions WHERE id=$1', [slot]))
        .rows[0].seats_held,
    ).toBe(3);
    expect((await cancel(customer, id, [1, 2, 3])).status).toBe(200);
    expect(
      (await query('SELECT seats_held FROM sessions WHERE id=$1', [slot]))
        .rows[0].seats_held,
    ).toBe(0);
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_MIN_AMOUNT;
    else process.env.PAYMENT_MIN_AMOUNT = previous;
  }
});
async function quote(customer: Account, id: string, sequences: number[]) {
  const response = await request(app)
    .post(`/bookings/${id}/seats/cancellation-quote`)
    .set('Cookie', customer.cookie)
    .send({ sequences });
  expect(response.status).toBe(200);
  return response.body.quote;
}
async function cancel(customer: Account, id: string, sequences: number[]) {
  const q = await quote(customer, id, sequences);
  return request(app)
    .post(`/bookings/${id}/seats/cancel`)
    .set('Cookie', customer.cookie)
    .send({ sequences, quoteToken: q.quoteToken });
}
async function detail(customer: Account, id: string) {
  const response = await request(app)
    .get(`/bookings/${id}`)
    .set('Cookie', customer.cookie);
  expect(response.status).toBe(200);
  return response.body.booking;
}
async function confirm(customer: Account, orderCode: number) {
  return request(app)
    .post(`/payments/mock/${orderCode}/confirm`)
    .set('Cookie', customer.cookie);
}

it.each([0, 5])(
  'cancels only selected original seats for %s%% without resetting the hold',
  async (percent) => {
    const { workshopId } = await publicWorkshop(percent),
      slot = await session(workshopId, 3),
      customer = await account(),
      created = await placeBooking(customer, slot, 3),
      id = created.body.booking.id;
    expect(created.status).toBe(201);
    const stranger = await account();
    expect(
      (
        await request(app)
          .get(`/bookings/${id}/seats`)
          .set('Cookie', stranger.cookie)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(`/bookings/${id}/seats/cancellation-quote`)
          .set('Cookie', customer.cookie)
          .send({ sequences: [2, 2] })
      ).status,
    ).toBe(422);
    const q = await quote(customer, id, [2]);
    expect(q).toMatchObject({
      refundDueAmount: 0,
      retainedAmount: 0,
      remainingQuantity: 2,
      sequences: [2],
    });
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        request(app)
          .post(`/bookings/${id}/seats/cancel`)
          .set('Cookie', customer.cookie)
          .send({ sequences: [2], quoteToken: q.quoteToken }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    const current = await detail(customer, id);
    expect(current).toMatchObject({
      quantity: 2,
      originalQuantity: 3,
      totalAmount: 400000,
      originalTotalAmount: 600000,
      holdExpiresAt: created.body.booking.holdExpiresAt,
      remainingQuantity: 2,
      paidAmount: 0,
    });
    expect(
      (
        await query(
          'SELECT seq,state FROM booking_seats WHERE booking_id=$1 ORDER BY seq',
          [id],
        )
      ).rows,
    ).toEqual([
      { seq: 1, state: 'active' },
      { seq: 2, state: 'cancelled' },
      { seq: 3, state: 'active' },
    ]);
    expect(
      (
        await query('SELECT seats_held,seats_sold FROM sessions WHERE id=$1', [
          slot,
        ])
      ).rows[0],
    ).toEqual({ seats_held: percent ? 2 : 0, seats_sold: percent ? 0 : 2 });
    if (percent) {
      const replacement = current.payments.find(
        (p: { isCurrent: boolean; kind: string }) =>
          p.isCurrent && p.kind === 'deposit',
      );
      expect(replacement.amount).toBe(20000);
      expect(replacement.orderCode).not.toBe(created.body.booking.orderCode);
      expect(replacement.checkoutUrl).toContain(String(replacement.orderCode));
      expect(
        current.payments.filter(
          (p: { checkoutUrl: string | null }) => p.checkoutUrl,
        ).length,
      ).toBe(1);
      expect(
        (await confirm(customer, created.body.booking.orderCode)).status,
      ).toBe(200);
      const paid = await detail(customer, id);
      expect(paid).toMatchObject({
        reservationStatus: 'confirmed',
        quantity: 2,
        paidAmount: 20000,
        receivedAmount: 30000,
        refundDueAmount: 10000,
        remainingQuantity: 2,
      });
      expect(
        (
          await query(
            'SELECT seq FROM tickets WHERE booking_id=$1 ORDER BY seq',
            [id],
          )
        ).rows,
      ).toEqual([{ seq: 1 }, { seq: 3 }]);
      expect(
        (await confirm(customer, created.body.booking.orderCode)).status,
      ).toBe(200);
      expect((await detail(customer, id)).receivedAmount).toBe(30000);
    }
  },
);

it('reconciles concurrent old and new QR receipts once and never sells cancelled seats', async () => {
  const { workshopId } = await publicWorkshop(5),
    slot = await session(workshopId, 3),
    customer = await account(),
    created = await placeBooking(customer, slot, 3),
    id = created.body.booking.id;
  expect((await cancel(customer, id, [2])).status).toBe(200);
  const current = await detail(customer, id),
    replacement = current.payments.find(
      (p: { kind: string; isCurrent: boolean }) =>
        p.kind === 'deposit' && p.isCurrent,
    );
  const results = await Promise.all([
    confirm(customer, created.body.booking.orderCode),
    confirm(customer, replacement.orderCode),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  const paid = await detail(customer, id);
  expect(paid).toMatchObject({
    reservationStatus: 'confirmed',
    paidAmount: 20000,
    receivedAmount: 50000,
    refundDueAmount: 30000,
    balanceAmount: 380000,
  });
  expect(
    (
      await query('SELECT seats_held,seats_sold FROM sessions WHERE id=$1', [
        slot,
      ])
    ).rows[0],
  ).toEqual({ seats_held: 0, seats_sold: 2 });
  expect(
    (
      await query('SELECT seq FROM tickets WHERE booking_id=$1 ORDER BY seq', [
        id,
      ])
    ).rows,
  ).toEqual([{ seq: 1 }, { seq: 3 }]);
  const duplicate = mockWebhook(
    created.body.booking.orderCode,
    30000,
    `extra-${randomUUID()}`,
    true,
  );
  expect(
    (
      await request(app)
        .post('/webhooks/mock')
        .set('Content-Type', 'application/json')
        .send(duplicate)
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .post('/webhooks/mock')
        .set('Content-Type', 'application/json')
        .send(duplicate)
    ).status,
  ).toBe(200);
  expect(await detail(customer, id)).toMatchObject({
    paidAmount: 20000,
    receivedAmount: 80000,
    refundDueAmount: 60000,
  });
});

it('keeps original paid allocations, collects remaining studio money, and refunds a later studio cancellation without paying twice', async () => {
  const { owner, studioId, workshopId } = await publicWorkshop(5),
    slot = await session(workshopId, 3),
    customer = await account(),
    admin = await account('admin'),
    created = await placeBooking(customer, slot, 3),
    id = created.body.booking.id;
  expect((await confirm(customer, created.body.booking.orderCode)).status).toBe(
    200,
  );
  const q = await quote(customer, id, [2]);
  expect(q).toMatchObject({ refundDueAmount: 10000, retainedAmount: 0 });
  expect(
    (
      await request(app)
        .post(`/bookings/${id}/seats/cancel`)
        .set('Cookie', customer.cookie)
        .send({ sequences: [1], quoteToken: q.quoteToken })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .post(`/bookings/${id}/seats/cancel`)
        .set('Cookie', customer.cookie)
        .send({ sequences: [2], quoteToken: q.quoteToken })
    ).status,
  ).toBe(200);
  expect(await detail(customer, id)).toMatchObject({
    quantity: 2,
    paidAmount: 20000,
    receivedAmount: 30000,
    refundDueAmount: 10000,
  });
  expect(
    (
      await request(app)
        .post(`/studios/${studioId}/bookings/${id}/confirm-payment`)
        .set('Cookie', owner.cookie)
        .send({ expectedAmount: 380000 })
    ).status,
  ).toBe(200);
  expect(await detail(customer, id)).toMatchObject({
    paidAmount: 400000,
    receivedAmount: 410000,
    refundDueAmount: 10000,
    balanceAmount: 0,
  });
  expect(
    (
      await query(
        'SELECT seq,paid_amount,status FROM tickets WHERE booking_id=$1 ORDER BY seq',
        [id],
      )
    ).rows,
  ).toEqual([
    { seq: 1, paid_amount: 200000, status: 'valid' },
    { seq: 2, paid_amount: 10000, status: 'void' },
    { seq: 3, paid_amount: 200000, status: 'valid' },
  ]);
  expect(
    (
      await request(app)
        .post(`/studios/${studioId}/bookings/${id}/refund`)
        .set('Cookie', owner.cookie)
        .send({ amount: 10000, reference: 'partial-refund-first' })
    ).status,
  ).toBe(409);
  await settleBookingRefund(id, customer, admin, 10000);
  expect(
    (
      await request(app)
        .post(`/studios/${studioId}/sessions/${slot}/cancel`)
        .set('Cookie', owner.cookie)
    ).status,
  ).toBe(200);
  expect(await detail(customer, id)).toMatchObject({
    reservationStatus: 'cancelled',
    receivedAmount: 410000,
    refundDueAmount: 410000,
    refundedAmount: 10000,
  });
  expect(
    (
      await query('SELECT seats_held,seats_sold FROM sessions WHERE id=$1', [
        slot,
      ])
    ).rows[0],
  ).toEqual({ seats_held: 0, seats_sold: 0 });
  expect(
    (
      await request(app)
        .post(`/studios/${studioId}/bookings/${id}/refund`)
        .set('Cookie', owner.cookie)
        .send({ amount: 400000, reference: 'studio-cancel-remaining' })
    ).status,
  ).toBe(409);
  await settleBookingRefund(id, customer, admin, 400000);
  expect(await detail(customer, id)).toMatchObject({
    refundedAmount: 410000,
    refundStatus: 'refunded',
  });
});

it.each([5, 20, 50])(
  'refunds only the selected original %s%% share inside 24 hours and preserves the remaining tickets',
  async (percent) => {
    const { owner, studioId, workshopId } = await publicWorkshop(percent),
      slot = await session(workshopId, 3),
      customer = await account(),
      created = await placeBooking(customer, slot, 3),
      id = created.body.booking.id;
    expect(
      (await confirm(customer, created.body.booking.orderCode)).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/studios/${studioId}/bookings/${id}/confirm-payment`)
          .set('Cookie', owner.cookie)
          .send({ expectedAmount: 600000 - created.body.booking.depositAmount })
      ).status,
    ).toBe(200);
    await query(
      "UPDATE sessions SET starts_at=clock_timestamp()+interval '23 hours',ends_at=clock_timestamp()+interval '25 hours' WHERE id=$1",
      [slot],
    );
    const original = (
      await query(
        'SELECT seq,code FROM tickets WHERE booking_id=$1 ORDER BY seq',
        [id],
      )
    ).rows;
    const q = await quote(customer, id, [2]);
    expect(q).toMatchObject({
      refundDueAmount: 200000 - (200000 * percent) / 100,
      retainedAmount: (200000 * percent) / 100,
    });
    expect(
      (
        await request(app)
          .post(`/bookings/${id}/seats/cancel`)
          .set('Cookie', customer.cookie)
          .send({ sequences: [2], quoteToken: q.quoteToken })
      ).status,
    ).toBe(200);
    expect(await detail(customer, id)).toMatchObject({
      quantity: 2,
      originalQuantity: 3,
      paidAmount: 400000,
      receivedAmount: 600000,
      refundDueAmount: 200000 - (200000 * percent) / 100,
    });
    expect(
      (
        await query(
          "SELECT seq,code FROM tickets WHERE booking_id=$1 AND status='valid' ORDER BY seq",
          [id],
        )
      ).rows,
    ).toEqual([original[0], original[2]]);
  },
);

it('recovers a failed replacement using the same payment code and original deadline', async () => {
  const { workshopId } = await publicWorkshop(5),
    slot = await session(workshopId, 3),
    customer = await account(),
    created = await placeBooking(customer, slot, 3),
    id = created.body.booking.id;
  const spy = vi
    .spyOn(MockProvider.prototype, 'createPayment')
    .mockRejectedValueOnce(new Error('Provider timeout'));
  try {
    const response = await cancel(customer, id, [2]);
    expect(response.status).toBe(200);
    expect(response.body.checkoutState).toBe('unknown');
    const pending = await detail(customer, id),
      attempt = pending.payments.find(
        (p: { isCurrent: boolean; kind: string }) =>
          p.isCurrent && p.kind === 'deposit',
      );
    expect(pending.holdExpiresAt).toBe(created.body.booking.holdExpiresAt);
    expect(attempt.checkoutUrl).toBeNull();
    const retries = await Promise.all(
      Array.from({ length: 3 }, () =>
        request(app)
          .post(`/bookings/${id}/deposit-checkout`)
          .set('Cookie', customer.cookie),
      ),
    );
    expect(retries.every((r) => r.status === 200)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
    const recovered = await detail(customer, id);
    expect(recovered.holdExpiresAt).toBe(created.body.booking.holdExpiresAt);
    expect(
      recovered.payments.find(
        (p: { isCurrent: boolean; kind: string }) =>
          p.isCurrent && p.kind === 'deposit',
      ),
    ).toMatchObject({
      orderCode: attempt.orderCode,
      amount: 20000,
      checkoutUrl: expect.stringContaining(String(attempt.orderCode)),
    });
    expect(
      (
        await query(
          "SELECT count(*)::integer AS n FROM payments WHERE booking_id=$1 AND kind='deposit'",
          [id],
        )
      ).rows[0].n,
    ).toBe(2);
  } finally {
    spy.mockRestore();
  }
});

it('does not overwrite a newer QR when an older replacement finishes late', async () => {
  const { workshopId } = await publicWorkshop(5),
    slot = await session(workshopId, 3),
    customer = await account(),
    created = await placeBooking(customer, slot, 3),
    id = created.body.booking.id;
  const q = await quote(customer, id, [2]),
    original = MockProvider.prototype.createPayment;
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    ready = new Promise<void>((resolve) => {
      started = resolve;
    });
  const spy = vi
    .spyOn(MockProvider.prototype, 'createPayment')
    .mockImplementationOnce(async function (input) {
      started();
      await gate;
      return original.call(this, input);
    });
  const first = request(app)
    .post(`/bookings/${id}/seats/cancel`)
    .set('Cookie', customer.cookie)
    .send({ sequences: [2], quoteToken: q.quoteToken })
    .then((result) => result);
  try {
    await ready;
    const second = await cancel(customer, id, [3]);
    expect(second.status).toBe(200);
    const current = await detail(customer, id),
      newest = current.payments.find(
        (p: { isCurrent: boolean; kind: string }) =>
          p.isCurrent && p.kind === 'deposit',
      );
    expect(newest.amount).toBe(10000);
    release();
    expect((await first).status).toBe(200);
    const final = await detail(customer, id);
    expect(final).toMatchObject({
      quantity: 1,
      remainingQuantity: 1,
      holdExpiresAt: created.body.booking.holdExpiresAt,
    });
    expect(
      final.payments
        .filter((p: { checkoutUrl: string | null }) => p.checkoutUrl)
        .map((p: { orderCode: number }) => p.orderCode),
    ).toEqual([newest.orderCode]);
    expect(
      (
        await query('SELECT seats_held,seats_sold FROM sessions WHERE id=$1', [
          slot,
        ])
      ).rows[0],
    ).toEqual({ seats_held: 1, seats_sold: 0 });
  } finally {
    release();
    await first;
    spy.mockRestore();
  }
});

it.each([true, false])(
  'applies a late old QR only to remaining seats when capacity available=%s',
  async (available) => {
    const { workshopId } = await publicWorkshop(5),
      slot = await session(workshopId, 3),
      customer = await account(),
      created = await placeBooking(customer, slot, 3),
      id = created.body.booking.id;
    expect((await cancel(customer, id, [2])).status).toBe(200);
    await query(
      "UPDATE bookings SET hold_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [id],
    );
    await releaseExpiredBookingHolds([slot]);
    if (!available) {
      const other = await account();
      expect((await placeBooking(other, slot, 3)).status).toBe(201);
    }
    expect(
      (await confirm(customer, created.body.booking.orderCode)).status,
    ).toBe(200);
    const final = await detail(customer, id);
    expect(final).toMatchObject({
      reservationStatus: available ? 'confirmed' : 'cancelled',
      paymentStatus: available ? 'pending' : 'expired',
      receivedAmount: 30000,
      refundDueAmount: available ? 10000 : 30000,
      paidAmount: available ? 20000 : 0,
    });
    expect(
      (
        await query(
          'SELECT seq FROM tickets WHERE booking_id=$1 ORDER BY seq',
          [id],
        )
      ).rows,
    ).toEqual(available ? [{ seq: 1 }, { seq: 3 }] : []);
    expect(
      (
        await query(
          'SELECT state FROM booking_seats WHERE booking_id=$1 AND seq=2',
          [id],
        )
      ).rows[0].state,
    ).toBe('cancelled');
  },
);

it.each(['registration', 'started', 'cancelled', 'all-cancelled'])(
  'refunds old QR money when the remainder cannot confirm: %s',
  async (reason) => {
    const { owner, studioId, workshopId } = await publicWorkshop(5),
      slot = await session(workshopId, 3),
      customer = await account(),
      created = await placeBooking(customer, slot, 3),
      id = created.body.booking.id;
    expect((await cancel(customer, id, [2])).status).toBe(200);
    if (reason === 'registration')
      await query(
        "UPDATE sessions SET registration_deadline=clock_timestamp()-interval '1 minute' WHERE id=$1",
        [slot],
      );
    if (reason === 'started')
      await query(
        "UPDATE sessions SET starts_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
        [slot],
      );
    if (reason === 'cancelled')
      expect(
        (
          await request(app)
            .post(`/studios/${studioId}/sessions/${slot}/cancel`)
            .set('Cookie', owner.cookie)
        ).status,
      ).toBe(200);
    if (reason === 'all-cancelled')
      expect((await cancel(customer, id, [1, 3])).status).toBe(200);
    expect(
      (await confirm(customer, created.body.booking.orderCode)).status,
    ).toBe(200);
    expect(await detail(customer, id)).toMatchObject({
      reservationStatus: 'cancelled',
      paidAmount: 0,
      receivedAmount: 30000,
      refundDueAmount: 30000,
      paymentAllowed: false,
      remainingQuantity: 0,
    });
    expect(
      (
        await query('SELECT seats_held,seats_sold FROM sessions WHERE id=$1', [
          slot,
        ])
      ).rows[0],
    ).toEqual({ seats_held: 0, seats_sold: 0 });
    expect(
      (
        await query(
          'SELECT count(*)::integer AS n FROM tickets WHERE booking_id=$1',
          [id],
        )
      ).rows[0].n,
    ).toBe(0);
  },
);
