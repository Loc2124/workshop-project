import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, query, withTransaction } from '../../src/db/pool.js';
import { loadConfig } from '../../src/config.js';
import { releaseExpiredHolds } from '../../src/modules/bookings/bookings.repository.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { releaseExpiredBookingHolds } from '../../src/modules/bookings/booking-expiry-job.js';
import { signMockWebhook } from '../../src/modules/payments/providers/mock.provider.js';

vi.setConfig({ testTimeout: 120000, hookTimeout: 60000 });

process.env.PAYMENT_PROVIDER = 'mock';
const app = createApp();

type Account = { id: string; cookie: string };

async function account(
  role: 'customer' | 'admin' = 'customer',
): Promise<Account> {
  const id = randomUUID();
  const sid = randomUUID();
  const config = loadConfig();
  await query(
    `INSERT INTO users (id, email, password_hash, full_name, role)
     VALUES ($1, $2, 'unused-test-hash', $3, $4)`,
    [id, `${id}@example.test`, `Customer ${id.slice(0, 6)}`, role],
  );
  await query(
    `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '1 day')`,
    [sid, id, createHash('sha256').update(sid).digest('hex')],
  );
  return {
    id,
    cookie: `${config.COOKIE_NAME}=${jwt.sign(
      { sub: id, sid, role },
      config.JWT_SECRET,
      { expiresIn: '1h' },
    )}`,
  };
}

async function publicWorkshop(depositPercent: number) {
  const owner = await account();
  const admin = await account('admin');
  const studioId = randomUUID();
  await query(
    `INSERT INTO studios
       (id, name, province_id, address, status, contact_phone, contact_email,
        verified_at, verified_by)
     VALUES ($1, 'Booking Test Studio', 'ho-chi-minh', 'Test address',
       'approved', '0901234567', 'studio@example.test', now(), $2)`,
    [studioId, admin.id],
  );
  await query(
    `INSERT INTO studio_members (studio_id, user_id, role)
     VALUES ($1, $2, 'owner')`,
    [studioId, owner.id],
  );
  const photoIds = [randomUUID(), randomUUID(), randomUUID()];
  for (const [index, photoId] of photoIds.entries()) {
    await query(
      `INSERT INTO images (id, studio_id, uploaded_by, key, state, byte_size)
       VALUES ($1, $2, $3, $4, 'ready', 100)`,
      [photoId, studioId, owner.id, `studio/${studioId}/photo-${index}.webp`],
    );
  }
  await query('UPDATE studios SET photo_ids = $2 WHERE id = $1', [
    studioId,
    photoIds,
  ]);
  const workshopId = randomUUID();
  await query(
    `INSERT INTO workshops
       (id, studio_id, title, slug, description, category_id, duration_minutes,
        base_price, status, is_simulated, visibility_status, publication_status,
        deposit_percent)
     VALUES ($1, $2, 'Workshop test', $3, 'Details', 'other', 90, 200000,
       'approved', false, 'active', 'published', $4)`,
    [workshopId, studioId, `booking-${workshopId}`, depositPercent],
  );
  return { owner, studioId, workshopId };
}

async function session(workshopId: string, capacity: number) {
  const id = randomUUID();
  await query(
    `INSERT INTO sessions
       (id, workshop_id, starts_at, ends_at, price, capacity)
     VALUES ($1, $2, now() + interval '2 days',
       now() + interval '2 days 2 hours', 200000, $3)`,
    [id, workshopId, capacity],
  );
  return id;
}

async function placeBooking(
  customer: Account,
  sessionId: string,
  quantity = 1,
) {
  return request(app).post('/bookings').set('Cookie', customer.cookie).send({
    sessionId,
    quantity,
  });
}

function mockWebhook(
  orderCode: number,
  amount: number,
  reference: string,
  succeeded: boolean,
) {
  const data = {
    orderCode,
    amount,
    reference,
    code: succeeded ? '00' : '01',
    desc: succeeded ? 'success' : 'failed',
  };
  return JSON.stringify({
    code: succeeded ? '00' : '01',
    desc: data.desc,
    success: succeeded,
    data,
    signature: signMockWebhook(data, loadConfig().PAYOS_CHECKSUM_KEY_TEST),
  });
}

beforeAll(async () => {
  assertSafeTestDatabase();
  await migrateDatabase(process.env.DATABASE_URL_TEST!);
});

afterAll(async () => closePool());

it('reserves no more than capacity under concurrent customer requests', async () => {
  const { workshopId } = await publicWorkshop(0);
  const sessionId = await session(workshopId, 5);
  const customers = await Promise.all(
    Array.from({ length: 50 }, () => account()),
  );
  const responses = await Promise.all(
    customers.map((customer) => placeBooking(customer, sessionId)),
  );

  expect(responses.filter((response) => response.status === 201)).toHaveLength(
    5,
  );
  expect(responses.filter((response) => response.status === 409)).toHaveLength(
    45,
  );
  const state = await query(
    'SELECT seats_held, seats_sold FROM sessions WHERE id = $1',
    [sessionId],
  );
  expect(state.rows[0]).toEqual({ seats_held: 0, seats_sold: 5 });
});

it('confirms only the deposit, issues tickets once, and records the studio balance', async () => {
  const { owner, studioId, workshopId } = await publicWorkshop(30);
  const sessionId = await session(workshopId, 3);
  const customer = await account();
  const created = await placeBooking(customer, sessionId, 2);

  expect(created.status).toBe(201);
  expect(created.body.booking).toMatchObject({
    paymentMode: 'payos_deposit',
    totalAmount: 400000,
    depositAmount: 120000,
    balanceAmount: 280000,
  });
  expect(created.body.checkoutUrl).toContain('/payment/mock');
  const storedCheckout = await request(app)
    .get(`/bookings/${created.body.booking.id}`)
    .set('Cookie', customer.cookie);
  expect(
    storedCheckout.body.booking.payments.find(
      (p: { kind: string }) => p.kind === 'deposit',
    ).checkoutUrl,
  ).toBe(created.body.checkoutUrl);
  const orderCode = created.body.booking.orderCode as number;

  const duplicate = await Promise.all(
    [1, 2].map(() =>
      request(app)
        .post(`/payments/mock/${orderCode}/confirm`)
        .set('Cookie', customer.cookie),
    ),
  );
  expect(duplicate.map((response) => response.status)).toEqual([200, 200]);
  const detail = await request(app)
    .get(`/bookings/${created.body.booking.id}`)
    .set('Cookie', customer.cookie);
  expect(detail.body.booking).toMatchObject({
    paymentStatus: 'pending',
    reservationStatus: 'confirmed',
    paidAmount: 120000,
    balanceAmount: 280000,
  });
  const counts = await query(
    `SELECT
       (SELECT count(*)::integer FROM tickets WHERE booking_id = $1) AS tickets,
       (SELECT count(*)::integer FROM webhook_events
        WHERE provider = 'mock' AND order_code = $2) AS events,
       (SELECT seats_held FROM sessions WHERE id = $3) AS held,
       (SELECT seats_sold FROM sessions WHERE id = $3) AS sold`,
    [created.body.booking.id, orderCode, sessionId],
  );
  expect(counts.rows[0]).toEqual({
    tickets: 2,
    events: 1,
    held: 0,
    sold: 2,
  });

  const settled = await request(app)
    .post(
      `/studios/${studioId}/bookings/${created.body.booking.id}/confirm-payment`,
    )
    .set('Cookie', owner.cookie)
    .send({ expectedAmount: 280000 });
  expect(settled.status).toBe(200);
  const afterSettlement = await request(app)
    .get(`/bookings/${created.body.booking.id}`)
    .set('Cookie', customer.cookie);
  expect(afterSettlement.body.booking).toMatchObject({
    paymentStatus: 'paid',
    reservationStatus: 'confirmed',
    paidAmount: 400000,
    balanceAmount: 0,
  });
});

it('allows only studio members to list and collect payments, and releases a cancelled seat once', async () => {
  const { owner, studioId, workshopId } = await publicWorkshop(0);
  const sessionId = await session(workshopId, 1);
  const customer = await account();
  const created = await placeBooking(customer, sessionId);
  expect(created.status).toBe(201);
  const path = `/studios/${studioId}/bookings`;
  expect(
    (await request(app).get(path).set('Cookie', customer.cookie)).status,
  ).toBe(404);
  const list = await request(app).get(path).set('Cookie', owner.cookie);
  expect(list.status).toBe(200);
  expect(list.body.bookings[0].id).toBe(created.body.booking.id);
  expect(
    (
      await request(app)
        .post(`${path}/${created.body.booking.id}/confirm-payment`)
        .set('Cookie', customer.cookie)
        .send({ expectedAmount: 200000 })
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .post(`/bookings/${created.body.booking.id}/cancel`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .post(`/bookings/${created.body.booking.id}/cancel`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(409);
  expect(
    (
      await query('SELECT seats_held, seats_sold FROM sessions WHERE id=$1', [
        sessionId,
      ])
    ).rows[0],
  ).toEqual({ seats_held: 0, seats_sold: 0 });
});

it('does not let an invalid signature consume the real transaction reference', async () => {
  const { workshopId } = await publicWorkshop(30);
  const customer = await account();
  const created = await placeBooking(customer, await session(workshopId, 1));
  expect(created.status).toBe(201);
  const valid = mockWebhook(
    created.body.booking.orderCode,
    60000,
    `same-${created.body.booking.orderCode}`,
    true,
  );
  const forged = JSON.parse(valid);
  forged.signature = 'invalid';
  expect(
    (
      await request(app)
        .post('/webhooks/mock')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(forged))
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post('/webhooks/mock')
        .set('Content-Type', 'application/json')
        .send(valid)
    ).status,
  ).toBe(200);
  const detail = await request(app)
    .get(`/bookings/${created.body.booking.id}`)
    .set('Cookie', customer.cookie);
  expect(detail.body.booking).toMatchObject({
    reservationStatus: 'confirmed',
    paidAmount: 60000,
  });
});

it('releases an expired hold and marks a late deposit refund-needed when capacity is taken', async () => {
  const { workshopId } = await publicWorkshop(30);
  const sessionId = await session(workshopId, 1);
  const first = await account();
  const second = await account();
  const original = await placeBooking(first, sessionId);
  expect(original.status).toBe(201);
  await query(
    `UPDATE bookings SET hold_expires_at = now() - interval '1 minute'
     WHERE id = $1`,
    [original.body.booking.id],
  );
  await withTransaction((client) => releaseExpiredHolds(client, [sessionId]));
  const next = await placeBooking(second, sessionId);
  expect(next.status).toBe(201);

  const latePayment = await request(app)
    .post(`/payments/mock/${original.body.booking.orderCode}/confirm`)
    .set('Cookie', first.cookie);
  expect(latePayment.status).toBe(200);
  const booking = await request(app)
    .get(`/bookings/${original.body.booking.id}`)
    .set('Cookie', first.cookie);
  expect(booking.body.booking).toMatchObject({
    paymentStatus: 'refund_needed',
    reservationStatus: 'cancelled',
    paidAmount: 60000,
  });
  const seats = await query(
    'SELECT seats_held, seats_sold FROM sessions WHERE id = $1',
    [sessionId],
  );
  expect(seats.rows[0]).toEqual({ seats_held: 1, seats_sold: 0 });
});

it('releases a deposit hold when PayOS fails to create the checkout link', async () => {
  const { workshopId } = await publicWorkshop(30);
  const sessionId = await session(workshopId, 2);
  const customer = await account();
  const env = {
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    PAYOS_CLIENT_ID: process.env.PAYOS_CLIENT_ID,
    PAYOS_API_KEY: process.env.PAYOS_API_KEY,
    PAYOS_CHECKSUM_KEY: process.env.PAYOS_CHECKSUM_KEY,
    PAYOS_WEBHOOK_URL: process.env.PAYOS_WEBHOOK_URL,
  };
  const originalFetch = globalThis.fetch;
  process.env.PAYMENT_PROVIDER = 'payos';
  process.env.PAYOS_CLIENT_ID = 'test-client-id';
  process.env.PAYOS_API_KEY = 'test-api-key';
  process.env.PAYOS_CHECKSUM_KEY = 'test-checksum-key';
  process.env.PAYOS_WEBHOOK_URL = 'https://api.example.test/webhooks/payos';
  globalThis.fetch = vi.fn(async () => ({
    ok: false,
    json: async () => ({ code: 'failed', desc: 'unavailable' }),
  })) as typeof fetch;
  try {
    const response = await placeBooking(customer, sessionId);
    expect(response.status).toBe(503);
    const state = await query(
      `SELECT s.seats_held, b.status
       FROM sessions s
       JOIN bookings b ON b.session_id = s.id
       WHERE s.id = $1`,
      [sessionId],
    );
    expect(state.rows[0]).toEqual({
      seats_held: 0,
      status: 'cancelled',
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

it('expires holds from the periodic job exactly once', async () => {
  const { workshopId } = await publicWorkshop(30);
  const sessionId = await session(workshopId, 2);
  const customer = await account();
  const created = await placeBooking(customer, sessionId);
  expect(created.status).toBe(201);
  await query(
    `UPDATE bookings SET hold_expires_at = now() - interval '1 minute'
     WHERE id = $1`,
    [created.body.booking.id],
  );

  await expect(releaseExpiredBookingHolds([sessionId])).resolves.toBe(1);
  await expect(releaseExpiredBookingHolds([sessionId])).resolves.toBe(0);
  const state = await query(
    `SELECT b.status, b.reservation_status, s.seats_held
     FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     WHERE b.id = $1`,
    [created.body.booking.id],
  );
  expect(state.rows[0]).toEqual({
    status: 'expired',
    reservation_status: 'cancelled',
    seats_held: 0,
  });
});

it('rejects invalid signatures and mismatched amounts without confirming payment', async () => {
  const { workshopId } = await publicWorkshop(30);
  const sessionId = await session(workshopId, 2);
  const customer = await account();
  const created = await placeBooking(customer, sessionId);
  expect(created.status).toBe(201);
  const orderCode = created.body.booking.orderCode as number;
  const invalidSignature = JSON.stringify({
    code: '00',
    success: true,
    data: {
      orderCode,
      amount: 60000,
      reference: `invalid-${orderCode}`,
      code: '00',
    },
    signature: 'invalid',
  });
  const rejected = await request(app)
    .post('/webhooks/mock')
    .set('Content-Type', 'application/json')
    .send(invalidSignature);
  expect(rejected.status).toBe(400);

  const mismatch = await request(app)
    .post('/webhooks/mock')
    .set('Content-Type', 'application/json')
    .send(mockWebhook(orderCode, 60100, `mismatch-${orderCode}`, true));
  expect(mismatch.status).toBe(200);
  const state = await query(
    `SELECT b.status, b.paid_amount, s.seats_held,
       (SELECT count(*)::integer FROM tickets t WHERE t.booking_id = b.id) AS tickets,
       (SELECT count(*)::integer FROM webhook_events e
        WHERE e.order_code = b.order_code AND e.outcome = 'amount_mismatch') AS mismatches
     FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     WHERE b.id = $1`,
    [created.body.booking.id],
  );
  expect(state.rows[0]).toEqual({
    status: 'pending',
    paid_amount: 0,
    seats_held: 1,
    tickets: 0,
    mismatches: 1,
  });
});

it('releases held seats and marks a failed deposit payment', async () => {
  const { workshopId } = await publicWorkshop(30);
  const sessionId = await session(workshopId, 2);
  const customer = await account();
  const created = await placeBooking(customer, sessionId);
  expect(created.status).toBe(201);

  const response = await request(app)
    .post('/webhooks/mock')
    .set('Content-Type', 'application/json')
    .send(
      mockWebhook(
        created.body.booking.orderCode,
        60000,
        `failed-${created.body.booking.orderCode}`,
        false,
      ),
    );
  expect(response.status).toBe(200);
  const state = await query(
    `SELECT b.status, b.reservation_status, s.seats_held,
       p.status AS payment_status
     FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     JOIN payments p ON p.booking_id = b.id AND p.kind = 'deposit'
     WHERE b.id = $1`,
    [created.body.booking.id],
  );
  expect(state.rows[0]).toEqual({
    status: 'cancelled',
    reservation_status: 'cancelled',
    seats_held: 0,
    payment_status: 'failed',
  });
});

it('uses the signed-in account contact snapshot and rejects client-supplied contacts', async () => {
  const { workshopId } = await publicWorkshop(0);
  const sessionId = await session(workshopId, 3);
  const customer = await account();
  await query('UPDATE users SET full_name = $2, phone = $3 WHERE id = $1', [
    customer.id,
    'Signed-in customer',
    '0912345678',
  ]);
  const forged = await request(app)
    .post('/bookings')
    .set('Cookie', customer.cookie)
    .send({
      sessionId,
      quantity: 1,
      contactName: 'Forged name',
      contactPhone: '0999999999',
    });
  expect(forged.status).toBe(422);
  const created = await placeBooking(customer, sessionId);
  expect(created.status).toBe(201);
  await query('UPDATE users SET full_name = $2, phone = NULL WHERE id = $1', [
    customer.id,
    'Updated name',
  ]);
  const detail = await request(app)
    .get(`/bookings/${created.body.booking.id}`)
    .set('Cookie', customer.cookie);
  expect(detail.body.booking).toMatchObject({
    contactName: 'Signed-in customer',
    contactPhone: '0912345678',
  });
  const withoutPhone = await placeBooking(customer, sessionId);
  expect(withoutPhone.status).toBe(201);
  const next = await request(app)
    .get(`/bookings/${withoutPhone.body.booking.id}`)
    .set('Cookie', customer.cookie);
  expect(next.body.booking).toMatchObject({
    contactName: 'Updated name',
    contactPhone: '',
  });
});
