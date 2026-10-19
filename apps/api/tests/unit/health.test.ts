import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { getTestDatabaseSafetyIssues } from '../../../../scripts/assert-safe-test-db.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';

const app = createApp();

describe('API foundation', () => {
  it('returns a successful health response', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('uses PORT, falls back to API_PORT, and defaults to the local port', () => {
    expect(loadConfig({ PORT: '8080' }).API_PORT).toBe(8080);
    expect(loadConfig({ API_PORT: '4001' }).API_PORT).toBe(4001);
    expect(loadConfig({}).API_PORT).toBe(4000);
  });

  it('rejects invalid ports and requires secure cookies in production', () => {
    expect(() => loadConfig({ API_PORT: 'not-a-port' })).toThrow(
      'Invalid API configuration: API_PORT',
    );
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(
      'COOKIE_SECURE must be true in production.',
    );
    expect(
      loadConfig({ NODE_ENV: 'production', COOKIE_SECURE: 'true' })
        .COOKIE_SECURE,
    ).toBe('true');
  });

  it('validates the web origin, trusted proxy hops, and database pool size', () => {
    expect(() => loadConfig({ WEB_ORIGIN: 'not a URL' })).toThrow(
      'Invalid API configuration: WEB_ORIGIN',
    );
    expect(() => loadConfig({ TRUST_PROXY_HOPS: '-1' })).toThrow(
      'Invalid API configuration: TRUST_PROXY_HOPS',
    );
    expect(() => loadConfig({ DB_POOL_MAX: '21' })).toThrow(
      'Invalid API configuration: DB_POOL_MAX',
    );
    expect(
      loadConfig({
        WEB_ORIGIN: 'https://demo.example.com',
        TRUST_PROXY_HOPS: '1',
        DB_POOL_MAX: '3',
      }),
    ).toMatchObject({
      WEB_ORIGIN: 'https://demo.example.com',
      TRUST_PROXY_HOPS: 1,
      DB_POOL_MAX: 3,
    });
  });

  it('rejects destructive tests unless explicitly enabled', () => {
    const issues = getTestDatabaseSafetyIssues({
      DATABASE_URL: 'postgresql://dev_user:secret@dev.example.com:5432/app',
      DATABASE_URL_TEST:
        'postgresql://test_user:secret@test.example.com:5432/app',
      ALLOW_DESTRUCTIVE_TESTS: 'false',
    });

    expect(issues).toContain(
      'ALLOW_DESTRUCTIVE_TESTS must be exactly "true" to run tests or test-database operations.',
    );
  });

  it('rejects a test URL that shares the application host and username', () => {
    const issues = getTestDatabaseSafetyIssues({
      DATABASE_URL: 'postgresql://same_user:secret@db.example.com:5432/app',
      DATABASE_URL_TEST:
        'postgresql://same_user:secret@db.example.com:5432/test',
      ALLOW_DESTRUCTIVE_TESTS: 'true',
    });

    expect(issues).toContain(
      'DATABASE_URL_TEST has the same host and username as DATABASE_URL; use a separate test Supabase project or a distinct database user.',
    );
  });

  it('accepts separate hosts and a literal opt-in', () => {
    const issues = getTestDatabaseSafetyIssues({
      DATABASE_URL: 'postgresql://postgres:secret@dev.example.com:5432/app',
      DATABASE_URL_TEST:
        'postgresql://postgres:secret@test.example.com:5432/app',
      ALLOW_DESTRUCTIVE_TESTS: 'true',
    });

    expect(issues).toEqual([]);
  });
});
