import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import {
  account,
  app,
  placeBooking,
  publicWorkshop,
  session,
} from '../helpers/partial-booking-fixtures.js';
import { closePool, query } from '../../src/db/pool.js';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';

vi.setConfig({ testTimeout: 120000, hookTimeout: 60000 });
beforeAll(async () => {
  assertSafeTestDatabase();
  await migrateDatabase(process.env.DATABASE_URL_TEST!);
});
afterAll(async () => closePool());

it('looks up only local tickets and checks in one seat without changing payment', async () => {
  const { studioId, workshopId } = await publicWorkshop(0);
  const staff = await account();
  const customer = await account();
  const other = await publicWorkshop(0);
  const slot = await session(workshopId, 2);
  await query(
    "INSERT INTO studio_members(studio_id,user_id,role) VALUES($1,$2,'staff')",
    [studioId, staff.id],
  );
  await query(
    "INSERT INTO studio_members(studio_id,user_id,role) VALUES($1,$2,'staff')",
    [other.studioId, staff.id],
  );
  const created = await placeBooking(customer, slot, 2);
  expect(created.status).toBe(201);
  const bookingId = created.body.booking.id as string;
  const tickets = (
    await query<{ code: string; id: string }>(
      'SELECT id,code FROM tickets WHERE booking_id=$1 ORDER BY seq',
      [bookingId],
    )
  ).rows;
  expect(tickets).toHaveLength(2);
  const code = `OS-TICKET:${tickets[0]!.code}`;
  const lookup = (targetStudio: string, value = code) =>
    request(app)
      .post(`/studios/${targetStudio}/check-in/lookup`)
      .set('Cookie', staff.cookie)
      .send({ code: value });
  const confirm = (expectedVersion: number, value = code) =>
    request(app)
      .post(`/studios/${studioId}/check-in/confirm`)
      .set('Cookie', staff.cookie)
      .send({ code: value, expectedVersion });

  const foreign = await lookup(other.studioId);
  expect(foreign.status).toBe(404);
  expect(JSON.stringify(foreign.body)).not.toContain(customer.id);
  const notStaff = await request(app)
    .post(`/studios/${studioId}/check-in/lookup`)
    .set('Cookie', customer.cookie)
    .send({ code });
  expect(notStaff.status).toBe(404);
  expect(JSON.stringify(notStaff.body)).not.toContain(customer.id);
  expect(
    (await lookup(studioId, randomBytes(18).toString('base64url'))).status,
  ).toBe(404);
  expect((await lookup(studioId, '000201010212PAYMENT-QR')).status).toBe(422);

  const beforeStart = await lookup(studioId);
  expect(beforeStart.status).toBe(200);
  expect(beforeStart.body.ticket).toMatchObject({
    quantity: 2,
    checkedInCount: 0,
    remainingAmount: 400000,
    canCheckIn: false,
  });
  expect((await confirm(beforeStart.body.ticket.version)).status).toBe(409);

  await query(
    "UPDATE sessions SET starts_at=clock_timestamp()-interval '5 minutes',ends_at=clock_timestamp()+interval '1 hour' WHERE id=$1",
    [slot],
  );
  const ready = await lookup(studioId);
  expect(ready.body.ticket.canCheckIn).toBe(true);
  const checked = await confirm(ready.body.ticket.version);
  expect(checked.status).toBe(200);
  expect(checked.body.ticket).toMatchObject({
    attendanceStatus: 'attended',
    checkedInCount: 1,
    quantity: 2,
    remainingAmount: 400000,
    canCheckIn: false,
  });
  expect(checked.body.ticket.checkedInAt).toBeTruthy();
  expect(checked.body.ticket.checkedInBy).toBeTruthy();
  expect((await confirm(ready.body.ticket.version)).status).toBe(409);
  expect((await lookup(studioId, tickets[1]!.code)).body.ticket).toMatchObject({
    attendanceStatus: 'unmarked',
    canCheckIn: true,
  });
  expect(
    (
      await query(
        'SELECT paid_amount,attendance_status FROM bookings WHERE id=$1',
        [bookingId],
      )
    ).rows[0],
  ).toEqual({ paid_amount: 0, attendance_status: 'unmarked' });

  await query("UPDATE tickets SET status='void' WHERE id=$1", [tickets[1]!.id]);
  const voidTicket = await lookup(studioId, tickets[1]!.code);
  expect(voidTicket.body.ticket.canCheckIn).toBe(false);
  expect(
    (await confirm(voidTicket.body.ticket.version, tickets[1]!.code)).status,
  ).toBe(409);
});
