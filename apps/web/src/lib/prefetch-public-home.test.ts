import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from './query-keys';

const mocks = vi.hoisted(() => ({ getPublicFeatured: vi.fn() }));
vi.mock('../services/featuredService', () => ({
  getPublicFeatured: mocks.getPublicFeatured,
}));

import { prefetchPublicHome } from './prefetch-public-home';

describe('prefetchPublicHome', () => {
  beforeEach(() => {
    mocks.getPublicFeatured.mockReset();
  });

  it('fetches and caches public featured data under the homepage query key', async () => {
    const data = { studios: [], workshops: [] };
    mocks.getPublicFeatured.mockResolvedValue(data);
    const queryClient = new QueryClient();

    await prefetchPublicHome(queryClient);

    expect(mocks.getPublicFeatured).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(queryKeys.public.home)).toEqual(data);
    queryClient.clear();
  });
});
