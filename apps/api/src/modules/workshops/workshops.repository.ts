import { query } from '../../db/pool.js';
import type {
  WorkshopInput,
  WorkshopUpdateInput,
} from './workshops.schemas.js';

export type WorkshopRow = {
  id: string;
  organizerId: string;
  title: string;
  description: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'all';
  audience: string[];
  takeaway: string | null;
  durationMinutes: number;
  basePrice: number;
  requirements: string | null;
  policy: string | null;
  district: string;
  address: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

const workshopColumns = `id,
  organizer_id AS "organizerId",
  title,
  description,
  category,
  level,
  audience,
  takeaway,
  duration_minutes AS "durationMinutes",
  base_price AS "basePrice",
  requirements,
  policy,
  district,
  address,
  status,
  created_at AS "createdAt"`;

const updateableColumns: Array<[keyof WorkshopUpdateInput, string]> = [
  ['title', 'title'],
  ['description', 'description'],
  ['category', 'category'],
  ['level', 'level'],
  ['audience', 'audience'],
  ['takeaway', 'takeaway'],
  ['durationMinutes', 'duration_minutes'],
  ['basePrice', 'base_price'],
  ['requirements', 'requirements'],
  ['policy', 'policy'],
  ['district', 'district'],
  ['address', 'address'],
];

export async function listWorkshops(
  organizerId: string,
): Promise<WorkshopRow[]> {
  const result = await query<WorkshopRow>(
    `SELECT ${workshopColumns}
     FROM workshops
     WHERE organizer_id = $1
     ORDER BY created_at DESC, id`,
    [organizerId],
  );

  return result.rows;
}

export async function createWorkshop(
  organizerId: string,
  input: WorkshopInput,
): Promise<WorkshopRow | null> {
  const result = await query<WorkshopRow>(
    `INSERT INTO workshops (
       organizer_id, title, description, category, level, audience, takeaway,
       duration_minutes, base_price, requirements, policy, district, address,
       status
     )
     SELECT
       id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending'
     FROM organizers
     WHERE id = $1
     RETURNING ${workshopColumns}`,
    [
      organizerId,
      input.title,
      input.description,
      input.category,
      input.level,
      input.audience,
      input.takeaway ?? null,
      input.durationMinutes,
      input.basePrice,
      input.requirements ?? null,
      input.policy ?? null,
      input.district,
      input.address ?? null,
    ],
  );

  return result.rows[0] ?? null;
}

export async function updateWorkshop(
  organizerId: string,
  workshopId: string,
  input: WorkshopUpdateInput,
): Promise<WorkshopRow | null> {
  const values: unknown[] = [organizerId, workshopId];
  const assignments = updateableColumns.flatMap(([field, column]) => {
    if (!Object.hasOwn(input, field)) {
      return [];
    }

    values.push(input[field]);
    return [`${column} = $${values.length}`];
  });

  const result = await query<WorkshopRow>(
    `UPDATE workshops
     SET ${assignments.join(', ')},
         status = CASE WHEN status = 'approved' THEN 'pending'::approval_status ELSE status END
     WHERE organizer_id = $1 AND id = $2
     RETURNING ${workshopColumns}`,
    values,
  );

  return result.rows[0] ?? null;
}
