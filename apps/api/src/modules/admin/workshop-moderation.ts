import { adminListFields } from './admin-list-query.js';
import { writeAuditLog } from './audit-log.js';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import { presentImage } from '../images/images.service.js';

export const moderationQuery = z
  .object({
    ...adminListFields,
    status: z.enum(['all', 'active', 'hidden', 'removed']).default('all'),
    sort: z
      .enum([
        'title:asc',
        'title:desc',
        'studioName:asc',
        'studioName:desc',
        'categoryName:asc',
        'categoryName:desc',
        'basePrice:asc',
        'basePrice:desc',
        'upcomingSlots:asc',
        'upcomingSlots:desc',
        'status:asc',
        'status:desc',
        'createdAt:asc',
        'createdAt:desc',
      ])
      .default('createdAt:desc'),
    studioId: z.string().uuid().optional(),
    categoryId: z.string().max(100).optional(),
    period: z.enum(['7d']).optional(),
  })
  .strict();
export const moderationDecision = z.discriminatedUnion('status', [
  z.object({ status: z.literal('active') }).strict(),
  z
    .object({
      status: z.enum(['hidden', 'removed']),
      reason: z.string().trim().min(10).max(1000),
    })
    .strict(),
]);
const columns = `w.id,w.title,w.description,w.studio_id AS "studioId",st.name AS "studioName",
 w.category_id AS "categoryId",COALESCE(c.name,w.proposed_category_name,'Khác') AS "categoryName",
 w.base_price AS "basePrice",w.status AS "reviewStatus",st.status AS "studioStatus",
 w.visibility_status AS status,w.hidden_reason AS "hiddenReason",w.created_at AS "createdAt",
 (SELECT count(*)::integer FROM sessions s WHERE s.workshop_id=w.id AND s.starts_at>now() AND s.status='scheduled') AS "upcomingSlots",
 (SELECT count(*)::integer FROM bookings b JOIN sessions s ON s.id=b.session_id WHERE s.workshop_id=w.id AND b.status NOT IN ('cancelled','expired')) AS "bookingCount",
 COALESCE((SELECT json_agg(json_build_object('id',i.id,'key',i.key,'thumbnailKey',i.thumbnail_key,'mediumKey',i.medium_key) ORDER BY i.created_at,i.id) FROM images i WHERE i.workshop_id=w.id AND i.state='ready'),'[]'::json) AS images`;
const joins =
  'FROM workshops w JOIN studios st ON st.id=w.studio_id LEFT JOIN categories c ON c.id=w.category_id';
type Row = {
  id: string;
  images: {
    id: string;
    key: string;
    thumbnailKey: string | null;
    mediumKey: string | null;
  }[];
  [key: string]: unknown;
};
const withImages = (row: Row) => ({
  ...row,
  images: row.images.map(presentImage),
});
export async function listModeratedWorkshops(
  filters: z.infer<typeof moderationQuery>,
  countsOnly = false,
) {
  const values: unknown[] = [];
  const bind = (v: unknown) => `$${values.push(v)}`;
  const where = ['true'];
  if (filters.q)
    where.push(
      `(w.title ILIKE ${bind('%' + filters.q.replace(/[\\%_]/g, '\\$&') + '%')} OR st.name ILIKE $${values.length})`,
    );
  if (filters.studioId) where.push(`w.studio_id=${bind(filters.studioId)}`);
  if (filters.categoryId)
    where.push(`w.category_id=${bind(filters.categoryId)}`);
  if (filters.period) where.push("w.created_at>=now()-interval '7 days'");
  const counts = await query<{ status: string; count: number }>(
    `SELECT w.visibility_status AS status,count(*)::integer AS count ${joins} WHERE ${where.join(' AND ')} GROUP BY w.visibility_status`,
    values,
  );
  const statusCounts: Record<string, number> = {
    all: 0,
    active: 0,
    hidden: 0,
    removed: 0,
  };
  for (const row of counts.rows) {
    statusCounts[row.status] = row.count;
    statusCounts.all += row.count;
  }
  if (countsOnly)
    return { rows: [], total: statusCounts.all, statusCounts: statusCounts };
  if (filters.status !== 'all')
    where.push(`w.visibility_status=${bind(filters.status)}`);
  const sorts: Record<string, string> = {
    title: 'w.title',
    studioName: 'st.name',
    categoryName: 'c.name',
    basePrice: 'w.base_price',
    upcomingSlots: '"upcomingSlots"',
    status: 'w.visibility_status',
    createdAt: 'w.created_at',
  };
  const [field, direction] = filters.sort.split(':');
  const result = await query<Row>(
    `SELECT ${columns} ${joins} WHERE ${where.join(' AND ')} ORDER BY ${sorts[field]} ${direction === 'asc' ? 'ASC' : 'DESC'},w.id LIMIT ${bind(filters.pageSize)} OFFSET ${bind((filters.page - 1) * filters.pageSize)}`,
    values,
  );
  return {
    rows: result.rows.map(withImages),
    total: statusCounts[filters.status],
    statusCounts,
  };
}
export async function moderatedWorkshopDetail(id: string) {
  const result = await query<Row>(`SELECT ${columns} ${joins} WHERE w.id=$1`, [
    id,
  ]);
  if (!result.rows[0])
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy workshop.');
  const slots = await query(
    `SELECT s.id,s.starts_at AS "startsAt",s.ends_at AS "endsAt",s.capacity,s.seats_sold AS "seatsSold",s.price,s.status FROM sessions s WHERE s.workshop_id=$1 ORDER BY s.starts_at DESC,s.id`,
    [id],
  );
  return { workshop: { ...withImages(result.rows[0]), slots: slots.rows } };
}
export async function moderateWorkshop(
  id: string,
  actor: string,
  input: z.infer<typeof moderationDecision>,
) {
  await withTransaction((client) =>
    moderateWorkshopInTransaction(client, id, actor, input),
  );
  return moderatedWorkshopDetail(id);
}
export async function moderateWorkshopInTransaction(
  client: PoolClient,
  id: string,
  actor: string,
  input: z.infer<typeof moderationDecision>,
) {
  const locked = await client.query<{
    visibility_status: string;
    title: string;
    studio_id: string;
  }>(
    'SELECT visibility_status,title,studio_id FROM workshops WHERE id=$1 FOR UPDATE',
    [id],
  );
  const current = locked.rows[0];
  if (!current)
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy workshop.');
  if (
    current.visibility_status === input.status ||
    (current.visibility_status === 'removed' && input.status === 'hidden')
  )
    throw new AppError(
      409,
      'CONFLICT',
      'Trạng thái đã thay đổi. Vui lòng tải lại workshop.',
    );
  const reason = input.status === 'active' ? null : input.reason;
  await client.query(
    'UPDATE workshops SET visibility_status=$2,hidden_reason=$3,moderated_by=$4,moderated_at=now() WHERE id=$1',
    [id, input.status, reason, actor],
  );
  await writeAuditLog(client, {
    actorId: actor,
    action:
      'workshop.' + (input.status === 'active' ? 'restored' : input.status),
    targetType: 'workshop',
    targetId: id,
    targetName: current.title,
    reason: reason,
    previousStatus: current.visibility_status,
    newStatus: input.status,
  });
  const label =
    input.status === 'hidden'
      ? 'đã bị ẩn'
      : input.status === 'removed'
        ? 'đã bị gỡ'
        : 'đã được khôi phục';
  await client.query(
    `INSERT INTO studio_notifications(user_id,studio_id,workshop_id,title,reason) SELECT user_id,studio_id,$2,$3,$4 FROM studio_members WHERE studio_id=$1 AND role='owner'`,
    [current.studio_id, id, `Workshop “${current.title}” ${label}`, reason],
  );
}

export const studioOptionsQuery = z
  .object({
    ...adminListFields,
    status: z
      .enum([
        'all',
        'pending',
        'needs_changes',
        'approved',
        'rejected',
        'suspended',
      ])
      .default('all'),
    sort: z
      .enum(['name:asc', 'name:desc', 'createdAt:asc', 'createdAt:desc'])
      .default('name:asc'),
  })
  .strict();
export async function workshopStudioOptions(
  input: z.infer<typeof studioOptionsQuery>,
) {
  const values: unknown[] = ['%' + input.q.replace(/[\\%_]/g, '\\$&') + '%'];
  const where = ['NOT is_draft', 'name ILIKE $1'];
  if (input.status !== 'all') {
    values.push(input.status);
    where.push(`status=$${values.length}::approval_status`);
  }
  const total = (
    await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM studios WHERE ${where.join(' AND ')}`,
      values,
    )
  ).rows[0].n;
  const [field, dir] = input.sort.split(':');
  values.push(input.pageSize, (input.page - 1) * input.pageSize);
  const items = (
    await query(
      `SELECT id,name FROM studios WHERE ${where.join(' AND ')} ORDER BY ${field === 'name' ? 'name' : 'created_at'} ${dir === 'asc' ? 'ASC' : 'DESC'},id LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    )
  ).rows;
  return { items, total };
}
