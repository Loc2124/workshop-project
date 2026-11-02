import { adminListFields } from './admin-list-query.js';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';

const sorts = {
  createdAt: 'a.created_at',
  actorName: 'a.actor_name',
  action: 'a.action',
  targetName: 'a.target_name',
} as const;
export const auditQuery = z
  .object({
    ...adminListFields,
    status: z.literal('all').default('all'),
    sort: z
      .enum([
        'createdAt:asc',
        'createdAt:desc',
        'actorName:asc',
        'actorName:desc',
        'action:asc',
        'action:desc',
        'targetName:asc',
        'targetName:desc',
      ])
      .default('createdAt:desc'),
    actorId: z.union([z.string().uuid(), z.literal('system')]).optional(),
    action: z.string().trim().min(1).max(100).optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
  })
  .strict()
  .refine((q) => !q.dateFrom || !q.dateTo || q.dateFrom <= q.dateTo, {
    message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
  });
const columns = `a.id,a.actor_id AS "actorId",a.actor_name AS "actorName",a.action,a.target_type AS "targetType",a.target_id AS "targetId",a.target_name AS "targetName",a.reason,a.created_at AS "createdAt"`;
function targetHref(row: { targetType: string; targetName: string }) {
  const q = encodeURIComponent(row.targetName);
  switch (row.targetType) {
    case 'studio':
      return `/admin/studios?q=${q}`;
    case 'workshop':
      return `/admin/workshop?q=${q}`;
    case 'booking':
      return `/admin/dat-cho?q=${q}`;
    case 'user':
      return `/admin/nguoi-dung?q=${q}`;
    case 'category':
      return '/admin/danh-muc';
    case 'settings':
      return '/admin/cai-dat';
    case 'featured':
      return '/admin/noi-dung';
    case 'message_template':
      return '/admin/mau-thong-bao';
    case 'report':
      return '/admin/bao-cao';
    case 'review':
      return '/admin/bao-cao';
    default:
      return null;
  }
}
export async function listAuditLogs(filters: z.infer<typeof auditQuery>) {
  const values: unknown[] = [];
  const bind = (v: unknown) => `$${values.push(v)}`;
  const clauses = ['true'];
  if (filters.actorId)
    clauses.push(
      filters.actorId === 'system'
        ? 'a.actor_id IS NULL'
        : `a.actor_id=${bind(filters.actorId)}::uuid`,
    );
  if (filters.action) clauses.push(`a.action=${bind(filters.action)}`);
  if (filters.dateFrom)
    clauses.push(
      `a.created_at>=${bind(filters.dateFrom)}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'`,
    );
  if (filters.dateTo)
    clauses.push(
      `a.created_at<(${bind(filters.dateTo)}::date+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'`,
    );
  if (filters.q) {
    const p = bind('%' + filters.q.replace(/[\\%_]/g, '\\$&') + '%');
    clauses.push(
      `(a.actor_name ILIKE ${p} OR a.action ILIKE ${p} OR a.target_name ILIKE ${p} OR a.target_id ILIKE ${p} OR a.reason ILIKE ${p})`,
    );
  }
  const where = clauses.join(' AND ');
  // One statement gives the count and page the same MVCC snapshot during concurrent writes.
  const [field, direction] = filters.sort.split(':');
  const limit = bind(filters.pageSize),
    offset = bind((filters.page - 1) * filters.pageSize);
  const result = (
    await query<{
      total: number;
      rows: ({ targetType: string; targetName: string } & Record<
        string,
        unknown
      >)[];
    }>(
      `WITH filtered AS MATERIALIZED (SELECT * FROM audit_logs a WHERE ${where})
     SELECT (SELECT count(*)::int FROM filtered) AS total,coalesce((SELECT json_agg(r) FROM (SELECT ${columns} FROM filtered a ORDER BY ${sorts[field as keyof typeof sorts]} ${direction === 'asc' ? 'ASC' : 'DESC'},a.id ${direction === 'asc' ? 'ASC' : 'DESC'} LIMIT ${limit} OFFSET ${offset}) r),'[]'::json) AS rows`,
      values,
    )
  ).rows[0];
  return {
    total: result.total,
    rows: result.rows.map((row) => ({ ...row, targetHref: targetHref(row) })),
  };
}
export async function getAuditLog(id: string) {
  const row = (
    await query<{
      targetType: string;
      targetName: string;
      [key: string]: unknown;
    }>(
      `SELECT ${columns},a."before",a."after" FROM audit_logs a WHERE a.id=$1`,
      [id],
    )
  ).rows[0];
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy nhật ký.');
  return { log: { ...row, targetHref: targetHref(row) } };
}
export async function auditFilterOptions(search: string) {
  const [actors, actions] = await Promise.all([
    query(
      `SELECT actor_id::text AS value,(array_agg(actor_name ORDER BY created_at DESC,id DESC))[1] AS label FROM audit_logs WHERE actor_id IS NOT NULL AND actor_name ILIKE $1 GROUP BY actor_id ORDER BY label,actor_id LIMIT 50`,
      ['%' + search.replace(/[\\%_]/g, '\\$&') + '%'],
    ),
    query<{ value: string }>(
      'SELECT DISTINCT action AS value FROM audit_logs ORDER BY action',
    ),
  ]);
  return {
    actors: [{ value: 'system', label: 'Hệ thống' }, ...actors.rows],
    actions: actions.rows,
  };
}
