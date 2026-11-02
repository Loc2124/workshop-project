import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';

const app = createApp();
const { JWT_SECRET: jwtSecret, COOKIE_NAME: cookieName } = loadConfig();

describe('authentication middleware', () => {
  it.each([
    [
      'wrong signature',
      jwt.sign({ sub: randomUUID(), role: 'customer' }, 'not-the-secret'),
    ],
    [
      'expired token',
      jwt.sign({ sub: randomUUID(), role: 'customer' }, jwtSecret, {
        algorithm: 'HS256',
        expiresIn: -1,
      }),
    ],
    [
      'unapproved algorithm',
      jwt.sign({ sub: randomUUID(), role: 'customer' }, jwtSecret, {
        algorithm: 'HS384',
      }),
    ],
  ])('rejects a token with %s', async (_description, token) => {
    const response = await request(app)
      .get('/me')
      .set('Cookie', `${cookieName}=${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
