import { withTransaction } from '../../db/pool.js';
import { query } from '../../db/pool.js';
import { createSlug } from '../../lib/slug.js';
import type { StudioProfileInput } from './studios.schemas.js';

export type StudioMemberRole = 'owner' | 'staff';

export async function getStudioMemberRole(
  studioId: string,
  userId: string,
): Promise<StudioMemberRole | null> {
  const result = await query<{ role: StudioMemberRole }>(
    `SELECT role
     FROM studio_members
     WHERE studio_id = $1 AND user_id = $2`,
    [studioId, userId],
  );
  return result.rows[0]?.role ?? null;
}

export type StudioRow = {
  categoryId: string;
  id: string;
  slug: string;
  name: string;
  description: string | null;
  provinceId: string;
  areaId: string | null;
  address: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

export async function createStudio(
  userId: string,
  input: StudioProfileInput,
): Promise<StudioRow | null> {
  return withTransaction(async (client) => {
    const result = await client.query<StudioRow>(
      `INSERT INTO studios (
         name, slug, description, province_id, area_id, address, category_id, status
       )
       SELECT $1, $2, $3, p.id, a.id, $6, $7, 'pending'
       FROM provinces p
       LEFT JOIN areas a
         ON a.id = $5::uuid AND a.province_id = p.id
       WHERE p.id = $4
         AND ($5::uuid IS NULL OR a.id IS NOT NULL)
       RETURNING id,
         slug,
         category_id AS "categoryId",
         name,
         description,
         province_id AS "provinceId",
         area_id AS "areaId",
         address,
         status,
         created_at AS "createdAt"`,
      [
        input.name,
        createSlug(input.name),
        input.description ?? null,
        input.provinceId,
        input.areaId ?? null,
        input.address,
        input.categoryId,
      ],
    );

    const studio = result.rows[0];
    if (!studio) return null;

    await client.query(
      `INSERT INTO studio_members (studio_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [studio.id, userId],
    );

    return studio;
  });
}
