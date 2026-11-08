import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

loadDotenv({ path: resolve(process.cwd(), '..', '..', '.env') });

const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  WEB_ORIGIN: z
    .url()
    .default('http://localhost:3000')
    .transform((value) => new URL(value).origin),
  JWT_SECRET: z.string().refine(isStrongJwtSecret, {
    message:
      'must be a random base64url secret with at least 43 characters and 16 distinct characters',
  }),
  FINANCIAL_ACCOUNT_ENCRYPTION_KEY: z
    .string()
    .refine((value) => Buffer.from(value, 'base64url').length === 32, {
      message: 'must be a 32-byte base64url encryption key',
    })
    .optional(),
  JWT_EXPIRES_IN: z.string().default('15m').refine(isValidJwtExpiresIn, {
    message: 'must be a positive duration such as 15m, 1h, or 7d',
  }),
  REFRESH_TOKEN_EXPIRES_IN: z
    .string()
    .default('14d')
    .refine(isValidJwtExpiresIn, {
      message: 'must be a positive duration such as 14d',
    }),
  COOKIE_NAME: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/)
    .default('workshop_session'),
  REFRESH_COOKIE_NAME: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/)
    .default('workshop_refresh'),
  AUTH_COOKIE_PATH_PREFIX: z
    .string()
    .regex(/^(?:\/[A-Za-z0-9_-]+)*$/)
    .default(''),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
  HOLD_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  EXPIRY_JOB_INTERVAL_SECONDS: z.coerce
    .number()
    .int()
    .min(10)
    .max(3600)
    .default(60),
  PAYMENT_PROVIDER: z.enum(['mock', 'payos']).default('mock'),
  PAYMENT_MIN_AMOUNT: z.coerce.number().int().positive().optional(),
  EMAIL_DELIVERY_URL: z.url().optional(),
  EMAIL_DELIVERY_TOKEN: z.string().min(1).optional(),
  PAYOS_CLIENT_ID: z.string().min(1).optional(),
  PAYOS_API_KEY: z.string().min(1).optional(),
  PAYOS_CHECKSUM_KEY: z.string().min(1).optional(),
  PAYOS_CHECKSUM_KEY_TEST: z.string().min(1).default('local-test-checksum-key'),
  PAYOS_RETURN_URL: z.url().default('http://localhost:3000/payment/return'),
  PAYOS_CANCEL_URL: z.url().default('http://localhost:3000/payment/cancel'),
  PAYOS_WEBHOOK_URL: z.url().optional(),
});

function isStrongJwtSecret(value: string): boolean {
  return (
    value.length >= 43 &&
    /^[A-Za-z0-9_-]+$/.test(value) &&
    new Set(value).size >= 16
  );
}

function isValidJwtExpiresIn(value: string): boolean {
  const match = value.match(/^([1-9]\d*)(s|m|h|d)$/i);
  if (!match) {
    return false;
  }

  const amount = Number(match[1]);
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };
  const multiplier = multipliers[match[2].toLowerCase()];

  return (
    multiplier !== undefined &&
    Number.isSafeInteger(amount) &&
    Number.isSafeInteger(amount * multiplier * 1000)
  );
}

export type ApiConfig = Omit<
  z.infer<typeof configSchema>,
  'PORT' | 'API_PORT'
> & {
  API_PORT: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const paymentEnv = { ...env };
  for (const key of [
    'PAYOS_CLIENT_ID',
    'PAYOS_API_KEY',
    'PAYOS_CHECKSUM_KEY',
    'PAYOS_WEBHOOK_URL',
    'PAYMENT_MIN_AMOUNT',
    'EMAIL_DELIVERY_URL',
    'EMAIL_DELIVERY_TOKEN',
  ]) {
    if (paymentEnv[key] === '') delete paymentEnv[key];
  }
  const result = configSchema.safeParse(paymentEnv);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid API configuration: ${details}`);
  }

  if (
    result.data.NODE_ENV === 'production' &&
    result.data.COOKIE_SECURE !== 'true'
  ) {
    throw new Error(
      'Invalid API configuration: COOKIE_SECURE must be true in production.',
    );
  }

  if (result.data.COOKIE_NAME === result.data.REFRESH_COOKIE_NAME) {
    throw new Error(
      'Invalid API configuration: COOKIE_NAME and REFRESH_COOKIE_NAME must differ.',
    );
  }

  if (
    result.data.NODE_ENV === 'production' &&
    new URL(result.data.WEB_ORIGIN).protocol !== 'https:'
  ) {
    throw new Error(
      'Invalid API configuration: WEB_ORIGIN must use HTTPS in production.',
    );
  }

  if (
    result.data.NODE_ENV === 'production' &&
    result.data.PAYMENT_PROVIDER !== 'payos'
  ) {
    throw new Error(
      'Invalid API configuration: production requires PAYMENT_PROVIDER=payos.',
    );
  }

  if (
    result.data.PAYMENT_PROVIDER === 'payos' &&
    (!result.data.PAYOS_CLIENT_ID ||
      !result.data.PAYOS_API_KEY ||
      !result.data.PAYOS_CHECKSUM_KEY ||
      !result.data.PAYOS_WEBHOOK_URL)
  ) {
    throw new Error(
      'Invalid API configuration: PayOS credentials and PAYOS_WEBHOOK_URL are required when PAYMENT_PROVIDER is payos.',
    );
  }

  const cookieSameSite =
    result.data.COOKIE_SAME_SITE ??
    (result.data.NODE_ENV === 'production' ? 'none' : 'lax');
  if (cookieSameSite === 'none' && result.data.COOKIE_SECURE !== 'true') {
    throw new Error(
      'Invalid API configuration: COOKIE_SECURE must be true when COOKIE_SAME_SITE is none.',
    );
  }

  return {
    ...result.data,
    COOKIE_SAME_SITE: cookieSameSite,
    API_PORT: result.data.PORT ?? result.data.API_PORT ?? 4000,
  };
}
