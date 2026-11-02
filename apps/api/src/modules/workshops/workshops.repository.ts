import { AppError } from '../../errors/app-error.js';
import { DEFAULT_DEPOSIT_PERCENT } from '@workshop/shared';
import { studioDepositEligibleSql } from '../studios/studio-profile-sql.js';
import { query, withTransaction } from '../../db/pool.js';
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
  proposedCategoryName: string | null;
  level: 'beginner' | 'intermediate' | 'all';
  audience: string[];
  takeaway: string | null;
  durationMinutes: number;
  basePrice: number;
  depositPercent: number;
  effectiveDepositPercent: number;
  requirements: string | null;
  cancellationPolicy: string | null;
  paymentPolicy: string | null;
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
  w.proposed_category_name AS "proposedCategoryName",
  w.level,
  w.audience,
  w.takeaway,
  w.duration_minutes AS "durationMinutes",
  w.base_price AS "basePrice",
  w.deposit_percent AS "depositPercent",
  CASE WHEN ${studioDepositEligibleSql} THEN w.deposit_percent ELSE 0 END AS "effectiveDepositPercent",
  w.requirements,
  w.cancellation_policy AS "cancellationPolicy",
  w.payment_policy AS "paymentPolicy",
  st.province_id AS "provinceId",
  st.area_id AS "areaId",
  st.address,
  w.status,
  w.created_at AS "createdAt"`;

const updateableColumns: Array<[keyof WorkshopUpdateInput, string]> = [
  ['title', 'title'],
  ['description', 'description'],
  ['categoryId', 'category_id'],
  ['proposedCategoryName', 'proposed_category_name'],
  ['level', 'level'],
  ['audience', 'audience'],
  ['takeaway', 'takeaway'],
  ['durationMinutes', 'duration_minutes'],
  ['basePrice', 'base_price'],
  ['depositPercent', 'deposit_percent'],
  ['requirements', 'requirements'],
  ['cancellationPolicy', 'cancellation_policy'],
  ['paymentPolicy', 'payment_policy'],
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
  return withTransaction(async (client) => {
    const state = await lockDepositStudio(client, studioId, userId);
    if (!state) return null;
    const depositPercent =
      input.depositPercent ??
      (state.canCollectDeposit ? DEFAULT_DEPOSIT_PERCENT : 0);
    if (depositPercent > 0 && !state.canCollectDeposit)
      throw new AppError(
        403,
        'FORBIDDEN',
        'Chỉ studio bậc 2 với hồ sơ đầy đủ mới được nhận cọc.',
      );
    const result = await client.query<WorkshopRow>(
      `INSERT INTO workshops (
       studio_id, slug, title, description, category_id, level, audience, takeaway,
       duration_minutes, base_price, requirements, cancellation_policy,
       payment_policy, district, address, status, proposed_category_name, deposit_percent
     )
     SELECT st.id, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NULL, NULL, 'pending', $15, $16
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
       proposed_category_name AS "proposedCategoryName",
       level,
       audience,
       takeaway,
       duration_minutes AS "durationMinutes",
       base_price AS "basePrice",
       deposit_percent AS "depositPercent",
       deposit_percent AS "effectiveDepositPercent",
       requirements,
       cancellation_policy AS "cancellationPolicy",
       payment_policy AS "paymentPolicy",
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
        input.cancellationPolicy ?? null,
        input.paymentPolicy ?? null,
        input.proposedCategoryName ?? null,
        depositPercent,
      ],
    );
    return result.rows[0] ?? null;
  });
}

export async function updateWorkshop(
  studioId: string,
  userId: string,
  workshopId: string,
  input: WorkshopUpdateInput,
): Promise<WorkshopRow | null> {
  if (
    input.categoryId !== undefined &&
    input.proposedCategoryName === undefined
  ) {
    input = { ...input, proposedCategoryName: null };
  }
  return withTransaction(async (client) => {
    const state = await lockDepositStudio(client, studioId, userId);
    if (!state) return null;
    if ((input.depositPercent ?? 0) > 0 && !state.canCollectDeposit)
      throw new AppError(
        403,
        'FORBIDDEN',
        'Chỉ studio bậc 2 với hồ sơ đầy đủ mới được nhận cọc.',
      );
    const values: unknown[] = [studioId, userId, workshopId];
    const assignments = updateableColumns.flatMap(([field, column]) => {
      if (!Object.hasOwn(input, field)) return [];
      values.push(input[field]);
      return [`${column} = $${values.length}`];
    });
    const basePriceParameter = `$${values.length + 1}`;
    values.push(
      Object.hasOwn(input, 'basePrice') ||
        Object.hasOwn(input, 'depositPercent'),
    );

    const result = await client.query<WorkshopRow>(
      `UPDATE workshops w
     SET ${assignments.join(', ')},
        status = CASE
          WHEN w.status IN ('approved', 'rejected')
            THEN 'pending'::approval_status
          ELSE w.status
        END
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
  });
}

async function lockDepositStudio(
  client: import('pg').PoolClient,
  studioId: string,
  userId: string,
) {
  const result = await client.query<{ canCollectDeposit: boolean }>(
    `SELECT ${studioDepositEligibleSql} AS "canCollectDeposit" FROM studios st JOIN studio_members sm ON sm.studio_id=st.id AND sm.user_id=$2 WHERE st.id=$1 FOR UPDATE OF st`,
    [studioId, userId],
  );
  return result.rows[0] ?? null;
}
