import type { QueryClient } from '@tanstack/react-query';
import type { DataTableFetcher, DataTableQuery } from '../core/data-table';
import { queryKeys } from '../api/query-keys';

// Used only for sidebar destinations with no query string. Filtered URLs are
// left to each page's existing validator, so speculative work cannot alter them.
export function prefetchDefaultTable<T>(
  client: QueryClient,
  userId: string,
  resource:
    'studios' | 'workshops' | 'bookings' | 'users' | 'reports' | 'audit',
  fetcher: DataTableFetcher<T>,
  filterIds: readonly string[],
  options: { tab?: string; sort?: string } = {},
) {
  const group = queryKeys[resource];
  const query: DataTableQuery = {
    page: 1,
    pageSize: 20,
    sort: options.sort ?? 'createdAt:desc',
    q: '',
    tab: options.tab ?? 'all',
    filters: Object.fromEntries(filterIds.map((id) => [id, ''])),
  };
  return Promise.all([
    client.prefetchQuery({
      queryKey: [...group.lists(userId), query],
      queryFn: ({ signal }) => fetcher(query, signal),
      staleTime: 30_000,
    }),
    ...(fetcher.counts
      ? [
          client.prefetchQuery({
            queryKey: [...group.counts(userId), query.q, query.filters],
            queryFn: ({ signal }) => fetcher.counts!(query, signal),
            staleTime: 30_000,
          }),
        ]
      : []),
  ]);
}
