import { randomUUID, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { query, closePool } from '../../src/db/pool.js';
import { loadConfig } from '../../src/config.js';
import * as argon2 from 'argon2';
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

it('moderates accounts with session revocation, role refresh, self protection and atomic audit', async () => {
  const admin = await account('admin'),
    other = await account('admin'),
    customer = await account('customer');
  const password = 'WillowFern72!';
  await query('UPDATE users SET password_hash=$2 WHERE id=$1', [
    customer.id,
    await argon2.hash(password),
  ]);
  const email = `${customer.id}@example.test`;
  const config = loadConfig();
  const staffStudio = randomUUID();
  await query(
    "INSERT INTO studios(id,name,province_id,address) VALUES($1,'Staff studio','ho-chi-minh','Test address')",
    [staffStudio],
  );
  await query(
    "INSERT INTO studio_members(studio_id,user_id,role) VALUES($1,$2,'staff')",
    [staffStudio, customer.id],
  );
  const login = await request(app)
    .post('/auth/login')
    .send({ email, password });
  expect(login.status).toBe(200);
  const cookie = (login.headers['set-cookie'] as unknown as string[])
    .map((c: string) => c.split(';')[0])
    .join('; ');
  const endpoint = (id: string) => `/admin/nguoi-dung/${id}`;
  const block = {
    action: 'block',
    expectedRole: 'customer',
    expectedBlocked: false,
    reason: 'Policy violation confirmed by administrator',
  };
  expect(
    (await request(app).get('/admin/nguoi-dung').set('Cookie', customer.cookie))
      .status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .patch(endpoint(customer.id))
        .set('Cookie', admin.cookie)
        .send({ ...block, reason: 'short' })
    ).status,
  ).toBe(422);
  const self = await request(app)
    .patch(endpoint(admin.id))
    .set('Cookie', admin.cookie)
    .send({ ...block, expectedRole: 'admin' });
  expect(self.status).toBe(400);
  expect(
    (
      await request(app)
        .patch(endpoint(admin.id))
        .set('Cookie', admin.cookie)
        .send({
          action: 'change_role',
          role: 'customer',
          expectedRole: 'admin',
          expectedBlocked: false,
          reason: 'Administrator requests a role change',
        })
    ).status,
  ).toBe(400);
  const blocked = await request(app)
    .patch(endpoint(customer.id))
    .set('Cookie', admin.cookie)
    .send(block);
  expect(blocked.status).toBe(200);
  expect((await request(app).get('/me').set('Cookie', cookie)).status).toBe(
    401,
  );
  expect(
    (await request(app).get('/me').set('Cookie', customer.cookie)).status,
  ).toBe(401);
  expect(
    (await request(app).post('/auth/refresh').set('Cookie', cookie)).status,
  ).toBe(401);
  const denied = await request(app)
    .post('/auth/login')
    .send({ email, password });
  expect(denied.status).toBe(403);
  expect(denied.body.error.message).toContain('khóa');
  const sessions = await query(
    'SELECT count(*)::int AS n FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL',
    [customer.id],
  );
  expect(sessions.rows[0].n).toBe(0);
  const list = await request(app)
    .get('/admin/nguoi-dung')
    .query({ status: 'blocked', q: email, sort: 'studioCount:desc' })
    .set('Cookie', admin.cookie);
  expect(list.status).toBe(200);
  expect(list.body.items[0]).toMatchObject({
    id: customer.id,
    status: 'blocked',
    role: 'customer',
    studioCount: 0,
    staffStudioCount: 1,
  });
  expect(list.body.items[0].passwordHash).toBeUndefined();
  expect(
    (
      await request(app)
        .patch(endpoint(customer.id))
        .set('Cookie', admin.cookie)
        .send({
          action: 'unblock',
          expectedRole: 'customer',
          expectedBlocked: true,
        })
    ).status,
  ).toBe(200);
  expect((await request(app).get('/me').set('Cookie', cookie)).status).toBe(
    401,
  );
  const newLogin = await request(app)
    .post('/auth/login')
    .send({ email, password });
  expect(newLogin.status).toBe(200);
  const newCookie = (newLogin.headers['set-cookie'] as unknown as string[])
    .map((c: string) => c.split(';')[0])
    .join('; ');
  expect(
    (
      await request(app)
        .patch(endpoint(customer.id))
        .set('Cookie', admin.cookie)
        .send({
          action: 'change_role',
          role: 'studio_owner',
          expectedRole: 'customer',
          expectedBlocked: false,
          reason: 'Owner role assigned by administrator',
        })
    ).status,
  ).toBe(200);
  expect((await request(app).get('/me').set('Cookie', newCookie)).status).toBe(
    401,
  );
  const ownerLogin = await request(app)
    .post('/auth/login')
    .send({ email, password });
  expect(ownerLogin.status).toBe(200);
  expect(ownerLogin.body.user.role).toBe('studio_owner');
  const ownerCookie = (ownerLogin.headers['set-cookie'] as unknown as string[])
    .map((c: string) => c.split(';')[0])
    .join('; ');
  expect(
    (await request(app).get('/me').set('Cookie', ownerCookie)).body.user.role,
  ).toBe('studio_owner');
  expect(
    (await request(app).post('/auth/refresh').set('Cookie', ownerCookie))
      .status,
  ).toBe(200);
  const audit = await query(
    "SELECT action,reason,actor_id FROM admin_activity_log WHERE entity_type='user' AND entity_id=$1 ORDER BY created_at,id",
    [customer.id],
  );
  expect(audit.rows.map((r) => r.action)).toEqual([
    'user.blocked',
    'user.unblocked',
    'user.role_changed',
  ]);
  expect(audit.rows[0]).toMatchObject({
    actor_id: admin.id,
    reason: block.reason,
  });
  // A request authorized before another admin's demotion must re-check the actor under the lock.
  const responses = await Promise.all(
    [
      [admin, other],
      [other, admin],
    ].map(([actor, target]) =>
      request(app).patch(endpoint(target.id)).set('Cookie', actor.cookie).send({
        action: 'change_role',
        role: 'customer',
        expectedRole: 'admin',
        expectedBlocked: false,
        reason: 'Administrative handover between accounts',
      }),
    ),
  );
  expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
  expect(responses.every((r) => [200, 401, 403].includes(r.status))).toBe(true);
  expect(config.COOKIE_NAME).toBeTruthy();
});
