import { z } from 'zod';

const integer = (max: number, fallback: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(max))
    .default(fallback);
export const adminListFields = {
  page: integer(1000000, 1),
  pageSize: integer(100, 20),
  q: z.string().trim().max(200).default(''),
  status: z.string().trim().min(1).max(100).default('all'),
  sort: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z][a-zA-Z0-9]*:(asc|desc)$/)
    .default('createdAt:desc'),
};
export const adminListQuery = z.object(adminListFields).strict();
