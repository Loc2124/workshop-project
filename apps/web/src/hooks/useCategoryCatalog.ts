import { useQuery } from '@tanstack/react-query';
import { mockWorkshops } from '../data/mockWorkshops';
import { catalogService } from '../services/catalogService';
import type { Workshop } from '../types/workshop';
import { isDemoDataMode } from '../lib/data-mode';

// Unfiltered and unpaginated: choosing a chip must not remove its siblings.
export function useCategoryCatalog() {
  const query = useQuery({
    queryKey: ['catalog', 'category-source'],
    enabled: !isDemoDataMode,
    staleTime: 60_000,
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
    items: isDemoDataMode ? mockWorkshops : (query.data ?? []),
  };
}
