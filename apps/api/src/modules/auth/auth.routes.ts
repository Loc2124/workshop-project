import { Router, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { validateBody } from '../../middleware/validate-body.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import {
  loginCustomer,
  logoutCurrentSession,
  refreshCustomerSession,
  registerCustomer,
} from './auth.service.js';
import { loadConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';

const router = Router();
const {
  COOKIE_NAME: cookieName,
  REFRESH_COOKIE_NAME: refreshCookieName,
  COOKIE_SECURE: cookieSecureValue,
  COOKIE_SAME_SITE: cookieSameSite,
  JWT_EXPIRES_IN: accessTokenExpiresIn,
  REFRESH_TOKEN_EXPIRES_IN: refreshTokenExpiresIn,
} = loadConfig();
const cookieSecure = cookieSecureValue === 'true';
const rememberCookieName = `${refreshCookieName}_remember`;
const accessCookieOptions = {
  httpOnly: true,
  sameSite: cookieSameSite,
  secure: cookieSecure,
  path: '/',
};
const refreshCookieOptions = {
  ...accessCookieOptions,
  path: '/auth',
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
