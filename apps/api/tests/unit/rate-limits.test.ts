import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import {
  createApiRateLimiter,
  createAdminRateLimiter,
} from '../../src/middleware/rate-limits.js';
import { createApp } from '../../src/app.js';
import { corsForWeb } from '../../src/middleware/cors.js';

describe('dashboard request limits', () => {
  it('does not block normal browsing after the former 100-request allowance', async () => {
    const app = createApp();
    const results = await Promise.all(
      Array.from({ length: 105 }, () => request(app).get('/health')),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
  });
  it('returns JSON and Retry-After when the IP abuse ceiling is exceeded', async () => {
    const app = express();
    app.use(corsForWeb('http://localhost:3000'));
    app.use(createApiRateLimiter({ limit: 2 }));
    app.get('/', (_req, res) => res.json({ ok: true }));
    expect((await request(app).get('/')).status).toBe(200);
    expect((await request(app).get('/')).status).toBe(200);
    const blocked = await request(app)
      .get('/')
      .set('Origin', 'http://localhost:3000');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.headers['access-control-expose-headers']).toContain(
      'Retry-After',
    );
  });
  it('keeps the authenticated admin allowance separate for each account', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.user = {
        sub: String(req.headers['x-test-account']),
        sid: 'test',
        role: 'admin',
      };
      next();
    });
    app.use(createAdminRateLimiter({ limit: 2 }));
    app.get('/', (_req, res) => res.json({ ok: true }));
    for (let i = 0; i < 2; i++)
      expect(
        (await request(app).get('/').set('x-test-account', 'admin-one')).status,
      ).toBe(200);
    expect(
      (await request(app).get('/').set('x-test-account', 'admin-one')).status,
    ).toBe(429);
    expect(
      (await request(app).get('/').set('x-test-account', 'admin-two')).status,
    ).toBe(200);
  });
});
