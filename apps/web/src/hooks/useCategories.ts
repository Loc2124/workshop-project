import { useQuery } from '@tanstack/react-query';
import { registerCategories, type Category } from '../constants/categories';
import { apiFetch } from '../lib/api-client';
import { isDemoDataMode } from '../lib/data-mode';
import { z } from 'zod';

const schema = z.object({
  categories: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      icon: z.string().nullable(),
      color: z.string().nullable(),
      placeholderImage: z.string().nullable(),
      status: z.enum(['active', 'pending']),
      sortOrder: z.number(),
      isVisible: z.boolean().optional(),
      keywords: z.array(z.string()),
      description: z.string(),
      imagePosition: z
        .string()
        .nullish()
        .transform((value) => value ?? undefined),
    }),
  ),
});

export function useCategoriesQuery(alwaysFetch = false) {
  return useQuery({
    queryKey: ['categories'],
    enabled: alwaysFetch || !isDemoDataMode,
    staleTime: 60000,
    queryFn: async ({ signal }) =>
      registerCategories(
        schema.parse(await apiFetch('/categories', { signal }))
          .categories as Category[],
      ),
  });
}

export function useCategories(alwaysFetch = false) {
  return useCategoriesQuery(alwaysFetch).data;
}
