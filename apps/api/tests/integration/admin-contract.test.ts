import * as db from '../../src/db/pool.js';
import {
  listAdminUsers,
  userListQuery,
} from '../../src/modules/admin/admin-users.js';
import {
  listAdminBookings,
  adminBookingsQuery,
} from '../../src/modules/admin/admin-bookings.js';
import {
  listModeratedWorkshops,
  moderationQuery,
} from '../../src/modules/admin/workshop-moderation.js';
import {
  listReports,
  reportsQuery,
} from '../../src/modules/reports/reports.repository.js';
import { randomUUID, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { query, closePool } from '../../src/db/pool.js';
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

it('guards the whole namespace and provides bounded uniform lists plus aggregate-only counts', async () => {
  const admin = await account('admin'),
    customer = await account('customer'),
    demoted = await account('admin');
  const denied = await request(app)
    .get('/admin/unknown-route')
    .set('Cookie', customer.cookie);
  expect(denied.status).toBe(403);
  expect(denied.body.error.code).toBe('FORBIDDEN');
  expect(
    (
      await request(app)
        .post('/admin/unknown-route')
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(403);
  expect(
    (await request(app).get('/admin/unknown-route').set('Cookie', admin.cookie))
      .status,
  ).toBe(404);
  await query("UPDATE users SET role='customer' WHERE id=$1", [demoted.id]);
  expect(
    (await request(app).get('/admin/overview').set('Cookie', demoted.cookie))
      .status,
  ).toBe(403);
  const marker = 'contract-' + randomUUID();
  await query(
    "INSERT INTO users(email,password_hash,full_name,role) SELECT $1||n||'@example.test','unused-test-hash',$1||n,'customer' FROM generate_series(1,25)n",
    [marker],
  );
  const resources = [
    'studios',
    'workshops',
    'workshop',
    'nguoi-dung',
    'dat-cho',
    'bao-cao',
    'nhat-ky',
    'danh-muc',
    'mau-thong-bao',
    'users',
    'bookings',
    'reports',
    'workshop-studios',
    'noi-dung/search',
  ];
  for (const resource of resources) {
    const path = '/admin/' + resource;
    const extra = resource === 'noi-dung/search' ? { type: 'studio' } : {};
    const list = await request(app)
      .get(path)
      .set('Cookie', admin.cookie)
      .query({ page: 1, pageSize: 1, q: marker, status: 'all', ...extra });
    expect(list.status, resource + JSON.stringify(list.body)).toBe(200);
    expect(Object.keys(list.body).sort()).toEqual(['items', 'total']);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.length).toBeLessThanOrEqual(1);
    expect(Number.isInteger(list.body.total)).toBe(true);
    const bad = await request(app)
      .get(path)
      .set('Cookie', admin.cookie)
      .query({ pageSize: 101, ...extra });
    expect(bad.status, resource).toBe(422);
  }
  const defaults = await request(app)
    .get('/admin/nguoi-dung')
    .set('Cookie', admin.cookie)
    .query({ q: marker });
  expect(defaults.body.items).toHaveLength(20);
  expect(defaults.body.total).toBe(25);
  const second = await request(app)
    .get('/admin/nguoi-dung')
    .set('Cookie', admin.cookie)
    .query({ q: marker, page: 2, pageSize: 20 });
  expect(second.body.items).toHaveLength(5);
  expect(second.body.total).toBe(25);
  const counts = await request(app)
    .get('/admin/nguoi-dung/counts')
    .set('Cookie', admin.cookie)
    .query({ q: marker, page: 9, pageSize: 1, status: 'admin' });
  expect(counts.body.counts).toMatchObject({ all: 25, customer: 25, admin: 0 });
  expect(counts.body).not.toHaveProperty('items');
  const filtered = await request(app)
    .get('/admin/nguoi-dung/counts')
    .set('Cookie', admin.cookie)
    .query({ q: marker + 'missing' });
  expect(filtered.body.counts.all).toBe(0);
  const spy = vi.spyOn(db, 'query');
  try {
    await listAdminUsers(userListQuery.parse({ q: marker }), true);
    await listAdminBookings(adminBookingsQuery.parse({ q: marker }), true);
    await listModeratedWorkshops(moderationQuery.parse({ q: marker }), true);
    await listReports(reportsQuery.parse({ q: marker }), true);
    expect(spy.mock.calls).toHaveLength(4);
    for (const [sql] of spy.mock.calls) {
      expect(sql).toMatch(/count\(/i);
      expect(sql).not.toMatch(/\bLIMIT\b|json_agg|reviewHistory/i);
    }
  } finally {
    spy.mockRestore();
  }
});
