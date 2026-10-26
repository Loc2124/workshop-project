import { apiFetch } from '../lib/api-client';
import type { CatalogResponse, Workshop } from '../types/workshop';

export const catalogService = {
  list: (category: string, signal?: AbortSignal) => {
    const search = new URLSearchParams({ page_size: '12' });
    if (category) search.set('category', category);
    return apiFetch<CatalogResponse>(`/workshops?${search.toString()}`, {
      signal,
    });
  },

  getById: (id: string, signal?: AbortSignal) =>
    apiFetch<{ workshop: Workshop }>(`/workshops/${id}`, { signal }),
};
