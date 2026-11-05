import { QueryClient } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import type { DataTableFetcher } from './data-table';
import { prefetchDefaultTable } from './prefetch-table';
import { queryKeys } from './query-keys';

it('warms exactly the list and count keys consumed by a table, without a second fetch on navigation', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  });
  const fetcher: DataTableFetcher<{ id: string }> = vi.fn(async () => ({
    rows: [{ id: 'one' }],
    total: 1,
  }));
  fetcher.counts = vi.fn(async () => ({ all: 1 }));
  const query = {
    page: 1,
    pageSize: 20,
    q: '',
    sort: 'createdAt:desc',
    tab: 'all',
    filters: { period: '' },
  };
  try {
    await prefetchDefaultTable(client, 'owner', 'users', fetcher, ['period']);
    await client.fetchQuery({
      queryKey: [...queryKeys.users.lists('owner'), query],
      queryFn: ({ signal }) => fetcher(query, signal),
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      client.getQueryData([
        ...queryKeys.users.counts('owner'),
        '',
        query.filters,
      ]),
    ).toEqual({ all: 1 });
    expect(
      client.getQueryData([...queryKeys.users.lists('other'), query]),
    ).toBeUndefined();
  } finally {
    client.clear();
  }
});
