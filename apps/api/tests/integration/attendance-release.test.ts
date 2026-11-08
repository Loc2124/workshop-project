import request from 'supertest';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  app,
  account,
  publicWorkshop,
  session,
  placeBooking,
  type Account,
} from '../helpers/partial-booking-fixtures.js';
import { closePool, query } from '../../src/db/pool.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import {
  runAttendanceReminders,
  sendQueuedEmails,
} from '../../src/modules/bookings/attendance-job.js';
vi.setConfig({ testTimeout: 120000, hookTimeout: 60000 });
beforeAll(async () => {
  assertSafeTestDatabase();
  await migrateDatabase(process.env.DATABASE_URL_TEST!);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
afterAll(() => closePool());
async function setup(minutes = 60, quantity = 2, percent = 0) {
  const { owner, studioId, workshopId } = await publicWorkshop(percent);
  await query(
    'UPDATE studios SET release_if_unconfirmed=true,release_before_minutes=120 WHERE id=$1',
    [studioId],
  );
  const slot = await session(workshopId, quantity),
    customer = await account(),
    created = await placeBooking(customer, slot, quantity);
  expect(created.status).toBe(201);
  const id = created.body.booking.id;
  // Advance the test clock by moving the slot; keep the schedule version unchanged.
  await query(
    'UPDATE sessions SET starts_at=clock_timestamp()+make_interval(mins=>$2),ends_at=clock_timestamp()+make_interval(mins=>$2+120) WHERE id=$1',
    [slot, minutes],
  );
  return { id, slot, customer, owner, studioId, created };
}
async function detail(customer: Account, id: string) {
  const r = await request(app)
    .get(`/bookings/${id}`)
    .set('Cookie', customer.cookie);
  expect(r.status).toBe(200);
  return r.body.booking;
}
async function sent(id: string, minutesAgo: number) {
  await query(
    "UPDATE email_outbox SET status='sent',sent_at=clock_timestamp()-make_interval(mins=>$2) WHERE booking_id=$1 AND delivery_type='attendance_confirmation'",
    [id, minutesAgo],
  );
}

it('never releases from a queued or in-app request without a successful email', async () => {
  const { id, slot, customer } = await setup();
  vi.stubEnv('EMAIL_DELIVERY_URL', '');
  await runAttendanceReminders([slot]);
  await runAttendanceReminders([slot]);
  await sendQueuedEmails([id]);
  expect(await detail(customer, id)).toMatchObject({
    reservationStatus: 'confirmed',
    attendanceConfirmationDeadline: null,
    remainingQuantity: 2,
  });
  const emails = (
    await query(
      "SELECT status,sent_at,body FROM email_outbox WHERE booking_id=$1 AND delivery_type='attendance_confirmation'",
      [id],
    )
  ).rows;
  expect(emails).toHaveLength(1);
  expect(emails[0]).toMatchObject({ status: 'pending', sent_at: null });
  expect(emails[0].body).toContain('Xác nhận tôi sẽ đến');
  expect(
    (
      await query(
        "SELECT count(*)::integer AS n FROM user_notifications WHERE booking_id=$1 AND type='attendance_confirmation_requested'",
        [id],
      )
    ).rows[0].n,
  ).toBe(1);
});

it('waits two hours from email acceptance, not queue creation, and preserves sent time on retry', async () => {
  const { id, slot, customer } = await setup();
  await runAttendanceReminders([slot]);
  vi.stubEnv('EMAIL_DELIVERY_URL', 'https://mailer.example.test/send');
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', fetcher);
  await sendQueuedEmails([id]);
  expect(
    (
      await query(
        "SELECT status,sent_at FROM email_outbox WHERE booking_id=$1 AND delivery_type='attendance_confirmation'",
        [id],
      )
    ).rows[0],
  ).toMatchObject({ status: 'failed', sent_at: null });
  await runAttendanceReminders([slot]);
  expect((await detail(customer, id)).reservationStatus).toBe('confirmed');
  fetcher.mockImplementation(async () => new Response(null, { status: 202 }));
  await Promise.all([sendQueuedEmails([id]), sendQueuedEmails([id])]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toBe(
    fetcher.mock.calls[1][1].headers['Idempotency-Key'],
  );
  const first = (
    await query(
      "SELECT sent_at FROM email_outbox WHERE booking_id=$1 AND delivery_type='attendance_confirmation'",
      [id],
    )
  ).rows[0].sent_at;
  // Accepted less than two hours before the class: no release deadline at all.
  expect(
    (await detail(customer, id)).attendanceConfirmationDeadline,
  ).toBeNull();
  await sendQueuedEmails([id]);
  expect(
    (
      await query(
        "SELECT sent_at FROM email_outbox WHERE booking_id=$1 AND delivery_type='attendance_confirmation'",
        [id],
      )
    ).rows[0].sent_at,
  ).toEqual(first);
  await sent(id, 119);
  await runAttendanceReminders([slot]);
  expect((await detail(customer, id)).reservationStatus).toBe('confirmed');
  await sent(id, 120);
  await Promise.all([
    runAttendanceReminders([slot]),
    runAttendanceReminders([slot]),
  ]);
  expect(await detail(customer, id)).toMatchObject({
    reservationStatus: 'cancelled',
    remainingQuantity: 0,
    paidAmount: 0,
  });
  expect(
    (await query('SELECT seats_sold FROM sessions WHERE id=$1', [slot])).rows[0]
      .seats_sold,
  ).toBe(0);
  expect(
    (
      await query(
        "SELECT count(*)::integer AS n FROM user_notifications WHERE booking_id=$1 AND type='attendance_hold_released'",
        [id],
      )
    ).rows[0].n,
  ).toBe(1);
  expect(
    (
      await query(
        "SELECT count(*)::integer AS n FROM tickets WHERE booking_id=$1 AND status='valid'",
        [id],
      )
    ).rows[0].n,
  ).toBe(0);
});

it('allows confirmation after the configured cutoff while the email grace period is still open', async () => {
  const { id, slot, customer } = await setup();
  await runAttendanceReminders([slot]);
  await sent(id, 90);
  expect(
    (await detail(customer, id)).attendanceConfirmationDeadline,
  ).not.toBeNull();
  const url = `/bookings/${id}/confirm-attendance`;
  const stranger = await account();
  expect(
    (await request(app).post(url).set('Cookie', stranger.cookie)).status,
  ).toBe(404);
  const replies = await Promise.all([
    request(app).post(url).set('Cookie', customer.cookie),
    request(app).post(url).set('Cookie', customer.cookie),
  ]);
  expect(replies.map((r) => r.status)).toEqual([200, 200]);
  const first = (await detail(customer, id)).attendanceConfirmedAt;
  await sent(id, 180);
  await runAttendanceReminders([slot]);
  expect(await detail(customer, id)).toMatchObject({
    reservationStatus: 'confirmed',
    attendanceConfirmedAt: first,
    attendanceConfirmationDeadline: null,
  });
});

it('rejects confirmation after the real deadline and commits release without waiting for the worker', async () => {
  const { id, slot, customer } = await setup();
  await runAttendanceReminders([slot]);
  await sent(id, 120);
  expect(
    (
      await request(app)
        .post(`/bookings/${id}/confirm-attendance`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(409);
  expect(
    (await query('SELECT reservation_status FROM bookings WHERE id=$1', [id]))
      .rows[0].reservation_status,
  ).toBe('cancelled');
  expect(
    (await query('SELECT seats_sold FROM sessions WHERE id=$1', [slot])).rows[0]
      .seats_sold,
  ).toBe(0);
});

it('keeps the later configured cutoff even when email was accepted over two hours ago', async () => {
  const { id, slot, customer } = await setup(180);
  await runAttendanceReminders([slot]);
  await sent(id, 180);
  const b = await detail(customer, id);
  expect(b.reservationStatus).toBe('confirmed');
  expect(Date.parse(b.attendanceConfirmationDeadline)).toBeGreaterThan(
    Date.parse(b.serverNow),
  );
});

it.each([
  'old-version',
  'old-start',
  'schedule-pending',
  'started',
  'cancelled',
  'paid',
])(
  'does not release a booking with stale or ineligible confirmation proof: %s',
  async (reason) => {
    const { id, slot, customer } = await setup();
    await runAttendanceReminders([slot]);
    await sent(id, 180);
    if (reason === 'old-version')
      await query(
        'UPDATE email_outbox SET schedule_version=schedule_version+1 WHERE booking_id=$1',
        [id],
      );
    if (reason === 'old-start')
      await query(
        "UPDATE email_outbox SET reminder_starts_at=reminder_starts_at+interval '1 hour' WHERE booking_id=$1",
        [id],
      );
    if (reason === 'schedule-pending')
      await query(
        "UPDATE bookings SET reschedule_pending=true,proposed_schedule_version=1,reschedule_deadline=clock_timestamp()+interval '1 hour' WHERE id=$1",
        [id],
      );
    if (reason === 'started')
      await query(
        "UPDATE sessions SET starts_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
        [slot],
      );
    if (reason === 'cancelled')
      await query("UPDATE sessions SET status='cancelled' WHERE id=$1", [slot]);
    if (reason === 'paid')
      await query('UPDATE bookings SET paid_amount=1000 WHERE id=$1', [id]);
    await runAttendanceReminders([slot]);
    expect((await detail(customer, id)).reservationStatus).toBe('confirmed');
  },
);

it('releases only the remaining original seats after a partial cancellation', async () => {
  const { id, slot, customer } = await setup(60, 3);
  const q = await request(app)
    .post(`/bookings/${id}/seats/cancellation-quote`)
    .set('Cookie', customer.cookie)
    .send({ sequences: [2] });
  expect(q.status).toBe(200);
  expect(
    (
      await request(app)
        .post(`/bookings/${id}/seats/cancel`)
        .set('Cookie', customer.cookie)
        .send({ sequences: [2], quoteToken: q.body.quote.quoteToken })
    ).status,
  ).toBe(200);
  await runAttendanceReminders([slot]);
  await sent(id, 180);
  await runAttendanceReminders([slot]);
  expect(await detail(customer, id)).toMatchObject({
    reservationStatus: 'cancelled',
    originalQuantity: 3,
    remainingQuantity: 0,
  });
  expect(
    (await query('SELECT seats_sold FROM sessions WHERE id=$1', [slot])).rows[0]
      .seats_sold,
  ).toBe(0);
  expect(
    (
      await query(
        "SELECT seq FROM tickets WHERE booking_id=$1 AND status='void' ORDER BY seq",
        [id],
      )
    ).rows,
  ).toEqual([{ seq: 1 }, { seq: 2 }, { seq: 3 }]);
});

it('does not request attendance or release a new booking made after the cutoff', async () => {
  const { studioId, workshopId } = await publicWorkshop(0);
  await query(
    'UPDATE studios SET release_if_unconfirmed=true,release_before_minutes=120 WHERE id=$1',
    [studioId],
  );
  const slot = await session(workshopId, 1);
  await query(
    "UPDATE sessions SET starts_at=clock_timestamp()+interval '1 hour' WHERE id=$1",
    [slot],
  );
  const customer = await account(),
    created = await placeBooking(customer, slot),
    id = created.body.booking.id;
  await runAttendanceReminders([slot]);
  expect(await detail(customer, id)).toMatchObject({
    reservationStatus: 'confirmed',
    releaseIfUnconfirmed: false,
    attendanceConfirmationDeadline: null,
  });
  expect(
    (
      await query(
        "SELECT count(*)::integer AS n FROM email_outbox WHERE booking_id=$1 AND delivery_type='attendance_confirmation'",
        [id],
      )
    ).rows[0].n,
  ).toBe(0);
});

it('never applies unpaid attendance release to a verified deposit booking', async () => {
  const { id, slot, customer, created } = await setup(60, 2, 5);
  expect(
    (
      await request(app)
        .post(`/payments/mock/${created.body.booking.orderCode}/confirm`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(200);
  await runAttendanceReminders([slot]);
  expect(await detail(customer, id)).toMatchObject({
    reservationStatus: 'confirmed',
    paidAmount: 20000,
    attendanceConfirmationDeadline: null,
  });
  expect(
    (
      await query(
        "SELECT count(*)::integer AS n FROM email_outbox WHERE booking_id=$1 AND delivery_type='attendance_confirmation'",
        [id],
      )
    ).rows[0].n,
  ).toBe(0);
});

it('requires a fresh accepted confirmation email after a real schedule change and acceptance', async () => {
  const { id, slot, customer, owner, studioId } = await setup(180);
  await runAttendanceReminders([slot]);
  await sent(id, 180);
  const now = (
    await query('SELECT clock_timestamp() AS now')
  ).rows[0].now.getTime();
  const changed = await request(app)
    .patch(`/studios/${studioId}/sessions/${slot}`)
    .set('Cookie', owner.cookie)
    .send({
      startsAt: new Date(now + 13 * 3600000).toISOString(),
      endsAt: new Date(now + 15 * 3600000).toISOString(),
    });
  expect(changed.status).toBe(200);
  expect(changed.body.session.scheduleVersion).toBe(2);
  await runAttendanceReminders([slot]);
  expect(await detail(customer, id)).toMatchObject({
    reservationStatus: 'confirmed',
    reschedulePending: true,
    attendanceConfirmationDeadline: null,
  });
  expect(
    (
      await request(app)
        .post(`/bookings/${id}/accept-schedule`)
        .set('Cookie', customer.cookie)
        .send({ scheduleVersion: 2 })
    ).status,
  ).toBe(200);
  await runAttendanceReminders([slot]);
  expect(
    (await detail(customer, id)).attendanceConfirmationDeadline,
  ).toBeNull();
  expect(
    (
      await query(
        "SELECT schedule_version,status FROM email_outbox WHERE booking_id=$1 AND delivery_type='attendance_confirmation' ORDER BY schedule_version",
        [id],
      )
    ).rows,
  ).toEqual([
    { schedule_version: 1, status: 'sent' },
    { schedule_version: 2, status: 'pending' },
  ]);
  vi.stubEnv('EMAIL_DELIVERY_URL', 'https://mailer.example.test/send');
  const fetcher = vi
    .fn()
    .mockImplementation(async () => new Response(null, { status: 202 }));
  vi.stubGlobal('fetch', fetcher);
  await sendQueuedEmails([id]);
  expect(fetcher).toHaveBeenCalledOnce();
  const b = await detail(customer, id);
  expect(b.reservationStatus).toBe('confirmed');
  expect(
    Date.parse(b.attendanceConfirmationDeadline) - Date.parse(b.serverNow),
  ).toBeGreaterThan(10 * 3600000);
});
