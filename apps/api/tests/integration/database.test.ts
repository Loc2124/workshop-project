import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { withTransaction } from '../../src/db/pool.js';
import {
  closeTestPool,
  createOrganizer,
  createSession,
  createUser,
  createWorkshop,
  getTestPool,
  withTestDatabase,
} from '../helpers/database.js';

describe('database infrastructure', () => {
  beforeAll(() => {
    assertSafeTestDatabase();
  });

  afterAll(async () => {
    await closeTestPool();
  });

  it('rolls back database work when a transaction callback fails', async () => {
    const connectionString = process.env.DATABASE_URL_TEST;
    if (!connectionString) {
      throw new Error('DATABASE_URL_TEST is required for database tests.');
    }
    const pool = new Pool({ connectionString, max: 1 });

    try {
      const client = await pool.connect();
      try {
        await client.query('CREATE TEMP TABLE rollback_probe (value text)');
      } finally {
        client.release();
      }

      await expect(
        withTransaction(async (transaction) => {
          await transaction.query(
            'INSERT INTO rollback_probe (value) VALUES ($1)',
            ['must roll back'],
          );
          throw new Error('trigger rollback');
        }, pool),
      ).rejects.toThrow('trigger rollback');

      const result = await pool.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM rollback_probe',
      );
      expect(result.rows[0].count).toBe('0');
    } finally {
      await pool.end();
    }
  });

  it('creates relational test fixtures inside an automatically rolled-back transaction', async () => {
    const ids = await withTestDatabase(async (client) => {
      const suffix = randomUUID();
      const userId = await createUser(client, suffix);
      const organizerId = await createOrganizer(
        client,
        userId,
        `Test organizer ${suffix}`,
      );
      const workshopId = await createWorkshop(client, organizerId, suffix);
      const sessionId = await createSession(client, workshopId);
      return { userId, organizerId, workshopId, sessionId };
    });

    expect(Object.values(ids)).toHaveLength(4);
    const result = await getTestPool().query(
      'SELECT id FROM users WHERE id = $1',
      [ids.userId],
    );
    expect(result.rowCount).toBe(0);
  });
});
