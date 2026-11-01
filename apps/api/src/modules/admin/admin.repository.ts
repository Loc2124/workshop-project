import { query } from '../../db/pool.js';
import type { StudioApprovalStatus } from './admin.schemas.js';

export type StudioAdminRow = {
  id: string;
  ownerUserId: string;
  ownerFullName: string;
  name: string;
  description: string | null;
  address: string;
  provinceId: string | null;
  province: string | null;
  areaId: string | null;
  status: StudioApprovalStatus;
  createdAt: string;
};

export async function listStudiosForAdmin(
  status?: StudioApprovalStatus,
): Promise<StudioAdminRow[]> {
  const result = await query<StudioAdminRow>(
    `SELECT
      st.id,
      owner.user_id AS "ownerUserId",
      u.full_name AS "ownerFullName",
      st.name,
      st.description,
      st.address,
      st.province_id AS "provinceId",
      p.name AS province,
      st.area_id AS "areaId",
      st.status,
      st.created_at AS "createdAt"
     FROM studios st
     JOIN studio_members owner
       ON owner.studio_id = st.id AND owner.role = 'owner'
     JOIN users u ON u.id = owner.user_id
     LEFT JOIN provinces p ON p.id = st.province_id
     WHERE ($1::text IS NULL OR st.status = $1::approval_status)
     ORDER BY st.created_at DESC`,
    [status ?? null],
  );
  return result.rows;
}

export async function updateStudioStatus(
  studioId: string,
  status: StudioApprovalStatus,
): Promise<StudioAdminRow | null> {
  const result = await query<StudioAdminRow>(
    `WITH updated AS (
       UPDATE studios st
       SET status = $1::approval_status
       FROM studio_members owner
       JOIN users u ON u.id = owner.user_id
       WHERE st.id = $2
         AND owner.studio_id = st.id
         AND owner.role = 'owner'
       RETURNING
         st.id,
         owner.user_id AS owner_user_id,
         u.full_name AS owner_full_name,
         st.name,
         st.description,
         st.address,
         st.province_id,
         st.area_id,
         st.status,
         st.created_at
     )
     SELECT
       updated.id,
       updated.owner_user_id AS "ownerUserId",
       updated.owner_full_name AS "ownerFullName",
       updated.name,
       updated.description,
       updated.address,
       updated.province_id AS "provinceId",
       p.name AS province,
       updated.area_id AS "areaId",
       updated.status,
       updated.created_at AS "createdAt"
     FROM updated
     LEFT JOIN provinces p ON p.id = updated.province_id`,
    [status, studioId],
  );
  return result.rows[0] ?? null;
}
