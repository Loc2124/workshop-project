import { useQuery } from '@tanstack/react-query';
import { catalogService } from '../services/catalogService';
import type { Workshop } from '../types/workshop';
// Unfiltered and unpaginated: choosing a chip must not remove its siblings.
export function useCategoryCatalog() {
  const query = useQuery({
    queryKey: ['catalog', 'category-source'],
    enabled: true,
    staleTime: 60000,
    queryFn: async ({ signal }) => {
      const items: Workshop[] = [];
      const first = await catalogService.list(
        { page: 1, pageSize: 100 },
        signal,
      );
      items.push(...first.items);
      const lastPage = Math.ceil(
        first.pagination.total / first.pagination.pageSize,
      );
      // Suggestions depend on the complete catalog and its order. Keep those
      // semantics while bounding parallel requests to avoid flooding the API.
      for (let page = 2; page <= lastPage; page += 3) {
        const pages = await Promise.all(
          Array.from({ length: Math.min(3, lastPage - page + 1) }, (_, index) =>
            catalogService.list({ page: page + index, pageSize: 100 }, signal),
          ),
        );
        pages.forEach((result) => items.push(...result.items));
        if (pages.some((result) => !result.items.length)) break;
      }
      return items;
    },
  });
  return {
    ...query,
    items: query.data ?? [],
  };
}
