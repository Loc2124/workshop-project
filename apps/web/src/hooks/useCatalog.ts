import { useQuery } from '@tanstack/react-query';
import { catalogService } from '../services/catalogService';

export const catalogKeys = {
  all: ['catalog'] as const,
  list: (category: string) => [...catalogKeys.all, category] as const,
  detail: (id: string) => [...catalogKeys.all, 'detail', id] as const,
};

export function useCatalog(category: string) {
  return useQuery({
    queryKey: catalogKeys.list(category),
    queryFn: ({ signal }) => catalogService.list(category, signal),
  });
}

export function useWorkshop(id: string) {
  return useQuery({
    queryKey: catalogKeys.detail(id),
    queryFn: ({ signal }) => catalogService.getById(id, signal),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}
