import { z } from 'zod';
import { query } from '../../db/pool.js';
import { adminListFields } from './admin-list-query.js';
import { listMessageTemplates } from './message-templates.js';
export const categoryListQuery = z
  .object({
    ...adminListFields,
    status: z.enum(['all', 'visible', 'hidden']).default('all'),
    sort: z
      .enum([
        'sortOrder:asc',
        'sortOrder:desc',
        'name:asc',
        'name:desc',
        'slug:asc',
        'slug:desc',
        'workshopCount:asc',
        'workshopCount:desc',
      ])
      .default('sortOrder:asc'),
  })
  .strict();
export async function listCategoryItems(
  filters: z.infer<typeof categoryListQuery>,
  countsOnly = false,
) {
  const values: unknown[] = [];
  const bind = (v: unknown) => `$${values.push(v)}`;
  const clauses = ['true'];
  if (filters.q) {
    const p = bind('%' + filters.q.replace(/[\\%_]/g, '\\$&') + '%');
    clauses.push(`(c.name ILIKE ${p} OR c.slug ILIKE ${p})`);
  }
  const counts = (
    await query<{ all: number; visible: number; hidden: number }>(
      `SELECT count(*)::int AS all,count(*) FILTER(WHERE is_visible)::int AS visible,count(*) FILTER(WHERE NOT is_visible)::int AS hidden FROM categories c WHERE ${clauses.join(' AND ')}`,
      values,
    )
  ).rows[0];
  if (countsOnly) return { items: [], total: counts.all, counts };
  if (filters.status !== 'all')
    clauses.push(
      filters.status === 'visible' ? 'c.is_visible' : 'NOT c.is_visible',
    );
  const sorts: Record<string, string> = {
    sortOrder: 'c.sort_order',
    name: 'c.name',
    slug: 'c.slug',
    workshopCount: '"workshopCount"',
  };
  const [field, dir] = filters.sort.split(':');
  const items = (
    await query(
      `SELECT c.id,c.name,c.slug,c.is_visible AS "isVisible",c.sort_order AS "sortOrder",c.status AS "reviewStatus",(SELECT count(*)::int FROM workshops w WHERE w.category_id=c.id) AS "workshopCount" FROM categories c WHERE ${clauses.join(' AND ')} ORDER BY (c.id='other'),${sorts[field]} ${dir === 'asc' ? 'ASC' : 'DESC'},c.id LIMIT ${bind(filters.pageSize)} OFFSET ${bind((filters.page - 1) * filters.pageSize)}`,
      values,
    )
  ).rows;
  return { items, total: counts[filters.status], counts };
}
export const templateListQuery = z
  .object({
    ...adminListFields,
    status: z.literal('all').default('all'),
    sort: z
      .enum([
        'key:asc',
        'key:desc',
        'subject:asc',
        'subject:desc',
        'updatedAt:asc',
        'updatedAt:desc',
      ])
      .default('key:asc'),
  })
  .strict();
export async function listTemplateItems(
  filters: z.infer<typeof templateListQuery>,
) {
  const q = filters.q.toLocaleLowerCase();
  const rows = (await listMessageTemplates()).templates.filter((t) =>
    [t.key, t.subject, t.body, t.label].some((v) =>
      v.toLocaleLowerCase().includes(q),
    ),
  );
  const [field, dir] = filters.sort.split(':');
  rows.sort(
    (a, b) =>
      String(a[field as 'key' | 'subject' | 'updatedAt']).localeCompare(
        String(b[field as 'key' | 'subject' | 'updatedAt']),
      ) * (dir === 'asc' ? 1 : -1) || a.key.localeCompare(b.key),
  );
  return {
    items: rows.slice(
      (filters.page - 1) * filters.pageSize,
      filters.page * filters.pageSize,
    ),
    total: rows.length,
  };
}
