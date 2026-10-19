import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { Pool, type PoolClient } from 'pg';
import { assertSafeTestDatabase } from './assert-safe-test-db.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const migrationsDirectory = resolve(projectRoot, 'db', 'migrations');
const advisoryLockKeys = [731904, 1];

loadDotenv({ path: resolve(projectRoot, '.env') });

type MigrationResult = {
  filename: string;
  applied: boolean;
};

export async function migrateDatabase(
  databaseUrl: string,
  directory = migrationsDirectory,
): Promise<MigrationResult[]> {
  assertPostgresUrl(databaseUrl);
  const migrations = await readMigrations(directory);
  if (migrations.length === 0) {
    throw new Error(`No SQL migrations found in ${directory}.`);
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query('SELECT pg_advisory_lock($1, $2)', advisoryLockKeys);
    lockAcquired = true;
    await ensureMigrationTable(client);

    const results: MigrationResult[] = [];
    for (const migration of migrations) {
      const applied = await applyMigration(client, migration);
      results.push({ filename: migration.filename, applied });
    }
    return results;
  } finally {
    try {
      if (lockAcquired) {
        await client.query(
          'SELECT pg_advisory_unlock($1, $2)',
          advisoryLockKeys,
        );
      }
    } finally {
      client.release();
      await pool.end();
    }
  }
}

async function readMigrations(directory: string) {
  const filenames = (await readdir(directory))
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

  return Promise.all(
    filenames.map(async (filename) => {
      const sql = await readFile(resolve(directory, filename), 'utf8');
      return {
        filename,
        sql,
        checksum: createHash('sha256')
          .update(sql.replace(/\r\n?/g, '\n'))
          .digest('hex'),
      };
    }),
  );
}

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await inTransaction(client, async () => {
    const existingSchema = await client.query<{ initialized: boolean }>(`
      SELECT to_regclass('public.users') IS NOT NULL
          OR to_regtype('public.user_role') IS NOT NULL AS initialized
    `);
    const trackingTable = await client.query<{
      tracking_table_exists: boolean;
    }>('SELECT to_regclass($1) IS NOT NULL AS tracking_table_exists', [
      'public.schema_migrations',
    ]);
    const hasHistory =
      trackingTable.rows[0]?.tracking_table_exists &&
      (
        await client.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM public.schema_migrations',
        )
      ).rows[0]?.count !== '0';
    if (existingSchema.rows[0]?.initialized && !hasHistory) {
      throw new Error(
        'The workshop schema already exists without migration history; refusing to apply migrations. Reconcile the existing database before retrying.',
      );
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        filename text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      'ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY',
    );

    const policies = await client.query<{ policyname: string }>(
      'SELECT policyname FROM pg_policies WHERE schemaname = $1 AND tablename = $2',
      ['public', 'schema_migrations'],
    );
    if (policies.rowCount !== 0) {
      throw new Error(
        'public.schema_migrations must not have any RLS policies.',
      );
    }
  });
}

async function applyMigration(
  client: PoolClient,
  migration: Awaited<ReturnType<typeof readMigrations>>[number],
): Promise<boolean> {
  return inTransaction(client, async () => {
    const existing = await client.query<{ checksum: string }>(
      'SELECT checksum FROM public.schema_migrations WHERE filename = $1',
      [migration.filename],
    );
    const appliedChecksum = existing.rows[0]?.checksum;

    if (appliedChecksum !== undefined) {
      if (appliedChecksum !== migration.checksum) {
        throw new Error(
          `Migration ${migration.filename} has changed since it was applied; restore the original file and add a new migration instead.`,
        );
      }
      return false;
    }

    await client.query(migration.sql);
    await client.query(
      'INSERT INTO public.schema_migrations (filename, checksum) VALUES ($1, $2)',
      [migration.filename, migration.checksum],
    );
    return true;
  });
}

async function inTransaction<T>(
  client: PoolClient,
  action: () => Promise<T>,
): Promise<T> {
  await client.query('BEGIN');
  try {
    const result = await action();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        'Migration failed and its transaction could not be rolled back.',
        { cause: rollbackError },
      );
    }
    throw error;
  }
}

function assertPostgresUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Database URL must be a valid PostgreSQL URL.');
  }

  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    !url.username
  ) {
    throw new Error(
      'Database URL must be a PostgreSQL URL with a host and username.',
    );
  }
  if (url.port !== '5432') {
    throw new Error(
      'Database URL must use port 5432 (Direct or Session pooler).',
    );
  }
}

function redactDatabaseUrl(message: string): string {
  return message.replace(
    /postgres(?:ql)?:\/\/[^\s"'`]+/gi,
    '[redacted database URL]',
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== '--test') || args.length > 1) {
    throw new Error('Usage: npm run migrate [-- --test]');
  }

  const useTestDatabase = args.includes('--test');
  if (useTestDatabase) {
    assertSafeTestDatabase();
  }

  const variableName = useTestDatabase ? 'DATABASE_URL_TEST' : 'DATABASE_URL';
  const databaseUrl = process.env[variableName];
  if (!databaseUrl) {
    throw new Error(`${variableName} is required.`);
  }

  const results = await migrateDatabase(databaseUrl);
  for (const result of results) {
    console.log(
      `${result.applied ? 'Applied' : 'Already applied'} ${result.filename}`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redactDatabaseUrl(message));
    process.exitCode = 1;
  });
}
