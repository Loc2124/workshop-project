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
  organizerId: string | null;
  cookie: string;
};

describe('organizer workshop and session endpoints', () => {
  beforeAll(async () => {
    assertSafeTestDatabase();
    const databaseUrl = process.env.DATABASE_URL_TEST;
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL_TEST is required for organizer workshop tests.',
      );
    }
    await migrateDatabase(databaseUrl);
  });

  afterAll(async () => {
    await closePool();
  });

  it('creates and updates workshops and sessions with required business rules', async () => {
    const organizer = await createAccount('organizer');
    const createdWorkshop = await createWorkshop(organizer.cookie);
    expect(createdWorkshop.status).toBe(201);
    expect(createdWorkshop.body.workshop.status).toBe('pending');

    const missingCreateTimezone = await request(app)
      .post(`/organizer/workshops/${createdWorkshop.body.workshop.id}/sessions`)
      .set('Cookie', organizer.cookie)
      .send({
        startsAt: '2030-05-01T09:00:00',
        endsAt: '2030-05-01T10:00:00',
        price: 10000,
        capacity: 10,
      });
    expect(missingCreateTimezone.status).toBe(422);

    await query(`UPDATE workshops SET status = 'approved' WHERE id = $1`, [
      createdWorkshop.body.workshop.id,
    ]);
    const editedWorkshop = await request(app)
      .patch(`/organizer/workshops/${createdWorkshop.body.workshop.id}`)
      .set('Cookie', organizer.cookie)
      .send({ title: 'Workshop đã cập nhật' });

    expect(editedWorkshop.status).toBe(200);
    expect(editedWorkshop.body.workshop.title).toBe('Workshop đã cập nhật');
    expect(editedWorkshop.body.workshop.status).toBe('pending');

    const createdSession = await createSession(
      organizer.cookie,
      createdWorkshop.body.workshop.id,
    );
    expect(createdSession.status).toBe(201);
    expect(createdSession.body.session.status).toBe('scheduled');

    const missingTimezone = await request(app)
      .patch(`/organizer/sessions/${createdSession.body.session.id}`)
      .set('Cookie', organizer.cookie)
      .send({
        startsAt: '2030-05-01T09:00:00',
      });
    expect(missingTimezone.status).toBe(422);

    const updatedSession = await request(app)
      .patch(`/organizer/sessions/${createdSession.body.session.id}`)
      .set('Cookie', organizer.cookie)
      .send({ capacity: 4 });
    expect(updatedSession.status).toBe(200);
    expect(updatedSession.body.session.capacity).toBe(4);

    const invalidSchedule = await request(app)
      .patch(`/organizer/sessions/${createdSession.body.session.id}`)
      .set('Cookie', organizer.cookie)
      .send({
        endsAt: new Date(
          new Date(createdSession.body.session.startsAt).getTime() - 60_000,
        ).toISOString(),
      });
    expect(invalidSchedule.status).toBe(422);

    await query(
      `INSERT INTO bookings
         (user_id, session_id, quantity, unit_price, total_amount,
          hold_expires_at, order_code, status, paid_at)
       VALUES
         ($1, $2, 1, 10000, 10000, now() + interval '15 minutes', $3, 'pending', NULL),
         ($1, $2, 1, 10000, 10000, now(), $4, 'paid', now())`,
      [
        organizer.userId,
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
      .patch(`/organizer/sessions/${createdSession.body.session.id}`)
      .set('Cookie', organizer.cookie)
      .send({ capacity: 1 });
    expect(reducedCapacity.status).toBe(409);

    const changedPrice = await request(app)
      .patch(`/organizer/sessions/${createdSession.body.session.id}`)
      .set('Cookie', organizer.cookie)
      .send({ price: 20000 });
    expect(changedPrice.status).toBe(409);

    const cancelled = await request(app)
      .post(`/organizer/sessions/${createdSession.body.session.id}/cancel`)
      .set('Cookie', organizer.cookie);
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

  it('hides, rejects, or prevents child creation for another organizer resources', async () => {
    const owner = await createAccount('organizer');
    const other = await createAccount('organizer');
    const workshop = await createWorkshop(owner.cookie);
    const session = await createSession(
      owner.cookie,
      workshop.body.workshop.id,
    );

    const list = await request(app)
      .get('/organizer/workshops')
      .set('Cookie', other.cookie);
    expect(list.status).toBe(200);
    expect(list.body.workshops).toEqual([]);

    const updateWorkshop = await request(app)
      .patch(`/organizer/workshops/${workshop.body.workshop.id}`)
      .set('Cookie', other.cookie)
      .send({ title: 'Unauthorized edit' });
    expect(updateWorkshop.status).toBe(404);

    const createChildSession = await request(app)
      .post(`/organizer/workshops/${workshop.body.workshop.id}/sessions`)
      .set('Cookie', other.cookie)
      .send(sessionInput());
    expect(createChildSession.status).toBe(404);

    const updateSession = await request(app)
      .patch(`/organizer/sessions/${session.body.session.id}`)
      .set('Cookie', other.cookie)
      .send({ price: 20000 });
    expect(updateSession.status).toBe(404);

    const cancelSession = await request(app)
      .post(`/organizer/sessions/${session.body.session.id}/cancel`)
      .set('Cookie', other.cookie);
    expect(cancelSession.status).toBe(404);

    const createdByOther = await createWorkshop(other.cookie);
    expect(createdByOther.status).toBe(201);
    expect(createdByOther.body.workshop.organizerId).toBe(other.organizerId);

    const otherWorkshops = await request(app)
      .get('/organizer/workshops')
      .set('Cookie', other.cookie);
    expect(otherWorkshops.body.workshops).toHaveLength(1);
    expect(otherWorkshops.body.workshops[0].id).toBe(
      createdByOther.body.workshop.id,
    );
  });

  it('returns 403 to customers on every organizer endpoint', async () => {
    const owner = await createAccount('organizer');
    const customer = await createAccount('customer');
    const workshop = await createWorkshop(owner.cookie);
    const session = await createSession(
      owner.cookie,
      workshop.body.workshop.id,
    );

    const responses = await Promise.all([
      request(app).get('/organizer/workshops').set('Cookie', customer.cookie),
      request(app)
        .post('/organizer/workshops')
        .set('Cookie', customer.cookie)
        .send(workshopInput()),
      request(app)
        .patch(`/organizer/workshops/${workshop.body.workshop.id}`)
        .set('Cookie', customer.cookie)
        .send({ title: 'Forbidden edit' }),
      request(app)
        .post(`/organizer/workshops/${workshop.body.workshop.id}/sessions`)
        .set('Cookie', customer.cookie)
        .send(sessionInput()),
      request(app)
        .patch(`/organizer/sessions/${session.body.session.id}`)
        .set('Cookie', customer.cookie)
        .send({ capacity: 20 }),
      request(app)
        .post(`/organizer/sessions/${session.body.session.id}/cancel`)
        .set('Cookie', customer.cookie),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      403, 403, 403, 403, 403, 403,
    ]);
  });
});

async function createAccount(
  role: 'customer' | 'organizer',
): Promise<TestAccount> {
  const suffix = randomUUID();
  const user = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4::user_role)
     RETURNING id`,
    [`${role}.${suffix}@example.test`, passwordHash, 'Test account', role],
  );
  const userId = user.rows[0].id;
  let organizerId: string | null = null;

  if (role === 'organizer') {
    const organizer = await query<{ id: string }>(
      `INSERT INTO organizers (user_id, name)
       VALUES ($1, $2)
       RETURNING id`,
      [userId, `Organizer ${suffix}`],
    );
    organizerId = organizer.rows[0].id;
  }

  const secret = process.env.JWT_SECRET || 'change-me-to-a-long-random-string';
  const token = jwt.sign({ sub: userId, role, organizerId }, secret, {
    expiresIn: '1h',
  });

  return {
    userId,
    organizerId,
    cookie: `${process.env.COOKIE_NAME || 'workshop_session'}=${token}`,
  };
}

async function createWorkshop(cookie: string) {
  return request(app)
    .post('/organizer/workshops')
    .set('Cookie', cookie)
    .send(workshopInput());
}

async function createSession(cookie: string, workshopId: string) {
  return request(app)
    .post(`/organizer/workshops/${workshopId}/sessions`)
    .set('Cookie', cookie)
    .send(sessionInput());
}

function workshopInput() {
  return {
    title: 'Workshop gốm thử nghiệm',
    description: 'Thực hành tạo hình gốm thủ công.',
    category: 'ceramics',
    level: 'beginner',
    audience: ['nhóm bạn'],
    takeaway: 'Một chiếc cốc',
    durationMinutes: 120,
    basePrice: 10000,
    requirements: 'Không cần kinh nghiệm.',
    policy: 'Báo trước nếu cần đổi lịch.',
    district: 'Quận 1',
    address: 'Địa chỉ thử nghiệm',
  };
}

function sessionInput() {
  const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    price: 10000,
    capacity: 10,
  };
}
