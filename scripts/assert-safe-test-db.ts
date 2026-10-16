import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

loadDotenv({
  path: resolve(fileURLToPath(new URL('..', import.meta.url)), '.env'),
});

type DatabaseTarget = {
  hostname: string;
  username: string;
};

export function getTestDatabaseSafetyIssues(env: NodeJS.ProcessEnv): string[] {
  const issues: string[] = [];

  if (env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
    issues.push(
      'ALLOW_DESTRUCTIVE_TESTS must be exactly "true" to run tests or test-database operations.',
    );
  }

  const applicationUrl = parseDatabaseUrl(
    env.DATABASE_URL,
    'DATABASE_URL',
    issues,
  );
  const testUrl = parseDatabaseUrl(
    env.DATABASE_URL_TEST,
    'DATABASE_URL_TEST',
    issues,
  );

  if (
    applicationUrl &&
    testUrl &&
    applicationUrl.hostname === testUrl.hostname &&
    applicationUrl.username === testUrl.username
  ) {
    issues.push(
      'DATABASE_URL_TEST has the same host and username as DATABASE_URL; use a separate test Supabase project or a distinct database user.',
    );
  }

  return issues;
}

export function assertSafeTestDatabase(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const issues = getTestDatabaseSafetyIssues(env);

  if (issues.length > 0) {
    throw new Error(
      `Refusing to run test-database operation:\n${issues.map((issue) => `- ${issue}`).join('\n')}`,
    );
  }
}

function parseDatabaseUrl(
  value: string | undefined,
  name: string,
  issues: string[],
): DatabaseTarget | undefined {
  if (!value) {
    issues.push(`${name} is required.`);
    return undefined;
  }

  try {
    const url = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      !url.username
    ) {
      issues.push(`${name} must be a PostgreSQL URL with a host and username.`);
      return undefined;
    }

    return {
      hostname: url.hostname.toLowerCase().replace(/\.$/, ''),
      username: decodeURIComponent(url.username),
    };
  } catch {
    issues.push(`${name} must be a valid PostgreSQL URL.`);
    return undefined;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    assertSafeTestDatabase();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
