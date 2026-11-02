import { writeAuditLog } from './audit-log.js';
import type { PoolClient } from 'pg';
import { AppError } from '../../errors/app-error.js';
import { withTransaction } from '../../db/pool.js';
export async function studioVisibilityInTransaction(
  client: PoolClient,
  id: string,
  actor: string,
  hidden: boolean,
  reason: string,
) {
  const studio = (
    await client.query<{ name: string; is_hidden: boolean }>(
      'SELECT name,is_hidden FROM studios WHERE id=$1 AND NOT is_draft FOR UPDATE',
      [id],
    )
  ).rows[0];
  if (!studio) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
  if (studio.is_hidden === hidden) return;
  await client.query(
    'UPDATE studios SET is_hidden=$2,hidden_reason=$3 WHERE id=$1',
    [id, hidden, hidden ? reason : null],
  );
  await writeAuditLog(client, {
    actorId: actor,
    action: hidden ? 'studio.hidden' : 'studio.shown',
    targetType: 'studio',
    targetId: id,
    targetName: studio.name,
    reason: reason,
    previousStatus: studio.is_hidden ? 'hidden' : 'visible',
    newStatus: hidden ? 'hidden' : 'visible',
  });
  await client.query(
    `INSERT INTO studio_notifications(user_id,studio_id,title,reason) SELECT user_id,studio_id,$2,$3 FROM studio_members WHERE studio_id=$1 AND role='owner'`,
    [
      id,
      `Studio “${studio.name}” ${hidden ? 'đã bị ẩn khỏi trang công khai' : 'đã được hiển thị lại'}`,
      reason,
    ],
  );
}
export async function setStudioVisibility(
  id: string,
  actor: string,
  hidden: boolean,
  reason: string,
) {
  await withTransaction((client) =>
    studioVisibilityInTransaction(client, id, actor, hidden, reason),
  );
  return { ok: true };
}
