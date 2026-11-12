import { QueryClient } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { prefetchNavigation } from './prefetch-navigation';
import { authQueryKey } from '../api/session-cache';
import { queryKeys } from '../api/query-keys';
import { catalogService } from '../../services/catalogService';

afterEach(() => vi.restoreAllMocks());

it('does not warm private endpoints for guests or customers hovering admin links', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const client = new QueryClient();
  try {
    await prefetchNavigation(client, new URL('https://open-slot.test/admin'));
    client.setQueryData(authQueryKey, { id: 'customer', role: 'customer' });
    await prefetchNavigation(
      client,
      new URL('https://open-slot.test/admin/nguoi-dung'),
    );
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    client.clear();
  }
});

it('uses the same public detail cache key on hover and navigation', async () => {
  const client = new QueryClient();
  const detail = vi
    .spyOn(catalogService, 'getStudioById')
    .mockResolvedValue({ studio: { id: 'studio' } } as Awaited<
      ReturnType<typeof catalogService.getStudioById>
    >);
  try {
    await prefetchNavigation(
      client,
      new URL('https://open-slot.test/studios/studio'),
    );
    await prefetchNavigation(
      client,
      new URL('https://open-slot.test/studios/studio'),
    );
    expect(detail).toHaveBeenCalledTimes(1);
    expect(
      client.getQueryData(['catalog', 'studios', 'detail', 'studio']),
    ).toEqual({ studio: { id: 'studio' } });
  } finally {
    client.clear();
  }
});

it('does not warm locked studio sections or a studio outside the current ownership list', async () => {
  const client = new QueryClient();
  const fetch = vi.spyOn(globalThis, 'fetch');
  client.setQueryData(authQueryKey, { id: 'owner', role: 'studio_owner' });
  client.setQueryData(queryKeys.studios.mine('owner'), [
    { id: 'studio', role: 'owner', status: 'pending' },
  ]);
  try {
    await prefetchNavigation(
      client,
      new URL('https://open-slot.test/studio/studio/sessions'),
    );
    await prefetchNavigation(
      client,
      new URL('https://open-slot.test/studio/another/workshops'),
    );
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    client.clear();
  }
});
