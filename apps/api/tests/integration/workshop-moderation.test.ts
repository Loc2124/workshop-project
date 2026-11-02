import { randomUUID, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { query, closePool } from '../../src/db/pool.js';
import { loadConfig } from '../../src/config.js';
import { seedStudioEvidence } from '../helpers/studio-evidence.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
vi.setConfig({ testTimeout: 120000, hookTimeout: 60000 });
const app = createApp();
beforeAll(async () => {
  assertSafeTestDatabase();
  await migrateDatabase(process.env.DATABASE_URL_TEST!);
});
afterAll(async () => closePool());
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
it('moderates visibility with atomic audit and private owner notifications, preserving review and bookings', async () => {
  const admin = await account('admin'),
    owner = await account('customer'),
    outsider = await account('customer');
  const studio = randomUUID(),
    id = randomUUID(),
    session = randomUUID();
  const title = `Moderation ${id}`;
  await query(
    "INSERT INTO studios(id,name,province_id,address,status) VALUES($1,$2,'ho-chi-minh','12 Test Street','pending')",
    [studio, title],
  );
  await query(
    "INSERT INTO studio_members(studio_id,user_id,role) VALUES($1,$2,'owner')",
    [studio, owner.id],
  );
  await seedStudioEvidence(studio, owner.id);
  await query(
    "INSERT INTO workshops(id,studio_id,title,slug,description,category_id,duration_minutes,base_price,status) VALUES($1,$2,$3,$4,'Workshop details','ceramics',90,200000,'approved')",
    [id, studio, title, `moderation-${id}`],
  );
  await query(
    "INSERT INTO sessions(id,workshop_id,starts_at,ends_at,price,capacity) VALUES($1,$2,now()+interval '2 days',now()+interval '2 days 90 minutes',200000,8)",
    [session, id],
  );
  const endpoint = `/admin/workshop/${id}/visibility`;
  expect(
    (await request(app).get('/admin/workshop').set('Cookie', owner.cookie))
      .status,
  ).toBe(403);
  expect((await request(app).get(`/workshops/${id}`)).status).toBe(404);
  await query("UPDATE studios SET status='approved' WHERE id=$1", [studio]);
  expect((await request(app).get(`/workshops/${id}`)).status).toBe(200);
  const list = await request(app)
    .get('/admin/workshop')
    .query({
      studioId: studio,
      categoryId: 'ceramics',
      sort: 'upcomingSlots:desc',
      status: 'active',
    })
    .set('Cookie', admin.cookie);
  expect(list.status).toBe(200);
  expect(list.body.items[0]).toMatchObject({
    id,
    upcomingSlots: 1,
    bookingCount: 0,
    status: 'active',
  });
  expect(
    (
      await request(app)
        .get('/admin/workshop/counts')
        .query({ studioId: studio, categoryId: 'ceramics' })
        .set('Cookie', admin.cookie)
    ).body.counts,
  ).toMatchObject({ active: 1, all: 1 });
  expect(
    (
      await request(app)
        .get('/admin/workshop?sort=title;DROP')
        .set('Cookie', admin.cookie)
    ).status,
  ).toBe(422);
  expect(
    (
      await request(app)
        .patch(endpoint)
        .set('Cookie', owner.cookie)
        .send({ status: 'hidden', reason: 'Long enough reason' })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .patch(endpoint)
        .set('Cookie', admin.cookie)
        .send({ status: 'hidden', reason: 'short' })
    ).status,
  ).toBe(422);
  const reason = 'Workshop needs additional information';
  const hidden = await request(app)
    .patch(endpoint)
    .set('Cookie', admin.cookie)
    .send({ status: 'hidden', reason });
  expect(hidden.status).toBe(200);
  expect(hidden.body.workshop).toMatchObject({
    status: 'hidden',
    hiddenReason: reason,
    reviewStatus: 'approved',
  });
  expect(hidden.body.workshop.slots).toHaveLength(1);
  expect((await request(app).get(`/workshops/${id}`)).status).toBe(404);
  const catalog = await request(app).get('/workshops').query({ q: title });
  expect(
    catalog.body.items.some((item: { id: string }) => item.id === id),
  ).toBe(false);
  const ownerNotifications = await request(app)
    .get('/me/notifications')
    .set('Cookie', owner.cookie);
  const notification = ownerNotifications.body.notifications.find(
    (n: { workshopId: string }) => n.workshopId === id,
  );
  expect(notification).toMatchObject({ reason, studioId: studio });
  const outsiders = await request(app)
    .get('/me/notifications')
    .set('Cookie', outsider.cookie);
  expect(outsiders.body.notifications).toEqual([]);
  expect(
    (
      await request(app)
        .patch(`/me/notifications/${notification.id}/read`)
        .set('Cookie', outsider.cookie)
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .patch(`/me/notifications/${notification.id}/read`)
        .set('Cookie', owner.cookie)
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .patch(endpoint)
        .set('Cookie', admin.cookie)
        .send({ status: 'hidden', reason })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .patch(endpoint)
        .set('Cookie', admin.cookie)
        .send({ status: 'removed', reason })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .patch(endpoint)
        .set('Cookie', admin.cookie)
        .send({ status: 'active' })
    ).status,
  ).toBe(200);
  const audit = await query(
    'SELECT action,reason,previous_status,new_status,actor_id FROM admin_activity_log WHERE entity_id=$1 ORDER BY created_at,id',
    [id],
  );
  expect(audit.rows.map((r) => r.action)).toEqual([
    'workshop.hidden',
    'workshop.removed',
    'workshop.restored',
  ]);
  expect(audit.rows[0]).toMatchObject({
    reason,
    previous_status: 'active',
    new_status: 'hidden',
    actor_id: admin.id,
  });
  expect((await request(app).get(`/workshops/${id}`)).status).toBe(200);
  expect(
    (
      await request(app)
        .get('/admin/workshop-studios')
        .query({ q: title })
        .set('Cookie', admin.cookie)
    ).body.items.some((s: { id: string }) => s.id === studio),
  ).toBe(true);
});
