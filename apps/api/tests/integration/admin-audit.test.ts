import { writeAuditLog } from '../../src/modules/admin/audit-log.js';
import { seedStudioEvidence } from '../helpers/studio-evidence.js';
import { randomUUID, createHash } from 'node:crypto';
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
async function account(role: 'admin' | 'customer') {
  const id = randomUUID(),
    sid = randomUUID();
  const config = loadConfig();
  await query(
    'INSERT INTO users(id,email,password_hash,full_name,role) VALUES($1,$2,$3,$4,$5)',
    [
      id,
      `${id}@example.test`,
      'unused-test-hash',
      'Moderation account ' + id,
      role,
    ],
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

it('keeps immutable, transactional snapshots with admin-only filtered reads', async () => {
  const admin = await account('admin'),
    customer = await account('customer');
  const endpoint = '/admin/nhat-ky';
  expect((await request(app).get(endpoint)).status).toBe(401);
  expect(
    (await request(app).get(endpoint).set('Cookie', customer.cookie)).status,
  ).toBe(403);
  const action = await request(app)
    .patch(`/admin/nguoi-dung/${customer.id}`)
    .set('Cookie', admin.cookie)
    .send({
      action: 'block',
      expectedRole: 'customer',
      expectedBlocked: false,
      reason: 'Audit test account block reason',
    });
  expect(action.status).toBe(200);
  let list = await request(app)
    .get(endpoint)
    .set('Cookie', admin.cookie)
    .query({
      actorId: admin.id,
      action: 'user.blocked',
      page: 1,
      pageSize: 1,
      sort: 'createdAt:desc',
    });
  expect(list.status).toBe(200);
  expect(list.body.total).toBe(1);
  expect(list.body.items).toHaveLength(1);
  expect(list.body.items[0]).not.toHaveProperty('before');
  const id = list.body.items[0].id;
  const detail = await request(app)
    .get(`${endpoint}/${id}`)
    .set('Cookie', admin.cookie);
  expect(detail.status).toBe(200);
  expect(detail.body.log).toMatchObject({
    actorId: admin.id,
    targetId: customer.id,
    reason: 'Audit test account block reason',
    before: { is_blocked: false, role: 'customer' },
    after: { is_blocked: true, role: 'customer' },
  });
  expect(detail.body.log.before).not.toHaveProperty('password_hash');
  expect(detail.body.log.after).not.toHaveProperty('password_hash');
  expect(detail.body.log.targetHref).toContain('/admin/nguoi-dung');
  expect(
    (
      await request(app)
        .patch(`${endpoint}/${id}`)
        .set('Cookie', admin.cookie)
        .send({ reason: 'alter' })
    ).status,
  ).toBe(404);
  expect(
    (await request(app).delete(`${endpoint}/${id}`).set('Cookie', admin.cookie))
      .status,
  ).toBe(404);
  await expect(
    query('UPDATE audit_logs SET reason=$2 WHERE id=$1', [id, 'tampered']),
  ).rejects.toMatchObject({ code: '42501' });
  await expect(
    query('DELETE FROM audit_logs WHERE id=$1', [id]),
  ).rejects.toMatchObject({ code: '42501' });
  await expect(query('TRUNCATE audit_logs')).rejects.toMatchObject({
    code: '42501',
  });
  const marker = randomUUID();
  const created = await request(app)
    .post('/admin/danh-muc')
    .set('Cookie', admin.cookie)
    .send({ name: 'Audit category ' + marker, slug: 'audit-' + marker });
  expect(created.status).toBe(201);
  const category = created.body.categories.find(
    (c: { slug: string }) => c.slug === 'audit-' + marker,
  );
  const cat = (
    await query('SELECT * FROM audit_logs WHERE actor_id=$1 AND target_id=$2', [
      admin.id,
      category.id,
    ])
  ).rows[0];
  expect(cat.before).toBeNull();
  expect(cat.after.name).toBe('Audit category ' + marker);
  expect(cat.target_type).toBe('category');
  expect(
    (
      await request(app)
        .patch(`/admin/danh-muc/${category.id}`)
        .set('Cookie', admin.cookie)
        .send({ name: 'Changed ' + marker, slug: category.slug })
    ).status,
  ).toBe(200);
  const catEdit = (
    await query(
      'SELECT * FROM audit_logs WHERE actor_id=$1 AND target_id=$2 ORDER BY created_at DESC,id DESC',
      [admin.id, category.id],
    )
  ).rows[0];
  expect(catEdit.before.name).toBe(category.name);
  expect(catEdit.after.name).toBe('Changed ' + marker);
  const studio = randomUUID(),
    workshop = randomUUID(),
    slot = randomUUID(),
    booking = randomUUID();
  await query(
    "INSERT INTO studios(id,name,province_id,address) VALUES($1,'Audit studio','ho-chi-minh','Audit address')",
    [studio],
  );
  await query(
    "INSERT INTO studio_members(studio_id,user_id,role) VALUES($1,$2,'owner')",
    [studio, customer.id],
  );
  await seedStudioEvidence(studio, customer.id);
  expect(
    (
      await request(app)
        .patch(`/admin/studios/${studio}/status`)
        .set('Cookie', admin.cookie)
        .send({ status: 'approved' })
    ).status,
  ).toBe(200);
  const st = (
    await query(
      "SELECT * FROM audit_logs WHERE target_id=$1 AND action='studio.approved'",
      [studio],
    )
  ).rows[0];
  expect(st.before.status).toBe('pending');
  expect(st.after.status).toBe('approved');
  await query(
    "INSERT INTO workshops(id,studio_id,title,slug,description,category_id,duration_minutes,base_price,status) VALUES($1,$2,'Audit workshop',$3,'Audit description','ceramics',90,200000,'approved')",
    [workshop, studio, 'audit-' + workshop],
  );
  expect(
    (
      await request(app)
        .patch(`/admin/workshop/${workshop}/visibility`)
        .set('Cookie', admin.cookie)
        .send({
          status: 'removed',
          reason: 'Audit workshop removal reason',
        })
    ).status,
  ).toBe(200);
  const ws = (
    await query(
      "SELECT * FROM audit_logs WHERE target_id=$1 AND action='workshop.removed'",
      [workshop],
    )
  ).rows[0];
  expect(ws.before.visibility_status).toBe('active');
  expect(ws.after.visibility_status).toBe('removed');
  await query(
    "INSERT INTO sessions(id,workshop_id,starts_at,ends_at,price,capacity,seats_held) VALUES($1,$2,now()+interval '2 days',now()+interval '2 days 90 minutes',200000,8,2)",
    [slot, workshop],
  );
  await query(
    "INSERT INTO bookings(id,user_id,session_id,quantity,unit_price,total_amount,hold_expires_at,order_code) VALUES($1,$2,$3,2,200000,400000,now()+interval '1 hour',$4)",
    [
      booking,
      customer.id,
      slot,
      Date.now() * 1000 + Math.floor(Math.random() * 1000),
    ],
  );
  expect(
    (
      await request(app)
        .patch(`/admin/dat-cho/${booking}/status`)
        .set('Cookie', admin.cookie)
        .send({
          status: 'cancelled',
          expectedStatus: 'pending',
          reason: 'Audit booking cancellation reason',
        })
    ).status,
  ).toBe(200);
  const bk = (
    await query(
      "SELECT * FROM audit_logs WHERE target_id=$1 AND action='booking.cancelled'",
      [booking],
    )
  ).rows[0];
  expect(bk.before.reservation_status).toBe('pending');
  expect(bk.after.reservation_status).toBe('cancelled');
  await expect(
    withTransaction(async (client) => {
      await client.query('UPDATE categories SET name=$2 WHERE id=$1', [
        category.id,
        'Rolled back',
      ]);
      await writeAuditLog(client, {
        actorId: admin.id,
        action: 'test.rollback',
        targetType: 'category',
        targetId: category.id,
        targetName: 'Rolled back',
      });
      throw Error('abort');
    }),
  ).rejects.toThrow('abort');
  expect(
    (
      await query(
        "SELECT count(*)::int AS n FROM audit_logs WHERE actor_id=$1 AND action='test.rollback'",
        [admin.id],
      )
    ).rows[0].n,
  ).toBe(0);
  const opts = await request(app)
    .get(`${endpoint}/filters`)
    .query({ q: admin.id })
    .set('Cookie', admin.cookie);
  expect(opts.status).toBe(200);
  expect(
    opts.body.actors.some((a: { value: string }) => a.value === admin.id),
  ).toBe(true);
  expect(
    opts.body.actions.some(
      (a: { value: string }) => a.value === 'user.blocked',
    ),
  ).toBe(true);
  expect(
    (
      await request(app)
        .get(endpoint)
        .set('Cookie', admin.cookie)
        .query({ dateFrom: '2026-02-30' })
    ).status,
  ).toBe(422);
  expect(
    (
      await request(app)
        .get(endpoint)
        .set('Cookie', admin.cookie)
        .query({ sort: 'action;DROP:asc' })
    ).status,
  ).toBe(422);
  expect(
    (
      await request(app)
        .get(endpoint)
        .set('Cookie', admin.cookie)
        .query({ dateFrom: '2026-11-04', dateTo: '2026-11-03' })
    ).status,
  ).toBe(422);
  list = await request(app).get(endpoint).set('Cookie', admin.cookie).query({
    actorId: admin.id,
    q: marker,
    pageSize: 1,
    page: 2,
    sort: 'createdAt:asc',
  });
  expect(list.status).toBe(200);
  expect(list.body.items).toHaveLength(1);
  expect(list.body.total).toBe(2);
  expect(
    (
      await request(app)
        .get(`${endpoint}/${randomUUID()}`)
        .set('Cookie', admin.cookie)
    ).status,
  ).toBe(404);
});
