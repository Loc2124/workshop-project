import { Pool, type PoolClient } from 'pg';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';

let testPool: Pool | undefined;

export function getTestPool(): Pool {
  assertSafeTestDatabase();
  const connectionString = process.env.DATABASE_URL_TEST;
  if (!connectionString) {
    throw new Error('DATABASE_URL_TEST is required for database tests.');
  }

  testPool ??= new Pool({ connectionString });
  return testPool;
}

export async function closeTestPool(): Promise<void> {
  if (testPool) {
    const pool = testPool;
    testPool = undefined;
    await pool.end();
  }
}

export async function withTestDatabase<T>(
  action: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getTestPool().connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    return await action(client);
  } finally {
    try {
      if (transactionStarted) {
        await client.query('ROLLBACK');
      }
    } finally {
      client.release();
    }
  }
}

export async function createUser(
  client: PoolClient,
  suffix: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [`${suffix}@example.test`, 'test-hash', 'Test user'],
  );
  return result.rows[0].id;
}

export async function createOrganizer(
  client: PoolClient,
  userId: string,
  name: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO organizers (user_id, name)
     VALUES ($1, $2)
     RETURNING id`,
    [userId, name],
  );
  return result.rows[0].id;
}

export async function createWorkshop(
  client: PoolClient,
  organizerId: string,
  suffix: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO workshops
       (organizer_id, title, description, category, duration_minutes, base_price, district)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      organizerId,
      `Test workshop ${suffix}`,
      'Test description',
      'craft',
      60,
      1000,
      'test',
    ],
  );
  return result.rows[0].id;
}

export async function createSession(
  client: PoolClient,
  workshopId: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO sessions (workshop_id, starts_at, ends_at, price, capacity)
     VALUES ($1, now() + interval '1 day', now() + interval '1 day 1 hour', $2, $3)
     RETURNING id`,
    [workshopId, 1000, 10],
  );
  return result.rows[0].id;
}
