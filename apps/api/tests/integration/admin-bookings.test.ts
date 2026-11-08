import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { query, closePool, withTransaction } from '../../src/db/pool.js';
import { loadConfig } from '../../src/config.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
vi.setConfig({ testTimeout: 120000, hookTimeout: 60000 });
const app = createApp();
beforeAll(async () => {
  assertSafeTestDatabase();
  await migrateDatabase(process.env.DATABASE_URL_TEST!);
});
afterAll(async () => closePool());

it('repairs missing refund metadata once without erasing receipts or overwriting a refund decision', async () => {
  const customer = await account('customer');
  const studio = randomUUID(),
    workshop = randomUUID(),
    slot = randomUUID();
  await query(
    "INSERT INTO studios(id,name,province_id,address) VALUES($1,'Refund repair','ho-chi-minh','Test address')",
    [studio],
  );
  await query(
    "INSERT INTO workshops(id,studio_id,title,slug,description,category_id,duration_minutes,base_price) VALUES($1,$2,'Refund repair',$3,'Details','ceramics',90,200000)",
    [workshop, studio, `repair-${workshop}`],
  );
  await query(
    "INSERT INTO sessions(id,workshop_id,starts_at,ends_at,price,capacity) VALUES($1,$2,now()+interval '2 days',now()+interval '2 days 2 hours',200000,10)",
    [slot, workshop],
  );
  const cases = [
    {
      status: 'not_applicable',
      paid: 10000,
      due: 0,
      expectedStatus: 'pending',
      expectedDue: 10000,
    },
    {
      status: 'not_applicable',
      paid: 0,
      due: 0,
      expectedStatus: 'not_applicable',
      expectedDue: 0,
    },
    {
      status: 'pending',
      paid: 200000,
      due: 190000,
      expectedStatus: 'pending',
      expectedDue: 190000,
    },
    {
      status: 'refunded',
      paid: 10000,
      due: 10000,
      expectedStatus: 'refunded',
      expectedDue: 10000,
    },
    {
      status: 'forfeited',
      paid: 10000,
      due: 0,
      expectedStatus: 'forfeited',
      expectedDue: 0,
    },
  ];
  const rows: Array<{
    id: string;
    expectedStatus: string;
    expectedDue: number;
    paid: number;
  }> = [];
  for (const [index, value] of cases.entries()) {
    const id = randomUUID();
    await query(
      "INSERT INTO bookings(id,user_id,session_id,quantity,unit_price,total_amount,status,hold_expires_at,order_code,paid_amount,refund_status,refund_due_amount) VALUES($1,$2,$3,1,200000,200000,'refund_needed',now()+interval '1 hour',$4,$5,$6,$7)",
      [
        id,
        customer.id,
        slot,
        Date.now() * 1000 + index,
        value.paid,
        value.status,
        value.due,
      ],
    );
    rows.push({
      id,
      expectedStatus: value.expectedStatus,
      expectedDue: value.expectedDue,
      paid: value.paid,
    });
  }
  const sql = readFileSync(
    new URL(
      '../../../../db/migrations/037_repair_missing_refund_metadata.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await withTransaction(async (client) => {
    await client.query(sql);
    await client.query(sql);
  });
  for (const row of rows) {
    const stored = (
      await query(
        'SELECT paid_amount,refund_due_amount,refund_status FROM bookings WHERE id=$1',
        [row.id],
      )
    ).rows[0];
    expect(stored).toEqual({
      paid_amount: row.paid,
      refund_due_amount: row.expectedDue,
      refund_status: row.expectedStatus,
    });
  }
  expect(
    (
      await query(
        "SELECT count(*)::integer AS count FROM admin_activity_log WHERE entity_id=$1 AND action='booking.refund_metadata.repaired'",
        [rows[0].id],
      )
    ).rows[0].count,
  ).toBe(1);
});
async function account(role: 'admin' | 'customer') {
  const id = randomUUID(),
    sid = randomUUID();
  const config = loadConfig();
  await query(
    'INSERT INTO users(id,email,password_hash,full_name,role) VALUES($1,$2,$3,$4,$5)',
    [id, `${id}@example.test`, 'unused-test-hash', 'Moderation account', role],
  );
  await query(
    "INSERT INTO auth_sessions(id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 day')",
    [sid, id, createHash('sha256').update(sid).digest('hex')],
  );
  return {
    id,
    cookie: `${config.COOKIE_NAME}=${jwt.sign({ sub: id, sid, role }, config.JWT_SECRET, { expiresIn: '1h' })}`,
  };
}

import { releaseExpiredHolds } from '../../src/modules/bookings/bookings.repository.js';

it('cancels once under concurrency, releases capacity, voids tickets, audits and preserves payment semantics', async () => {
  const admin = await account('admin'),
    other = await account('admin'),
    customer = await account('customer');
  const studio = randomUUID(),
    workshop = randomUUID(),
    slot = randomUUID();
  await query("UPDATE users SET phone='0908887776' WHERE id=$1", [customer.id]);
  await query(
    "INSERT INTO studios(id,name,province_id,address) VALUES($1,'Booking Studio','ho-chi-minh','12 Booking Street')",
    [studio],
  );
  await query(
    "INSERT INTO workshops(id,studio_id,title,slug,description,category_id,duration_minutes,base_price) VALUES($1,$2,'Booking Workshop',$3,'Workshop details','ceramics',90,200000)",
    [workshop, studio, `booking-${workshop}`],
  );
  await query(
    "INSERT INTO sessions(id,workshop_id,starts_at,ends_at,price,capacity,seats_held,seats_sold) VALUES($1,$2,now()+interval '2 days',now()+interval '2 days 90 minutes',200000,10,5,2)",
    [slot, workshop],
  );
  let seq = 0;
  const base = Date.now() * 1000;
  async function booking(payment: string, qty: number) {
    const id = randomUUID();
    await query(
      "INSERT INTO bookings(id,user_id,session_id,quantity,unit_price,total_amount,status,paid_amount,hold_expires_at,order_code) VALUES($1,$2,$3,$4,200000,$4*200000,$5::booking_status,CASE WHEN $5::booking_status='paid' THEN $4*200000 ELSE 0 END,now()+interval '1 hour',$6)",
      [id, customer.id, slot, qty, payment, base + seq++],
    );
    return id;
  }
  const pending = await booking('pending', 3),
    paid = await booking('paid', 2),
    remaining = await booking('pending', 2);
  await query(
    'INSERT INTO tickets(booking_id,seq,code) VALUES($1,1,$2),($1,2,$3)',
    [paid, randomUUID(), randomUUID()],
  );
  const endpoint = (id: string) => `/admin/dat-cho/${id}/status`;
  const reason = 'Customer requested cancellation';
  expect(
    (await request(app).get('/admin/dat-cho').set('Cookie', customer.cookie))
      .status,
  ).toBe(403);
  for (const q of [
    '0908887776',
    'Moderation account',
    `${customer.id}@example.test`,
    String(base),
  ]) {
    const response = await request(app)
      .get('/admin/dat-cho')
      .query({ q, studioId: studio, sort: 'startsAt:asc' })
      .set('Cookie', admin.cookie);
    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(0);
  }
  expect(
    (
      await request(app)
        .get('/admin/dat-cho')
        .query({ dateFrom: '2026-10-20', dateTo: '2026-10-01' })
        .set('Cookie', admin.cookie)
    ).status,
  ).toBe(422);
  const denied = await request(app)
    .patch(endpoint(pending))
    .set('Cookie', customer.cookie)
    .send({ status: 'cancelled', expectedStatus: 'pending', reason });
  expect(denied.status).toBe(403);
  expect(
    (
      await request(app)
        .patch(endpoint(pending))
        .set('Cookie', admin.cookie)
        .send({
          status: 'cancelled',
          expectedStatus: 'pending',
          reason: 'short',
        })
    ).status,
  ).toBe(422);
  const results = await Promise.all(
    [admin, other].map((a) =>
      request(app)
        .patch(endpoint(pending))
        .set('Cookie', a.cookie)
        .send({ status: 'cancelled', expectedStatus: 'pending', reason }),
    ),
  );
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(
    (
      await query('SELECT seats_held,seats_sold FROM sessions WHERE id=$1', [
        slot,
      ])
    ).rows[0],
  ).toEqual({ seats_held: 2, seats_sold: 2 });
  const cancelled = await request(app)
    .patch(endpoint(paid))
    .set('Cookie', admin.cookie)
    .send({ status: 'cancelled', expectedStatus: 'confirmed', reason });
  expect(cancelled.status).toBe(200);
  expect(cancelled.body.booking).toMatchObject({
    status: 'cancelled',
    paymentStatus: 'refund_needed',
    paidAmount: 400000,
    refundStatus: 'pending',
    refundDueAmount: 400000,
  });
  expect(
    (
      await query('SELECT seats_held,seats_sold FROM sessions WHERE id=$1', [
        slot,
      ])
    ).rows[0],
  ).toEqual({ seats_held: 2, seats_sold: 0 });
  expect(
    (
      await query(
        "SELECT count(*)::int AS n FROM tickets WHERE booking_id=$1 AND status='void'",
        [paid],
      )
    ).rows[0].n,
  ).toBe(2);
  expect(cancelled.body.booking.history.at(-1)).toMatchObject({
    fromStatus: 'confirmed',
    toStatus: 'cancelled',
    actorId: admin.id,
    reason,
  });
  const audit = await query(
    "SELECT reason FROM admin_activity_log WHERE entity_id=$1 AND action='booking.cancelled'",
    [pending],
  );
  expect(audit.rows).toHaveLength(1);
  expect(audit.rows[0].reason).toBe(reason);
  const confirm = await request(app)
    .patch(endpoint(remaining))
    .set('Cookie', admin.cookie)
    .send({
      status: 'confirmed',
      expectedStatus: 'pending',
      reason: 'Owner confirms attendance arrangement',
    });
  expect(confirm.status).toBe(200);
  expect(confirm.body.booking.paymentStatus).toBe('pending');
  await query(
    "UPDATE bookings SET hold_expires_at=now()-interval '1 minute' WHERE id=$1",
    [remaining],
  );
  await withTransaction(async (client) => {
    await releaseExpiredHolds(client, [slot]);
  });
  expect(
    (
      await query(
        'SELECT reservation_status,status FROM bookings WHERE id=$1',
        [remaining],
      )
    ).rows[0],
  ).toEqual({ reservation_status: 'confirmed', status: 'pending' });
  expect(
    (
      await request(app)
        .patch(endpoint(remaining))
        .set('Cookie', admin.cookie)
        .send({
          status: 'completed',
          expectedStatus: 'confirmed',
          reason: 'Attendance completed successfully',
        })
    ).status,
  ).toBe(400);
  await query(
    "UPDATE sessions SET starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' WHERE id=$1",
    [slot],
  );
  expect(
    (
      await request(app)
        .patch(endpoint(remaining))
        .set('Cookie', admin.cookie)
        .send({
          status: 'completed',
          expectedStatus: 'confirmed',
          reason: 'Attendance completed successfully',
        })
    ).status,
  ).toBe(200);
  const detail = await request(app)
    .get(`/admin/dat-cho/${remaining}`)
    .set('Cookie', admin.cookie);
  expect(detail.body.booking.status).toBe('completed');
  expect(detail.body.booking.history.at(-1).actorId).toBe(admin.id);
  const cancelCompleted = await request(app)
    .patch(endpoint(remaining))
    .set('Cookie', admin.cookie)
    .send({ status: 'cancelled', expectedStatus: 'completed', reason });
  expect(cancelCompleted.status).toBe(200);
  expect(cancelCompleted.body.booking).toMatchObject({
    status: 'cancelled',
    paymentStatus: 'cancelled',
    paidAmount: 0,
    refundStatus: 'not_applicable',
    refundDueAmount: 0,
  });
  expect(
    (await query('SELECT seats_sold FROM sessions WHERE id=$1', [slot])).rows[0]
      .seats_sold,
  ).toBe(0);
  // A failed counter update rolls back status, tickets and history.
  const mismatch = await booking('pending', 1);
  await query('UPDATE sessions SET seats_held=0 WHERE id=$1', [slot]);
  expect(
    (
      await request(app)
        .patch(endpoint(mismatch))
        .set('Cookie', admin.cookie)
        .send({ status: 'cancelled', expectedStatus: 'pending', reason })
    ).status,
  ).toBe(409);
  expect(
    (
      await query('SELECT reservation_status FROM bookings WHERE id=$1', [
        mismatch,
      ])
    ).rows[0].reservation_status,
  ).toBe('pending');
  expect(
    (
      await query(
        "SELECT count(*)::int AS n FROM admin_activity_log WHERE entity_id=$1 AND action='booking.cancelled'",
        [mismatch],
      )
    ).rows[0].n,
  ).toBe(0);
});
