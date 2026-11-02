import { assertCategoryId } from '../../src/modules/catalog/categories.repository.js';
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

it('manages category metadata and atomic ordering while preserving workshop references', async () => {
  const admin = await account('admin'),
    customer = await account('customer');
  const marker = randomUUID();
  expect(
    (await request(app).get('/admin/danh-muc').set('Cookie', customer.cookie))
      .status,
  ).toBe(403);
  const created = await request(app)
    .post('/admin/danh-muc')
    .set('Cookie', admin.cookie)
    .send({ name: 'Test category ' + marker, slug: 'test-' + marker });
  expect(created.status).toBe(201);
  const item = created.body.categories.find(
    (c: { slug: string }) => c.slug === 'test-' + marker,
  );
  expect(item).toMatchObject({ isVisible: true, workshopCount: 0 });
  expect(created.body.categories.at(-1).id).toBe('other');
  const duplicate = await request(app)
    .post('/admin/danh-muc')
    .set('Cookie', admin.cookie)
    .send({ name: 'Other category ' + marker, slug: item.slug });
  expect(duplicate.status).toBe(409);
  expect(
    (
      await request(app)
        .patch(`/admin/danh-muc/${item.id}`)
        .set('Cookie', admin.cookie)
        .send({ name: item.name, slug: 'Not Valid Slug' })
    ).status,
  ).toBe(422);
  const studio = randomUUID();
  await query(
    "INSERT INTO studios(id,name,province_id,address) VALUES($1,'Category studio','ho-chi-minh','Test address')",
    [studio],
  );
  const workshop = randomUUID();
  await query(
    "INSERT INTO workshops(id,studio_id,title,slug,description,category_id,duration_minutes,base_price) VALUES($1,$2,'Category workshop',$3,'Test workshop',$4,90,200000)",
    [workshop, studio, 'category-test-' + workshop, item.id],
  );
  const changed = await request(app)
    .patch(`/admin/danh-muc/${item.id}`)
    .set('Cookie', admin.cookie)
    .send({ name: 'Renamed ' + marker, slug: 'renamed-' + marker });
  expect(changed.status).toBe(200);
  expect(
    changed.body.categories.find((c: { id: string }) => c.id === item.id)
      .workshopCount,
  ).toBe(1);
  expect(
    (await query('SELECT category_id FROM workshops WHERE id=$1', [workshop]))
      .rows[0].category_id,
  ).toBe(item.id);
  expect(
    (
      await request(app)
        .delete(`/admin/danh-muc/${item.id}`)
        .set('Cookie', admin.cookie)
    ).status,
  ).toBe(400);
  const hidden = await request(app)
    .patch(`/admin/danh-muc/${item.id}/visibility`)
    .set('Cookie', admin.cookie)
    .send({ visible: false });
  expect(hidden.status).toBe(200);
  await expect(assertCategoryId(item.id)).rejects.toMatchObject({
    statusCode: 422,
  });
  await expect(assertCategoryId(item.id, workshop)).resolves.toBeUndefined();
  const publicMetadata = await request(app).get('/categories');
  expect(publicMetadata.status).toBe(200);
  expect(
    publicMetadata.body.categories.find(
      (c: { id: string }) => c.id === item.id,
    ),
  ).toMatchObject({ isVisible: false, name: 'Renamed ' + marker });
  expect(publicMetadata.body.categories.at(-1).id).toBe('other');
  // Hidden choices cannot be supplied directly when registering a new studio.
  const formFields = await (
    await import('../helpers/studio-evidence.js')
  ).draftStudioProfile(app, customer.cookie);
  const invalidStudio = await request(app)
    .post('/studios')
    .set('Cookie', customer.cookie)
    .send({
      ...formFields,
      name: 'Invalid category studio',
      categoryIds: [item.id],
      provinceId: 'ho-chi-minh',
      address: 'Test address',
    });
  expect(invalidStudio.status).toBe(422);
  expect(
    (
      await request(app)
        .patch('/admin/danh-muc/other/visibility')
        .set('Cookie', admin.cookie)
        .send({ visible: false })
    ).status,
  ).toBe(400);
  const before = hidden.body.categories.map((c: { id: string }) => c.id);
  const moved = [item.id, ...before.filter((id: string) => id !== item.id)];
  const reorder = await request(app)
    .patch('/admin/danh-muc/order')
    .set('Cookie', admin.cookie)
    .send({ ids: moved, expectedIds: before });
  expect(reorder.status).toBe(200);
  expect(reorder.body.categories[0].id).toBe(item.id);
  expect(reorder.body.categories.at(-1).id).toBe('other');
  expect(
    (
      await request(app)
        .patch('/admin/danh-muc/order')
        .set('Cookie', admin.cookie)
        .send({ ids: before, expectedIds: before })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .patch('/admin/danh-muc/order')
        .set('Cookie', admin.cookie)
        .send({ ids: [...moved].reverse(), expectedIds: moved })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .patch(`/admin/danh-muc/${item.id}/visibility`)
        .set('Cookie', admin.cookie)
        .send({ visible: true })
    ).status,
  ).toBe(200);
  const audit = await query(
    "SELECT count(*)::int AS n FROM admin_activity_log WHERE entity_type='category' AND entity_id=md5($1)::uuid",
    [item.id],
  );
  expect(audit.rows[0].n).toBe(4);
});
