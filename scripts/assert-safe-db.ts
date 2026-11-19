import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const nodeEnv = process.env.NODE_ENV || 'development';
for (const envPath of [
  resolve(projectRoot, '.env.local'),
  resolve(projectRoot, `.env.${nodeEnv}.local`),
  resolve(projectRoot, `.env.${nodeEnv}`),
  resolve(projectRoot, '.env'),
]) {
  if (existsSync(envPath)) loadDotenv({ path: envPath });
}

export interface DatabaseTarget {
  hostname: string;
  database: string;
  username: string;
}

export function parseDatabaseUrl(
  value: string | undefined,
): DatabaseTarget | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) return undefined;
    return {
      hostname: url.hostname.toLowerCase().replace(/\.$/, ''),
      database: url.pathname.replace(/^\//, ''),
      username: decodeURIComponent(url.username),
    };
  } catch {
    return undefined;
  }
}

export interface SafetyCheckOptions {
  operationName: string;
  env?: NodeJS.ProcessEnv;
  allowProduction?: boolean;
}

export function assertSafeDatabaseOperation(options: SafetyCheckOptions): void {
  const env = options.env || process.env;
  const dbUrl = env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error(
      `[DB Guard] DATABASE_URL is required to run '${options.operationName}'.`,
    );
  }

  const target = parseDatabaseUrl(dbUrl);
  if (!target) {
    throw new Error(`[DB Guard] DATABASE_URL is not a valid PostgreSQL URL.`);
  }

  const isProduction = env.NODE_ENV === 'production';
  const isDestructiveAllowed =
    env.ALLOW_DESTRUCTIVE_OPERATIONS === 'true' ||
    process.argv.includes('--force') ||
    process.argv.includes('--confirm');

  if (isProduction && !options.allowProduction) {
    throw new Error(
      `[DB Guard] Refusing to run destructive operation '${options.operationName}' on production environment (NODE_ENV=production).`,
    );
  }

  // Safety confirmation for destructive operations
  if (
    !isDestructiveAllowed &&
    !target.hostname.includes('localhost') &&
    target.hostname !== '127.0.0.1'
  ) {
    throw new Error(
      `[DB Guard] Refusing to run destructive operation '${options.operationName}' on remote database '${target.hostname}/${target.database}'.\n` +
        `To proceed, pass --force argument or set ALLOW_DESTRUCTIVE_OPERATIONS=true in your environment.`,
    );
  }

  console.log(
    `[DB Guard] Target verified: ${target.username}@${target.hostname}/${target.database} for '${options.operationName}'`,
  );
}
