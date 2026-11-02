import { adminListFields } from '../admin/admin-list-query.js';
import { writeAuditLog } from '../admin/audit-log.js';
import { z } from 'zod';
import {
  createReportSchema,
  reportStatusSchema,
  reportTargetSchema,
} from '@workshop/shared';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import { signedReportImages } from './report-storage.js';
import { updateStudioStatus } from '../admin/admin.repository.js';
import { moderateWorkshopInTransaction } from '../admin/workshop-moderation.js';
import { studioVisibilityInTransaction } from '../admin/studio-visibility.js';
export const reportsQuery = z
  .object({
    ...adminListFields,
    status: z
      .enum(['all', 'new', 'in_progress', 'resolved', 'dismissed'])
      .default('new'),
    targetType: reportTargetSchema.optional(),
    sort: z
      .enum([
        'targetType:asc',
        'targetType:desc',
        'targetName:asc',
        'targetName:desc',
        'reporterName:asc',
        'reporterName:desc',
        'reason:asc',
        'reason:desc',
        'createdAt:asc',
        'createdAt:desc',
        'status:asc',
        'status:desc',
      ])
      .default('createdAt:desc'),
  })
  .strict();
export const reportDecision = z
  .object({
    action: z.enum(['start', 'hide', 'suspend', 'dismiss', 'resolve']),
    expectedStatus: reportStatusSchema,
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
const joins = `FROM reports r LEFT JOIN users u ON u.id=r.reporter_id LEFT JOIN reviews rev ON r.target_type='review' AND rev.id=r.target_id LEFT JOIN workshops w ON (r.target_type='workshop' AND w.id=r.target_id) OR (r.target_type='review' AND w.id=rev.workshop_id) LEFT JOIN studios st ON r.target_type='studio' AND st.id=r.target_id LEFT JOIN studios ws ON ws.id=w.studio_id`;
const targetName =
  "CASE WHEN r.target_type='review' THEN 'Đánh giá về '||coalesce(w.title,'workshop đã xóa') ELSE coalesce(st.name,w.title,'Đối tượng đã xóa') END";
const columns = `r.id,r.target_type AS "targetType",r.target_id AS "targetId",${targetName} AS "targetName",coalesce(st.id,ws.id) AS "studioId",coalesce(st.name,ws.name) AS "studioName",CASE WHEN r.target_type='studio' THEN '/studios/'||st.slug ELSE '/workshops/'||w.slug||CASE WHEN r.target_type='review' THEN '#reviews-heading' ELSE '' END END AS "targetHref",r.reason,r.detail,r.status,r.handled_by AS "handledBy",r.handled_at AS "handledAt",r.created_at AS "createdAt",coalesce(u.full_name,'Tài khoản đã xóa') AS "reporterName",u.email AS "reporterEmail",CASE WHEN r.target_type='review' THEN rev.comment ELSE coalesce(st.description,w.description) END AS "targetContent",coalesce(st.is_hidden,ws.is_hidden,false) AS "studioHidden",coalesce(st.status,ws.status)::text AS "studioStatus",w.visibility_status AS "workshopVisibility",rev.is_hidden AS "reviewHidden"`;
export async function createReport(
  user: string,
  input: z.infer<typeof createReportSchema>,
) {
  try {
    return await withTransaction(async (client) => {
      if (
        (
          await client.query(
            'SELECT id FROM reports WHERE reporter_id=$1 AND target_type=$2 AND target_id=$3',
            [user, input.targetType, input.targetId],
          )
        ).rowCount
      )
        throw new AppError(
          409,
          'CONFLICT',
          'Bạn đã báo cáo đối tượng này rồi. Mỗi người chỉ được báo cáo một lần cho mỗi đối tượng.',
        );
      const visible =
        input.targetType === 'studio'
          ? await client.query(
              "SELECT id FROM studios WHERE id=$1 AND status='approved' AND NOT is_draft AND NOT is_hidden AND studio_profile_complete(studios)",
              [input.targetId],
            )
          : input.targetType === 'workshop'
            ? await client.query(
                "SELECT w.id FROM workshops w JOIN studios st ON st.id=w.studio_id WHERE w.id=$1 AND w.status='approved' AND w.visibility_status='active' AND st.status='approved' AND NOT st.is_draft AND NOT st.is_hidden AND studio_profile_complete(st)",
                [input.targetId],
              )
            : await client.query(
                "SELECT rev.id FROM reviews rev JOIN workshops w ON w.id=rev.workshop_id JOIN studios st ON st.id=w.studio_id WHERE rev.id=$1 AND NOT rev.is_hidden AND w.status='approved' AND w.visibility_status='active' AND st.status='approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st)",
                [input.targetId],
              );
      if (!visible.rowCount)
        throw new AppError(
          404,
          'NOT_FOUND',
          'Đối tượng không còn hiển thị để báo cáo.',
        );
      const images = await client.query(
        "SELECT id FROM report_attachments WHERE id=ANY($1::uuid[]) AND reporter_id=$2 AND report_id IS NULL AND state='ready' AND created_at>now()-interval '1 day' FOR UPDATE",
        [input.attachmentIds, user],
      );
      if (images.rowCount !== input.attachmentIds.length)
        throw new AppError(
          422,
          'UNPROCESSABLE_ENTITY',
          'Ảnh phải được tải xong và thuộc tài khoản của bạn.',
        );
      const report = (
        await client.query<{ id: string; status: string }>(
          'INSERT INTO reports(reporter_id,target_type,target_id,reason,detail) VALUES($1,$2,$3,$4,$5) RETURNING id,status',
          [user, input.targetType, input.targetId, input.reason, input.detail],
        )
      ).rows[0];
      await client.query(
        'UPDATE report_attachments SET report_id=$1 WHERE id=ANY($2::uuid[])',
        [report.id, input.attachmentIds],
      );
      return { report };
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'constraint' in error &&
      error.constraint === 'reports_reporter_target_unique'
    )
      throw new AppError(
        409,
        'CONFLICT',
        'Bạn đã báo cáo đối tượng này rồi. Mỗi người chỉ được báo cáo một lần cho mỗi đối tượng.',
      );
    throw error;
  }
}
export async function listReports(
  filters: z.infer<typeof reportsQuery>,
  countsOnly = false,
) {
  const values: unknown[] = [];
  const bind = (v: unknown) => `$${values.push(v)}`;
  const clauses = ['true'];
  if (filters.q) {
    const p = bind('%' + filters.q.replace(/[\\%_]/g, '\\$&') + '%');
    clauses.push(
      `(${targetName} ILIKE ${p} OR u.full_name ILIKE ${p} OR u.email ILIKE ${p} OR r.reason ILIKE ${p})`,
    );
  }
  if (filters.targetType)
    clauses.push(`r.target_type=${bind(filters.targetType)}`);
  const counts: Record<string, number> = {
    all: 0,
    new: 0,
    in_progress: 0,
    resolved: 0,
    dismissed: 0,
  };
  for (const r of (
    await query<{ status: string; count: number }>(
      `SELECT r.status,count(*)::int AS count ${joins} WHERE ${clauses.join(' AND ')} GROUP BY r.status`,
      values,
    )
  ).rows) {
    counts[r.status] = r.count;
    counts.all += r.count;
  }
  if (countsOnly) return { rows: [], total: counts.all, statusCounts: counts };
  if (filters.status !== 'all')
    clauses.push(`r.status=${bind(filters.status)}`);
  const sorts: Record<string, string> = {
    targetType: 'r.target_type',
    targetName,
    reporterName: 'u.full_name',
    reason: 'r.reason',
    createdAt: 'r.created_at',
    status: 'r.status',
  };
  const [field, dir] = filters.sort.split(':');
  const rows = (
    await query(
      `SELECT ${columns} ${joins} WHERE ${clauses.join(' AND ')} ORDER BY ${sorts[field]} ${dir === 'asc' ? 'ASC' : 'DESC'},r.id LIMIT ${bind(filters.pageSize)} OFFSET ${bind((filters.page - 1) * filters.pageSize)}`,
      values,
    )
  ).rows;
  return { rows, total: counts[filters.status], statusCounts: counts };
}
export async function getReport(id: string) {
  const report = (await query(`SELECT ${columns} ${joins} WHERE r.id=$1`, [id]))
    .rows[0];
  if (!report) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy báo cáo.');
  const [images, notes] = await Promise.all([
    signedReportImages(id),
    query(
      `SELECT id,author_name AS "authorName",body,created_at AS "createdAt" FROM report_notes WHERE report_id=$1 ORDER BY created_at,id`,
      [id],
    ),
  ]);
  return { report: { ...report, images, notes: notes.rows } };
}
export async function addReportNote(id: string, actor: string, body: string) {
  await withTransaction(async (client) => {
    if (
      !(
        await client.query('SELECT id FROM reports WHERE id=$1 FOR UPDATE', [
          id,
        ])
      ).rowCount
    )
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy báo cáo.');
    const note = (
      await client.query(
        `INSERT INTO report_notes(report_id,author_id,author_name,body) SELECT $2,id,full_name,$3 FROM users WHERE id=$1 RETURNING id,author_id,author_name,body,created_at`,
        [actor, id, body],
      )
    ).rows[0];
    await writeAuditLog(client, {
      actorId: actor,
      action: 'report.note',
      targetType: 'report',
      targetId: id,
      targetName: 'Báo cáo',
      reason: body,
      before: null,
      after: { note },
    });
  });
  return { ok: true };
}
export async function actOnReport(
  id: string,
  actor: string,
  input: z.infer<typeof reportDecision>,
) {
  await withTransaction(async (client) => {
    const r = (
      await client.query<{
        target_type: string;
        target_id: string;
        status: string;
      }>(
        'SELECT target_type,target_id,status FROM reports WHERE id=$1 FOR UPDATE',
        [id],
      )
    ).rows[0];
    if (!r) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy báo cáo.');
    if (
      r.status !== input.expectedStatus ||
      ['resolved', 'dismissed'].includes(r.status)
    )
      throw new AppError(
        409,
        'CONFLICT',
        'Báo cáo đã đổi trạng thái hoặc đã kết thúc. Vui lòng tải lại.',
      );
    if (input.action === 'start' && r.status !== 'new')
      throw new AppError(409, 'CONFLICT', 'Báo cáo đang được xử lý.');
    if (input.action === 'hide') {
      if (r.target_type === 'studio')
        await studioVisibilityInTransaction(
          client,
          r.target_id,
          actor,
          true,
          input.reason,
        );
      else if (r.target_type === 'workshop') {
        const w = (
          await client.query<{ visibility_status: string }>(
            'SELECT visibility_status FROM workshops WHERE id=$1 FOR UPDATE',
            [r.target_id],
          )
        ).rows[0];
        if (!w) throw new AppError(404, 'NOT_FOUND', 'Workshop đã bị xóa.');
        if (w.visibility_status === 'active')
          await moderateWorkshopInTransaction(client, r.target_id, actor, {
            status: 'hidden',
            reason: input.reason,
          });
      } else {
        const review = await client.query(
          'UPDATE reviews SET is_hidden=true,hidden_reason=$2 WHERE id=$1 RETURNING id',
          [r.target_id, input.reason],
        );
        if (!review.rowCount)
          throw new AppError(404, 'NOT_FOUND', 'Đánh giá đã bị xóa.');
        await writeAuditLog(client, {
          actorId: actor,
          action: 'review.hidden',
          targetType: 'review',
          targetId: r.target_id,
          targetName: 'Đánh giá',
          reason: input.reason,
        });
      }
    }
    if (input.action === 'suspend') {
      const studio =
        r.target_type === 'studio'
          ? r.target_id
          : (
              await client.query<{ studio_id: string }>(
                r.target_type === 'workshop'
                  ? 'SELECT studio_id FROM workshops WHERE id=$1'
                  : 'SELECT w.studio_id FROM workshops w JOIN reviews rev ON rev.workshop_id=w.id WHERE rev.id=$1',
                [r.target_id],
              )
            ).rows[0]?.studio_id;
      if (!studio)
        throw new AppError(
          404,
          'NOT_FOUND',
          'Không tìm thấy studio của đối tượng.',
        );
      const state = (
        await client.query<{ status: string }>(
          'SELECT status FROM studios WHERE id=$1 FOR UPDATE',
          [studio],
        )
      ).rows[0];
      if (state?.status !== 'suspended') {
        if (state?.status !== 'approved')
          throw new AppError(
            400,
            'BAD_REQUEST',
            'Chỉ tạm ngưng studio đang được duyệt.',
          );
        await updateStudioStatus(
          studio,
          'suspended',
          actor,
          input.reason,
          client,
        );
      }
    }
    const next =
      input.action === 'start'
        ? 'in_progress'
        : input.action === 'dismiss'
          ? 'dismissed'
          : 'resolved';
    await client.query(
      'UPDATE reports SET status=$2,handled_by=$3,handled_at=now() WHERE id=$1',
      [id, next, actor],
    );
    await client.query(
      `INSERT INTO report_notes(report_id,author_id,author_name,body) SELECT $2,id,full_name,$3 FROM users WHERE id=$1`,
      [actor, id, input.reason],
    );
    await writeAuditLog(client, {
      actorId: actor,
      action: 'report.' + input.action,
      targetType: 'report',
      targetId: id,
      targetName: 'Báo cáo',
      reason: input.reason,
      previousStatus: r.status,
      newStatus: next,
    });
  });
  return { ok: true };
}
