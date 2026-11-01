import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { createApp } from '../../src/app.js';
import { query } from '../../src/db/pool.js';
import { closeTestPool } from '../helpers/database.js';

const app = createApp();

describe('studio and admin module', () => {
  beforeAll(async () => {
    assertSafeTestDatabase();
    const databaseUrl = process.env.DATABASE_URL_TEST;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL_TEST is required for studio flow tests.');
    }
    await migrateDatabase(databaseUrl);
  });

  afterAll(async () => {
    await closeTestPool();
  });

  it('creates a pending studio without changing the user system role', async () => {
    const email = `studio.${randomUUID()}@example.test`;
    const password = 'Password123!';

    await request(app).post('/auth/register').send({
      fullName: 'Studio Owner',
      email,
      password,
    });

    const login = await request(app).post('/auth/login').send({
      email,
      password,
    });

    const profile = await request(app)
      .post('/studios')
      .set('Cookie', login.headers['set-cookie'][0])
      .send({
        name: 'Làng Gốm Mới',
        description: 'Workshop làm gốm thủ công cho các nhóm bạn.',
        provinceId: 'ho-chi-minh',
        address: '123 Đường Sáng Tạo',
      });

    expect(profile.status).toBe(201);
    expect(profile.body.studio.status).toBe('pending');
    expect(profile.body.studio.name).toBe('Làng Gốm Mới');

    const me = await request(app)
      .get('/me')
      .set('Cookie', login.headers['set-cookie'][0]);
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('customer');

    const membership = await query<{ role: string }>(
      `SELECT role
       FROM studio_members
       WHERE studio_id = $1 AND user_id = $2`,
      [profile.body.studio.id, me.body.user.id],
    );
    expect(membership.rows[0].role).toBe('owner');
  });

  it('allows admins to approve studios and blocks customers from admin routes', async () => {
    const customerEmail = `customer.${randomUUID()}@example.test`;
    const customerPassword = 'Password123!';
    await request(app).post('/auth/register').send({
      fullName: 'Customer Test',
      email: customerEmail,
      password: customerPassword,
    });
    const customerLogin = await request(app).post('/auth/login').send({
      email: customerEmail,
      password: customerPassword,
    });
    const studioProfile = await request(app)
      .post('/studios')
      .set('Cookie', customerLogin.headers['set-cookie'][0])
      .send({
        name: 'Workshop Cắm Hoa',
        description: 'Workshop cắm hoa cho gia đình.',
        provinceId: 'ho-chi-minh',
        address: '456 Đường Cây Cỏ',
      });
    expect(studioProfile.status).toBe(201);

    const adminEmail = `admin.${randomUUID()}@example.test`;
    const adminPassword = 'Password123!';
    await query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'admin')`,
      [adminEmail, await argon2.hash(adminPassword), 'System Admin'],
    );
    const adminLogin = await request(app).post('/auth/login').send({
      email: adminEmail,
      password: adminPassword,
    });

    const list = await request(app)
      .get('/admin/studios')
      .set('Cookie', adminLogin.headers['set-cookie'][0]);
    expect(list.status).toBe(200);
    expect(
      list.body.studios.some(
        (studio: { id: string }) => studio.id === studioProfile.body.studio.id,
      ),
    ).toBe(true);

    const approval = await request(app)
      .patch(`/admin/studios/${studioProfile.body.studio.id}/status`)
      .set('Cookie', adminLogin.headers['set-cookie'][0])
      .send({ status: 'approved' });
    expect(approval.status).toBe(200);
    expect(approval.body.studio.status).toBe('approved');

    const forbidden = await request(app)
      .get('/admin/studios')
      .set('Cookie', customerLogin.headers['set-cookie'][0]);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });
});
