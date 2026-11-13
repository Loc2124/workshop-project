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
import { runAttendanceReminders } from '../../src/modules/bookings/attendance-job.js';
import { expirePendingScheduleResponses } from '../../src/modules/bookings/schedule-changes.js';
import { signMockWebhook } from '../../src/modules/payments/providers/mock.provider.js';
import { settleBookingRefund } from '../helpers/partial-booking-fixtures.js';

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
  await query(
    'UPDATE studios SET deposit_mode=$2,deposit_percent=$3 WHERE id=$1',
    [
      studioId,
      depositPercent > 0 ? 'required' : 'none',
      depositPercent > 0 ? depositPercent : null,
    ],
  );
  const workshopId = randomUUID();
  await query(
    `INSERT INTO workshops
       (id, studio_id, title, slug, description, category_id, duration_minutes,
        base_price, status, is_simulated, visibility_status, publication_status,
        deposit_percent)
     VALUES ($1, $2, 'Workshop test', $3, 'Details', 'other', 90, 200000,
       'approved', false, 'active', 'published', NULL)`,
    [workshopId, studioId, `booking-${workshopId}`],
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
  requestId = randomUUID(),
) {
  return request(app).post('/bookings').set('Cookie', customer.cookie).send({
    sessionId,
    quantity,
    requestId,
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

async function attendanceTickets(owner: Account, studioId: string, id: string) {
  const response = await request(app)
    .get(`/studios/${studioId}/bookings/${id}/tickets`)
    .set('Cookie', owner.cookie);
  expect(response.status).toBe(200);
  return response.body.tickets as {
    id: string;
    seq: number;
    version: number;
    attendanceStatus: string;
    refundDueAmount: number;
    refundedAmount: number;
    refundHistoryLocked: boolean;
  }[];
}
it('ticket attendance records only selected tickets, allocates absence refunds, and keeps the booking active', async () => {
  const { owner, studioId, workshopId } = await publicWorkshop(5),
    slot = await session(workshopId, 3),
    customer = await account(),
    created = await placeBooking(customer, slot, 3),
    id = created.body.booking.id;
  expect(created.status).toBe(201);
  expect(
    (
      await request(app)
        .post(`/payments/mock/${created.body.booking.orderCode}/confirm`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .post(`/studios/${studioId}/bookings/${id}/confirm-payment`)
        .set('Cookie', owner.cookie)
        .send({ expectedAmount: 570000 })
    ).status,
  ).toBe(200);
  await query(
    "UPDATE sessions SET starts_at=clock_timestamp()-interval '40 minutes',ends_at=clock_timestamp()+interval '1 hour' WHERE id=$1",
    [slot],
  );
  const tickets = await attendanceTickets(owner, studioId, id),
    path = (tid: string) =>
      `/studios/${studioId}/bookings/${id}/tickets/${tid}/attendance`;
  expect(
    (
      await request(app)
        .post(path(tickets[0].id))
        .set('Cookie', customer.cookie)
        .send({ status: 'attended', expectedVersion: tickets[0].version })
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .post(path(tickets[0].id))
        .set('Cookie', owner.cookie)
        .send({ status: 'attended', expectedVersion: tickets[0].version })
    ).status,
  ).toBe(200);
  let live = await attendanceTickets(owner, studioId, id);
  expect(live.map((t) => t.attendanceStatus)).toEqual([
    'attended',
    'unmarked',
    'unmarked',
  ]);
  expect(
    (
      await query(
        'SELECT reservation_status,attendance_status FROM bookings WHERE id=$1',
        [id],
      )
    ).rows[0],
  ).toEqual({ reservation_status: 'confirmed', attendance_status: 'unmarked' });
  expect(
    (
      await request(app)
        .post(path(live[1].id))
        .set('Cookie', owner.cookie)
        .send({ status: 'absent', expectedVersion: live[1].version })
    ).status,
  ).toBe(200);
  live = await attendanceTickets(owner, studioId, id);
  expect(live[1]).toMatchObject({
    refundDueAmount: 190000,
    refundHistoryLocked: true,
  });
  expect(
    (
      await request(app)
        .post(path(live[1].id))
        .set('Cookie', owner.cookie)
        .send({ status: 'attended', expectedVersion: live[1].version })
    ).status,
  ).toBe(409);
  const repeat = await Promise.all(
    Array.from({ length: 2 }, () =>
      request(app)
        .post(path(live[1].id))
        .set('Cookie', owner.cookie)
        .send({ status: 'absent', expectedVersion: live[1].version }),
    ),
  );
  expect(repeat.map((r) => r.status)).toEqual([200, 200]);
  expect(
    (
      await query(
        'SELECT paid_amount,refund_due_amount,reservation_status,status FROM bookings WHERE id=$1',
        [id],
      )
    ).rows[0],
  ).toEqual({
    paid_amount: 600000,
    refund_due_amount: 190000,
    reservation_status: 'confirmed',
    status: 'paid',
  });
  expect(
    (
      await query(
        "SELECT count(*)::integer AS n FROM user_notifications WHERE booking_id=$1 AND type='absence_refund_needed'",
        [id],
      )
    ).rows[0].n,
  ).toBe(1);
  expect(
    (
      await request(app)
        .post(`/bookings/${id}/cancel`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(409);
  const received = await request(app)
    .get(`/bookings/${id}/tickets`)
    .set('Cookie', customer.cookie);
  expect(
    received.body.tickets.map(
      (t: { attendanceStatus: string }) => t.attendanceStatus,
    ),
  ).toEqual(['attended', 'absent', 'unmarked']);
});

it('ticket attendance requires an administrator after refund history and never erases money already refunded', async () => {
  const { owner, studioId, workshopId } = await publicWorkshop(5),
    slot = await session(workshopId, 2),
    customer = await account(),
    admin = await account('admin'),
    created = await placeBooking(customer, slot, 2),
    id = created.body.booking.id;
  expect(created.status).toBe(201);
  expect(
    (
      await request(app)
        .post(`/payments/mock/${created.body.booking.orderCode}/confirm`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .post(`/studios/${studioId}/bookings/${id}/confirm-payment`)
        .set('Cookie', owner.cookie)
        .send({ expectedAmount: 380000 })
    ).status,
  ).toBe(200);
  await query(
    "UPDATE sessions SET starts_at=clock_timestamp()-interval '40 minutes',ends_at=clock_timestamp()+interval '1 hour' WHERE id=$1",
    [slot],
  );
  let live = await attendanceTickets(owner, studioId, id);
  for (const ticket of live)
    expect(
      (
        await request(app)
          .post(
            `/studios/${studioId}/bookings/${id}/tickets/${ticket.id}/attendance`,
          )
          .set('Cookie', owner.cookie)
          .send({ status: 'absent', expectedVersion: ticket.version })
      ).status,
    ).toBe(200);
  live = await attendanceTickets(owner, studioId, id);
  const adminPath = (tid: string) =>
    `/admin/bookings/${id}/tickets/${tid}/attendance`;
  expect(
    (
      await request(app)
        .post(adminPath(live[0].id))
        .set('Cookie', owner.cookie)
        .send({
          status: 'attended',
          expectedVersion: live[0].version,
          reason: 'Điểm danh nhầm',
          refundAction: 'cancel_pending',
        })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .post(adminPath(live[0].id))
        .set('Cookie', admin.cookie)
        .send({
          status: 'attended',
          expectedVersion: live[0].version,
          reason: 'Điểm danh nhầm',
        })
    ).status,
  ).toBe(422);
  expect(
    (
      await request(app)
        .post(adminPath(live[0].id))
        .set('Cookie', admin.cookie)
        .send({
          status: 'attended',
          expectedVersion: live[0].version,
          reason: 'Điểm danh nhầm, chưa chuyển hoàn',
          refundAction: 'cancel_pending',
        })
    ).status,
  ).toBe(200);
  expect(
    (
      await query(
        'SELECT refund_due_amount,refunded_amount FROM bookings WHERE id=$1',
        [id],
      )
    ).rows[0],
  ).toEqual({ refund_due_amount: 190000, refunded_amount: 0 });
  live = await attendanceTickets(owner, studioId, id);
  expect(live[0]).toMatchObject({
    attendanceStatus: 'attended',
    refundDueAmount: 0,
    refundHistoryLocked: true,
  });
  expect(
    (
      await request(app)
        .post(
          `/studios/${studioId}/bookings/${id}/tickets/${live[0].id}/attendance`,
        )
        .set('Cookie', owner.cookie)
        .send({ status: 'absent', expectedVersion: live[0].version })
    ).status,
  ).toBe(409);
  const refundPath = `/studios/${studioId}/bookings/${id}/refund`;
  expect(
    (
      await request(app)
        .post(refundPath)
        .set('Cookie', owner.cookie)
        .send({ amount: 190000, reference: 'paid-refund-1' })
    ).status,
  ).toBe(409);
  await settleBookingRefund(id, customer, admin, 190000);
  expect(
    (
      await request(app)
        .post(refundPath)
        .set('Cookie', owner.cookie)
        .send({ amount: 190000, reference: 'paid-refund-2' })
    ).status,
  ).toBe(409);
  live = await attendanceTickets(owner, studioId, id);
  expect(live[1].refundedAmount).toBe(190000);
  expect(
    (
      await request(app)
        .post(adminPath(live[1].id))
        .set('Cookie', admin.cookie)
        .send({
          status: 'attended',
          expectedVersion: live[1].version,
          reason: 'Khách đã đến muộn',
          refundAction: 'cancel_pending',
        })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .post(adminPath(live[1].id))
        .set('Cookie', admin.cookie)
        .send({
          status: 'attended',
          expectedVersion: live[1].version,
          reason: 'Khách đã đến muộn, giữ lịch sử hoàn',
          refundAction: 'preserve',
        })
    ).status,
  ).toBe(200);
  expect(
    (
      await query(
        'SELECT reservation_status,status,paid_amount,refund_due_amount,refunded_amount FROM bookings WHERE id=$1',
        [id],
      )
    ).rows[0],
  ).toEqual({
    reservation_status: 'completed',
    status: 'paid',
    paid_amount: 400000,
    refund_due_amount: 190000,
    refunded_amount: 190000,
  });
  expect(
    (
      await query(
        'SELECT count(*)::integer AS n FROM booking_refund_receipts WHERE booking_id=$1',
        [id],
      )
    ).rows[0].n,
  ).toBe(1);
  live = await attendanceTickets(owner, studioId, id);
  expect(
    (
      await request(app)
        .post(adminPath(live[0].id))
        .set('Cookie', admin.cookie)
        .send({
          status: 'absent',
          expectedVersion: live[0].version,
          reason: 'Điều chỉnh vé đầu sau đối soát',
        })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .post(refundPath)
        .set('Cookie', owner.cookie)
        .send({ amount: 380000, reference: 'wrong-cumulative' })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .post(refundPath)
        .set('Cookie', owner.cookie)
        .send({ amount: 190000, reference: 'paid-refund-1' })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .post(refundPath)
        .set('Cookie', owner.cookie)
        .send({ amount: 190000, reference: 'paid-refund-new' })
    ).status,
  ).toBe(409);
  await settleBookingRefund(id, customer, admin, 190000);
  expect(
    (
      await query(
        'SELECT refunded_amount,paid_amount,reservation_status FROM bookings WHERE id=$1',
        [id],
      )
    ).rows[0],
  ).toEqual({
    refunded_amount: 380000,
    paid_amount: 400000,
    reservation_status: 'confirmed',
  });
  expect(
    (
      await query(
        'SELECT count(*)::integer AS n FROM booking_refund_receipts WHERE booking_id=$1',
        [id],
      )
    ).rows[0].n,
  ).toBe(2);
});

it('ticket attendance enforces start and thirty-minute boundaries, preserves unpaid debt, and rejects stale versions', async () => {
  const { owner, studioId, workshopId } = await publicWorkshop(0),
    slot = await session(workshopId, 2),
    customer = await account(),
    created = await placeBooking(customer, slot, 2),
    id = created.body.booking.id;
  let live = await attendanceTickets(owner, studioId, id);
  const path = `/studios/${studioId}/bookings/${id}/tickets/${live[0].id}/attendance`;
  expect(
    (
      await request(app)
        .post(path)
        .set('Cookie', owner.cookie)
        .send({ status: 'attended', expectedVersion: live[0].version })
    ).status,
  ).toBe(409);
  await query(
    "UPDATE sessions SET starts_at=clock_timestamp()-interval '29 minutes',ends_at=clock_timestamp()+interval '1 hour' WHERE id=$1",
    [slot],
  );
  expect(
    (
      await request(app)
        .post(path)
        .set('Cookie', owner.cookie)
        .send({ status: 'absent', expectedVersion: live[0].version })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .post(path)
        .set('Cookie', owner.cookie)
        .send({ status: 'attended', expectedVersion: live[0].version })
    ).status,
  ).toBe(200);
  await query(
    "UPDATE sessions SET starts_at=clock_timestamp()-interval '30 minutes' WHERE id=$1",
    [slot],
  );
  expect(
    (
      await request(app)
        .post(path)
        .set('Cookie', owner.cookie)
        .send({ status: 'absent', expectedVersion: live[0].version })
    ).status,
  ).toBe(409);
  live = await attendanceTickets(owner, studioId, id);
  expect(
    (
      await request(app)
        .post(path)
        .set('Cookie', owner.cookie)
        .send({ status: 'absent', expectedVersion: live[0].version })
    ).status,
  ).toBe(200);
  expect(
    (
      await query(
        'SELECT paid_amount,total_amount,refund_due_amount FROM bookings WHERE id=$1',
        [id],
      )
    ).rows[0],
  ).toEqual({ paid_amount: 0, total_amount: 400000, refund_due_amount: 0 });
  expect(
    (
      await request(app)
        .post(`/studios/${studioId}/bookings/${id}/attendance`)
        .set('Cookie', owner.cookie)
        .send({ status: 'attended' })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .post(`/bookings/${id}/cancel`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .get(`/studios/${studioId}/attendance`)
        .set('Cookie', owner.cookie)
    ).body.stats.absent,
  ).toBe(1);
});

it('ticket attendance preserves the last-seat deposit remainder in an actual receipt and refund', async () => {
  const { owner, studioId, workshopId } = await publicWorkshop(5),
    slot = await session(workshopId, 3),
    customer = await account();
  await query('UPDATE sessions SET price=66667 WHERE id=$1', [slot]);
  const created = await placeBooking(customer, slot, 3),
    id = created.body.booking.id;
  expect(created.status).toBe(201);
  expect(created.body.booking.depositAmount).toBe(10000);
  expect(
    (
      await request(app)
        .post(`/payments/mock/${created.body.booking.orderCode}/confirm`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .post(`/studios/${studioId}/bookings/${id}/confirm-payment`)
        .set('Cookie', owner.cookie)
        .send({ expectedAmount: 190001 })
    ).status,
  ).toBe(200);
  const amounts = (
    await query(
      'SELECT seq,total_amount,deposit_amount,paid_amount FROM tickets WHERE booking_id=$1 ORDER BY seq',
      [id],
    )
  ).rows;
  expect(amounts).toEqual([
    { seq: 1, total_amount: 66667, deposit_amount: 3333, paid_amount: 66667 },
    { seq: 2, total_amount: 66667, deposit_amount: 3333, paid_amount: 66667 },
    { seq: 3, total_amount: 66667, deposit_amount: 3334, paid_amount: 66667 },
  ]);
  await query(
    "UPDATE sessions SET starts_at=clock_timestamp()-interval '40 minutes',ends_at=clock_timestamp()+interval '1 hour' WHERE id=$1",
    [slot],
  );
  const ticket = (await attendanceTickets(owner, studioId, id))[2];
  expect(
    (
      await request(app)
        .post(
          `/studios/${studioId}/bookings/${id}/tickets/${ticket.id}/attendance`,
        )
        .set('Cookie', owner.cookie)
        .send({ status: 'absent', expectedVersion: ticket.version })
    ).status,
  ).toBe(200);
  expect(
    (await query('SELECT refund_due_amount FROM bookings WHERE id=$1', [id]))
      .rows[0].refund_due_amount,
  ).toBe(63333);
});

it('ticket attendance keeps a later studio receipt and creates only the absent ticket refund', async () => {
  const { owner, studioId, workshopId } = await publicWorkshop(5),
    slot = await session(workshopId, 2),
    customer = await account(),
    created = await placeBooking(customer, slot, 2),
    id = created.body.booking.id;
  expect(
    (
      await request(app)
        .post(`/payments/mock/${created.body.booking.orderCode}/confirm`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(200);
  await query(
    "UPDATE sessions SET starts_at=clock_timestamp()-interval '40 minutes',ends_at=clock_timestamp()+interval '1 hour' WHERE id=$1",
    [slot],
  );
  const [ticket] = await attendanceTickets(owner, studioId, id);
  expect(
    (
      await request(app)
        .post(
          `/studios/${studioId}/bookings/${id}/tickets/${ticket.id}/attendance`,
        )
        .set('Cookie', owner.cookie)
        .send({ status: 'absent', expectedVersion: ticket.version })
    ).status,
  ).toBe(200);
  expect(
    (
      await query(
        'SELECT refund_due_amount,paid_amount FROM bookings WHERE id=$1',
        [id],
      )
    ).rows[0],
  ).toEqual({ refund_due_amount: 0, paid_amount: 20000 });
  expect(
    (
      await request(app)
        .post(`/studios/${studioId}/bookings/${id}/confirm-payment`)
        .set('Cookie', owner.cookie)
        .send({ expectedAmount: 380000 })
    ).status,
  ).toBe(200);
  const live = await attendanceTickets(owner, studioId, id);
  expect(live[0]).toMatchObject({
    attendanceStatus: 'absent',
    refundDueAmount: 190000,
    refundHistoryLocked: true,
  });
  expect(live[1]).toMatchObject({
    attendanceStatus: 'unmarked',
    refundDueAmount: 0,
  });
  expect(
    (
      await query(
        'SELECT status,paid_amount,refund_due_amount,refund_status,reservation_status FROM bookings WHERE id=$1',
        [id],
      )
    ).rows[0],
  ).toEqual({
    status: 'paid',
    paid_amount: 400000,
    refund_due_amount: 190000,
    refund_status: 'pending',
    reservation_status: 'confirmed',
  });
});

const future = (hours: number) =>
  new Date(Date.now() + hours * 3600000).toISOString();

it('schedule response cancellation refunds the entire deposit inside 24h before accepting the changed time', async () => {
  const { owner, studioId, workshopId } = await publicWorkshop(5),
    slot = await session(workshopId, 1),
    customer = await account();
  const created = await placeBooking(customer, slot),
    id = created.body.booking.id;
  expect(created.status).toBe(201);
  expect(
    (
      await request(app)
        .post(`/payments/mock/${created.body.booking.orderCode}/confirm`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .patch(`/studios/${studioId}/sessions/${slot}`)
        .set('Cookie', owner.cookie)
        .send({ startsAt: future(13), endsAt: future(15) })
    ).status,
  ).toBe(200);
  const quote = await request(app)
    .get(`/bookings/${id}/cancellation-quote`)
    .set('Cookie', customer.cookie);
  expect(quote.status).toBe(200);
  expect(quote.body.quote).toMatchObject({
    paidAmount: 10000,
    refundDueAmount: 10000,
    retainedAmount: 0,
  });
  expect(
    (
      await request(app)
        .post(`/bookings/${id}/cancel`)
        .set('Cookie', customer.cookie)
        .send({ quoteToken: quote.body.quote.quoteToken })
    ).status,
  ).toBe(200);
  expect(
    (
      await query(
        'SELECT reservation_status,paid_amount,refund_due_amount,refund_status FROM bookings WHERE id=$1',
        [id],
      )
    ).rows[0],
  ).toEqual({
    reservation_status: 'cancelled',
    paid_amount: 10000,
    refund_due_amount: 10000,
    refund_status: 'pending',
  });
});

it('schedule change refuses a new start twelve hours away or sooner without changing bookings', async () => {
  const { owner, studioId, workshopId } = await publicWorkshop(0),
    slot = await session(workshopId, 1),
    customer = await account();
  const created = await placeBooking(customer, slot);
  expect(created.status).toBe(201);
  for (const hours of [11, 12]) {
    const dbNow = (
      await query<{ now: Date }>('SELECT clock_timestamp() AS now')
    ).rows[0]!.now.getTime();
    const rejected = await request(app)
      .patch(`/studios/${studioId}/sessions/${slot}`)
      .set('Cookie', owner.cookie)
      .send({
        startsAt: new Date(dbNow + hours * 3600000).toISOString(),
        endsAt: new Date(dbNow + (hours + 2) * 3600000).toISOString(),
      });
    expect(rejected.status).toBe(422);
    expect(rejected.body.error.message).toContain('trên 12 giờ');
  }
  expect(
    (
      await query(
        'SELECT schedule_version,seats_sold FROM sessions WHERE id=$1',
        [slot],
      )
    ).rows[0],
  ).toEqual({ schedule_version: 1, seats_sold: 1 });
  expect(
    (
      await query('SELECT reschedule_pending FROM bookings WHERE id=$1', [
        created.body.booking.id,
      ])
    ).rows[0].reschedule_pending,
  ).toBe(false);
});

it('schedule version rejects stale acceptance, preserves snapshots, and accepts the current version exactly once', async () => {
  const { owner, studioId, workshopId } = await publicWorkshop(5),
    slot = await session(workshopId, 2),
    customer = await account();
  const created = await placeBooking(customer, slot, 2),
    id = created.body.booking.id;
  expect(created.status).toBe(201);
  expect(
    (
      await request(app)
        .post(`/payments/mock/${created.body.booking.orderCode}/confirm`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(200);
  const original = (
    await query('SELECT booked_starts_at FROM bookings WHERE id=$1', [id])
  ).rows[0].booked_starts_at;
  const first = await request(app)
    .patch(`/studios/${studioId}/sessions/${slot}`)
    .set('Cookie', owner.cookie)
    .send({ startsAt: future(72), endsAt: future(74) });
  expect(first.status).toBe(200);
  expect(first.body.session.scheduleVersion).toBe(2);
  const terms = (
    await query(
      'SELECT reschedule_notified_at,reschedule_deadline FROM bookings WHERE id=$1',
      [id],
    )
  ).rows[0];
  expect(
    terms.reschedule_deadline.getTime() -
      terms.reschedule_notified_at.getTime(),
  ).toBe(48 * 3600000);
  const second = await request(app)
    .patch(`/studios/${studioId}/sessions/${slot}`)
    .set('Cookie', owner.cookie)
    .send({ startsAt: future(13), endsAt: future(15) });
  expect(second.status).toBe(200);
  expect(second.body.session.scheduleVersion).toBe(3);
  const path = `/bookings/${id}/accept-schedule`;
  expect(
    (
      await request(app)
        .post(path)
        .set('Cookie', customer.cookie)
        .send({ scheduleVersion: 2 })
    ).status,
  ).toBe(409);
  expect(
    (await request(app).post(path).set('Cookie', customer.cookie).send({}))
      .status,
  ).toBe(422);
  const stranger = await account();
  expect(
    (
      await request(app)
        .post(path)
        .set('Cookie', stranger.cookie)
        .send({ scheduleVersion: 3 })
    ).status,
  ).toBe(404);
  let before = (
    await query(
      'SELECT booked_starts_at,reschedule_pending,paid_amount,reschedule_deadline FROM bookings WHERE id=$1',
      [id],
    )
  ).rows[0];
  expect(before.booked_starts_at).toEqual(original);
  expect(before.reschedule_pending).toBe(true);
  expect(before.paid_amount).toBe(20000);
  expect(before.reschedule_deadline.toISOString()).toBe(
    new Date(
      Date.parse(second.body.session.startsAt) - 12 * 3600000,
    ).toISOString(),
  );
  const replies = await Promise.all(
    Array.from({ length: 2 }, () =>
      request(app)
        .post(path)
        .set('Cookie', customer.cookie)
        .send({ scheduleVersion: 3 }),
    ),
  );
  expect(replies.map((r) => r.status)).toEqual([200, 200]);
  before = (
    await query(
      'SELECT booked_starts_at,reschedule_pending,schedule_version,paid_amount FROM bookings WHERE id=$1',
      [id],
    )
  ).rows[0];
  expect(before.reschedule_pending).toBe(false);
  expect(before.booked_starts_at.toISOString()).toBe(
    second.body.session.startsAt,
  );
  expect(before.schedule_version).toBe(3);
  expect(before.paid_amount).toBe(20000);
  expect(
    (
      await query(
        'SELECT count(*)::integer AS n FROM booking_schedule_acceptances WHERE booking_id=$1',
        [id],
      )
    ).rows[0].n,
  ).toBe(1);
  expect(
    (
      await query(
        'SELECT count(*)::integer AS n FROM session_schedule_history WHERE session_id=$1',
        [slot],
      )
    ).rows[0].n,
  ).toBe(2);
});

it.each([0, 5])(
  'schedule response expiry cancels once and refunds all received money for a %s%% booking even during acceptance',
  async (percent) => {
    const { owner, studioId, workshopId } = await publicWorkshop(percent),
      slot = await session(workshopId, 1),
      customer = await account();
    const created = await placeBooking(customer, slot),
      id = created.body.booking.id;
    expect(created.status).toBe(201);
    if (percent) {
      expect(
        (
          await request(app)
            .post(`/payments/mock/${created.body.booking.orderCode}/confirm`)
            .set('Cookie', customer.cookie)
        ).status,
      ).toBe(200);
      expect(
        (
          await request(app)
            .post(`/studios/${studioId}/bookings/${id}/confirm-payment`)
            .set('Cookie', owner.cookie)
            .send({ expectedAmount: 190000 })
        ).status,
      ).toBe(200);
    }
    expect(
      (
        await request(app)
          .patch(`/studios/${studioId}/sessions/${slot}`)
          .set('Cookie', owner.cookie)
          .send({ startsAt: future(13), endsAt: future(15) })
      ).status,
    ).toBe(200);
    await query(
      "UPDATE bookings SET reschedule_deadline=clock_timestamp()-interval '1 second' WHERE id=$1",
      [id],
    );
    const [accepted] = await Promise.all([
      request(app)
        .post(`/bookings/${id}/accept-schedule`)
        .set('Cookie', customer.cookie)
        .send({ scheduleVersion: 2 }),
      expirePendingScheduleResponses([slot]),
      expirePendingScheduleResponses([slot]),
    ]);
    expect(accepted.status).toBe(409);
    expect(await expirePendingScheduleResponses([slot])).toBe(0);
    const detail = await request(app)
      .get(`/bookings/${id}`)
      .set('Cookie', customer.cookie);
    expect(detail.body.booking).toMatchObject({
      reservationStatus: 'cancelled',
      reschedulePending: false,
      paidAmount: percent ? 200000 : 0,
      refundDueAmount: percent ? 200000 : 0,
      refundStatus: percent ? 'pending' : 'not_applicable',
    });
    expect(detail.body.booking.cancelledAt).toEqual(expect.any(String));
    expect(
      (
        await query('SELECT seats_sold,seats_held FROM sessions WHERE id=$1', [
          slot,
        ])
      ).rows[0],
    ).toEqual({ seats_sold: 0, seats_held: 0 });
    expect(
      (
        await query(
          "SELECT count(*)::integer AS n FROM tickets WHERE booking_id=$1 AND status='valid'",
          [id],
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (
        await query(
          "SELECT count(*)::integer AS n FROM user_notifications WHERE booking_id=$1 AND type='schedule_response_expired'",
          [id],
        )
      ).rows[0].n,
    ).toBe(1);
    expect((await placeBooking(customer, slot)).status).toBe(201);
  },
);

it('schedule change cancels old holds and refunds later money without accepting the new time', async () => {
  const { owner, studioId, workshopId } = await publicWorkshop(5),
    slot = await session(workshopId, 2),
    customer = await account();
  const live = await placeBooking(customer, slot),
    expired = await placeBooking(customer, slot);
  expect(live.status).toBe(201);
  expect(expired.status).toBe(201);
  await query(
    "UPDATE bookings SET hold_expires_at=now()-interval '1 minute' WHERE id=$1",
    [expired.body.booking.id],
  );
  await releaseExpiredBookingHolds([slot]);
  expect(
    (
      await request(app)
        .patch(`/studios/${studioId}/sessions/${slot}`)
        .set('Cookie', owner.cookie)
        .send({ startsAt: future(30), endsAt: future(32) })
    ).status,
  ).toBe(200);
  const first = await request(app)
    .get(`/bookings/${live.body.booking.id}`)
    .set('Cookie', customer.cookie);
  expect(first.body.booking.reservationStatus).toBe('cancelled');
  expect(first.body.booking.holdExpiresAt).toBe(
    live.body.booking.holdExpiresAt,
  );
  for (const booked of [live, expired]) {
    expect(
      (
        await request(app)
          .post('/webhooks/mock')
          .set('Content-Type', 'application/json')
          .send(
            mockWebhook(
              booked.body.booking.orderCode,
              10000,
              `changed-${booked.body.booking.id}`,
              true,
            ),
          )
      ).status,
    ).toBe(200);
    const detail = await request(app)
      .get(`/bookings/${booked.body.booking.id}`)
      .set('Cookie', customer.cookie);
    expect(detail.body.booking).toMatchObject({
      reservationStatus: 'cancelled',
      paymentStatus: 'refund_needed',
      paidAmount: 10000,
      refundDueAmount: 10000,
    });
  }
  expect(
    (
      await query('SELECT seats_sold,seats_held FROM sessions WHERE id=$1', [
        slot,
      ])
    ).rows[0],
  ).toEqual({ seats_sold: 0, seats_held: 0 });
  const next = await placeBooking(customer, slot);
  expect(next.status).toBe(201);
  expect(
    (
      await query('SELECT schedule_version FROM bookings WHERE id=$1', [
        next.body.booking.id,
      ])
    ).rows[0].schedule_version,
  ).toBe(2);
});

it('schedule response pauses attendance reminders and release, replaces old notices, and allows full cancellation inside 24h', async () => {
  const { owner, studioId, workshopId } = await publicWorkshop(0);
  await query(
    'UPDATE studios SET release_if_unconfirmed=true,release_before_minutes=1440 WHERE id=$1',
    [studioId],
  );
  const slot = await session(workshopId, 1),
    customer = await account(),
    created = await placeBooking(customer, slot),
    id = created.body.booking.id;
  expect(created.status).toBe(201);
  for (const hours of [30, 13])
    expect(
      (
        await request(app)
          .patch(`/studios/${studioId}/sessions/${slot}`)
          .set('Cookie', owner.cookie)
          .send({ startsAt: future(hours), endsAt: future(hours + 2) })
      ).status,
    ).toBe(200);
  await runAttendanceReminders([slot]);
  expect(
    (await query('SELECT reservation_status FROM bookings WHERE id=$1', [id]))
      .rows[0].reservation_status,
  ).toBe('confirmed');
  expect(
    (
      await query(
        'SELECT count(*)::integer AS n FROM booking_reminders WHERE booking_id=$1',
        [id],
      )
    ).rows[0].n,
  ).toBe(0);
  expect(
    (
      await request(app)
        .post(`/bookings/${id}/confirm-attendance`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .post(`/studios/${studioId}/bookings/${id}/confirm-payment`)
        .set('Cookie', owner.cookie)
        .send({ expectedAmount: 200000 })
    ).status,
  ).toBe(409);
  const emails = await query(
    'SELECT schedule_version,status FROM email_outbox WHERE booking_id=$1 ORDER BY schedule_version',
    [id],
  );
  expect(emails.rows).toEqual([
    { schedule_version: 2, status: 'cancelled' },
    { schedule_version: 3, status: 'pending' },
  ]);
  const quote = (
    await request(app)
      .get(`/bookings/${id}/cancellation-quote`)
      .set('Cookie', customer.cookie)
  ).body.quote;
  expect(
    (
      await request(app)
        .post(`/bookings/${id}/cancel`)
        .set('Cookie', customer.cookie)
        .send({ quoteToken: quote.quoteToken })
    ).status,
  ).toBe(200);
  expect(
    (
      await query(
        'SELECT reschedule_pending,reservation_status FROM bookings WHERE id=$1',
        [id],
      )
    ).rows[0],
  ).toEqual({ reschedule_pending: false, reservation_status: 'cancelled' });
});

it.each([0, 5, 20, 50])(
  'refunds only the amount beyond the original %s%% deposit for a fully paid cancellation inside 24h',
  async (percent) => {
    const { owner, studioId, workshopId } = await publicWorkshop(percent);
    const sessionId = await session(workshopId, 1);
    await query(
      `UPDATE sessions SET starts_at=now()+interval '5 hours', ends_at=now()+interval '7 hours' WHERE id=$1`,
      [sessionId],
    );
    const customer = await account();
    const created = await placeBooking(customer, sessionId);
    expect(created.status).toBe(201);
    if (percent > 0) {
      const received = await request(app)
        .post(`/payments/mock/${created.body.booking.orderCode}/confirm`)
        .set('Cookie', customer.cookie);
      expect(received.status).toBe(200);
    }
    const deposit = (200000 * percent) / 100;
    const settled = await request(app)
      .post(
        `/studios/${studioId}/bookings/${created.body.booking.id}/confirm-payment`,
      )
      .set('Cookie', owner.cookie)
      .send({ expectedAmount: 200000 - deposit });
    expect(settled.status).toBe(200);
    // Changing studio policy must not change the cancellation deposit snapshot.
    await query(
      `UPDATE studios SET deposit_mode='none',deposit_percent=NULL WHERE id=$1`,
      [studioId],
    );
    const path = `/bookings/${created.body.booking.id}/cancel`;
    const quote = (
      await request(app)
        .get(`/bookings/${created.body.booking.id}/cancellation-quote`)
        .set('Cookie', customer.cookie)
    ).body.quote;
    expect(
      (
        await request(app)
          .post(path)
          .set('Cookie', customer.cookie)
          .send({ quoteToken: quote.quoteToken })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(path)
          .set('Cookie', customer.cookie)
          .send({ quoteToken: quote.quoteToken })
      ).status,
    ).toBe(409);
    const detail = await request(app)
      .get(`/bookings/${created.body.booking.id}`)
      .set('Cookie', customer.cookie);
    expect(detail.body.booking).toMatchObject({
      reservationStatus: 'cancelled',
      paymentStatus: 'refund_needed',
      paidAmount: 200000,
      depositAmount: deposit,
      refundDueAmount: 200000 - deposit,
      refundStatus: 'pending',
    });
    expect(
      (
        await query('SELECT seats_held,seats_sold FROM sessions WHERE id=$1', [
          sessionId,
        ])
      ).rows[0],
    ).toEqual({ seats_held: 0, seats_sold: 0 });
    expect(
      (
        await query(
          "SELECT count(*)::integer AS count FROM tickets WHERE booking_id=$1 AND status='valid'",
          [created.body.booking.id],
        )
      ).rows[0].count,
    ).toBe(0);
  },
);

it.each([119, 121])(
  'snapshots the attendance-confirmation exemption when a studio-payment booking is made %s minutes before class',
  async (minutes) => {
    const { studioId, workshopId } = await publicWorkshop(0);
    await query(
      'UPDATE studios SET release_if_unconfirmed=true,release_before_minutes=120 WHERE id=$1',
      [studioId],
    );
    const sessionId = await session(workshopId, 1);
    await query(
      `UPDATE sessions SET starts_at=now()+make_interval(mins=>$2),ends_at=now()+make_interval(mins=>$2+120) WHERE id=$1`,
      [sessionId, minutes],
    );
    const customer = await account();
    const created = await placeBooking(customer, sessionId);
    expect(created.status).toBe(201);
    const detail = await request(app)
      .get(`/bookings/${created.body.booking.id}`)
      .set('Cookie', customer.cookie);
    expect(detail.body.booking).toMatchObject({
      reservationStatus: 'confirmed',
      releaseIfUnconfirmed: minutes > 120,
    });
    await runAttendanceReminders([sessionId]);
    await runAttendanceReminders([sessionId]);
    expect(
      (
        await query('SELECT reservation_status FROM bookings WHERE id=$1', [
          created.body.booking.id,
        ])
      ).rows[0].reservation_status,
    ).toBe('confirmed');
    expect(
      (await query('SELECT seats_sold FROM sessions WHERE id=$1', [sessionId]))
        .rows[0].seats_sold,
    ).toBe(1);
  },
);

it('replays the same booking intent under concurrent retries and rejects changed payloads', async () => {
  const { workshopId } = await publicWorkshop(5),
    sessionId = await session(workshopId, 2),
    customer = await account(),
    requestId = randomUUID();
  const replies = await Promise.all(
    Array.from({ length: 4 }, () =>
      placeBooking(customer, sessionId, 1, requestId),
    ),
  );
  expect(replies.map((r) => r.status)).toEqual([201, 201, 201, 201]);
  expect(new Set(replies.map((r) => r.body.booking.id)).size).toBe(1);
  expect(new Set(replies.map((r) => r.body.booking.holdExpiresAt)).size).toBe(
    1,
  );
  const conflict = await placeBooking(customer, sessionId, 2, requestId);
  expect(conflict.status).toBe(409);
  expect(conflict.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  expect(
    (
      await query('SELECT seats_held,seats_sold FROM sessions WHERE id=$1', [
        sessionId,
      ])
    ).rows[0],
  ).toEqual({ seats_held: 1, seats_sold: 0 });
  expect(
    (
      await query(
        "SELECT count(*)::integer AS count FROM payments WHERE booking_id=$1 AND kind='deposit'",
        [replies[0].body.booking.id],
      )
    ).rows[0].count,
  ).toBe(1);
});

it('keeps request identities account-scoped and permits an intentional new booking', async () => {
  const { workshopId } = await publicWorkshop(0),
    sessionId = await session(workshopId, 3),
    a = await account(),
    b = await account(),
    requestId = randomUUID();
  const first = await placeBooking(a, sessionId, 1, requestId),
    other = await placeBooking(b, sessionId, 1, requestId),
    next = await placeBooking(a, sessionId);
  expect([first.status, other.status, next.status]).toEqual([201, 201, 201]);
  expect(
    new Set([
      first.body.booking.id,
      other.body.booking.id,
      next.body.booking.id,
    ]).size,
  ).toBe(3);
});

it('never recreates checkout or reserves another seat when replaying a cancelled request', async () => {
  const { workshopId } = await publicWorkshop(5),
    sessionId = await session(workshopId, 1),
    customer = await account(),
    requestId = randomUUID();
  const first = await placeBooking(customer, sessionId, 1, requestId);
  expect(first.status).toBe(201);
  expect(
    (
      await request(app)
        .post(`/bookings/${first.body.booking.id}/cancel`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(200);
  const replay = await placeBooking(customer, sessionId, 1, requestId);
  expect(replay.status).toBe(201);
  expect(replay.body.booking.id).toBe(first.body.booking.id);
  expect(replay.body.checkoutUrl).toBeNull();
  expect(
    (
      await query('SELECT seats_held,seats_sold FROM sessions WHERE id=$1', [
        sessionId,
      ])
    ).rows[0],
  ).toEqual({ seats_held: 0, seats_sold: 0 });
});

it('does not cancel after payment changes the displayed terms until the customer confirms a fresh quote', async () => {
  const { workshopId } = await publicWorkshop(5),
    sessionId = await session(workshopId, 1),
    customer = await account(),
    other = await account();
  const first = await placeBooking(customer, sessionId),
    id = first.body.booking.id;
  const quote = (
    await request(app)
      .get(`/bookings/${id}/cancellation-quote`)
      .set('Cookie', customer.cookie)
  ).body.quote;
  expect(quote.paidAmount).toBe(0);
  expect(
    (
      await request(app)
        .get(`/bookings/${id}/cancellation-quote`)
        .set('Cookie', other.cookie)
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .post(`/payments/mock/${first.body.booking.orderCode}/confirm`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(200);
  const stale = await request(app)
    .post(`/bookings/${id}/cancel`)
    .set('Cookie', customer.cookie)
    .send({ quoteToken: quote.quoteToken });
  expect(stale.status).toBe(409);
  expect(stale.body.error.code).toBe('CANCELLATION_QUOTE_CHANGED');
  const preserved = (
    await request(app).get(`/bookings/${id}`).set('Cookie', customer.cookie)
  ).body.booking;
  expect(preserved).toMatchObject({
    reservationStatus: 'confirmed',
    paidAmount: 10000,
    refundStatus: 'not_applicable',
  });
  expect(
    (
      await request(app)
        .post(`/bookings/${id}/cancel`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(409);
  const fresh = (
    await request(app)
      .get(`/bookings/${id}/cancellation-quote`)
      .set('Cookie', customer.cookie)
  ).body.quote;
  expect(fresh.refundDueAmount).toBe(10000);
  expect(
    (
      await request(app)
        .post(`/bookings/${id}/cancel`)
        .set('Cookie', customer.cookie)
        .send({ quoteToken: fresh.quoteToken })
    ).status,
  ).toBe(200);
});

it('refreshes the refund terms after a schedule/time change and rejects forged quotes without releasing seats', async () => {
  const { workshopId } = await publicWorkshop(5),
    sessionId = await session(workshopId, 1),
    customer = await account();
  const first = await placeBooking(customer, sessionId),
    id = first.body.booking.id;
  await request(app)
    .post(`/payments/mock/${first.body.booking.orderCode}/confirm`)
    .set('Cookie', customer.cookie);
  const old = (
    await request(app)
      .get(`/bookings/${id}/cancellation-quote`)
      .set('Cookie', customer.cookie)
  ).body.quote;
  await query(
    "UPDATE sessions SET starts_at=now()+interval '23 hours',ends_at=now()+interval '25 hours' WHERE id=$1",
    [sessionId],
  );
  for (const quoteToken of [old.quoteToken, 'forged-token']) {
    const reply = await request(app)
      .post(`/bookings/${id}/cancel`)
      .set('Cookie', customer.cookie)
      .send({ quoteToken });
    expect(reply.status).toBe(409);
    expect(reply.body.error.code).toBe('CANCELLATION_QUOTE_CHANGED');
  }
  expect(
    (await query('SELECT seats_sold FROM sessions WHERE id=$1', [sessionId]))
      .rows[0].seats_sold,
  ).toBe(1);
  const fresh = (
    await request(app)
      .get(`/bookings/${id}/cancellation-quote`)
      .set('Cookie', customer.cookie)
  ).body.quote;
  expect(fresh).toMatchObject({ refundDueAmount: 0, retainedAmount: 10000 });
  expect(
    (
      await request(app)
        .post(`/bookings/${id}/cancel`)
        .set('Cookie', customer.cookie)
        .send({ quoteToken: fresh.quoteToken })
    ).status,
  ).toBe(200);
});

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

it.each([0, 5])(
  'records the remaining studio payment after attendance for a %s%% deposit, without reopening the booking or collecting twice',
  async (percent) => {
    const { owner, studioId, workshopId } = await publicWorkshop(percent);
    const sessionId = await session(workshopId, 1);
    const customer = await account();
    const created = await placeBooking(customer, sessionId);
    expect(created.status).toBe(201);
    if (percent > 0) {
      expect(
        (
          await request(app)
            .post(`/payments/mock/${created.body.booking.orderCode}/confirm`)
            .set('Cookie', customer.cookie)
        ).status,
      ).toBe(200);
    }
    await query(
      "UPDATE sessions SET starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' WHERE id=$1",
      [sessionId],
    );
    expect(
      (
        await request(app)
          .post(
            `/studios/${studioId}/bookings/${created.body.booking.id}/attendance`,
          )
          .set('Cookie', owner.cookie)
          .send({ status: 'attended' })
      ).status,
    ).toBe(200);
    const due = 200000 - created.body.booking.depositAmount;
    const path = `/studios/${studioId}/bookings/${created.body.booking.id}/confirm-payment`;
    expect(
      (
        await request(app)
          .post(path)
          .set('Cookie', owner.cookie)
          .send({ expectedAmount: due - 1 })
      ).status,
    ).toBe(409);
    const receipts = await Promise.all(
      [1, 2].map(() =>
        request(app)
          .post(path)
          .set('Cookie', owner.cookie)
          .send({ expectedAmount: due }),
      ),
    );
    expect(receipts.map((r) => r.status).sort()).toEqual([200, 409]);
    const detail = await request(app)
      .get(`/bookings/${created.body.booking.id}`)
      .set('Cookie', customer.cookie);
    expect(detail.body.booking).toMatchObject({
      reservationStatus: 'completed',
      attendanceStatus: 'attended',
      paidAmount: 200000,
      balanceAmount: 0,
      paymentStatus: 'paid',
    });
    expect(
      (
        await query(
          "SELECT count(*)::integer AS count FROM admin_activity_log WHERE entity_id=$1 AND action='booking.in_studio_payment.recorded' AND actor_id=$2",
          [created.body.booking.id, owner.id],
        )
      ).rows[0].count,
    ).toBe(1);
    expect(
      (
        await query('SELECT seats_held,seats_sold FROM sessions WHERE id=$1', [
          sessionId,
        ])
      ).rows[0],
    ).toEqual({ seats_held: 0, seats_sold: 1 });
  },
);

it('requires an approved transfer to record a refund without changing received money', async () => {
  const { owner, studioId, workshopId } = await publicWorkshop(5);
  const customer = await account();
  const admin = await account('admin');
  const created = await placeBooking(customer, await session(workshopId, 1));
  expect(created.status).toBe(201);
  expect(
    (
      await request(app)
        .post(`/payments/mock/${created.body.booking.orderCode}/confirm`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .post(`/bookings/${created.body.booking.id}/cancel`)
        .set('Cookie', customer.cookie)
        .send({
          quoteToken: (
            await request(app)
              .get(`/bookings/${created.body.booking.id}/cancellation-quote`)
              .set('Cookie', customer.cookie)
          ).body.quote.quoteToken,
        })
    ).status,
  ).toBe(200);
  const path = `/studios/${studioId}/bookings/${created.body.booking.id}/refund`;
  expect(
    (
      await request(app)
        .post(path)
        .set('Cookie', customer.cookie)
        .send({ amount: 10000, reference: 'refund-test' })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .post(path)
        .set('Cookie', owner.cookie)
        .send({ amount: 9999, reference: 'refund-test' })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .post(path)
        .set('Cookie', owner.cookie)
        .send({ amount: 10000, reference: 'refund-test' })
    ).status,
  ).toBe(409);
  await settleBookingRefund(created.body.booking.id, customer, admin, 10000);
  expect(
    (
      await request(app)
        .post(path)
        .set('Cookie', owner.cookie)
        .send({ amount: 10000, reference: 'refund-test' })
    ).status,
  ).toBe(409);
  const detail = await request(app)
    .get(`/bookings/${created.body.booking.id}`)
    .set('Cookie', customer.cookie);
  expect(detail.body.booking).toMatchObject({
    reservationStatus: 'cancelled',
    paidAmount: 10000,
    refundDueAmount: 10000,
    refundStatus: 'refunded',
  });
  expect(
    (
      await query(
        "SELECT count(*)::integer AS count FROM financial_transfers t JOIN financial_obligations o ON o.id=t.obligation_id WHERE o.booking_id=$1 AND t.direction='outbound' AND t.status='succeeded'",
        [created.body.booking.id],
      )
    ).rows[0].count,
  ).toBe(1);
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

it('does not let a member of another studio access or collect a booking', async () => {
  const studioA = await publicWorkshop(0);
  const studioB = await publicWorkshop(0);
  const customer = await account();
  const sessionId = await session(studioA.workshopId, 1);
  const created = await placeBooking(customer, sessionId);
  expect(created.status).toBe(201);

  expect(
    (
      await request(app)
        .get(`/studios/${studioA.studioId}/bookings`)
        .set('Cookie', studioB.owner.cookie)
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .post(
          `/studios/${studioB.studioId}/bookings/${created.body.booking.id}/confirm-payment`,
        )
        .set('Cookie', studioB.owner.cookie)
        .send({ expectedAmount: 200000 })
    ).status,
  ).toBe(404);

  const state = await query(
    `SELECT b.status, b.paid_amount, s.seats_sold
     FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     WHERE b.id = $1`,
    [created.body.booking.id],
  );
  expect(state.rows[0]).toEqual({
    status: 'pending',
    paid_amount: 0,
    seats_sold: 1,
  });
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

it('releases an expired hold before reserving a new booking', async () => {
  const { workshopId } = await publicWorkshop(30);
  const sessionId = await session(workshopId, 1);
  const firstCustomer = await account();
  const nextCustomer = await account();
  const original = await placeBooking(firstCustomer, sessionId);
  expect(original.status).toBe(201);
  await query(
    `UPDATE bookings SET hold_expires_at = now() - interval '1 minute'
     WHERE id = $1`,
    [original.body.booking.id],
  );

  const next = await placeBooking(nextCustomer, sessionId);
  expect(next.status).toBe(201);

  const state = await query(
    `SELECT
       (SELECT status FROM bookings WHERE id = $1) AS previous_status,
       (SELECT status FROM bookings WHERE id = $2) AS next_status,
       seats_held, seats_sold
     FROM sessions
     WHERE id = $3`,
    [original.body.booking.id, next.body.booking.id, sessionId],
  );
  expect(state.rows[0]).toEqual({
    previous_status: 'expired',
    next_status: 'pending',
    seats_held: 1,
    seats_sold: 0,
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

it('reacquires an available seat for a late deposit and issues tickets once', async () => {
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
  await withTransaction((client) => releaseExpiredHolds(client, [sessionId]));

  const latePayment = await request(app)
    .post(`/payments/mock/${created.body.booking.orderCode}/confirm`)
    .set('Cookie', customer.cookie);
  expect(latePayment.status).toBe(200);
  const state = await query(
    `SELECT b.status, b.reservation_status, b.paid_amount,
       s.seats_held, s.seats_sold,
       (SELECT count(*)::integer FROM tickets t WHERE t.booking_id = b.id) AS tickets
     FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     WHERE b.id = $1`,
    [created.body.booking.id],
  );
  expect(state.rows[0]).toEqual({
    status: 'pending',
    reservation_status: 'confirmed',
    paid_amount: 60000,
    seats_held: 0,
    seats_sold: 1,
    tickets: 1,
  });
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
  })) as unknown as typeof fetch;
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
      requestId: randomUUID(),
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
