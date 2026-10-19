import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { getTestDatabaseSafetyIssues } from '../../../scripts/assert-safe-test-db.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const app = createApp();

describe('API foundation', () => {
  it('returns a successful health response', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('rejects a missing or invalid API port with a clear error', () => {
    expect(() => loadConfig({ NODE_ENV: 'test' })).toThrow(
      'Invalid API configuration: API_PORT',
    );
    expect(() => loadConfig({ API_PORT: 'not-a-port' })).toThrow(
      'Invalid API configuration: API_PORT',
    );
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
