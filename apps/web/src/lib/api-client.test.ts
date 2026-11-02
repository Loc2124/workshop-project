import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiAbortError,
  ApiNetworkError,
  ApiResponseError,
  ApiTimeoutError,
  apiFetch,
} from './api-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('shares one refresh across concurrent expired requests and retries their bodies', async () => {
    let releaseRefresh!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const attempts = new Map<string, number>();
    const fetchMock = vi.fn<
      (url: URL, init?: RequestInit) => Promise<Response>
    >(async (url) => {
      if (url.pathname === '/auth/refresh') {
        await gate;
        return Response.json({ user: {} });
      }
      const count = (attempts.get(url.pathname) ?? 0) + 1;
      attempts.set(url.pathname, count);
      return count === 1
        ? Response.json({}, { status: 401 })
        : Response.json({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);
    const first = apiFetch('/studios', {
      method: 'POST',
      body: JSON.stringify({ name: 'Studio' }),
    });
    const second = apiFetch('/me');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    releaseRefresh();
    await expect(Promise.all([first, second])).resolves.toEqual([
      { ok: true },
      { ok: true },
    ]);
    expect(
      fetchMock.mock.calls.filter(([url]) => url.pathname === '/auth/refresh'),
    ).toHaveLength(1);
    const studioCalls = fetchMock.mock.calls.filter(
      ([url]) => url.pathname === '/studios',
    );
    expect(studioCalls[1][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ name: 'Studio' }),
    });
  });

  it('does not refresh again if a retried request still returns 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ user: {} }))
      .mockResolvedValueOnce(Response.json({}, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('stops when refresh is rejected', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(Response.json({}, { status: 401 })),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('accepts 204 responses without attempting to parse a body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiFetch('/auth/logout', { method: 'POST', responseType: 'void' }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('responseType');
  });

  it.each([
    [401, 'UNAUTHORIZED', 'Vui lòng đăng nhập.'],
    [403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.'],
    [409, 'CONFLICT', 'Email đã được sử dụng.'],
    [422, 'UNPROCESSABLE_ENTITY', 'Dữ liệu không hợp lệ.'],
  ])('preserves structured %i API errors', async (status, code, message) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: { code, message } }, { status }),
        ),
    );

    await expect(apiFetch('/auth/login')).rejects.toMatchObject({
      name: 'ApiError',
      status,
      code,
      message,
    });
  });

  it('falls back to a status message for HTML or malformed API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>proxy error</html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );

    await expect(apiFetch('/test')).rejects.toMatchObject({
      name: 'ApiError',
      status: 502,
      code: null,
      message: 'Yêu cầu không thành công (502).',
    });
  });

  it('classifies aborted, timed out, and network requests separately', async () => {
    const abortController = new AbortController();
    abortController.abort();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('', 'AbortError')),
    );
    await expect(
      apiFetch('/test', { signal: abortController.signal }),
    ).rejects.toBeInstanceOf(ApiAbortError);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('', 'TimeoutError')),
    );
    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiTimeoutError);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiNetworkError);
  });

  it('rejects malformed successful responses with a response error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('<html>not json</html>', { status: 200 }),
        ),
    );

    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiResponseError);
  });
});
