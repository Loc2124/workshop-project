import {
  catalogResponseSchema,
  publicStudioResponseSchema,
  publicWorkshopResponseSchema,
} from '@workshop/shared';
import { apiFetch } from '../lib/api-client';
import type { CatalogFilters } from '../types/catalog';
import type { StudioCatalogResponse } from '../types/studio';

export const catalogService = {
  provinces: (signal?: AbortSignal, includeEmpty = false) =>
    apiFetch<{
      provinces: Array<{ id: string; name: string; studioCount: number }>;
    }>(`/provinces${includeEmpty ? '?include_empty=true' : ''}`, { signal }),

  areas: (provinceId: string, signal?: AbortSignal) =>
    apiFetch<{
      areas: Array<{ id: string; name: string; studioCount: number }>;
    }>(`/provinces/${encodeURIComponent(provinceId)}/areas`, { signal }),

  list: (filters: CatalogFilters, signal?: AbortSignal) => {
    const search = toCatalogSearchParams(filters);
    return apiFetch<unknown>(`/workshops?${search.toString()}`, {
      signal,
    }).then((response) => catalogResponseSchema.parse(response));
  },

  listStudios: (filters: CatalogFilters, signal?: AbortSignal) => {
    const search = toCatalogSearchParams(filters);
    return apiFetch<StudioCatalogResponse>(
      `/catalog/studios?${search.toString()}`,
      { signal },
    );
  },

  getById: (idOrSlug: string, signal?: AbortSignal) =>
    apiFetch<unknown>(`/workshops/${encodeURIComponent(idOrSlug)}`, {
      signal,
    }).then((response) => publicWorkshopResponseSchema.parse(response)),

  getStudioById: (idOrSlug: string, signal?: AbortSignal) =>
    apiFetch<unknown>(`/studios/${encodeURIComponent(idOrSlug)}`, {
      signal,
    }).then((response) => publicStudioResponseSchema.parse(response)),
};

function toCatalogSearchParams(filters: CatalogFilters): URLSearchParams {
  const search = new URLSearchParams({
    page: String(filters.page),
    page_size: String(filters.pageSize),
    sort: filters.sort ?? 'recommended',
  });
  if (filters.query?.trim()) search.set('q', filters.query.trim());
  if (filters.categoryId) search.set('category_id', filters.categoryId);
  if (filters.provinceId) search.set('province_id', filters.provinceId);
  filters.areaIds?.forEach((areaId) => search.append('area_ids', areaId));
  if (filters.level) search.set('level', filters.level);
  if (filters.audience) search.set('audience', filters.audience);
  if (filters.priceMin !== undefined)
    search.set('price_min', String(filters.priceMin));
  if (filters.priceMax !== undefined)
    search.set('price_max', String(filters.priceMax));
  if (filters.dateFrom) search.set('date_from', filters.dateFrom);
  if (filters.dateTo) search.set('date_to', filters.dateTo);
  if (filters.takeawaySameDay) search.set('same_day', 'true');
  return search;
}
