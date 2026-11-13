vi.mock('../../src/modules/auth/password-check.js', () => ({
  assertPasswordNotCompromised: vi.fn().mockResolvedValue(undefined),
}));
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { query } from '../../src/db/pool.js';
import {
  closeTestPool,
  getTestPool,
  withTestDatabase,
} from '../helpers/database.js';

const app = createApp();
vi.setConfig({ testTimeout: 30_000 });

describe('auth module', () => {
  beforeAll(async () => {
    assertSafeTestDatabase();
    const databaseUrl = process.env.DATABASE_URL_TEST;
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL_TEST is required for auth integration tests.',
      );
    }
    await migrateDatabase(databaseUrl);
  });

  afterAll(async () => {
    await closeTestPool();
  });

  it('registers a customer, logs in, and exposes current user from the auth cookie', async () => {
    const email = `customer.${randomUUID()}@example.test`;
    const password = 'WillowFern72!';

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
    expect(loginResponse.body).not.toHaveProperty('token');
    expect(loginResponse.body).not.toHaveProperty('refreshToken');
    const accessCookie = cookieFrom(loginResponse, loadConfig().COOKIE_NAME);
    const refreshCookie = cookieFrom(
      loginResponse,
      loadConfig().REFRESH_COOKIE_NAME,
    );
    const setCookies = loginResponse.headers['set-cookie'] as unknown as string[];
    const accessSetCookie = setCookies.find((value) =>
      value.startsWith(`${loadConfig().COOKIE_NAME}=`),
    );
    const refreshSetCookie = setCookies.find((value) =>
      value.startsWith(`${loadConfig().REFRESH_COOKIE_NAME}=`),
    );
    expect(accessSetCookie).toContain('Path=/;');
    expect(accessSetCookie).toContain('HttpOnly');
    expect(accessSetCookie).toContain('Max-Age=900');
    expect(refreshSetCookie).toContain('Path=/auth;');
    expect(refreshSetCookie).toContain('HttpOnly');
    expect(refreshSetCookie).toContain('Max-Age=1209600');

    const meResponse = await request(app)
      .get('/me')
      .set('Cookie', `${accessCookie}; ${refreshCookie}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.email).toBe(email.toLowerCase());
  });

  it('rotates refresh tokens and rejects replay without invalidating the active session', async () => {
    const email = `refresh.${randomUUID()}@example.test`;
    const password = 'WillowFern72!';
    await request(app)
      .post('/auth/register')
      .send({ fullName: 'Refresh User', email, password });

    const login = await request(app)
      .post('/auth/login')
      .send({ email, password });
    const oldAccessCookie = cookieFrom(login, loadConfig().COOKIE_NAME);
    const oldRefreshCookie = cookieFrom(
      login,
      loadConfig().REFRESH_COOKIE_NAME,
    );
    const oldRefreshToken = oldRefreshCookie.split('=')[1];
    const storedHash = await query<{ refresh_token_hash: string }>(
      `SELECT auth_sessions.refresh_token_hash
       FROM auth_sessions
       JOIN users ON users.id = auth_sessions.user_id
       WHERE users.email = $1`,
      [email.toLowerCase()],
    );
    expect(storedHash.rows[0].refresh_token_hash).toBe(
      createHash('sha256').update(oldRefreshToken).digest('hex'),
    );

    const refresh = await request(app)
      .post('/auth/refresh')
      .set('Cookie', oldRefreshCookie);
    expect(refresh.status).toBe(200);
    expect(refresh.body.user.id).toBe(login.body.user.id);
    const accessCookie = cookieFrom(refresh, loadConfig().COOKIE_NAME);
    const refreshCookie = cookieFrom(refresh, loadConfig().REFRESH_COOKIE_NAME);
    expect(refreshCookie.split('=')[1]).not.toBe(oldRefreshToken);

    const replay = await request(app)
      .post('/auth/refresh')
      .set('Cookie', oldRefreshCookie);
    expect(replay.status).toBe(401);
    expect(replay.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${loadConfig().COOKIE_NAME}=`),
        expect.stringContaining(`${loadConfig().REFRESH_COOKIE_NAME}=`),
      ]),
    );

    const stillActive = await request(app)
      .get('/me')
      .set('Cookie', accessCookie);
    expect(stillActive.status).toBe(200);
    const oldAccessStillAccepted = await request(app)
      .get('/me')
      .set('Cookie', oldAccessCookie);
    expect(oldAccessStillAccepted.status).toBe(200);
  });

  it('logs out only the current session and revokes its access token immediately', async () => {
    const email = `logout.${randomUUID()}@example.test`;
    const password = 'WillowFern72!';
    await request(app)
      .post('/auth/register')
      .send({ fullName: 'Logout User', email, password });

    const firstLogin = await request(app)
      .post('/auth/login')
      .send({ email, password });
    const firstAccessCookie = cookieFrom(firstLogin, loadConfig().COOKIE_NAME);
    const firstRefreshCookie = cookieFrom(
      firstLogin,
      loadConfig().REFRESH_COOKIE_NAME,
    );
    const secondLogin = await request(app)
      .post('/auth/login')
      .send({ email, password });
    const secondAccessCookie = cookieFrom(
      secondLogin,
      loadConfig().COOKIE_NAME,
    );

    const logout = await request(app)
      .post('/auth/logout')
      .set('Cookie', `${firstAccessCookie}; ${firstRefreshCookie}`);
    expect(logout.status).toBe(204);

    const revokedSession = await request(app)
      .get('/me')
      .set('Cookie', firstAccessCookie);
    expect(revokedSession.status).toBe(401);
    const otherSession = await request(app)
      .get('/me')
      .set('Cookie', secondAccessCookie);
    expect(otherSession.status).toBe(200);
  });

  it('uses the current database role and rejects sessions for deleted users', async () => {
    const email = `role-change.${randomUUID()}@example.test`;
    const password = 'WillowFern72!';
    const registered = await request(app)
      .post('/auth/register')
      .send({ fullName: 'Role Change', email, password });
    const userId = registered.body.user.id as string;
    await query("UPDATE users SET role = 'admin' WHERE id = $1", [userId]);

    const accessCookie = await signedAccessCookie(userId, 'admin');
    const beforeDowngrade = await request(app)
      .get('/admin/studios')
      .set('Cookie', accessCookie);
    expect(beforeDowngrade.status).toBe(200);

    await query("UPDATE users SET role = 'customer' WHERE id = $1", [userId]);
    const afterDowngrade = await request(app)
      .get('/admin/studios')
      .set('Cookie', accessCookie);
    expect(afterDowngrade.status).toBe(403);
    const currentUser = await request(app)
      .get('/me')
      .set('Cookie', accessCookie);
    expect(currentUser.body.user.role).toBe('customer');

    await query('DELETE FROM users WHERE id = $1', [userId]);
    const deletedUser = await request(app)
      .get('/me')
      .set('Cookie', accessCookie);
    expect(deletedUser.status).toBe(401);
  });

  it('preserves credentialed CORS for the configured web origin and rejects other origins', async () => {
    const allowed = await request(app)
      .post('/auth/logout')
      .set('Origin', loadConfig().WEB_ORIGIN);
    expect(allowed.status).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(
      loadConfig().WEB_ORIGIN,
    );
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const blocked = await request(app)
      .post('/auth/logout')
      .set('Origin', 'https://untrusted.example');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('rejects duplicate emails and invalid credentials without leaking account existence', async () => {
    const email = `duplicate.${randomUUID()}@example.test`;
    const password = 'WillowFern72!';

    await request(app).post('/auth/register').send({
      fullName: 'Nguyen Van B',
      email,
      password,
    });

    const duplicateResponse = await request(app).post('/auth/register').send({
      fullName: 'Nguyen Van C',
      email,
      password: 'WillowFern72!',
    });

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.error.code).toBe('CONFLICT');

    const badLoginResponse = await request(app).post('/auth/login').send({
      email,
      password: 'WrongWillowFern72!',
    });

    expect(badLoginResponse.status).toBe(401);
    expect(badLoginResponse.body.error.message).toBe(
      'Email hoặc mật khẩu không chính xác.',
    );
  });

  it('creates only one account when concurrent registrations normalize to the same email', async () => {
    const email = `Race.${randomUUID()}@EXAMPLE.TEST`;
    const password = 'WillowFern72!';

    const responses = await Promise.all([
      request(app)
        .post('/auth/register')
        .send({
          fullName: 'Race User One',
          email: ` ${email} `,
          password,
        }),
      request(app).post('/auth/register').send({
        fullName: 'Race User Two',
        email: email.toLowerCase(),
        password,
      }),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    const conflict = responses.find(({ status }) => status === 409);
    expect(conflict?.body.error.code).toBe('CONFLICT');
    expect(conflict?.text).not.toContain('users_email_key');
    expect(conflict?.text).not.toContain('duplicate key');

    const users = await query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()],
    );
    expect(users.rows[0].count).toBe(1);
  });

  it('requires authentication before accessing protected user data', async () => {
    const protectedResponse = await request(app).get('/me');
    expect(protectedResponse.status).toBe(401);
    expect(protectedResponse.body.error.code).toBe('UNAUTHORIZED');
  });

  it('stores a hashed password and does not return it in the public user payload', async () => {
    const email = `hash.${randomUUID()}@example.test`;
    const password = 'WillowFern72!';

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

    const legacyToken = jwt.sign(
      { sub: randomUUID(), role: 'organizer' },
      loadConfig().JWT_SECRET,
      { algorithm: 'HS256' },
    );
    const legacyResponse = await request(app)
      .get('/me')
      .set('Cookie', `${loadConfig().COOKIE_NAME}=${legacyToken}`);
    expect(legacyResponse.status).toBe(401);
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

function cookieFrom(
  response: { headers: Record<string, string | string[] | undefined> },
  name: string,
): string {
  const header = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const value = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!value) {
    throw new Error(`Missing ${name} cookie.`);
  }
  const cookie = value.split(';', 1)[0];
  if (!cookie) {
    throw new Error(`Invalid ${name} cookie.`);
  }
  return cookie;
}

async function signedAccessCookie(
  userId: string,
  role: 'customer' | 'admin',
): Promise<string> {
  const config = loadConfig();
  const refreshToken = randomBytes(32).toString('base64url');
  const session = await query<{ id: string }>(
    `INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at)
     VALUES ($1, $2, now() + interval '14 days')
     RETURNING id`,
    [userId, createHash('sha256').update(refreshToken).digest('hex')],
  );
  const token = jwt.sign(
    { sub: userId, sid: session.rows[0].id, role },
    config.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
  return `${config.COOKIE_NAME}=${token}`;
}
