import { z } from 'zod';

const queryInteger = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().safe());
const queryPrice = queryInteger.pipe(z.number().max(2_147_483_647));
const areaIds = z
  .union([
    z
      .string()
      .uuid()
      .transform((id) => [id]),
    z.array(z.string().uuid()).max(50),
  ])
  .optional();

const calendarDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
});

export const catalogQuerySchema = z
  .object({
    date_from: calendarDate.optional(),
    date_to: calendarDate.optional(),
    price_min: queryPrice.optional(),
    price_max: queryPrice.optional(),
    province_id: z.string().trim().min(1).max(100).optional(),
    area_ids: areaIds,
    category_id: z.string().trim().min(1).max(100).optional(),
    level: z.enum(['beginner', 'intermediate', 'all']).optional(),
    audience: z.string().trim().min(1).max(100).optional(),
    page: queryInteger.optional(),
    page_size: queryInteger.optional(),
  })
  .strict()
  .superRefine((filters, context) => {
    if (
      filters.date_from &&
      filters.date_to &&
      filters.date_from > filters.date_to
    ) {
      context.addIssue({
        code: 'custom',
        message: 'date_from must be on or before date_to.',
        path: ['date_from'],
      });
    }
    if (
      filters.price_min !== undefined &&
      filters.price_max !== undefined &&
      filters.price_min > filters.price_max
    ) {
      context.addIssue({
        code: 'custom',
        message: 'price_min must be less than or equal to price_max.',
        path: ['price_min'],
      });
    }
    if (
      filters.page !== undefined &&
      (filters.page < 1 || filters.page > 1_000_000)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'page must be a positive integer.',
        path: ['page'],
      });
    }
    if (
      filters.page_size !== undefined &&
      (filters.page_size < 1 || filters.page_size > 100)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'page_size must be between 1 and 100.',
        path: ['page_size'],
      });
    }
  });

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export type CatalogFilters = {
  dateFrom?: string;
  dateTo?: string;
  priceMin?: number;
  priceMax?: number;
  provinceId?: string;
  areaIds?: string[];
  categoryId?: string;
  level?: 'beginner' | 'intermediate' | 'all';
  audience?: string;
  page: number;
  pageSize: number;
};

export function toCatalogFilters(query: CatalogQuery): CatalogFilters {
  return {
    dateFrom: query.date_from,
    dateTo: query.date_to,
    priceMin: query.price_min,
    priceMax: query.price_max,
    provinceId: query.province_id,
    areaIds: query.area_ids,
    categoryId: query.category_id,
    level: query.level,
    audience: query.audience,
    page: query.page ?? 1,
    pageSize: query.page_size ?? 20,
  };
}
