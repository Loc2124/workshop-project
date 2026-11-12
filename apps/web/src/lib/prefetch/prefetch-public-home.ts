import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/query-keys';

export function prefetchPublicHome(queryClient: QueryClient) {
  return queryClient.prefetchQuery({
    queryKey: queryKeys.public.home,
    queryFn: async ({ signal }) => {
      const { getPublicFeatured } = await import('@/services/featuredService');
      return getPublicFeatured(signal);
    },
    staleTime: 30_000,
  });
}
