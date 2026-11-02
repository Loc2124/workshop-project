import type {
  AdminStudioListQuery,
  AdminWorkshopListQuery,
} from './admin.schemas.js';
const studioSorts: Record<string, string> = {
  name: 'st.name',
  ownerFullName: 'u.full_name',
  province: 'p.name',
  createdAt: 'st.created_at',
  submittedAt: 'coalesce(st.submitted_at,st.created_at)',
  status: 'st.status',
};
const workshopSorts: Record<string, string> = {
  title: 'w.title',
  studioName: 'st.name',
  basePrice: 'w.base_price',
  province: 'p.name',
  createdAt: 'w.created_at',
  status: 'w.status',
};
export function adminListSql(
  kind: 'studio' | 'workshop',
  filters: AdminStudioListQuery | AdminWorkshopListQuery,
  includeStatus = true,
) {
  const values: unknown[] = [];
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  const clauses = kind === 'studio' ? ['NOT st.is_draft'] : ['true'];
  if (includeStatus && filters.status && filters.status !== 'all')
    clauses.push(
      `${kind === 'studio' ? 'st' : 'w'}.status = ${bind(filters.status)}::approval_status`,
    );
  if (filters.q) {
    const pattern = bind(`%${filters.q.replace(/[\\%_]/g, '\\$&')}%`);
    clauses.push(
      kind === 'studio'
        ? `(st.name ILIKE ${pattern} OR u.full_name ILIKE ${pattern} OR st.address ILIKE ${pattern})`
        : `(w.title ILIKE ${pattern} OR st.name ILIKE ${pattern})`,
    );
  }
  if (filters.provinceId)
    clauses.push(`st.province_id = ${bind(filters.provinceId)}`);
  if (filters.categoryId)
    clauses.push(
      kind === 'studio'
        ? `EXISTS (SELECT 1 FROM studio_categories sc WHERE sc.deleted_at IS NULL AND sc.studio_id = st.id AND sc.category_id = ${bind(filters.categoryId)})`
        : `w.category_id = ${bind(filters.categoryId)}`,
    );
  if (filters.period === '7d')
    clauses.push(
      `${kind === 'studio' ? 'st' : 'w'}.created_at >= now() - interval '7 days'`,
    );
  if (filters.period === 'today')
    clauses.push(
      `${kind === 'studio' ? 'st' : 'w'}.created_at >= date_trunc('day',now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh'`,
    );
  if (kind === 'studio' && filters.reviewQueue === 'overdue')
    clauses.push(
      `st.status='pending' AND st.submitted_at < now() - interval '48 hours'`,
    );
  if (kind === 'studio' && filters.reviewQueue === 'resubmitted')
    clauses.push(`st.status='pending' AND st.resubmitted_at IS NOT NULL`);
  const [field, direction] = (filters.sort ?? 'createdAt:desc').split(':');
  const column =
    (kind === 'studio' ? studioSorts : workshopSorts)[field] ??
    (kind === 'studio' ? 'st.created_at' : 'w.created_at');
  return {
    where: clauses.join(' AND '),
    values,
    orderBy: `${column} ${direction === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, ${kind === 'studio' ? 'st' : 'w'}.id ASC`,
  };
}
export function adminStatusCounts(rows: { status: string; count: number }[]) {
  const counts: Record<string, number> = {
    pending: 0,
    needs_changes: 0,
    approved: 0,
    rejected: 0,
    suspended: 0,
    all: 0,
  };
  for (const row of rows) {
    counts[row.status] = row.count;
    counts.all += row.count;
  }
  return counts;
}
