import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';

export async function assertImageOwner(
  studioId: string,
  userId: string,
  workshopId?: string | null,
) {
  const member = await query<{ role: string }>(
    'SELECT role FROM studio_members WHERE studio_id = $1 AND user_id = $2',
    [studioId, userId],
  );
  if (!member.rows[0])
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
  if (member.rows[0].role !== 'owner')
    throw new AppError(403, 'FORBIDDEN', 'Chỉ chủ studio được quản lý ảnh.');
  if (workshopId) {
    const workshop = await query(
      'SELECT 1 FROM workshops WHERE id = $1 AND studio_id = $2',
      [workshopId, studioId],
    );
    if (!workshop.rowCount)
      throw new AppError(
        404,
        'NOT_FOUND',
        'Không tìm thấy workshop thuộc studio.',
      );
  }
}
export type ImageRow = {
  id: string;
  key: string;
  studioId: string;
  workshopId: string | null;
  byteSize: number;
  state: string;
  expired: boolean;
};
export async function reserveImage(
  id: string,
  studioId: string,
  workshopId: string | null,
  userId: string,
  key: string,
  size: number,
) {
  await query(
    `INSERT INTO images(id, studio_id, workshop_id, uploaded_by, key, byte_size) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, studioId, workshopId, userId, key, size],
  );
}
export async function getOwnedImage(
  id: string,
  userId: string,
): Promise<ImageRow> {
  const result = await query<ImageRow>(
    `SELECT i.id, i.key, i.studio_id AS "studioId", i.workshop_id AS "workshopId", i.byte_size AS "byteSize", i.state, i.expires_at < now() AS expired FROM images i JOIN studio_members sm ON sm.studio_id = i.studio_id AND sm.user_id = $2 AND sm.role = 'owner' WHERE i.id = $1`,
    [id, userId],
  );
  if (!result.rows[0])
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy ảnh.');
  return result.rows[0];
}
export async function confirmImage(id: string) {
  const result = await query(
    `UPDATE images SET state = 'ready' WHERE id = $1 AND state = 'pending' AND expires_at > now() RETURNING id`,
    [id],
  );
  if (!result.rowCount)
    throw new AppError(
      409,
      'CONFLICT',
      'Quyền tải ảnh đã hết hạn hoặc ảnh đã thay đổi.',
    );
}
export async function markImageDeleting(id: string) {
  return withTransaction(async (client) => {
    await client.query(
      `SELECT st.id FROM studios st JOIN images i ON i.studio_id=st.id WHERE i.id=$1 FOR UPDATE OF st`,
      [id],
    );
    const result = await client.query(
      `UPDATE images i SET state = 'deleting' WHERE i.id = $1 AND i.state <> 'deleted' AND NOT EXISTS (SELECT 1 FROM studios st WHERE i.id = ANY(st.photo_ids) AND NOT st.is_draft) RETURNING i.id`,
      [id],
    );
    if (!result.rowCount)
      throw new AppError(
        409,
        'CONFLICT',
        'Ảnh đang thuộc hồ sơ. Gửi bộ ảnh thay thế trước khi xóa ảnh cũ.',
      );
  });
}
export async function markImageDeleted(id: string) {
  await query(`UPDATE images SET state = 'deleted' WHERE id = $1`, [id]);
}
export async function getImageUrlsForIds(ids: string[]) {
  const result = await query<{ id: string; key: string }>(
    `SELECT id, key FROM images WHERE id = ANY($1::uuid[]) AND state = 'ready' ORDER BY array_position($1::uuid[], id)`,
    [ids],
  );
  return result.rows;
}
export async function listStudioImages(
  studioId: string,
  workshopId?: string | null,
) {
  return (
    await query<{ id: string; key: string }>(
      `SELECT id,key FROM images WHERE studio_id=$1 AND workshop_id IS NOT DISTINCT FROM $2::uuid AND state='ready' ORDER BY created_at,id`,
      [studioId, workshopId ?? null],
    )
  ).rows;
}
export async function expiredImages() {
  return (
    await query<{ id: string; key: string; state: string }>(
      `SELECT id,key,state FROM images i WHERE (state IN ('pending','deleted') AND expires_at < now()) OR state = 'deleting' OR (state='ready' AND workshop_id IS NULL AND created_at < now()-interval '7 days' AND NOT EXISTS(SELECT 1 FROM studios st WHERE i.id=ANY(st.photo_ids))) ORDER BY created_at LIMIT 100`,
    )
  ).rows;
}
export async function purgeExpiredImage(id: string) {
  await query(
    `DELETE FROM images WHERE id=$1 AND expires_at < now() AND state <> 'ready'`,
    [id],
  );
}
