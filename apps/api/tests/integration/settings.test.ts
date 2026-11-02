import {
  defaultSiteSettings,
  createStudioRegistrationSchema,
} from '@workshop/shared';
import { inspectUploadedImage } from '../../src/modules/images/image-storage.js';
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
let original: unknown;
beforeAll(async () => {
  original = (await query("SELECT value FROM settings WHERE key='site'"))
    .rows[0].value;
});
afterAll(async () => {
  try {
    if (original)
      await query("UPDATE settings SET value=$1 WHERE key='site'", [original]);
  } finally {
    vi.unstubAllGlobals();
    await closePool();
  }
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

it('shares validated settings with registration, upload limits, booking policies and atomic audit', async () => {
  const admin = await account('admin'),
    customer = await account('customer'),
    other = await account('customer');
  const endpoint = '/admin/cai-dat';
  expect(
    (await request(app).get(endpoint).set('Cookie', customer.cookie)).status,
  ).toBe(403);
  expect(
    (await request(app).put(endpoint).set('Cookie', customer.cookie).send({}))
      .status,
  ).toBe(403);
  const first = await request(app).get(endpoint).set('Cookie', admin.cookie);
  expect(first.status).toBe(200);
  const settings = {
    ...defaultSiteSettings,
    studio: { minPhotos: 2, maxPhotos: 4, maxImageMb: 2 },
    support: {
      hotline: '1900 9999',
      workingHours: '9:00-18:00',
      email: 'HELP@example.test',
    },
    booking: { cancellationHours: 24, maxActiveSlots: 1 },
  };
  const invalid = await request(app)
    .put(endpoint)
    .set('Cookie', admin.cookie)
    .send({
      settings: { ...settings, studio: { ...settings.studio, minPhotos: 5 } },
      expectedVersion: first.body.version,
    });
  expect(invalid.status).toBe(422);
  expect(
    (
      await query(
        "SELECT count(*)::int AS n FROM audit_logs WHERE actor_id=$1 AND action='settings.updated'",
        [admin.id],
      )
    ).rows[0].n,
  ).toBe(0);
  const saved = await request(app)
    .put(endpoint)
    .set('Cookie', admin.cookie)
    .send({ settings, expectedVersion: first.body.version });
  expect(saved.status).toBe(200);
  settings.support.email = 'help@example.test';
  expect((await request(app).get('/settings')).body).toEqual({ settings });
  expect(
    (
      await request(app)
        .put(endpoint)
        .set('Cookie', admin.cookie)
        .send({ settings, expectedVersion: first.body.version })
    ).status,
  ).toBe(409);
  const log = (
    await query(
      "SELECT * FROM audit_logs WHERE actor_id=$1 AND action='settings.updated'",
      [admin.id],
    )
  ).rows[0];
  expect(log.target_id).toBe('site');
  expect(log.before).toEqual(first.body.settings);
  expect(log.after).toEqual(settings);
  const draft = await request(app)
    .post('/studios/drafts')
    .set('Cookie', customer.cookie);
  const studio = draft.body.studio.id;
  const evidence = await seedStudioEvidence(studio, customer.id);
  const two = { ...evidence, photoIds: evidence.photoIds.slice(0, 2) };
  const profile = {
    draftStudioId: studio,
    name: 'Settings studio',
    categoryId: 'ceramics',
    categoryIds: ['ceramics'],
    provinceId: 'ho-chi-minh',
    address: 'Settings address',
    ...two,
  };
  expect(
    createStudioRegistrationSchema(settings.studio).safeParse(profile).success,
  ).toBe(true);
  expect(
    (
      await request(app)
        .post('/studios')
        .set('Cookie', customer.cookie)
        .send(profile)
    ).status,
  ).toBe(201);
  expect(
    (
      await query(
        'SELECT studio_profile_complete(st) AS complete FROM studios st WHERE id=$1',
        [studio],
      )
    ).rows[0].complete,
  ).toBe(true);
  expect(
    (
      await request(app)
        .patch(`/admin/studios/${studio}/status`)
        .set('Cookie', admin.cookie)
        .send({ status: 'approved' })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .post('/images/upload-url')
        .set('Cookie', customer.cookie)
        .send({ studioId: studio, byteSize: 2 * 1024 * 1024 + 1 })
    ).status,
  ).toBe(422);
  const file = Buffer.alloc(1024 * 1024 + 1);
  file.write('RIFF');
  file.write('WEBP', 8);
  file.write('VP8X', 12);
  file.writeUIntLE(99, 24, 3);
  file.writeUIntLE(99, 27, 3);
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(file, { headers: { 'Content-Type': 'image/webp' } }),
    ),
  );
  await expect(
    inspectUploadedImage('test.webp', file.length, undefined, 2 * 1024 * 1024),
  ).resolves.toBeUndefined();
  await expect(
    inspectUploadedImage('test.webp', file.length, undefined, 1024 * 1024),
  ).rejects.toMatchObject({ statusCode: 422 });
  vi.unstubAllGlobals();
  const workshop = randomUUID();
  await query(
    "INSERT INTO workshops(id,studio_id,title,slug,description,category_id,duration_minutes,base_price,status) VALUES($1,$2,'Settings workshop',$3,'Settings description','ceramics',90,200000,'approved')",
    [workshop, studio, 'settings-' + workshop],
  );
  const slots = [randomUUID(), randomUUID(), randomUUID()];
  for (const [i, id] of slots.entries())
    await query(
      'INSERT INTO sessions(id,workshop_id,starts_at,ends_at,price,capacity,seats_held) VALUES($1,$2,now()+make_interval(hours=>$3),now()+make_interval(hours=>$3+2),200000,10,1)',
      [id, workshop, i === 2 ? 12 : 48 + i],
    );
  const create = async (user: string, slot: string) => {
    const id = randomUUID();
    await query(
      "INSERT INTO bookings(id,user_id,session_id,quantity,unit_price,total_amount,hold_expires_at,order_code) VALUES($1,$2,$3,1,200000,200000,now()+interval '1 hour',$4)",
      [id, user, slot, Date.now() * 1000 + Math.floor(Math.random() * 1000)],
    );
    return id;
  };
  const booking = await create(customer.id, slots[0]);
  await expect(create(customer.id, slots[1])).rejects.toMatchObject({
    code: 'P0001',
  });
  expect(
    (
      await request(app)
        .post(`/me/bookings/${booking}/cancel`)
        .set('Cookie', other.cookie)
        .send({
          status: 'cancelled',
          expectedStatus: 'pending',
          reason: 'Customer requested cancellation',
        })
    ).status,
  ).toBe(404);
  const cancelled = await request(app)
    .post(`/me/bookings/${booking}/cancel`)
    .set('Cookie', customer.cookie)
    .send({
      status: 'cancelled',
      expectedStatus: 'pending',
      reason: 'Customer requested cancellation',
    });
  expect(cancelled.status).toBe(200);
  expect(cancelled.body).toEqual({ ok: true });
  expect(
    (await query('SELECT seats_held FROM sessions WHERE id=$1', [slots[0]]))
      .rows[0].seats_held,
  ).toBe(0);
  const near = await create(customer.id, slots[2]);
  expect(
    (
      await request(app)
        .post(`/me/bookings/${near}/cancel`)
        .set('Cookie', customer.cookie)
        .send({
          status: 'cancelled',
          expectedStatus: 'pending',
          reason: 'Customer requested cancellation',
        })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .patch(`/admin/dat-cho/${near}/status`)
        .set('Cookie', admin.cookie)
        .send({
          status: 'cancelled',
          expectedStatus: 'pending',
          reason: 'Administrator approved special cancellation',
        })
    ).status,
  ).toBe(200);
  const outcomes = await Promise.allSettled([
    create(other.id, slots[0]),
    create(other.id, slots[1]),
  ]);
  expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.filter((o) => o.status === 'rejected')).toHaveLength(1);
});
