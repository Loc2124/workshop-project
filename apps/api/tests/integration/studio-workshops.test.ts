import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { createApp } from '../../src/app.js';
import { closePool, query } from '../../src/db/pool.js';

const app = createApp();
const passwordHash = 'test-password-hash';

type TestAccount = {
  userId: string;
  studioId: string | null;
  cookie: string;
};

describe('studio workshop and session endpoints', () => {
  beforeAll(async () => {
    assertSafeTestDatabase();
    const databaseUrl = process.env.DATABASE_URL_TEST;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL_TEST is required for studio tests.');
    }
    await migrateDatabase(databaseUrl);
  });

  afterAll(async () => {
    await closePool();
  });

  it('creates and updates workshops and sessions with required business rules', async () => {
    const owner = await createAccount(true);
    const createdWorkshop = await createWorkshop(owner);
    expect(createdWorkshop.status).toBe(201);
    expect(createdWorkshop.body.workshop.status).toBe('pending');
    expect(createdWorkshop.body.workshop.provinceId).toBe('ho-chi-minh');
    expect(createdWorkshop.body.workshop.address).toBe('Địa chỉ thử nghiệm');

    const invalidWorkshop = await request(app)
      .post(`/studios/${owner.studioId}/workshops`)
      .set('Cookie', owner.cookie)
      .send({ title: 'Invalid payload' });
    expect(invalidWorkshop.status).toBe(422);

    const missingTimezone = await request(app)
      .post(
        `/studios/${owner.studioId}/workshops/${createdWorkshop.body.workshop.id}/sessions`,
      )
      .set('Cookie', owner.cookie)
      .send({
        startsAt: '2030-05-01T09:00:00',
        endsAt: '2030-05-01T10:00:00',
        price: 10000,
        capacity: 10,
      });
    expect(missingTimezone.status).toBe(422);

    await query(`UPDATE workshops SET status = 'approved' WHERE id = $1`, [
      createdWorkshop.body.workshop.id,
    ]);
    const editedWorkshop = await request(app)
      .patch(
        `/studios/${owner.studioId}/workshops/${createdWorkshop.body.workshop.id}`,
      )
      .set('Cookie', owner.cookie)
      .send({ title: 'Workshop đã cập nhật' });
    expect(editedWorkshop.status).toBe(200);
    expect(editedWorkshop.body.workshop.title).toBe('Workshop đã cập nhật');
    expect(editedWorkshop.body.workshop.status).toBe('pending');

    const createdSession = await createSession(
      owner,
      createdWorkshop.body.workshop.id,
    );
    expect(createdSession.status).toBe(201);
    expect(createdSession.body.session.status).toBe('scheduled');

    const invalidSchedule = await request(app)
      .patch(
        `/studios/${owner.studioId}/sessions/${createdSession.body.session.id}`,
      )
      .set('Cookie', owner.cookie)
      .send({
        endsAt: new Date(
          new Date(createdSession.body.session.startsAt).getTime() - 60_000,
        ).toISOString(),
      });
    expect(invalidSchedule.status).toBe(422);

    const updatedSession = await request(app)
      .patch(
        `/studios/${owner.studioId}/sessions/${createdSession.body.session.id}`,
      )
      .set('Cookie', owner.cookie)
      .send({ capacity: 4 });
    expect(updatedSession.status).toBe(200);
    expect(updatedSession.body.session.capacity).toBe(4);

    await query(
      `INSERT INTO bookings
         (user_id, session_id, quantity, unit_price, total_amount,
          hold_expires_at, order_code, status, paid_at)
       VALUES
         ($1, $2, 1, 10000, 10000, now() + interval '15 minutes', $3, 'pending', NULL),
         ($1, $2, 1, 10000, 10000, now(), $4, 'paid', now())`,
      [
        owner.userId,
        createdSession.body.session.id,
        Date.now(),
        Date.now() + 1,
      ],
    );
    await query(
      `UPDATE sessions
       SET seats_held = 1, seats_sold = 1
       WHERE id = $1`,
      [createdSession.body.session.id],
    );

    const reducedCapacity = await request(app)
      .patch(
        `/studios/${owner.studioId}/sessions/${createdSession.body.session.id}`,
      )
      .set('Cookie', owner.cookie)
      .send({ capacity: 1 });
    expect(reducedCapacity.status).toBe(409);

    const changedPrice = await request(app)
      .patch(
        `/studios/${owner.studioId}/sessions/${createdSession.body.session.id}`,
      )
      .set('Cookie', owner.cookie)
      .send({ price: 20000 });
    expect(changedPrice.status).toBe(409);

    const cancelled = await request(app)
      .post(
        `/studios/${owner.studioId}/sessions/${createdSession.body.session.id}/cancel`,
      )
      .set('Cookie', owner.cookie);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.session.status).toBe('cancelled');
    expect(cancelled.body.session.seatsHeld).toBe(0);

    const bookings = await query<{ status: string }>(
      `SELECT status
       FROM bookings
       WHERE session_id = $1
       ORDER BY status`,
      [createdSession.body.session.id],
    );
    expect(bookings.rows.map((booking) => booking.status).sort()).toEqual([
      'cancelled',
      'refund_needed',
    ]);
  });

  it('scopes workshop and session access to studio members', async () => {
    const owner = await createAccount(true);
    const otherOwner = await createAccount(true);
    const workshop = await createWorkshop(owner);
    const session = await createSession(owner, workshop.body.workshop.id);

    const outsiderList = await request(app)
      .get(`/studios/${owner.studioId}/workshops`)
      .set('Cookie', otherOwner.cookie);
    expect(outsiderList.status).toBe(404);

    const forbiddenUpdate = await request(app)
      .patch(
        `/studios/${owner.studioId}/workshops/${workshop.body.workshop.id}`,
      )
      .set('Cookie', otherOwner.cookie)
      .send({ title: 'Unauthorized edit' });
    expect(forbiddenUpdate.status).toBe(404);

    const forbiddenSessionUpdate = await request(app)
      .patch(`/studios/${owner.studioId}/sessions/${session.body.session.id}`)
      .set('Cookie', otherOwner.cookie)
      .send({ price: 20000 });
    expect(forbiddenSessionUpdate.status).toBe(404);

    await query(
      `INSERT INTO studio_members (studio_id, user_id, role)
       VALUES ($1, $2, 'staff')`,
      [owner.studioId, otherOwner.userId],
    );
    const staffList = await request(app)
      .get(`/studios/${owner.studioId}/workshops`)
      .set('Cookie', otherOwner.cookie);
    expect(staffList.status).toBe(200);
    expect(staffList.body.workshops).toHaveLength(1);

    const staffWorkshopCreate = await request(app)
      .post(`/studios/${owner.studioId}/workshops`)
      .set('Cookie', otherOwner.cookie)
      .send(workshopInput());
    expect(staffWorkshopCreate.status).toBe(403);

    const staffContentUpdate = await request(app)
      .patch(
        `/studios/${owner.studioId}/workshops/${workshop.body.workshop.id}`,
      )
      .set('Cookie', otherOwner.cookie)
      .send({ title: 'Updated by staff' });
    expect(staffContentUpdate.status).toBe(200);
    expect(staffContentUpdate.body.workshop.title).toBe('Updated by staff');

    const staffWorkshopPriceUpdate = await request(app)
      .patch(
        `/studios/${owner.studioId}/workshops/${workshop.body.workshop.id}`,
      )
      .set('Cookie', otherOwner.cookie)
      .send({ basePrice: 20000 });
    expect(staffWorkshopPriceUpdate.status).toBe(403);

    const staffSessionPriceUpdate = await request(app)
      .patch(`/studios/${owner.studioId}/sessions/${session.body.session.id}`)
      .set('Cookie', otherOwner.cookie)
      .send({ price: 20000 });
    expect(staffSessionPriceUpdate.status).toBe(403);

    const staffSessionScheduleUpdate = await request(app)
      .patch(`/studios/${owner.studioId}/sessions/${session.body.session.id}`)
      .set('Cookie', otherOwner.cookie)
      .send({
        startsAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 73 * 60 * 60 * 1000).toISOString(),
      });
    expect(staffSessionScheduleUpdate.status).toBe(200);

    const staffSessionCreate = await request(app)
      .post(
        `/studios/${owner.studioId}/workshops/${workshop.body.workshop.id}/sessions`,
      )
      .set('Cookie', otherOwner.cookie)
      .send(sessionInput(false));
    expect(staffSessionCreate.status).toBe(201);
    expect(staffSessionCreate.body.session.price).toBe(
      workshop.body.workshop.basePrice,
    );

    const staffPricedSessionCreate = await request(app)
      .post(
        `/studios/${owner.studioId}/workshops/${workshop.body.workshop.id}/sessions`,
      )
      .set('Cookie', otherOwner.cookie)
      .send(sessionInput());
    expect(staffPricedSessionCreate.status).toBe(403);

    const createdByOther = await createWorkshop(otherOwner);
    expect(createdByOther.status).toBe(201);
    expect(createdByOther.body.workshop.studioId).toBe(otherOwner.studioId);
  });

  it('does not allow a non-member to create studio resources', async () => {
    const owner = await createAccount(true);
    const customer = await createAccount(false);
    const response = await request(app)
      .post(`/studios/${owner.studioId}/workshops`)
      .set('Cookie', customer.cookie)
      .send(workshopInput());
    expect(response.status).toBe(404);
  });
});

async function createAccount(createOwnedStudio: boolean): Promise<TestAccount> {
  const suffix = randomUUID();
  const user = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'customer')
     RETURNING id`,
    [`customer.${suffix}@example.test`, passwordHash, 'Test account'],
  );
  const userId = user.rows[0].id;
  let studioId: string | null = null;

  if (createOwnedStudio) {
    const studio = await query<{ id: string }>(
      `INSERT INTO studios (name, province_id, address)
       VALUES ($1, 'ho-chi-minh', 'Địa chỉ thử nghiệm')
       RETURNING id`,
      [`Test studio ${suffix}`],
    );
    studioId = studio.rows[0].id;
    await query(
      `INSERT INTO studio_members (studio_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [studioId, userId],
    );
  }

  const secret = process.env.JWT_SECRET || 'change-me-to-a-long-random-string';
  const token = jwt.sign({ sub: userId, role: 'customer' }, secret, {
    expiresIn: '1h',
  });
  return {
    userId,
    studioId,
    cookie: `${process.env.COOKIE_NAME || 'workshop_session'}=${token}`,
  };
}

async function createWorkshop(account: TestAccount) {
  return request(app)
    .post(`/studios/${account.studioId}/workshops`)
    .set('Cookie', account.cookie)
    .send(workshopInput());
}

async function createSession(account: TestAccount, workshopId: string) {
  return request(app)
    .post(`/studios/${account.studioId}/workshops/${workshopId}/sessions`)
    .set('Cookie', account.cookie)
    .send(sessionInput());
}

function workshopInput() {
  return {
    title: 'Workshop gốm thử nghiệm',
    description: 'Thực hành tạo hình gốm thủ công.',
    categoryId: 'ceramics',
    level: 'beginner',
    audience: ['nhóm bạn'],
    takeaway: 'Một chiếc cốc',
    durationMinutes: 120,
    basePrice: 10000,
    requirements: 'Không cần kinh nghiệm.',
    policy: 'Báo trước nếu cần đổi lịch.',
  };
}

function sessionInput(includePrice = true) {
  const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    ...(includePrice ? { price: 10000 } : {}),
    capacity: 10,
  };
}
