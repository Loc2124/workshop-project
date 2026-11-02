import { z } from 'zod';
import { apiFetch, ApiResponseError } from '../lib/api-client';
import type { DataTableFetcher, DataTableQuery } from '../lib/data-table';
import {
  adminStudioSchema,
  adminWorkshopSchema,
  type AdminStudio,
  type AdminWorkshop,
} from '../types/management';
export function adminTableSearch(query: DataTableQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    status: query.tab,
  });
  if (query.q) params.set('q', query.q);
  if (query.sort) params.set('sort', query.sort);
  for (const [name, value] of Object.entries(query.filters))
    if (value) params.set(name, value);
  return params.toString();
}
export function createAdminTableFetcher<T>(
  endpoint: string,
  schema: z.ZodType<T>,
  withCounts = true,
): DataTableFetcher<T> {
  const fetcher: DataTableFetcher<T> = async (query, signal) => {
    const parsed = z
      .object({ items: z.array(schema), total: z.number().int().nonnegative() })
      .strict()
      .safeParse(
        await apiFetch(`${endpoint}?${adminTableSearch(query)}`, { signal }),
      );
    if (!parsed.success) throw new ApiResponseError();
    return { rows: parsed.data.items, total: parsed.data.total };
  };
  if (withCounts)
    fetcher.counts = async (query, signal) => {
      const params = new URLSearchParams();
      if (query.q) params.set('q', query.q);
      for (const [name, value] of Object.entries(query.filters))
        if (value) params.set(name, value);
      return z
        .object({
          counts: z.record(z.string(), z.number().int().nonnegative()),
        })
        .strict()
        .parse(await apiFetch(`${endpoint}/counts?${params}`, { signal }))
        .counts;
    };
  return fetcher;
}
export const fetchAdminStudios: DataTableFetcher<AdminStudio> =
  createAdminTableFetcher('/admin/studios', adminStudioSchema);
export const fetchAdminWorkshops: DataTableFetcher<AdminWorkshop> =
  createAdminTableFetcher('/admin/workshops', adminWorkshopSchema);
