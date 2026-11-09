import { Router, type Response } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { validateBody } from '../../middleware/validate-body.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import {
  loginCustomer,
  logoutCurrentSession,
  refreshCustomerSession,
  registerCustomer,
  requestPasswordReset,
  resetPassword,
} from './auth.service.js';
import { loadConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import { newPasswordSchema } from '@workshop/shared';

const router = Router();
const {
  COOKIE_NAME: cookieName,
  REFRESH_COOKIE_NAME: refreshCookieName,
  AUTH_COOKIE_PATH_PREFIX: authCookiePathPrefix,
  COOKIE_SECURE: cookieSecureValue,
  COOKIE_SAME_SITE: cookieSameSite,
  JWT_EXPIRES_IN: accessTokenExpiresIn,
  REFRESH_TOKEN_EXPIRES_IN: refreshTokenExpiresIn,
} = loadConfig();
const cookieSecure = cookieSecureValue === 'true';
const rememberCookieName = `${refreshCookieName}_remember`;
const authCookiePath = `${authCookiePathPrefix}/auth` || '/auth';
const accessCookieOptions = {
  httpOnly: true,
  sameSite: cookieSameSite,
  secure: cookieSecure,
  path: authCookiePathPrefix || '/',
};
const refreshCookieOptions = {
  ...accessCookieOptions,
  path: authCookiePath,
};
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.',
    },
  },
});
const forgotPasswordIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Vui lòng thử lại sau.' } },
});
const forgotPasswordEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (request) =>
    String(request.body?.email ?? '').trim().toLowerCase() || 'missing-email',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Vui lòng thử lại sau.' } },
});

router.post(
  '/forgot-password',
  forgotPasswordIpLimiter,
  forgotPasswordEmailLimiter,
  validateBody(z.object({ email: z.string().trim().email().max(254) })),
  async (request, response) => {
    await requestPasswordReset(request.body.email);
    response.status(202).json({
      message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư.',
    });
  },
);

router.post(
  '/reset-password',
  validateBody(
    z.object({
      token: z.string().regex(/^[a-f0-9]{64}$/i),
      password: newPasswordSchema,
    }),
  ),
  async (request, response) => {
    const reset = await resetPassword(request.body.token, request.body.password);
    if (!reset)
      throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    response.json({ ok: true, message: 'Mật khẩu đã được thay đổi.' });
  },
);

router.post(
  '/register',
  validateBody(registerSchema),
  async (request, response) => {
    const result = await registerCustomer(request.body);
    response.status(201).json({ user: result.user });
  },
);

router.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  async (request, response) => {
    const result = await loginCustomer(request.body);

    response.cookie(cookieName, result.token, {
      ...accessCookieOptions,
      ...(request.body.rememberMe === false
        ? {}
        : { maxAge: durationToMilliseconds(accessTokenExpiresIn) }),
    });
    response.cookie(refreshCookieName, result.refreshToken, {
      ...refreshCookieOptions,
      ...(request.body.rememberMe === false
        ? {}
        : { maxAge: durationToMilliseconds(refreshTokenExpiresIn) }),
    });
    response.cookie(
      rememberCookieName,
      request.body.rememberMe === false ? 'false' : 'true',
      {
        ...refreshCookieOptions,
        ...(request.body.rememberMe === false
          ? {}
          : { maxAge: durationToMilliseconds(refreshTokenExpiresIn) }),
      },
    );

    response.json({ user: result.user });
  },
);

router.post('/refresh', async (request, response) => {
  const refreshToken = request.cookies?.[refreshCookieName];
  if (!refreshToken) {
    clearAuthCookies(response);
    throw invalidRefreshToken();
  }

  const result = await refreshCustomerSession(refreshToken);
  if (!result) {
    clearAuthCookies(response);
    throw invalidRefreshToken();
  }

  response.cookie(cookieName, result.token, {
    ...accessCookieOptions,
    ...(request.cookies?.[rememberCookieName] === 'false'
      ? {}
      : { maxAge: durationToMilliseconds(accessTokenExpiresIn) }),
  });
  response.cookie(refreshCookieName, result.refreshToken, {
    ...refreshCookieOptions,
    ...(request.cookies?.[rememberCookieName] === 'false'
      ? {}
      : { maxAge: durationToMilliseconds(refreshTokenExpiresIn) }),
  });
  response.json({ user: result.user });
});

router.post('/logout', async (request, response) => {
  await logoutCurrentSession(
    request.cookies?.[cookieName],
    request.cookies?.[refreshCookieName],
  );
  clearAuthCookies(response);
  response.status(204).send();
});

function durationToMilliseconds(duration: string): number {
  const match = duration.match(/^([1-9]\d*)([smhd])$/i);
  if (!match) {
    throw new Error('Invalid token duration configuration.');
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const multiplier = multipliers[unit];
  if (multiplier === undefined) {
    throw new Error('Invalid token duration configuration.');
  }

  return value * multiplier;
}

function clearAuthCookies(response: Response): void {
  response.clearCookie(cookieName, accessCookieOptions);
  response.clearCookie(refreshCookieName, refreshCookieOptions);
  response.clearCookie(rememberCookieName, refreshCookieOptions);
}

function invalidRefreshToken(): AppError {
  return new AppError(
    401,
    'UNAUTHORIZED',
    'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
  );
}

export default router;
