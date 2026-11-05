import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { catalogService } from '../services/catalogService';
import type { CatalogFilters } from '../types/catalog';

export const catalogKeys = {
  all: ['catalog'] as const,
  list: (filters: CatalogFilters) =>
    [...catalogKeys.all, 'workshops', 'lists', filters] as const,
  studios: (filters: CatalogFilters) =>
    [...catalogKeys.all, 'studios', filters] as const,
  detail: (id: string) =>
    [...catalogKeys.all, 'workshops', 'detail', id] as const,
  reviews: (id: string) => [...catalogKeys.all, 'reviews', id] as const,
  studioDetail: (id: string) =>
    [...catalogKeys.all, 'studios', 'detail', id] as const,
};

export function useCatalog(filters: CatalogFilters, enabled = true) {
  return useQuery({
    queryKey: catalogKeys.list(filters),
    queryFn: ({ signal }) => catalogService.list(filters, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCatalogStudios(filters: CatalogFilters, enabled = true) {
  return useQuery({
    queryKey: catalogKeys.studios(filters),
    queryFn: ({ signal }) => catalogService.listStudios(filters, signal),
    enabled,
    placeholderData: keepPreviousData,
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

export function useWorkshopReviews(id: string) {
  return useQuery({
    queryKey: catalogKeys.reviews(id),
    queryFn: ({ signal }) => catalogService.reviews(id, signal),
    enabled: Boolean(id),
  });
}
