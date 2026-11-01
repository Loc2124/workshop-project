import { apiFetch } from '../lib/api-client';
import type { CatalogResponse, Workshop } from '../types/workshop';
import type { CatalogFilters } from '../types/catalog';
import type { PublicStudio } from '../types/studio';

export const catalogService = {
  provinces: (signal?: AbortSignal) =>
    apiFetch<{
      provinces: Array<{ id: string; name: string; studioCount: number }>;
    }>('/provinces', { signal }),

  areas: (provinceId: string, signal?: AbortSignal) =>
    apiFetch<{
      areas: Array<{ id: string; name: string; studioCount: number }>;
    }>(`/provinces/${encodeURIComponent(provinceId)}/areas`, { signal }),

  list: (filters: CatalogFilters, signal?: AbortSignal) => {
    const search = new URLSearchParams({
      page: String(filters.page),
      page_size: String(filters.pageSize),
    });
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
    return apiFetch<CatalogResponse>(`/workshops?${search.toString()}`, {
      signal,
    });
  },

  getById: (idOrSlug: string, signal?: AbortSignal) =>
    apiFetch<{ workshop: Workshop }>(
      `/workshops/${encodeURIComponent(idOrSlug)}`,
      { signal },
    ),

  getStudioById: (idOrSlug: string, signal?: AbortSignal) =>
    apiFetch<{ studio: PublicStudio }>(
      `/studios/${encodeURIComponent(idOrSlug)}`,
      { signal },
    ),
};
