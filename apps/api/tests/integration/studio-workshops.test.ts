import { seedStudioEvidence } from '../helpers/studio-evidence.js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { closePool, query, withTransaction } from '../../src/db/pool.js';
import { releaseExpiredHolds } from '../../src/modules/bookings/bookings.repository.js';

const app = createApp();
const passwordHash = 'test-password-hash';
vi.setConfig({ testTimeout: 30_000 });

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

  it('lists only studios where the authenticated user is a member', async () => {
    const owner = await createAccount(true);
    const otherOwner = await createAccount(true);
    const customer = await createAccount(false);

    await query(
      `INSERT INTO studio_members (studio_id, user_id, role)
       VALUES ($1, $2, 'staff')`,
      [owner.studioId, otherOwner.userId],
    );

    const unauthenticated = await request(app).get('/me/studios');
    expect(unauthenticated.status).toBe(401);

    const ownerStudios = await request(app)
      .get('/me/studios')
      .set('Cookie', owner.cookie);
    expect(ownerStudios.status).toBe(200);
    expect(ownerStudios.body.studios).toEqual([
      expect.objectContaining({
        id: owner.studioId,
        role: 'owner',
        status: 'pending',
        provinceId: 'ho-chi-minh',
        province: 'TP. Hồ Chí Minh',
      }),
    ]);

    const staffStudios = await request(app)
      .get('/me/studios')
      .set('Cookie', otherOwner.cookie);
    expect(staffStudios.status).toBe(200);
    expect(staffStudios.body.studios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: owner.studioId, role: 'staff' }),
        expect.objectContaining({ id: otherOwner.studioId, role: 'owner' }),
      ]),
    );
    expect(staffStudios.body.studios).toHaveLength(2);

    const customerStudios = await request(app)
      .get('/me/studios')
      .set('Cookie', customer.cookie);
    expect(customerStudios.status).toBe(200);
    expect(customerStudios.body.studios).toEqual([]);
  });

  it('includes drafts for their owner without exposing them to other accounts', async () => {
    const owner = await createAccount(false);
    const outsider = await createAccount(false);
    const draft = await request(app)
      .post('/studios/drafts')
      .set('Cookie', owner.cookie)
      .send({});
    expect(draft.status).toBe(201);
    const studioId = draft.body.studio.id;
    const ownList = await request(app)
      .get('/me/studios')
      .set('Cookie', owner.cookie);
    expect(ownList.body.studios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: studioId, isDraft: true, role: 'owner' }),
      ]),
    );
    const otherList = await request(app)
      .get('/me/studios')
      .set('Cookie', outsider.cookie);
    expect(otherList.body.studios).toEqual([]);
  });

  it('lists sessions only for members of the requested studio', async () => {
    const owner = await createAccount(true);
    const otherOwner = await createAccount(true);
    const workshop = await createWorkshop(owner);
    const session = await createSession(owner, workshop.body.workshop.id);

    const unauthenticated = await request(app).get(
      `/studios/${owner.studioId}/sessions`,
    );
    expect(unauthenticated.status).toBe(401);

    const outsider = await request(app)
      .get(`/studios/${owner.studioId}/sessions`)
      .set('Cookie', otherOwner.cookie);
    expect(outsider.status).toBe(404);

    const ownerSessions = await request(app)
      .get(`/studios/${owner.studioId}/sessions`)
      .set('Cookie', owner.cookie);
    expect(ownerSessions.status).toBe(200);
    expect(ownerSessions.body.sessions).toEqual([
      expect.objectContaining({
        id: session.body.session.id,
        workshopId: workshop.body.workshop.id,
        workshopTitle: workshop.body.workshop.title,
        status: 'scheduled',
      }),
    ]);

    await query(
      `INSERT INTO studio_members (studio_id, user_id, role)
       VALUES ($1, $2, 'staff')`,
      [owner.studioId, otherOwner.userId],
    );
    const staffSessions = await request(app)
      .get(`/studios/${owner.studioId}/sessions`)
      .set('Cookie', otherOwner.cookie);
    expect(staffSessions.status).toBe(200);
    expect(staffSessions.body.sessions).toHaveLength(1);
    expect(staffSessions.body.sessions[0].id).toBe(session.body.session.id);
  });

  it('creates and updates workshops and sessions with required business rules', async () => {
    const owner = await createAccount(true);
    const invalidStudioId = await request(app)
      .get('/studios/not-a-uuid/workshops')
      .set('Cookie', owner.cookie);
    expect(invalidStudioId.status).toBe(400);

    const createdWorkshop = await createWorkshop(owner);
    expect(createdWorkshop.status).toBe(201);
    expect(createdWorkshop.body.workshop.status).toBe('pending');
    expect(createdWorkshop.body.workshop.provinceId).toBe('ho-chi-minh');
    expect(createdWorkshop.body.workshop.address).toBe('Địa chỉ thử nghiệm');
    const invalidWorkshopId = await request(app)
      .patch(`/studios/${owner.studioId}/workshops/not-a-uuid`)
      .set('Cookie', owner.cookie)
      .send({ title: 'Updated title' });
    expect(invalidWorkshopId.status).toBe(400);
    expect(createdWorkshop.body.workshop.cancellationPolicy).toBe(
      'Báo trước nếu cần đổi lịch.',
    );
    expect(createdWorkshop.body.workshop.paymentPolicy).toBe(
      'Thanh toán khi đặt chỗ.',
    );
    const oversizedAudience = await request(app)
      .post(`/studios/${owner.studioId}/workshops`)
      .set('Cookie', owner.cookie)
      .send({
        ...workshopInput(),
        audience: Array.from({ length: 21 }, (_, index) => `audience ${index}`),
      });
    expect(oversizedAudience.status).toBe(422);
    const outOfRangeSession = await request(app)
      .post(
        `/studios/${owner.studioId}/workshops/${createdWorkshop.body.workshop.id}/sessions`,
      )
      .set('Cookie', owner.cookie)
      .send({ ...sessionInput(), capacity: 2_147_483_648 });
    expect(outOfRangeSession.status).toBe(422);

    const invalidWorkshop = await request(app)
      .post(`/studios/${owner.studioId}/workshops`)
      .set('Cookie', owner.cookie)
      .send({ title: 'Invalid payload' });
    expect(invalidWorkshop.status).toBe(422);
    const legacyPolicy = await request(app)
      .patch(
        `/studios/${owner.studioId}/workshops/${createdWorkshop.body.workshop.id}`,
      )
      .set('Cookie', owner.cookie)
      .send({ policy: 'Không còn là trường hợp đồng.' });
    expect(legacyPolicy.status).toBe(422);

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
      .send({
        title: 'Workshop đã cập nhật',
        paymentPolicy: 'Thanh toán trước khi tham gia.',
      });
    expect(editedWorkshop.status).toBe(200);
    expect(editedWorkshop.body.workshop.title).toBe('Workshop đã cập nhật');
    expect(editedWorkshop.body.workshop.cancellationPolicy).toBe(
      'Báo trước nếu cần đổi lịch.',
    );
    expect(editedWorkshop.body.workshop.paymentPolicy).toBe(
      'Thanh toán trước khi tham gia.',
    );
    expect(editedWorkshop.body.workshop.status).toBe('pending');

    const createdSession = await createSession(
      owner,
      createdWorkshop.body.workshop.id,
    );
    expect(createdSession.status).toBe(201);
    expect(createdSession.body.session.status).toBe('scheduled');
    await query(`UPDATE studios SET status = 'approved' WHERE id = $1`, [
      owner.studioId,
    ]);
    await query(`UPDATE workshops SET status = 'approved' WHERE id = $1`, [
      createdWorkshop.body.workshop.id,
    ]);
    const publicWorkshop = await request(app).get(
      `/workshops/${createdWorkshop.body.workshop.id}`,
    );
    expect(publicWorkshop.status).toBe(200);
    expect(publicWorkshop.body.workshop).toMatchObject({
      cancellationPolicy: 'Báo trước nếu cần đổi lịch.',
      paymentPolicy: 'Thanh toán trước khi tham gia.',
    });

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

    const changedSchedule = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const lockedSchedule = await request(app)
      .patch(
        `/studios/${owner.studioId}/sessions/${createdSession.body.session.id}`,
      )
      .set('Cookie', owner.cookie)
      .send({
        startsAt: changedSchedule.toISOString(),
        endsAt: new Date(
          changedSchedule.getTime() + 60 * 60 * 1000,
        ).toISOString(),
      });
    expect(lockedSchedule.status).toBe(409);
    expect(lockedSchedule.body.error.message).toContain('Không thể đổi lịch');

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

    const concurrentCapacityUpdates = await Promise.all([
      request(app)
        .patch(
          `/studios/${owner.studioId}/sessions/${createdSession.body.session.id}`,
        )
        .set('Cookie', owner.cookie)
        .send({ capacity: 1 }),
      request(app)
        .patch(
          `/studios/${owner.studioId}/sessions/${createdSession.body.session.id}`,
        )
        .set('Cookie', owner.cookie)
        .send({ capacity: 3 }),
    ]);
    expect(
      concurrentCapacityUpdates.map(({ status }) => status).sort(),
    ).toEqual([200, 409]);
    const capacityAfterConcurrentUpdates = await query<{
      capacity: number;
      seatsHeld: number;
      seatsSold: number;
    }>(
      `SELECT capacity,
              seats_held AS "seatsHeld",
              seats_sold AS "seatsSold"
       FROM sessions
       WHERE id = $1`,
      [createdSession.body.session.id],
    );
    expect(
      capacityAfterConcurrentUpdates.rows[0].capacity,
    ).toBeGreaterThanOrEqual(
      capacityAfterConcurrentUpdates.rows[0].seatsHeld +
        capacityAfterConcurrentUpdates.rows[0].seatsSold,
    );

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

  it('rejects edits to closed sessions and sessions with refund-needed bookings', async () => {
    const owner = await createAccount(true);
    const workshop = await createWorkshop(owner);
    const cancelled = await createSession(owner, workshop.body.workshop.id);
    const completed = await createSession(owner, workshop.body.workshop.id);
    const past = await createSession(owner, workshop.body.workshop.id);
    const refundNeeded = await createSession(owner, workshop.body.workshop.id);

    await query(`UPDATE sessions SET status = 'cancelled' WHERE id = $1`, [
      cancelled.body.session.id,
    ]);
    await query(`UPDATE sessions SET status = 'completed' WHERE id = $1`, [
      completed.body.session.id,
    ]);
    await query(
      `UPDATE sessions
       SET starts_at = now() - interval '1 hour',
           ends_at = now() - interval '30 minutes'
       WHERE id = $1`,
      [past.body.session.id],
    );
    await query(
      `INSERT INTO bookings
         (user_id, session_id, quantity, unit_price, total_amount,
          hold_expires_at, order_code, status, paid_at)
       VALUES ($1, $2, 1, 10000, 10000, now(), $3, 'refund_needed', now())`,
      [
        owner.userId,
        refundNeeded.body.session.id,
        Date.now() + Number.parseInt(randomUUID().slice(0, 8), 16),
      ],
    );

    for (const session of [cancelled, completed, past]) {
      const response = await request(app)
        .patch(`/studios/${owner.studioId}/sessions/${session.body.session.id}`)
        .set('Cookie', owner.cookie)
        .send({ capacity: 12 });
      expect(response.status).toBe(409);
      expect(response.body.error.message).toContain('Không thể sửa buổi');
    }

    const lockedRefundSchedule = new Date(Date.now() + 96 * 60 * 60 * 1000);
    const response = await request(app)
      .patch(
        `/studios/${owner.studioId}/sessions/${refundNeeded.body.session.id}`,
      )
      .set('Cookie', owner.cookie)
      .send({
        startsAt: lockedRefundSchedule.toISOString(),
        endsAt: new Date(
          lockedRefundSchedule.getTime() + 60 * 60 * 1000,
        ).toISOString(),
      });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toContain('Không thể đổi lịch');

    const lockedRefundPrice = await request(app)
      .patch(
        `/studios/${owner.studioId}/sessions/${refundNeeded.body.session.id}`,
      )
      .set('Cookie', owner.cookie)
      .send({ price: 20000 });
    expect(lockedRefundPrice.status).toBe(409);
    expect(lockedRefundPrice.body.error.message).toContain('Không thể đổi giá');
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

  it('serializes expired-hold cleanup and session cancellation without double release', async () => {
    const owner = await createAccount(true);
    const workshop = await createWorkshop(owner);
    const session = await createSession(owner, workshop.body.workshop.id);
    const sessionId = session.body.session.id;
    const booking = await query<{ id: string }>(
      `INSERT INTO bookings (
         user_id, session_id, quantity, unit_price, total_amount,
         hold_expires_at, order_code
       )
       VALUES ($1, $2, 1, 10000, 10000, now() - interval '1 minute', $3)
       RETURNING id`,
      [
        owner.userId,
        sessionId,
        Date.now() + Number.parseInt(randomUUID().slice(0, 8), 16),
      ],
    );
    await query('UPDATE sessions SET seats_held = 1 WHERE id = $1', [
      sessionId,
    ]);

    const cleanup = withTransaction((client) =>
      releaseExpiredHolds(client, [sessionId]),
    );
    const cancellation = request(app)
      .post(`/studios/${owner.studioId}/sessions/${sessionId}/cancel`)
      .set('Cookie', owner.cookie);
    const [cleanupResult, cancellationResult] = await Promise.all([
      cleanup,
      cancellation,
    ]);

    expect(cleanupResult).toBeUndefined();
    expect(cancellationResult.status).toBe(200);
    expect(cancellationResult.body.session).toMatchObject({
      id: sessionId,
      status: 'cancelled',
      seatsHeld: 0,
    });

    await withTransaction((client) => releaseExpiredHolds(client, [sessionId]));
    const result = await query<{
      bookingStatus: string;
      seatsHeld: number;
      seatsSold: number;
      capacity: number;
    }>(
      `SELECT b.status AS "bookingStatus",
              s.seats_held AS "seatsHeld",
              s.seats_sold AS "seatsSold",
              s.capacity
       FROM bookings b
       JOIN sessions s ON s.id = b.session_id
       WHERE b.id = $1`,
      [booking.rows[0].id],
    );
    expect(['expired', 'cancelled']).toContain(result.rows[0].bookingStatus);
    expect(result.rows[0]).toMatchObject({
      seatsHeld: 0,
      seatsSold: 0,
      capacity: 10,
    });
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

  it('rejects and reapproves edited workshops with admin-only decisions', async () => {
    const owner = await createAccount(true);
    const suffix = randomUUID();
    const created = await createWorkshop(owner);
    const uniquelyNamed = await request(app)
      .patch(`/studios/${owner.studioId}/workshops/${created.body.workshop.id}`)
      .set('Cookie', owner.cookie)
      .send({ title: `Workshop ${suffix}` });
    expect(uniquelyNamed.status).toBe(200);
    expect(uniquelyNamed.body.workshop.status).toBe('pending');
    await query(
      `INSERT INTO sessions
         (workshop_id, starts_at, ends_at, price, capacity, status)
       VALUES ($1, now() + interval '7 days', now() + interval '8 days',
               10000, 10, 'scheduled')`,
      [created.body.workshop.id],
    );

    const admin = await createAdmin();
    const forbidden = await request(app)
      .get('/admin/workshops')
      .set('Cookie', owner.cookie);
    expect(forbidden.status).toBe(403);

    const pending = await request(app)
      .get('/admin/workshops')
      .query({ pageSize: 100 })
      .set('Cookie', admin.cookie);
    expect(pending.status).toBe(200);
    expect(pending.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.workshop.id,
          status: 'pending',
          reviewHistory: [],
        }),
      ]),
    );

    const missingReason = await request(app)
      .patch(`/admin/workshops/${created.body.workshop.id}/status`)
      .set('Cookie', admin.cookie)
      .send({ status: 'rejected' });
    expect(missingReason.status).toBe(422);

    const reason = 'Bổ sung thông tin vật liệu sử dụng.';
    const rejected = await request(app)
      .patch(`/admin/workshops/${created.body.workshop.id}/status`)
      .set('Cookie', admin.cookie)
      .send({ status: 'rejected', reason });
    expect(rejected.status).toBe(200);
    expect(rejected.body.workshop.status).toBe('rejected');
    expect(rejected.body.workshop.reviewHistory).toEqual([
      expect.objectContaining({
        decision: 'rejected',
        reason,
        reviewerName: 'MOD1 admin',
      }),
    ]);

    const duplicateDecision = await request(app)
      .patch(`/admin/workshops/${created.body.workshop.id}/status`)
      .set('Cookie', admin.cookie)
      .send({ status: 'approved' });
    expect(duplicateDecision.status).toBe(409);

    const resubmitted = await request(app)
      .patch(`/studios/${owner.studioId}/workshops/${created.body.workshop.id}`)
      .set('Cookie', owner.cookie)
      .send({ description: `Nội dung đã bổ sung ${suffix}.` });
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.workshop.status).toBe('pending');

    const pendingAgain = await request(app)
      .get('/admin/workshops')
      .query({ pageSize: 100 })
      .set('Cookie', admin.cookie);
    const listedAgain = pendingAgain.body.items.find(
      (workshop: { id: string }) => workshop.id === created.body.workshop.id,
    );
    expect(listedAgain.reviewHistory).toHaveLength(1);
    expect(listedAgain.reviewHistory[0].reason).toBe(reason);

    const approved = await request(app)
      .patch(`/admin/workshops/${created.body.workshop.id}/status`)
      .set('Cookie', admin.cookie)
      .send({ status: 'approved' });
    expect(approved.status).toBe(200);
    expect(approved.body.workshop.reviewHistory).toHaveLength(2);

    const hiddenUntilStudioApproval = await request(app)
      .get('/workshops')
      .query({ q: suffix, category_id: 'ceramics' });
    expect(hiddenUntilStudioApproval.body.pagination.total).toBe(0);

    const studioApproval = await request(app)
      .patch(`/admin/studios/${owner.studioId}/status`)
      .set('Cookie', admin.cookie)
      .send({ status: 'approved' });
    expect(studioApproval.status).toBe(200);

    const publicWorkshop = await request(app)
      .get('/workshops')
      .query({ q: suffix, category_id: 'ceramics' });
    expect(publicWorkshop.status).toBe(200);
    expect(publicWorkshop.body.pagination.total).toBe(1);
    expect(publicWorkshop.body.items[0].id).toBe(created.body.workshop.id);
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
    await seedStudioEvidence(studioId, userId);
    await query(
      `INSERT INTO studio_members (studio_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [studioId, userId],
    );
  }

  const config = loadConfig();
  const sessionId = await createAuthSession(userId);
  const token = jwt.sign(
    { sub: userId, sid: sessionId, role: 'customer' },
    config.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
  return {
    userId,
    studioId,
    cookie: `${config.COOKIE_NAME}=${token}`,
  };
}

async function createAdmin(): Promise<{ cookie: string }> {
  const user = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'admin')
     RETURNING id`,
    [`admin.${randomUUID()}@example.test`, passwordHash, 'MOD1 admin'],
  );
  const config = loadConfig();
  const sessionId = await createAuthSession(user.rows[0].id);
  const token = jwt.sign(
    { sub: user.rows[0].id, sid: sessionId, role: 'admin' },
    config.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
  return { cookie: `${config.COOKIE_NAME}=${token}` };
}

async function createAuthSession(userId: string): Promise<string> {
  const refreshToken = randomBytes(32).toString('base64url');
  const result = await query<{ id: string }>(
    `INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at)
     VALUES ($1, $2, now() + interval '14 days')
     RETURNING id`,
    [userId, createHash('sha256').update(refreshToken).digest('hex')],
  );
  return result.rows[0].id;
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
    cancellationPolicy: 'Báo trước nếu cần đổi lịch.',
    paymentPolicy: 'Thanh toán khi đặt chỗ.',
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
