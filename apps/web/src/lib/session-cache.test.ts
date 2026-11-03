import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  authQueryKey,
  installSessionLifecycle,
  synchronizeSession,
} from './session-cache';
import { apiFetch, ApiAbortError } from './api-client';
import { queryKeys } from './query-keys';
import { studioDraftKey } from './studio-registration-draft';

const a = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'a@example.test',
  fullName: 'A',
  role: 'studio_owner' as const,
};
const b = {
  ...a,
  id: '00000000-0000-4000-8000-000000000002',
  email: 'b@example.test',
};
const disposers: (() => void)[] = [];
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const storage = new Map([
    [studioDraftKey(a.id), 'draft A'],
    [studioDraftKey(b.id), 'draft B'],
  ]);
  vi.stubGlobal('sessionStorage', {
    removeItem: (key: string) => storage.delete(key),
  });
  disposers.push(installSessionLifecycle(client), () => client.clear());
  return { client, storage };
}
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
  vi.unstubAllGlobals();
});

describe('account cache boundary', () => {
  it('waits for cancellation, clears data and removes only the departing account draft', async () => {
    const { client, storage } = setup();
    await synchronizeSession(client, a);
    client.setQueryData(queryKeys.studios.mine(a.id), ['private A']);
    let complete!: () => void;
    const original = client.cancelQueries.bind(client);
    vi.spyOn(client, 'cancelQueries').mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        complete = resolve;
      });
      await original();
    });
    const changing = synchronizeSession(client, b);
    await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
    expect(client.getQueryData(queryKeys.studios.mine(a.id))).toEqual([
      'private A',
    ]);
    complete();
    await changing;
    expect(client.getQueryData(queryKeys.studios.mine(a.id))).toBeUndefined();
    expect(client.getQueryData(authQueryKey)).toEqual(b);
    expect(storage.has(studioDraftKey(a.id))).toBe(false);
    expect(storage.get(studioDraftKey(b.id))).toBe('draft B');
    // An in-flight mutation from A must not repopulate the cache after switching.
    client.setQueryData(queryKeys.studios.mine(a.id), ['late A']);
    expect(client.getQueryData(queryKeys.studios.mine(a.id))).toBeUndefined();
  });

  it('cleans private data and drafts when refresh fails', async () => {
    const { client, storage } = setup();
    await synchronizeSession(client, a);
    client.setQueryData(queryKeys.bookings.list(a.id, {}), ['booking A']);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401 })),
    );
    await expect(apiFetch('/private-bookings')).rejects.toMatchObject({
      status: 401,
    });
    expect(client.getQueryData(authQueryKey)).toBeNull();
    expect(
      client.getQueryData(queryKeys.bookings.list(a.id, {})),
    ).toBeUndefined();
    expect(storage.has(studioDraftKey(a.id))).toBe(false);
  });

  it('does not restore a logged-out session from a late refresh response', async () => {
    const { client } = setup();
    await synchronizeSession(client, a);
    let finish!: (response: Response) => void;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      );
    vi.stubGlobal('fetch', fetch);
    const request = apiFetch('/private-bookings');
    const rejection = expect(request).rejects.toBeInstanceOf(ApiAbortError);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    await synchronizeSession(client, null, true);
    finish(Response.json({ user: a }));
    await rejection;
    expect(client.getQueryData(authQueryKey)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not replay a request with another account revealed by refresh', async () => {
    const { client } = setup();
    await synchronizeSession(client, a);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(Response.json({ user: b }));
    vi.stubGlobal('fetch', fetch);
    await expect(
      apiFetch('/private-bookings', { method: 'POST', body: '{}' }),
    ).rejects.toBeInstanceOf(ApiAbortError);
    expect(client.getQueryData(authQueryKey)).toEqual(b);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('treats a malformed refresh user as a failed session', async () => {
    const { client } = setup();
    await synchronizeSession(client, a);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('{}', { status: 401 }))
        .mockResolvedValueOnce(Response.json({ user: { id: 'invalid' } })),
    );
    await expect(apiFetch('/private-bookings')).rejects.toThrow(
      'Invalid refresh response',
    );
    expect(client.getQueryData(authQueryKey)).toBeNull();
  });
});
