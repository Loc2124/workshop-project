import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { assertSafeTestDatabase } from '../../../scripts/assert-safe-test-db.js';
import { migrateDatabase } from '../../../scripts/migrate.js';

let pool: Pool | undefined;
let databaseUrl: string;

beforeAll(async () => {
  assertSafeTestDatabase();
  databaseUrl = process.env.DATABASE_URL_TEST ?? '';
  await migrateDatabase(databaseUrl);
  pool = new Pool({ connectionString: databaseUrl });
});

afterAll(async () => {
  if (pool) {
    await pool.end();
  }
});

describe('database migrations', () => {
  it('enables RLS without policies on every public table', async () => {
    const result = await getPool().query<{
      tablename: string;
      row_level_security: boolean;
      policy_count: string;
    }>(
      `
      SELECT c.relname AS tablename,
             c.relrowsecurity AS row_level_security,
             count(p.policyname)::text AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_policies p
        ON p.schemaname = n.nspname AND p.tablename = c.relname
      WHERE n.nspname = $1 AND c.relkind = 'r'
      GROUP BY c.oid, c.relname, c.relrowsecurity
      ORDER BY c.relname
    `,
      ['public'],
    );

    expect(result.rows.length).toBeGreaterThan(0);
    for (const table of result.rows) {
      expect(
        table.row_level_security,
        `${table.tablename} must have RLS enabled`,
      ).toBe(true);
      expect(
        Number(table.policy_count),
        `${table.tablename} must not have RLS policies`,
      ).toBe(0);
    }
  });

  it('enforces capacity and webhook and ticket uniqueness constraints', async () => {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const suffix = randomUUID();
      const user = await client.query<{ id: string }>(
        'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id',
        [`${suffix}@example.test`, 'test-hash', 'Migration test'],
      );
      const organizer = await client.query<{ id: string }>(
        'INSERT INTO organizers (user_id, name) VALUES ($1, $2) RETURNING id',
        [user.rows[0].id, `Migration test ${suffix}`],
      );
      const workshop = await client.query<{ id: string }>(
        `INSERT INTO workshops
           (organizer_id, title, description, category, duration_minutes, base_price, district)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          organizer.rows[0].id,
          'Migration test workshop',
          'Test description',
          'craft',
          60,
          1000,
          'test-district',
        ],
      );
      const startsAt = new Date(Date.now() + 60 * 60 * 1000);
      const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const session = await client.query<{ id: string }>(
        `INSERT INTO sessions (workshop_id, starts_at, ends_at, price, capacity)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [workshop.rows[0].id, startsAt, endsAt, 1000, 1],
      );
      const booking = await client.query<{ id: string }>(
        `INSERT INTO bookings
           (user_id, session_id, quantity, unit_price, total_amount, hold_expires_at, order_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          user.rows[0].id,
          session.rows[0].id,
          1,
          1000,
          1000,
          endsAt,
          Date.now().toString(),
        ],
      );
      const provider = `test-${suffix}`;
      const dedupeKey = `event-${suffix}`;

      await client.query(
        'INSERT INTO webhook_events (provider, dedupe_key, payload, signature_valid) VALUES ($1, $2, $3, $4)',
        [provider, dedupeKey, '{}', true],
      );
      await expectConstraintCode(
        client,
        'INSERT INTO webhook_events (provider, dedupe_key, payload, signature_valid) VALUES ($1, $2, $3, $4)',
        [provider, dedupeKey, '{}', true],
        '23505',
      );

      await client.query(
        'INSERT INTO tickets (booking_id, seq, code) VALUES ($1, $2, $3)',
        [booking.rows[0].id, 1, `ticket-${suffix}-1`],
      );
      await expectConstraintCode(
        client,
        'INSERT INTO tickets (booking_id, seq, code) VALUES ($1, $2, $3)',
        [booking.rows[0].id, 1, `ticket-${suffix}-2`],
        '23505',
      );
      await expectConstraintCode(
        client,
        'UPDATE sessions SET seats_held = $1, seats_sold = $2 WHERE id = $3',
        [1, 1, session.rows[0].id],
        '23514',
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('can apply the migration set repeatedly without changing applied migrations', async () => {
    const results = await migrateDatabase(databaseUrl);

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => !result.applied)).toBe(true);
  });

  it('rejects a migration file whose checksum changed after application', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'workshop-migrations-'));
    const filename = '999_checksum_probe.sql';
    const migrationPath = join(directory, filename);

    try {
      await writeFile(
        migrationPath,
        'CREATE TABLE public.migration_checksum_probe (id integer);\nALTER TABLE public.migration_checksum_probe ENABLE ROW LEVEL SECURITY;\n',
      );
      await migrateDatabase(databaseUrl, directory);

      await writeFile(
        migrationPath,
        'CREATE TABLE public.migration_checksum_probe (id bigint);\nALTER TABLE public.migration_checksum_probe ENABLE ROW LEVEL SECURITY;\n',
      );
      await expect(migrateDatabase(databaseUrl, directory)).rejects.toThrow(
        `Migration ${filename} has changed since it was applied`,
      );
    } finally {
      await getPool().query(
        'DELETE FROM public.schema_migrations WHERE filename = $1',
        [filename],
      );
      await getPool().query(
        'DROP TABLE IF EXISTS public.migration_checksum_probe',
      );
      await rm(directory, { recursive: true, force: true });
    }
  });
});

async function expectConstraintCode(
  client: PoolClient,
  sql: string,
  values: unknown[],
  expectedCode: string,
): Promise<void> {
  await client.query('SAVEPOINT constraint_check');
  let caughtError: unknown;
  try {
    await client.query(sql, values);
  } catch (error) {
    caughtError = error;
  }
  await client.query('ROLLBACK TO SAVEPOINT constraint_check');
  await client.query('RELEASE SAVEPOINT constraint_check');

  const errorCode =
    typeof caughtError === 'object' &&
    caughtError !== null &&
    'code' in caughtError &&
    typeof caughtError.code === 'string'
      ? caughtError.code
      : undefined;
  expect(errorCode).toBe(expectedCode);
}

function getPool(): Pool {
  if (!pool) {
    throw new Error('Test database connection was not initialized.');
  }
  return pool;
}
