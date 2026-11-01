import { useQuery } from '@tanstack/react-query';
import { registerCategories, type Category } from '../constants/categories';
import { apiFetch } from '../lib/api-client';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    enabled: !import.meta.env.DEV,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const data = await apiFetch<{ categories: Category[] }>('/categories', {
        signal,
      });
      return registerCategories(data.categories);
    },
  }).data;
}
