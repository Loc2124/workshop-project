import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ApiError,
  ApiAbortError,
  ApiNetworkError,
  apiFetch,
  shouldRetryApiQuery,
} from './api-client';
afterEach(() => vi.unstubAllGlobals());
describe('API query retries', () => {
  it('does not retry rate limits, invalid permissions or aborted requests', () => {
    for (const status of [400, 401, 403, 404, 422, 429])
      expect(shouldRetryApiQuery(0, new ApiError('error', status))).toBe(false);
    expect(shouldRetryApiQuery(0, new ApiAbortError())).toBe(false);
    expect(shouldRetryApiQuery(0, new ApiNetworkError())).toBe(true);
    expect(shouldRetryApiQuery(1, new ApiNetworkError())).toBe(false);
    expect(shouldRetryApiQuery(0, new ApiError('Unavailable', 503))).toBe(true);
  });
  it('keeps Retry-After and shows a useful message without resending the request', async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        { error: { code: 'RATE_LIMITED', message: 'Limit' } },
        { status: 429, headers: { 'Retry-After': '42' } },
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    await expect(apiFetch('/admin/studios')).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterSeconds: 42,
      message: expect.stringContaining('42'),
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
