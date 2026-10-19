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

describe('organizer and admin module', () => {
  beforeAll(async () => {
    assertSafeTestDatabase();
    const databaseUrl = process.env.DATABASE_URL_TEST;
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL_TEST is required for organizer flow tests.',
      );
    }
    await migrateDatabase(databaseUrl);
  });

  afterAll(async () => {
    await closeTestPool();
  });

  it('creates a pending organizer profile and updates the user role to organizer', async () => {
    const email = `organizer.${randomUUID()}@example.test`;
    const password = 'Password123!';

    await request(app).post('/auth/register').send({
      fullName: 'Organizer User',
      email,
      password,
    });

    const loginResponse = await request(app).post('/auth/login').send({
      email,
      password,
    });

    const profileResponse = await request(app)
      .post('/organizer/profile')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        name: 'Làng Gốm Mới',
        description: 'Workshop làm gốm thủ công cho các nhóm bạn.',
        address: '123 Đường Sáng Tạo',
        district: 'Quận 1',
      });

    expect(profileResponse.status).toBe(201);
    expect(profileResponse.body.organizer.status).toBe('pending');
    expect(profileResponse.body.organizer.name).toBe('Làng Gốm Mới');

    const meResponse = await request(app)
      .get('/me')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.role).toBe('organizer');
    expect(meResponse.body.user.organizerId).toBe(
      profileResponse.body.organizer.id,
    );
  });

  it('allows admin approval flow and blocks customers from admin routes', async () => {
    const customerEmail = `customer.${randomUUID()}@example.test`;
    const customerPassword = 'Password123!';

    const customerRegister = await request(app).post('/auth/register').send({
      fullName: 'Customer Test',
      email: customerEmail,
      password: customerPassword,
    });

    expect(customerRegister.status).toBe(201);

    const customerLogin = await request(app).post('/auth/login').send({
      email: customerEmail,
      password: customerPassword,
    });

    const organizerProfile = await request(app)
      .post('/organizer/profile')
      .set('Cookie', customerLogin.headers['set-cookie'][0])
      .send({
        name: 'Workshop Cắm Hoa',
        description: 'Workshop cắm hoa cho gia đình.',
        address: '456 Đường Cây Cỏ',
        district: 'Quận 7',
      });

    expect(organizerProfile.status).toBe(201);

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

    const listResponse = await request(app)
      .get('/admin/organizers')
      .set('Cookie', adminLogin.headers['set-cookie'][0]);

    expect(listResponse.status).toBe(200);
    expect(
      listResponse.body.organizers.some(
        (organizer: { id: string }) =>
          organizer.id === organizerProfile.body.organizer.id,
      ),
    ).toBe(true);

    const approvalResponse = await request(app)
      .patch(`/admin/organizers/${organizerProfile.body.organizer.id}/status`)
      .set('Cookie', adminLogin.headers['set-cookie'][0])
      .send({ status: 'approved' });

    expect(approvalResponse.status).toBe(200);
    expect(approvalResponse.body.organizer.status).toBe('approved');

    const forbiddenResponse = await request(app)
      .get('/admin/organizers')
      .set('Cookie', customerLogin.headers['set-cookie'][0]);

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.error.code).toBe('FORBIDDEN');
  });
});
