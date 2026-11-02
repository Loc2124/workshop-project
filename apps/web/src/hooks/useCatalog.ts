import { useQuery } from '@tanstack/react-query';
import { catalogService } from '../services/catalogService';
import type { CatalogFilters } from '../types/catalog';

export const catalogKeys = {
  all: ['catalog'] as const,
  list: (filters: CatalogFilters) => [...catalogKeys.all, filters] as const,
  studios: (filters: CatalogFilters) =>
    [...catalogKeys.all, 'studios', filters] as const,
  detail: (id: string) => [...catalogKeys.all, 'detail', id] as const,
};

export function useCatalog(filters: CatalogFilters, enabled = true) {
  return useQuery({
    queryKey: catalogKeys.list(filters),
    queryFn: ({ signal }) => catalogService.list(filters, signal),
    enabled,
  });
}

export function useCatalogStudios(filters: CatalogFilters, enabled = true) {
  return useQuery({
    queryKey: catalogKeys.studios(filters),
    queryFn: ({ signal }) => catalogService.listStudios(filters, signal),
    enabled,
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
