import { query } from '../../db/pool.js';
import type { AdminRecordQuery, AdminRecordKind } from './admin.schemas.js';
const tables = {
  users: {
    from: 'users u',
    select:
      'u.id,u.full_name AS "fullName",u.email,u.role::text AS role,u.created_at AS "createdAt"',
    created: 'u.created_at',
    status: 'u.role',
    search: ['u.full_name', 'u.email'],
    sorts: {
      fullName: 'u.full_name',
      email: 'u.email',
      role: 'u.role',
      createdAt: 'u.created_at',
    },
    id: 'u.id',
  },
  bookings: {
    from: 'bookings b JOIN users u ON u.id=b.user_id JOIN sessions s ON s.id=b.session_id JOIN workshops w ON w.id=s.workshop_id JOIN studios st ON st.id=w.studio_id',
    select:
      'b.id,u.full_name AS "customerName",w.title AS "workshopTitle",st.name AS "studioName",b.quantity,b.total_amount AS "totalAmount",b.status::text AS status,b.created_at AS "createdAt",s.starts_at AS "startsAt"',
    created: 'b.created_at',
    status: 'b.status',
    search: ['u.full_name', 'w.title', 'st.name'],
    sorts: {
      createdAt: 'b.created_at',
      totalAmount: 'b.total_amount',
      status: 'b.status',
      workshopTitle: 'w.title',
    },
    id: 'b.id',
  },
  reports: {
    from: 'content_reports r LEFT JOIN users u ON u.id=r.reported_by LEFT JOIN studios st ON st.id=r.studio_id LEFT JOIN workshops w ON w.id=r.workshop_id',
    select: `r.id,coalesce(u.full_name,'Tài khoản đã xóa') AS "reporterName",coalesce(st.name,w.title) AS "targetName",r.reason,r.status,r.created_at AS "createdAt"`,
    created: 'r.created_at',
    status: 'r.status',
    search: ['r.reason', 'st.name', 'w.title'],
    sorts: { createdAt: 'r.created_at', status: 'r.status' },
    id: 'r.id',
  },
};
export async function selectAdminRecords(
  kind: AdminRecordKind,
  filters: AdminRecordQuery,
  countsOnly = false,
) {
  const config = tables[kind];
  const values: unknown[] = [];
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  const clauses = ['true'];
  if (filters.q) {
    const parameter = bind(`%${filters.q.replace(/[\\%_]/g, '\\$&')}%`);
    clauses.push(
      `(${config.search.map((column) => `${column} ILIKE ${parameter}`).join(' OR ')})`,
    );
  }
  if (filters.period === '7d')
    clauses.push(`${config.created} >= now()-interval '7 days'`);
  if (filters.period === 'today')
    clauses.push(
      `${config.created} >= date_trunc('day',now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AND ${config.created} < (date_trunc('day',now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')+interval '1 day'`,
    );
  const counts = await query<{ status: string; count: number }>(
    `SELECT ${config.status}::text AS status,count(*)::int AS count FROM ${config.from} WHERE ${clauses.join(' AND ')} GROUP BY ${config.status}`,
    values,
  );
  const statusCounts: Record<string, number> = { all: 0 };
  for (const row of counts.rows) {
    statusCounts[row.status] = row.count;
    statusCounts.all += row.count;
  }
  const known =
    kind === 'users'
      ? ['customer', 'studio_owner', 'admin']
      : kind === 'bookings'
        ? ['pending', 'paid', 'expired', 'cancelled', 'refund_needed']
        : ['pending', 'resolved', 'dismissed'];
  for (const status of known) statusCounts[status] ??= 0;
  if (countsOnly)
    return {
      rows: [],
      pagination: { page: 1, pageSize: 20, total: statusCounts.all },
      statusCounts,
    };
  if (filters.status && filters.status !== 'all')
    clauses.push(`${config.status}::text=${bind(filters.status)}`);
  const [field, direction] = (filters.sort ?? 'createdAt:desc').split(':');
  const order =
    (config.sorts as Record<string, string>)[field] ?? config.created;
  const page = filters.page ?? 1,
    pageSize = filters.pageSize ?? 20;
  const limit = bind(pageSize),
    offset = bind((page - 1) * pageSize);
  const records = await query(
    `SELECT ${config.select} FROM ${config.from} WHERE ${clauses.join(' AND ')} ORDER BY ${order} ${direction === 'asc' ? 'ASC' : 'DESC'} NULLS LAST,${config.id} LIMIT ${limit} OFFSET ${offset}`,
    values,
  );
  return {
    rows: records.rows,
    pagination: {
      page,
      pageSize,
      total: statusCounts[filters.status ?? 'all'] ?? 0,
    },
    statusCounts,
  };
}
