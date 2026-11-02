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
import { loginCustomer } from '../../src/modules/auth/auth.service.js';
import { AppError } from '../../src/errors/app-error.js';
import { errorHandler } from '../../src/middleware/errors.js';

describe('login rate limit', () => {
  it('excludes successful logins but still blocks repeated failures', async () => {
    const app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    app.use(errorHandler);
    vi.mocked(loginCustomer).mockResolvedValue({
      token: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-id',
        email: 'customer@example.test',
        fullName: 'Customer',
        role: 'customer',
      },
    });
    const login = () =>
      request(app)
        .post('/auth/login')
        .send({ email: 'customer@example.test', password: 'password123' });
    for (let attempt = 0; attempt < 6; attempt++) {
      expect((await login()).status).toBe(200);
    }
    vi.mocked(loginCustomer).mockRejectedValue(
      new AppError(401, 'UNAUTHORIZED', 'Invalid credentials'),
    );
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await login()).status).toBe(401);
    }
    expect((await login()).status).toBe(429);
    expect(loginCustomer).toHaveBeenCalledTimes(11);
  });
});
