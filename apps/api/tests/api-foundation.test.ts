import { randomUUID } from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { assertSafeTestDatabase } from '../../../scripts/assert-safe-test-db.js';
import { withTransaction } from '../src/db/pool.js';
import { errorHandler, notFoundHandler } from '../src/middleware/errors.js';
import { validateBody } from '../src/middleware/validate-body.js';
import {
  closeTestPool,
  createOrganizer,
  createSession,
  createUser,
  createWorkshop,
  getTestPool,
  withTestDatabase,
} from './helpers/database.js';

describe('API infrastructure', () => {
  beforeAll(() => {
    assertSafeTestDatabase();
  });

  afterAll(async () => {
    await closeTestPool();
  });

  it('validates request bodies and returns the shared error format', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validateBody(expressBodySchema), (_request, response) =>
      response.json({ ok: true }),
    );
    app.use(errorHandler);

    const response = await request(app).post('/test').send({ name: 42 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: {
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Dữ liệu gửi lên không hợp lệ.',
      },
    });
  });

  it('returns a standard 404 response for unknown routes', async () => {
    const app = express();
    app.use(notFoundHandler);
    app.use(errorHandler);

    const response = await request(app).get('/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên.' },
    });
  });

  it('does not expose unexpected internal errors', async () => {
    const app = express();
    app.get('/failure', async () => {
      throw new Error('secret database detail');
    });
    app.use(errorHandler);

    const response = await request(app).get('/failure');

    expect(response.status).toBe(500);
    expect(response.body.error.message).not.toContain('secret database detail');
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

const expressBodySchema = z.object({
  name: z.string(),
});
