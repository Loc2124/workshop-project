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
      for (let page = 1; ; page++) {
        const result = await catalogService.list(
          { page, pageSize: 100 },
          signal,
        );
        items.push(...result.items);
        if (
          !result.items.length ||
          page * result.pagination.pageSize >= result.pagination.total
        )
          break;
      }
      return items;
    },
  });
  return {
    ...query,
    items: query.data ?? [],
  };
}
