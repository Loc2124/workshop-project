import { z } from 'zod';
import { categoryValue, getCategoryMeta } from '../constants/categories';
import { provinceSlug } from './catalog';
import { parseCalendarDate } from './calendar-date';
import { searchQuerySchema } from './form-validation';
import type { CatalogFilters, SortOption } from '../types/catalog';
import type { ProvinceOption } from '../components/catalog/ProvinceCombobox';

const postgresIntegerMax = 2_147_483_647;
const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => parseCalendarDate(value) !== undefined);
const pageSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(postgresIntegerMax));
const priceSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/)
  .transform(Number)
  .pipe(z.number().int().min(0).max(postgresIntegerMax));
const sortSchema = z.enum([
  'recommended',
  'soonest',
  'price-asc',
  'price-desc',
]);
const viewSchema = z.enum(['workshop', 'workshops', 'studio', 'studios']);
const levelSchema = z.enum(['beginner', 'intermediate', 'all']);
const audienceSchema = z.string().trim().min(1).max(100);

export type ParsedExploreUrl = {
  filters: CatalogFilters;
  sort: SortOption;
  view: 'workshops' | 'studios';
  query: string;
  normalizedParams: URLSearchParams;
};

function readValidated<T>(
  params: URLSearchParams,
  key: string,
  schema: z.ZodType<T>,
) {
  const value = params.get(key);
  if (value === null) return undefined;
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  params.delete(key);
  return undefined;
}

function resolveCategory(params: URLSearchParams, categoriesReady: boolean) {
  const categoryKeys = ['mon', 'type', 'category', 'category_id'];
  let categoryId: string | undefined;
  for (const key of categoryKeys) {
    const rawValue = params.get(key);
    if (rawValue === null) continue;
    const validValue = categoryValue(rawValue);
    if (validValue) categoryId ??= validValue;
    else if (categoriesReady) params.delete(key);
  }
  if (categoryId) {
    categoryKeys.forEach((key) => params.delete(key));
    params.set('type', getCategoryMeta(categoryId).slug);
  }
  return categoryId;
}

function resolveProvince(params: URLSearchParams, provinces: ProvinceOption[]) {
  const id = params.get('province_id');
  // Province ids in the public API are slugs (for example "ha-noi"), not UUIDs.
  // Keep an explicit id until the province list is available for validation.
  if (id !== null && !/^[\p{L}\p{N}-]{1,100}$/u.test(id))
    params.delete('province_id');

  const value = params.get('province');
  if (value === null) return params.get('province_id') ?? undefined;
  if (provinces.length === 0) return params.get('province_id') ?? undefined;

  const province = provinces.find(
    (item) =>
      item.id === params.get('province_id') ||
      item.id === value ||
      provinceSlug(item.name) === value,
  );
  if (!province) {
    params.delete('province');
    params.delete('province_id');
    return undefined;
  }
  params.delete('province');
  params.set('province_id', province.id);
  return province.id;
}

export function parseExploreUrl(
  input: URLSearchParams,
  provinces: ProvinceOption[] = [],
  categoriesReady = true,
): ParsedExploreUrl {
  const normalizedParams = new URLSearchParams(input);
  const page = readValidated(normalizedParams, 'page', pageSchema) ?? 1;
  const priceMin = readValidated(normalizedParams, 'price_min', priceSchema);
  const priceMax = readValidated(normalizedParams, 'price_max', priceSchema);
  const validPriceMin =
    priceMin !== undefined && priceMax !== undefined && priceMin > priceMax
      ? undefined
      : priceMin;
  const validPriceMax =
    priceMin !== undefined && priceMax !== undefined && priceMin > priceMax
      ? undefined
      : priceMax;
  if (validPriceMin === undefined && priceMin !== undefined)
    normalizedParams.delete('price_min');
  if (validPriceMax === undefined && priceMax !== undefined)
    normalizedParams.delete('price_max');

  let dateFrom: string | undefined;
  let dateTo: string | undefined;
  const singleDate = readValidated(normalizedParams, 'date', dateSchema);
  if (singleDate) {
    normalizedParams.delete('date_from');
    normalizedParams.delete('date_to');
    dateFrom = singleDate;
    dateTo = singleDate;
  } else {
    dateFrom = readValidated(normalizedParams, 'date_from', dateSchema);
    dateTo = readValidated(normalizedParams, 'date_to', dateSchema);
    if (dateFrom && dateTo && dateFrom > dateTo) {
      normalizedParams.delete('date_from');
      normalizedParams.delete('date_to');
      dateFrom = undefined;
      dateTo = undefined;
    }
  }

  const areaIds = [...new Set(normalizedParams.getAll('area_ids'))].filter(
    (areaId) => uuidSchema.safeParse(areaId).success,
  );
  normalizedParams.delete('area_ids');
  areaIds.forEach((areaId) => normalizedParams.append('area_ids', areaId));

  const level = readValidated(normalizedParams, 'level', levelSchema);
  const audience = readValidated(normalizedParams, 'audience', audienceSchema);
  const sortResult = sortSchema.safeParse(normalizedParams.get('sort'));
  if (normalizedParams.has('sort') && !sortResult.success)
    normalizedParams.delete('sort');
  const viewResult = viewSchema.safeParse(normalizedParams.get('view'));
  if (normalizedParams.has('view') && !viewResult.success)
    normalizedParams.delete('view');

  const query = searchQuerySchema.safeParse(normalizedParams.get('q') ?? '');
  if (!query.success) normalizedParams.delete('q');
  const validQuery = query.success ? query.data : '';
  const sameDay = normalizedParams.get('same_day') === 'true';
  if (normalizedParams.has('same_day') && !sameDay)
    normalizedParams.delete('same_day');

  return {
    filters: {
      page,
      pageSize: 12,
      categoryId: resolveCategory(normalizedParams, categoriesReady),
      provinceId: resolveProvince(normalizedParams, provinces),
      areaIds: areaIds.length > 0 ? areaIds : undefined,
      level,
      audience,
      priceMin: validPriceMin,
      priceMax: validPriceMax,
      dateFrom,
      dateTo,
      takeawaySameDay: sameDay || undefined,
    },
    sort: sortResult.success ? sortResult.data : 'recommended',
    view:
      viewResult.success &&
      (viewResult.data === 'studio' || viewResult.data === 'studios')
        ? 'studios'
        : 'workshops',
    query: validQuery,
    normalizedParams,
  };
}
