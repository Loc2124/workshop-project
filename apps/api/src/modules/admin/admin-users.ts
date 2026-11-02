import { adminListFields } from './admin-list-query.js';
import { writeAuditLog } from './audit-log.js';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
export const accountRole = z.enum(['customer', 'studio_owner', 'admin']);
export const userListQuery = z
  .object({
    ...adminListFields,
    status: z
      .enum(['all', 'customer', 'studio_owner', 'admin', 'blocked'])
      .default('all'),
    period: z.enum(['7d']).optional(),
    sort: z
      .enum([
        'fullName:asc',
        'fullName:desc',
        'email:asc',
        'email:desc',
        'role:asc',
        'role:desc',
        'studioCount:asc',
        'studioCount:desc',
        'status:asc',
        'status:desc',
        'createdAt:asc',
        'createdAt:desc',
      ])
      .default('createdAt:desc'),
  })
  .strict();
const expected = { expectedRole: accountRole, expectedBlocked: z.boolean() };
const reason = z.string().trim().min(10).max(1000);
export const userAction = z.discriminatedUnion('action', [
  z.object({ action: z.literal('block'), reason, ...expected }).strict(),
  z.object({ action: z.literal('unblock'), ...expected }).strict(),
  z
    .object({
      action: z.literal('change_role'),
      role: accountRole,
      reason,
      ...expected,
    })
    .strict(),
]);
const columns = `u.id,u.full_name AS "fullName",u.email,u.avatar_url AS "avatarUrl",u.role,
 (SELECT count(*)::int FROM studio_members sm WHERE sm.user_id=u.id AND sm.role='owner') AS "studioCount",
 (SELECT count(*)::int FROM studio_members sm WHERE sm.user_id=u.id AND sm.role='staff') AS "staffStudioCount",
 CASE WHEN u.is_blocked THEN 'blocked' ELSE 'active' END AS status,u.blocked_reason AS "blockedReason",u.created_at AS "createdAt"`;
export async function listAdminUsers(
  filters: z.infer<typeof userListQuery>,
  countsOnly = false,
) {
  const values: unknown[] = [];
  const bind = (v: unknown) => `$${values.push(v)}`;
  const clauses = ['true'];
  if (filters.q) {
    const p = bind('%' + filters.q.replace(/[\\%_]/g, '\\$&') + '%');
    clauses.push(`(u.full_name ILIKE ${p} OR u.email ILIKE ${p})`);
  }
  if (filters.period) clauses.push("u.created_at>=now()-interval '7 days'");
  const base = clauses.join(' AND ');
  const counts = (
    await query<{
      all: number;
      customer: number;
      studio_owner: number;
      admin: number;
      blocked: number;
    }>(
      `SELECT count(*)::int AS all,count(*) FILTER(WHERE role='customer')::int AS customer,count(*) FILTER(WHERE role='studio_owner')::int AS studio_owner,count(*) FILTER(WHERE role='admin')::int AS admin,count(*) FILTER(WHERE is_blocked)::int AS blocked FROM users u WHERE ${base}`,
      values,
    )
  ).rows[0];
  if (countsOnly) return { rows: [], total: counts.all, statusCounts: counts };
  if (filters.status === 'blocked') clauses.push('u.is_blocked');
  else if (filters.status !== 'all')
    clauses.push(`u.role=${bind(filters.status)}::user_role`);
  const sorts: Record<string, string> = {
    fullName: 'u.full_name',
    email: 'u.email',
    role: 'u.role',
    studioCount: '"studioCount"',
    status: 'u.is_blocked',
    createdAt: 'u.created_at',
  };
  const [field, direction] = filters.sort.split(':');
  const rows = (
    await query(
      `SELECT ${columns} FROM users u WHERE ${clauses.join(' AND ')} ORDER BY ${sorts[field]} ${direction === 'asc' ? 'ASC' : 'DESC'},u.id LIMIT ${bind(filters.pageSize)} OFFSET ${bind((filters.page - 1) * filters.pageSize)}`,
      values,
    )
  ).rows;
  return { rows, total: counts[filters.status], statusCounts: counts };
}
export async function moderateUser(
  id: string,
  actor: string,
  input: z.infer<typeof userAction>,
) {
  await withTransaction(async (client) => {
    // One lock for all account-management requests prevents concurrent last-admin removal.
    await client.query('SELECT pg_advisory_xact_lock(731904,20)');
    const administrator = (
      await client.query<{ role: string; is_blocked: boolean }>(
        'SELECT role,is_blocked FROM users WHERE id=$1',
        [actor],
      )
    ).rows[0];
    if (
      !administrator ||
      administrator.role !== 'admin' ||
      administrator.is_blocked
    )
      throw new AppError(
        403,
        'FORBIDDEN',
        'Quyền quản trị của bạn đã thay đổi. Vui lòng đăng nhập lại.',
      );
    const target = (
      await client.query<{
        role: string;
        is_blocked: boolean;
        full_name: string;
      }>('SELECT role,is_blocked,full_name FROM users WHERE id=$1 FOR UPDATE', [
        id,
      ])
    ).rows[0];
    if (!target)
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng.');
    if (
      target.role !== input.expectedRole ||
      target.is_blocked !== input.expectedBlocked
    )
      throw new AppError(
        409,
        'CONFLICT',
        'Tài khoản đã thay đổi. Vui lòng tải lại danh sách.',
      );
    const lowering =
      input.action === 'change_role' &&
      target.role === 'admin' &&
      input.role !== 'admin';
    if (id === actor && (input.action === 'block' || lowering))
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Bạn không thể tự khóa hoặc tự hạ quyền quản trị của chính mình.',
      );
    if (
      target.role === 'admin' &&
      !target.is_blocked &&
      (input.action === 'block' || lowering)
    ) {
      const count = (
        await client.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM users WHERE role='admin' AND NOT is_blocked",
        )
      ).rows[0].n;
      if (count <= 1)
        throw new AppError(
          400,
          'BAD_REQUEST',
          'Không thể khóa hoặc hạ quyền admin cuối cùng đang hoạt động.',
        );
    }
    if (
      (input.action === 'block' && target.is_blocked) ||
      (input.action === 'unblock' && !target.is_blocked) ||
      (input.action === 'change_role' && input.role === target.role)
    )
      throw new AppError(
        409,
        'CONFLICT',
        'Tài khoản đã ở trạng thái hoặc vai trò này.',
      );
    const eventReason =
      input.action === 'unblock' ? 'Mở khóa tài khoản' : input.reason;
    if (input.action === 'change_role')
      await client.query('UPDATE users SET role=$2 WHERE id=$1', [
        id,
        input.role,
      ]);
    else
      await client.query(
        'UPDATE users SET is_blocked=$2,blocked_reason=$3,blocked_by=$4,blocked_at=CASE WHEN $2 THEN now() ELSE NULL END WHERE id=$1',
        [
          id,
          input.action === 'block',
          input.action === 'block' ? eventReason : null,
          input.action === 'block' ? actor : null,
        ],
      );
    // Unblocking never reactivates sessions that were revoked by a prior action.
    if (input.action !== 'unblock')
      await client.query(
        'UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1 AND revoked_at IS NULL',
        [id],
      );
    await writeAuditLog(client, {
      actorId: actor,
      action:
        'user.' +
        (input.action === 'change_role'
          ? 'role_changed'
          : input.action === 'block'
            ? 'blocked'
            : 'unblocked'),
      targetType: 'user',
      targetId: id,
      targetName: target.full_name,
      reason: eventReason,
      previousStatus:
        input.action === 'change_role'
          ? target.role
          : target.is_blocked
            ? 'blocked'
            : 'active',
      newStatus:
        input.action === 'change_role'
          ? input.role
          : input.action === 'block'
            ? 'blocked'
            : 'active',
    });
  });
  return { ok: true };
}
