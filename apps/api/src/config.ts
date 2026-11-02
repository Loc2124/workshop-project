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
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
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
  const result = configSchema.safeParse(env);

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
