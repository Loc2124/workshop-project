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
let original: {
  type: string;
  target_id: string;
  sort_order: number;
  deleted_at: Date | null;
}[] = [];
beforeAll(async () => {
  original = (
    await query<{
      type: string;
      target_id: string;
      sort_order: number;
      deleted_at: Date | null;
    }>('SELECT type,target_id,sort_order,deleted_at FROM featured_items')
  ).rows;
});
afterAll(async () => {
  try {
    await query('DELETE FROM featured_items');
    for (const row of original)
      await query(
        'INSERT INTO featured_items(type,target_id,sort_order,deleted_at) VALUES($1,$2,$3,$4)',
        [row.type, row.target_id, row.sort_order, row.deleted_at],
      );
  } finally {
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

it('publishes ordered eligible selections with latest fallback and keeps previews separate from saved content', async () => {
  const admin = await account('admin'),
    owner = await account('customer');
  const studios = Array.from({ length: 9 }, () => randomUUID()),
    workshops = Array.from({ length: 12 }, () => randomUUID());
  for (const [index, id] of studios.entries()) {
    await query(
      "INSERT INTO studios(id,name,province_id,address,status,created_at) VALUES($1,$2,'ho-chi-minh','Featured studio address','approved',now()+interval '1 year'-$3*interval '1 minute')",
      [id, `Featured studio ${index}`, index],
    );
    await query(
      "INSERT INTO studio_members(studio_id,user_id,role) VALUES($1,$2,'owner')",
      [id, owner.id],
    );
    await seedStudioEvidence(id, owner.id);
  }
  for (const [index, id] of workshops.entries())
    await query(
      "INSERT INTO workshops(id,studio_id,title,slug,description,category_id,duration_minutes,base_price,status,created_at) VALUES($1,$2,$3,$4,'Featured workshop description','ceramics',90,200000,'approved',now()+interval '1 year'-$5*interval '1 minute')",
      [
        id,
        studios[index % studios.length],
        `Featured workshop ${index}`,
        'featured-' + id,
        index,
      ],
    );
  expect(
    (await request(app).get('/admin/noi-dung').set('Cookie', owner.cookie))
      .status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .post('/admin/noi-dung/preview')
        .set('Cookie', owner.cookie)
        .send({ studioIds: [], workshopIds: [] })
    ).status,
  ).toBe(403);
  await query(
    `INSERT INTO sessions(workshop_id,starts_at,ends_at,price,capacity,seats_sold)
    VALUES ($1,now()+interval '7 days',now()+interval '7 days 2 hours',345000,10,0),
      ($1,now()+interval '8 days',now()+interval '8 days 2 hours',400000,10,0),
      ($1,now()-interval '2 days',now()-interval '1 day',1000,10,0),
      ($1,now()+interval '9 days',now()+interval '9 days 2 hours',2000,10,10)`,
    [workshops[7]],
  );
  const expiredSessionId = randomUUID();
  await query(
    `INSERT INTO sessions(id,workshop_id,starts_at,ends_at,price,capacity,seats_held)
     VALUES($1,$2,now()+interval '10 days',now()+interval '10 days 2 hours',345000,10,1)`,
    [expiredSessionId, workshops[7]],
  );
  const expiredBookingId = randomUUID();
  await query(
    `INSERT INTO bookings(
       id,user_id,session_id,quantity,unit_price,total_amount,hold_expires_at,order_code
     ) VALUES($1,$2,$3,1,345000,345000,now()-interval '1 minute',$4)`,
    [
      expiredBookingId,
      owner.id,
      expiredSessionId,
      Date.now() + Number.parseInt(randomUUID().slice(0, 8), 16),
    ],
  );
  const before = await request(app)
    .get('/admin/noi-dung')
    .set('Cookie', admin.cookie);
  expect(before.status).toBe(200);
  const expected = {
    studioIds: before.body.studioIds,
    workshopIds: before.body.workshopIds,
  };
  const selection = {
    studioIds: [studios[7], studios[5]],
    workshopIds: [workshops[10], workshops[8]],
  };
  const save = await request(app)
    .put('/admin/noi-dung')
    .set('Cookie', admin.cookie)
    .send({ ...selection, expected });
  expect(save.status).toBe(200);
  expect(save.body.studioIds).toEqual(selection.studioIds);
  expect(save.body.workshopIds).toEqual(selection.workshopIds);
  const published = await request(app).get('/home/featured');
  expect(published.status).toBe(200);
  expect(published.body.studios).toHaveLength(6);
  expect(published.body.workshops).toHaveLength(8);
  expect(published.body.studios[0]).toMatchObject({
    id: studios[7],
    categoryId: 'other',
    provinceId: 'ho-chi-minh',
    address: 'Featured studio address',
    workshopCount: 1,
    availableSessions: 3,
    startingPrice: 345000,
  });
  expect(
    (
      await query<{ status: string }>(
        'SELECT status FROM bookings WHERE id=$1',
        [expiredBookingId],
      )
    ).rows[0].status,
  ).toBe('expired');
  expect(
    (
      await query<{ seats_held: number }>(
        'SELECT seats_held FROM sessions WHERE id=$1',
        [expiredSessionId],
      )
    ).rows[0].seats_held,
  ).toBe(0);
  expect(published.body.studios[1]).toMatchObject({
    id: studios[5],
    workshopCount: 0,
    availableSessions: 0,
    startingPrice: null,
  });
  expect(
    published.body.studios.slice(0, 3).map((s: { id: string }) => s.id),
  ).toEqual([studios[7], studios[5], studios[0]]);
  expect(
    published.body.workshops.slice(0, 3).map((w: { id: string }) => w.id),
  ).toEqual([workshops[10], workshops[8], workshops[0]]);
  const preview = await request(app)
    .post('/admin/noi-dung/preview')
    .set('Cookie', admin.cookie)
    .send({ studioIds: [studios[6]], workshopIds: [workshops[6]] });
  expect(preview.status).toBe(200);
  expect(preview.body.studios[0].id).toBe(studios[6]);
  expect(preview.body.workshops[0].id).toBe(workshops[6]);
  expect(
    (await request(app).get('/admin/noi-dung').set('Cookie', admin.cookie)).body
      .studioIds,
  ).toEqual(selection.studioIds);
  expect(
    (
      await request(app)
        .put('/admin/noi-dung')
        .set('Cookie', admin.cookie)
        .send({
          ...selection,
          studioIds: studios.slice(0, 7),
          expected: selection,
        })
    ).status,
  ).toBe(422);
  expect(
    (
      await request(app)
        .put('/admin/noi-dung')
        .set('Cookie', admin.cookie)
        .send({
          ...selection,
          workshopIds: [workshops[0], workshops[0]],
          expected: selection,
        })
    ).status,
  ).toBe(422);
  expect(
    (
      await request(app)
        .put('/admin/noi-dung')
        .set('Cookie', admin.cookie)
        .send({ ...selection, expected: { studioIds: [], workshopIds: [] } })
    ).status,
  ).toBe(409);
  await query("UPDATE studios SET status='suspended' WHERE id=$1", [
    studios[7],
  ]);
  await query("UPDATE workshops SET visibility_status='hidden' WHERE id=$1", [
    workshops[10],
  ]);
  const filled = await request(app).get('/home/featured');
  expect(filled.status).toBe(200);
  expect(filled.body.studios).toHaveLength(6);
  expect(filled.body.workshops).toHaveLength(8);
  expect(filled.body.studios[0].id).toBe(studios[5]);
  expect(filled.body.workshops[0].id).toBe(workshops[8]);
  expect(
    filled.body.studios.some((s: { id: string }) => s.id === studios[7]),
  ).toBe(false);
  expect(
    filled.body.workshops.some(
      (w: { id: string; studioId?: string }) =>
        w.id === workshops[10] || w.studioId === studios[7],
    ),
  ).toBe(false);
  expect(
    (
      await request(app)
        .put('/admin/noi-dung')
        .set('Cookie', admin.cookie)
        .send({ ...selection, expected: selection })
    ).status,
  ).toBe(400);
  const config = await request(app)
    .get('/admin/noi-dung')
    .set('Cookie', admin.cookie);
  expect(
    config.body.items.find(
      (i: { targetId: string }) => i.targetId === studios[7],
    ).eligible,
  ).toBe(false);
  const choices = await request(app)
    .get('/admin/noi-dung/search')
    .query({ type: 'studio', q: 'Featured studio' })
    .set('Cookie', admin.cookie);
  expect(choices.status).toBe(200);
  expect(
    choices.body.items.every((i: { eligible: boolean }) => i.eligible),
  ).toBe(true);
  expect(
    choices.body.items.some(
      (i: { targetId: string }) => i.targetId === studios[7],
    ),
  ).toBe(false);
  const clear = await request(app)
    .put('/admin/noi-dung')
    .set('Cookie', admin.cookie)
    .send({ studioIds: [], workshopIds: [], expected: selection });
  expect(clear.status).toBe(200);
  const tombstones = await query(
    "SELECT deleted_at FROM featured_items WHERE type='studio' AND target_id=ANY($1::uuid[])",
    [selection.studioIds],
  );
  expect(tombstones.rows).toHaveLength(selection.studioIds.length);
  expect(tombstones.rows.every((r) => r.deleted_at !== null)).toBe(true);
  const latest = await request(app).get('/home/featured');
  expect(latest.body.studios[0].id).toBe(studios[0]);
  expect(latest.body.workshops[0].id).toBe(workshops[0]);
  const audit = await query(
    "SELECT count(*)::int AS n FROM admin_activity_log WHERE actor_id=$1 AND action='featured.updated'",
    [admin.id],
  );
  expect(audit.rows[0].n).toBe(2);
});
