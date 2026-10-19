import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler, notFoundHandler } from '../../src/middleware/errors.js';
import { validateBody } from '../../src/middleware/validate-body.js';

describe('API infrastructure', () => {
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
});

const expressBodySchema = z.object({
  name: z.string(),
});
