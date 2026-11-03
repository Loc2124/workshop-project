import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config.js', () => ({
  loadConfig: () => ({
    COOKIE_NAME: 'access',
    REFRESH_COOKIE_NAME: 'refresh',
    COOKIE_SECURE: 'false',
    COOKIE_SAME_SITE: 'lax',
    JWT_EXPIRES_IN: '15m',
    REFRESH_TOKEN_EXPIRES_IN: '14d',
  }),
}));
vi.mock('../../src/modules/auth/auth.service.js', () => ({
  loginCustomer: vi.fn(),
  registerCustomer: vi.fn(),
  refreshCustomerSession: vi.fn(),
  logoutCurrentSession: vi.fn(),
}));
import authRoutes from '../../src/modules/auth/auth.routes.js';
import {
  loginCustomer,
  refreshCustomerSession,
} from '../../src/modules/auth/auth.service.js';
import { errorHandler } from '../../src/middleware/errors.js';

const result = {
  token: 'access-token',
  refreshToken: 'refresh-token',
  user: {
    id: 'user-id',
    email: 'an@example.test',
    fullName: 'Nguyen An',
    role: 'customer' as const,
  },
};
const app = express();
app.use(express.json(), cookieParser());
app.use('/auth', authRoutes);
app.use(errorHandler);

describe('remember login', () => {
  it.each([true, false])(
    'preserves rememberMe=%s through refresh',
    async (rememberMe) => {
      vi.mocked(loginCustomer).mockResolvedValue(result);
      vi.mocked(refreshCustomerSession).mockResolvedValue(result);
      const login = await request(app).post('/auth/login').send({
        email: 'an@example.test',
        password: 'password123',
        rememberMe,
      });
      expect(login.status).toBe(200);
      const cookies = login.headers['set-cookie'] as unknown as string[];
      for (const cookie of cookies) {
        expect(cookie.includes('Max-Age=')).toBe(rememberMe);
        expect(cookie.includes('Expires=')).toBe(rememberMe);
      }
      const refresh = await request(app)
        .post('/auth/refresh')
        .set(
          'Cookie',
          cookies.map((cookie) => cookie.split(';')[0]).join('; '),
        );
      expect(refresh.status).toBe(200);
      for (const cookie of refresh.headers['set-cookie'] as unknown as string[])
        expect(cookie.includes('Max-Age=')).toBe(rememberMe);
    },
  );
  it('clears the preference cookie on logout', async () => {
    const logout = await request(app).post('/auth/logout');
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refresh_remember=;')]),
    );
  });
});
