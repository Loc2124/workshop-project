import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { createApp } from '../../src/app.js';
import { query } from '../../src/db/pool.js';
import { closeTestPool, getTestPool, withTestDatabase } from '../helpers/database.js';

const app = createApp();

describe('auth module', () => {
  beforeAll(async () => {
    assertSafeTestDatabase();
    const databaseUrl = process.env.DATABASE_URL_TEST;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL_TEST is required for auth integration tests.');
    }
    await migrateDatabase(databaseUrl);
  });

  afterAll(async () => {
    await closeTestPool();
  });

  it('registers a customer, logs in, and exposes current user from the auth cookie', async () => {
    const email = `customer.${randomUUID()}@example.test`;
    const password = 'Password123!';

    const registerResponse = await request(app)
      .post('/auth/register')
      .send({ fullName: 'Nguyen Van A', email, password });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.email).toBe(email.toLowerCase());
    expect(registerResponse.body.user.role).toBe('customer');

    const loginResponse = await request(app)
      .post('/auth/login')
      .send({ email, password });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.email).toBe(email.toLowerCase());
    expect(loginResponse.headers['set-cookie'][0]).toContain('workshop_session=');

    const meResponse = await request(app)
      .get('/me')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.email).toBe(email.toLowerCase());
  });

  it('rejects duplicate emails and invalid credentials without leaking account existence', async () => {
    const email = `duplicate.${randomUUID()}@example.test`;
    const password = 'Password123!';

    await request(app).post('/auth/register').send({
      fullName: 'Nguyen Van B',
      email,
      password,
    });

    const duplicateResponse = await request(app).post('/auth/register').send({
      fullName: 'Nguyen Van C',
      email,
      password: 'Password123!',
    });

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.error.code).toBe('CONFLICT');

    const badLoginResponse = await request(app).post('/auth/login').send({
      email,
      password: 'WrongPassword123!',
    });

    expect(badLoginResponse.status).toBe(401);
    expect(badLoginResponse.body.error.message).toBe(
      'Email hoặc mật khẩu không chính xác.',
    );
  });

  it('requires authentication before accessing protected user data', async () => {
    const protectedResponse = await request(app).get('/me');
    expect(protectedResponse.status).toBe(401);
    expect(protectedResponse.body.error.code).toBe('UNAUTHORIZED');
  });

  it('stores a hashed password and does not return it in the public user payload', async () => {
    const email = `hash.${randomUUID()}@example.test`;
    const password = 'Password123!';

    const registerResponse = await request(app).post('/auth/register').send({
      fullName: 'Hashed User',
      email,
      password,
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user).not.toHaveProperty('passwordHash');

    const result = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1',
      [email.toLowerCase()],
    );

    expect(result.rows[0].password_hash).not.toBe(password);
    expect(result.rows[0].password_hash).toMatch(/^\$argon2/);
  });

  it('rejects a token with a bad signature or expired session', async () => {
    const badTokenResponse = await request(app)
      .get('/me')
      .set('Cookie', 'workshop_session=bad.jwt.token');

    expect(badTokenResponse.status).toBe(401);
    expect(badTokenResponse.body.error.code).toBe('UNAUTHORIZED');
  });

  it('uses a transaction-safe database fixture and never leaks user records across tests', async () => {
    await withTestDatabase(async (client) => {
      const email = `fixture.${randomUUID()}@example.test`;
      const existing = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()],
      );
      expect(existing.rowCount).toBe(0);
    });

    const pool = getTestPool();
    const result = await pool.query(
      'SELECT COUNT(*)::int AS count FROM users WHERE email LIKE $1',
      [`%${randomUUID()}%`],
    );
    expect(result.rows[0].count).toBe(0);
  });
});
