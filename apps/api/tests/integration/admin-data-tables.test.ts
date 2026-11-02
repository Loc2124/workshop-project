import { randomUUID, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { query, closePool } from '../../src/db/pool.js';
import { loadConfig } from '../../src/config.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
const app = createApp();
const marker = `admin-table-${randomUUID()}`;
let adminCookie: string;
let customerCookie: string;
vi.setConfig({ hookTimeout: 60000, testTimeout: 60000 });
beforeAll(async () => {
  assertSafeTestDatabase();
  await migrateDatabase(process.env.DATABASE_URL_TEST!);
  const config = loadConfig();
  async function account(role: 'admin' | 'customer') {
    const id = randomUUID(),
      sid = randomUUID();
    await query(
      'INSERT INTO users(id,email,password_hash,full_name,role) VALUES($1,$2,$3,$4,$5)',
      [
        id,
        `${id}@example.test`,
        'unused-test-password-hash',
        'Admin table owner',
        role,
      ],
    );
    await query(
      `INSERT INTO auth_sessions(id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 day')`,
      [sid, id, createHash('sha256').update(randomUUID()).digest('hex')],
    );
    return {
      id,
      cookie: `${config.COOKIE_NAME}=${jwt.sign({ sub: id, sid, role }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })}`,
    };
  }
  adminCookie = (await account('admin')).cookie;
  const owner = await account('customer');
  customerCookie = owner.cookie;
  for (const [index, status] of [
    'pending',
    'approved',
    'rejected',
    'needs_changes',
  ].entries()) {
    const id = randomUUID();
    await query(
      'INSERT INTO studios(id,name,slug,address,province_id,category_id,status) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        id,
        `${marker} ${['Alpha', 'Beta', 'Gamma', 'Literal%'][index]}`,
        id,
        'Test address',
        index % 2 ? 'ha-noi' : 'ho-chi-minh',
        'ceramics',
        status,
      ],
    );
    await query(
      `INSERT INTO studio_members(studio_id,user_id,role) VALUES($1,$2,'owner')`,
      [id, owner.id],
    );
    await query(
      `INSERT INTO studio_categories(studio_id,category_id) VALUES($1,'ceramics')`,
      [id],
    );
    if (index < 3)
      await query(
        'INSERT INTO workshops(studio_id,title,slug,description,category_id,duration_minutes,base_price,status) VALUES($1,$2,$3,$4,$5,90,$6,$7)',
        [
          id,
          `${marker} ${['Alpha', 'Beta', 'Gamma'][index]}`,
          randomUUID(),
          'Test workshop',
          'ceramics',
          [200000, 100000, 300000][index],
          status,
        ],
      );
  }
});
afterAll(closePool);
describe('server admin DataTable contracts', () => {
  it('paginates and sorts studios while counting all filtered statuses, not only the current page or tab', async () => {
    const page = await request(app)
      .get('/admin/studios')
      .query({
        q: marker,
        status: 'all',
        page: 2,
        pageSize: 1,
        sort: 'name:asc',
      })
      .set('Cookie', adminCookie);
    expect(page.status).toBe(200);
    expect(page.body.items.map((row: { name: string }) => row.name)).toEqual([
      `${marker} Beta`,
    ]);
    expect(page.body.total).toBe(4);
    expect(
      (
        await request(app)
          .get('/admin/studios/counts')
          .query({ q: marker })
          .set('Cookie', adminCookie)
      ).body.counts,
    ).toEqual({
      suspended: 0,
      pending: 1,
      needs_changes: 1,
      approved: 1,
      rejected: 1,
      all: 4,
    });
    const filtered = await request(app)
      .get('/admin/studios')
      .query({
        q: marker,
        status: 'pending',
        provinceId: 'ha-noi',
        categoryId: 'ceramics',
        page: 1,
        pageSize: 20,
      })
      .set('Cookie', adminCookie);
    expect(filtered.status).toBe(200);
    expect(filtered.body.items).toEqual([]);
    expect(filtered.body.total).toBe(0);
    expect(
      (
        await request(app)
          .get('/admin/studios/counts')
          .query({ q: marker, provinceId: 'ha-noi', categoryId: 'ceramics' })
          .set('Cookie', adminCookie)
      ).body.counts,
    ).toMatchObject({
      pending: 0,
      approved: 1,
      needs_changes: 1,
      all: 2,
    });
    const literal = await request(app)
      .get('/admin/studios')
      .query({ q: `${marker} Literal%`, page: 1, pageSize: 20 })
      .set('Cookie', adminCookie);
    expect(literal.status).toBe(200);
    expect(literal.body.total).toBe(1);
  });
  it('sorts workshops by price on the server and returns status counts across tabs', async () => {
    const list = await request(app)
      .get('/admin/workshops')
      .query({
        q: marker,
        status: 'all',
        page: 1,
        pageSize: 2,
        sort: 'basePrice:asc',
      })
      .set('Cookie', adminCookie);
    expect(list.status).toBe(200);
    expect(
      list.body.items.map((row: { basePrice: number }) => row.basePrice),
    ).toEqual([100000, 200000]);
    expect(list.body.total).toBe(3);
    expect(
      (
        await request(app)
          .get('/admin/workshops/counts')
          .query({ q: marker })
          .set('Cookie', adminCookie)
      ).body.counts,
    ).toMatchObject({
      pending: 1,
      approved: 1,
      rejected: 1,
      all: 3,
    });
    const filtered = await request(app)
      .get('/admin/workshops')
      .query({
        q: marker,
        status: 'all',
        provinceId: 'ha-noi',
        page: 1,
        pageSize: 20,
      })
      .set('Cookie', adminCookie);
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.items[0].basePrice).toBe(100000);
  });
  it('keeps the endpoints admin-only and rejects non-allowlisted sort expressions', async () => {
    expect(
      (
        await request(app)
          .get('/admin/studios?page=1')
          .set('Cookie', customerCookie)
      ).status,
    ).toBe(403);
    expect((await request(app).get('/admin/workshops?page=1')).status).toBe(
      401,
    );
    expect(
      (
        await request(app)
          .get('/admin/studios')
          .query({ page: 1, sort: 'password_hash:desc' })
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .get('/admin/workshops')
          .query({ page: 1, sort: 'title:asc;drop table users' })
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(422);
  });
});
