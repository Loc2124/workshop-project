import { afterEach, describe, expect, it, vi } from 'vitest';
import { authService } from './authService';

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'khach@example.com',
  fullName: 'Nguyen Thi An',
  role: 'customer',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authService', () => {
  it('restores a session by refreshing an expired access cookie then checking /me', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: 'UNAUTHORIZED', message: 'Hết hạn.' } },
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ user }))
      .mockResolvedValueOnce(Response.json({ user }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authService.currentUser()).resolves.toEqual(user);
    expect(
      fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname),
    ).toEqual(['/me', '/auth/refresh', '/me']);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
    });
  });

  it('returns an unauthenticated result when refresh is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json(
            { error: { code: 'UNAUTHORIZED', message: 'Hết hạn.' } },
            { status: 401 },
          ),
        )
        .mockResolvedValueOnce(
          Response.json(
            { error: { code: 'UNAUTHORIZED', message: 'Phiên hết hạn.' } },
            { status: 401 },
          ),
        ),
    );

    await expect(authService.currentUser()).resolves.toBeNull();
  });

  it('does not hide network failures while restoring a session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValueOnce(new TypeError('network unavailable')),
    );

    await expect(authService.currentUser()).rejects.toMatchObject({
      name: 'ApiNetworkError',
    });
  });

  it('logs in with the API response shape and clears the session on logout', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ user }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      authService.login({
        email: 'khach@example.com',
        password: 'WillowFern72!',
      }),
    ).resolves.toEqual(user);
    await expect(authService.logout()).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        email: 'khach@example.com',
        password: 'WillowFern72!',
      }),
    });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
    });
  });

  it('registers a customer without treating registration as an authenticated session', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ user }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      authService.register({
        fullName: '  Nguyen Thi An  ',
        email: '  khach@example.com  ',
        password: 'WillowFern72!',
      }),
    ).resolves.toEqual(user);

    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe(
      '/auth/register',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        fullName: 'Nguyen Thi An',
        email: 'khach@example.com',
        password: 'WillowFern72!',
      }),
    });
  });

  it('rejects invalid registration data before making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      authService.register({
        fullName: 'A',
        email: 'invalid',
        password: 'short',
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
