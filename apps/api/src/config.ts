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
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
});

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

  return {
    ...result.data,
    API_PORT: result.data.PORT ?? result.data.API_PORT ?? 4000,
  };
}
