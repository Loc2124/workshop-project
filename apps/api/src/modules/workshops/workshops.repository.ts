import { query } from '../../db/pool.js';
import { createSlug } from '../../lib/slug.js';
import type {
  WorkshopInput,
  WorkshopUpdateInput,
} from './workshops.schemas.js';

export type WorkshopRow = {
  id: string;
  slug: string;
  studioId: string;
  title: string;
  description: string;
  categoryId: string;
  level: 'beginner' | 'intermediate' | 'all';
  audience: string[];
  takeaway: string | null;
  durationMinutes: number;
  basePrice: number;
  requirements: string | null;
  policy: string | null;
  provinceId: string;
  areaId: string | null;
  address: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

const workshopColumns = `w.id,
  w.slug,
  w.studio_id AS "studioId",
  w.title,
  w.description,
  w.category_id AS "categoryId",
  w.level,
  w.audience,
  w.takeaway,
  w.duration_minutes AS "durationMinutes",
  w.base_price AS "basePrice",
  w.requirements,
  w.policy,
  st.province_id AS "provinceId",
  st.area_id AS "areaId",
  st.address,
  w.status,
  w.created_at AS "createdAt"`;

const updateableColumns: Array<[keyof WorkshopUpdateInput, string]> = [
  ['title', 'title'],
  ['description', 'description'],
  ['categoryId', 'category_id'],
  ['level', 'level'],
  ['audience', 'audience'],
  ['takeaway', 'takeaway'],
  ['durationMinutes', 'duration_minutes'],
  ['basePrice', 'base_price'],
  ['requirements', 'requirements'],
  ['policy', 'policy'],
];

export async function listWorkshops(
  studioId: string,
  userId: string,
): Promise<WorkshopRow[] | null> {
  const membership = await query(
    `SELECT 1
     FROM studio_members
     WHERE studio_id = $1 AND user_id = $2`,
    [studioId, userId],
  );
  if (!membership.rowCount) return null;

  const result = await query<WorkshopRow>(
    `SELECT ${workshopColumns}
     FROM workshops w
     JOIN studios st ON st.id = w.studio_id
     JOIN studio_members sm ON sm.studio_id = st.id
     WHERE st.id = $1 AND sm.user_id = $2
     ORDER BY w.created_at DESC, w.id`,
    [studioId, userId],
  );
  return result.rows;
}

export async function createWorkshop(
  studioId: string,
  userId: string,
  input: WorkshopInput,
): Promise<WorkshopRow | null> {
  const result = await query<WorkshopRow>(
    `INSERT INTO workshops (
       studio_id, slug, title, description, category_id, level, audience, takeaway,
       duration_minutes, base_price, requirements, policy, district, address, status
     )
     SELECT st.id, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NULL, NULL, 'pending'
     FROM studios st
     JOIN studio_members sm
       ON sm.studio_id = st.id AND sm.user_id = $2 AND sm.role = 'owner'
     WHERE st.id = $1
     RETURNING id,
       studio_id AS "studioId",
       slug,
       title,
       description,
       category_id AS "categoryId",
       level,
       audience,
       takeaway,
       duration_minutes AS "durationMinutes",
       base_price AS "basePrice",
       requirements,
       policy,
       (SELECT province_id FROM studios WHERE id = studio_id) AS "provinceId",
       (SELECT area_id FROM studios WHERE id = studio_id) AS "areaId",
       (SELECT address FROM studios WHERE id = studio_id) AS address,
       status,
       created_at AS "createdAt"`,
    [
      studioId,
      userId,
      createSlug(input.title),
      input.title,
      input.description,
      input.categoryId,
      input.level,
      input.audience,
      input.takeaway ?? null,
      input.durationMinutes,
      input.basePrice,
      input.requirements ?? null,
      input.policy ?? null,
    ],
  );
  return result.rows[0] ?? null;
}

export async function updateWorkshop(
  studioId: string,
  userId: string,
  workshopId: string,
  input: WorkshopUpdateInput,
): Promise<WorkshopRow | null> {
  const values: unknown[] = [studioId, userId, workshopId];
  const assignments = updateableColumns.flatMap(([field, column]) => {
    if (!Object.hasOwn(input, field)) return [];
    values.push(input[field]);
    return [`${column} = $${values.length}`];
  });
  const basePriceParameter = `$${values.length + 1}`;
  values.push(Object.hasOwn(input, 'basePrice'));

  const result = await query<WorkshopRow>(
    `UPDATE workshops w
     SET ${assignments.join(', ')},
         status = CASE WHEN w.status = 'approved' THEN 'pending'::approval_status ELSE w.status END
     FROM studios st
     JOIN studio_members sm ON sm.studio_id = st.id
     WHERE w.studio_id = st.id
       AND st.id = $1
       AND sm.user_id = $2
       AND w.id = $3
       AND (NOT ${basePriceParameter}::boolean OR sm.role = 'owner')
     RETURNING ${workshopColumns}`,
    values,
  );
  return result.rows[0] ?? null;
}
