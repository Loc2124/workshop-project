import { rateLimit } from 'express-rate-limit';

type Options = { limit?: number; windowMs?: number };
const response = {
  error: {
    code: 'RATE_LIMITED',
    message: 'Bạn thao tác quá nhanh. Vui lòng chờ một chút rồi thử lại.',
  },
};
// A dashboard normally makes several requests for one screen. Keep the IP
// abuse ceiling separate from the authenticated account's admin budget.
export function createApiRateLimiter({
  limit = 600,
  windowMs = 60_000,
}: Options = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: response,
  });
}
export function createAdminRateLimiter({
  limit = 300,
  windowMs = 60_000,
}: Options = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.user!.sub,
    message: response,
  });
}
