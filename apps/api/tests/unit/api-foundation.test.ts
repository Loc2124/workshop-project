import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { depositSettingsSchema } from '@workshop/shared';
import { updateWorkshopSchema } from '../../src/modules/workshops/workshops.schemas.js';
import { errorHandler, notFoundHandler } from '../../src/middleware/errors.js';
import { validateBody } from '../../src/middleware/validate-body.js';
import { validateUuidParam } from '../../src/middleware/validate-uuid-param.js';

describe('API infrastructure', () => {
  it.each([
    {
      schema: depositSettingsSchema,
      body: { depositMode: 'optional', depositPercent: 51 },
    },
    {
      schema: updateWorkshopSchema,
      body: { depositModeOverride: 'required', depositPercent: 51 },
    },
  ])(
    'keeps the Vietnamese maximum-deposit error at the HTTP boundary',
    async ({ schema, body }) => {
      const app = express();
      app.use(express.json());
      app.post('/deposit', validateBody(schema), (_req, res) =>
        res.json({ ok: true }),
      );
      app.use(errorHandler);
      const response = await request(app).post('/deposit').send(body);
      expect(response.status).toBe(422);
      expect(response.body.error.message).toBe('Mức cọc tối đa là 50%');
    },
  );
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
    app.get('/failure', (_request, _response, next) => {
      next(new Error('secret database detail'));
    });
    app.use(errorHandler);

    const response = await request(app).get('/failure');

    expect(response.status).toBe(500);
    expect(response.body.error.message).not.toContain('secret database detail');
  });

  it('validates UUID path parameters before reaching the handler', async () => {
    const app = express();
    let handlerCalled = false;
    app.get(
      '/studios/:studioId/sessions/:id',
      validateUuidParam('studioId'),
      validateUuidParam('id'),
      (_request, response) => {
        handlerCalled = true;
        response.json({ ok: true });
      },
    );
    app.use(errorHandler);

    const response = await request(app).get(
      '/studios/not-a-uuid/sessions/not-a-uuid',
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(handlerCalled).toBe(false);
  });

  it('maps expected PostgreSQL constraint errors without exposing database details', async () => {
    const app = express();
    app.get('/conflict', () => {
      throw Object.assign(new Error('private constraint detail'), {
        code: '23505',
      });
    });
    app.get('/invalid-data', () => {
      throw Object.assign(new Error('private check constraint detail'), {
        code: '23514',
      });
    });
    app.use(errorHandler);

    const conflict = await request(app).get('/conflict');
    const invalidData = await request(app).get('/invalid-data');

    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('CONFLICT');
    expect(conflict.text).not.toContain('private constraint detail');
    expect(invalidData.status).toBe(422);
    expect(invalidData.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(invalidData.text).not.toContain('private check constraint detail');
  });
});

const expressBodySchema = z.object({
  name: z.string(),
});
