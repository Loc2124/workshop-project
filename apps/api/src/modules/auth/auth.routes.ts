import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { validateBody } from '../../middleware/validate-body.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import { loginCustomer, registerCustomer } from './auth.service.js';

const router = Router();
const cookieName = process.env.COOKIE_NAME || 'workshop_session';
const cookieSecure = process.env.COOKIE_SECURE === 'true';
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
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
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure,
      maxAge: getCookieMaxAge(),
    });

    response.json({ user: result.user });
  },
);

router.post('/logout', (_request, response) => {
  response.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
  });
  response.status(204).send();
});

function getCookieMaxAge(): number {
  const expiry = process.env.JWT_EXPIRES_IN || '7d';
  const match = expiry.match(/^(\d+)([smhd])$/i);

  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * (multipliers[unit] ?? 24 * 60 * 60 * 1000);
}

export default router;
