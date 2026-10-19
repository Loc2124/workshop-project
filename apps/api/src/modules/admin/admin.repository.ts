import { query } from '../../db/pool.js';
import type { OrganizerApprovalStatus } from './admin.schemas.js';

export type OrganizerAdminRow = {
  id: string;
  userId: string;
  userFullName: string;
  name: string;
  description: string | null;
  address: string | null;
  district: string | null;
  status: OrganizerApprovalStatus;
  createdAt: string;
};

export async function listOrganizersForAdmin(
  status?: OrganizerApprovalStatus,
): Promise<OrganizerAdminRow[]> {
  const result = await query<OrganizerAdminRow>(
    `SELECT
      o.id,
      o.user_id AS "userId",
      u.full_name AS "userFullName",
      o.name,
      o.description,
      o.address,
      o.district,
      o.status,
      o.created_at AS "createdAt"
     FROM organizers o
     JOIN users u ON u.id = o.user_id
     WHERE ($1::text IS NULL OR o.status = $1::approval_status)
     ORDER BY o.created_at DESC`,
    [status ?? null],
  );

  return result.rows;
}

export async function updateOrganizerStatus(
  organizerId: string,
  status: OrganizerApprovalStatus,
): Promise<OrganizerAdminRow | null> {
  const result = await query<OrganizerAdminRow>(
    `UPDATE organizers o
     SET status = $1::approval_status
     FROM users u
     WHERE o.id = $2 AND o.user_id = u.id
     RETURNING
       o.id,
       o.user_id AS "userId",
       u.full_name AS "userFullName",
       o.name,
       o.description,
       o.address,
       o.district,
       o.status,
       o.created_at AS "createdAt"`,
    [status, organizerId],
  );

  return result.rows[0] ?? null;
}
