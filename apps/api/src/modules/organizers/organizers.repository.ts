import { query } from '../../db/pool.js';
import type { OrganizerProfileInput } from './organizers.schemas.js';

export type OrganizerRow = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  address: string | null;
  district: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

export async function findOrganizerByUserId(
  userId: string,
): Promise<OrganizerRow | null> {
  const result = await query<OrganizerRow>(
    `SELECT
      id,
      user_id AS "userId",
      name,
      description,
      address,
      district,
      status,
      created_at AS "createdAt"
     FROM organizers
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function upsertOrganizerProfile(
  userId: string,
  input: OrganizerProfileInput,
): Promise<OrganizerRow> {
  const result = await query<OrganizerRow>(
    `INSERT INTO organizers (user_id, name, description, address, district, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     ON CONFLICT (user_id)
     DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       address = EXCLUDED.address,
       district = EXCLUDED.district,
       status = 'pending'
     RETURNING
       id,
       user_id AS "userId",
       name,
       description,
       address,
       district,
       status,
       created_at AS "createdAt"`,
    [
      userId,
      input.name,
      input.description ?? null,
      input.address ?? null,
      input.district ?? null,
    ],
  );

  return result.rows[0];
}

export async function setUserRole(
  userId: string,
  role: 'customer' | 'organizer' | 'admin',
): Promise<void> {
  await query(
    `UPDATE users
     SET role = $1
     WHERE id = $2`,
    [role, userId],
  );
}
