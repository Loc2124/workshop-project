import { gzipSync } from 'node:zlib';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('JSON request body parser', () => {
  it('accepts regular JSON and validates its schema', async () => {
    const response = await request(app).post('/auth/register').send({});

    expect(response.status).toBe(422);
  });

  it('rejects compressed JSON with an unsupported media type response', async () => {
    const response = await request(app)
      .post('/auth/register')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send(gzipSync(Buffer.from('{}')));

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('returns 400 for malformed JSON and 413 for oversized JSON', async () => {
    const malformed = await request(app)
      .post('/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('BAD_REQUEST');

    const oversized = await request(app)
      .post('/auth/register')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ value: 'x'.repeat(100 * 1024) }));

    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
