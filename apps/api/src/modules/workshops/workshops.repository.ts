import { AppError } from '../../errors/app-error.js';
import { writeAuditLog } from '../admin/audit-log.js';
import { studioDepositEligibleSql } from '../studios/studio-profile-sql.js';
import { query, withTransaction } from '../../db/pool.js';
import { calculateDeposit } from '@workshop/shared';
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
  depositPercent: number | null;
  depositModeOverride: 'none' | 'optional' | 'required' | null;
  included: string[];
  effectiveDepositPercent: number;
  requirements: string | null;
  cancellationPolicy: string | null;
  paymentPolicy: string | null;
  provinceId: string;
  areaId: string | null;
  address: string;
  status: 'pending' | 'approved' | 'rejected';
  publicationStatus: 'draft' | 'published' | 'hidden';
  isDiscontinued: boolean;
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
  w.deposit_mode_override AS "depositModeOverride",w.included,
  effective_deposit_percent(st,w) AS "effectiveDepositPercent",
  w.requirements,
  w.cancellation_policy AS "cancellationPolicy",
  w.payment_policy AS "paymentPolicy",
  st.province_id AS "provinceId",
  st.area_id AS "areaId",
  st.address,
  w.status,
  CASE WHEN w.visibility_status <> 'active' THEN 'hidden' ELSE w.publication_status END AS "publicationStatus",
  w.is_discontinued AS "isDiscontinued",
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
  ['depositModeOverride', 'deposit_mode_override'],
  ['included', 'included'],
  ['requirements', 'requirements'],
  ['cancellationPolicy', 'cancellation_policy'],
  ['paymentPolicy', 'payment_policy'],
  ['publicationStatus', 'publication_status'],
  ['isDiscontinued', 'is_discontinued'],
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
    assertApprovedStudio(state);
    const depositPercent = input.depositPercent ?? null;
    if ((depositPercent ?? 0) > 0 && !state.canCollectDeposit)
      throw new AppError(
        403,
        'FORBIDDEN',
        'Chỉ studio bậc 2 với hồ sơ đầy đủ mới được nhận cọc.',
      );
    const result = await client.query<WorkshopRow>(
      `INSERT INTO workshops (
       studio_id, slug, title, description, category_id, level, audience, takeaway,
       duration_minutes, base_price, requirements, cancellation_policy,
       payment_policy, district, address, status, proposed_category_name, deposit_percent, publication_status, is_simulated,deposit_mode_override,included
     )
     SELECT st.id, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NULL, NULL, 'approved'::approval_status, $15, $16, $17, false, $18, $19
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
       deposit_percent AS "depositPercent",deposit_mode_override AS "depositModeOverride",included,
       (SELECT effective_deposit_percent(st,workshops) FROM studios st WHERE st.id=studio_id) AS "effectiveDepositPercent",
       requirements,
       cancellation_policy AS "cancellationPolicy",
       payment_policy AS "paymentPolicy",
       (SELECT province_id FROM studios WHERE id = studio_id) AS "provinceId",
       (SELECT area_id FROM studios WHERE id = studio_id) AS "areaId",
       (SELECT address FROM studios WHERE id = studio_id) AS address,
       status,
       publication_status AS "publicationStatus",
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
        input.publicationStatus ?? 'published',
        input.depositModeOverride ?? null,
        input.included ?? [],
      ],
    );
    const workshop = result.rows[0] ?? null;
    if (workshop) await assertMinimumDeposit(client, workshop.id);
    if (workshop)
      await writeAuditLog(client, {
        actorId: userId,
        action: 'workshop.created',
        targetType: 'workshop',
        targetId: workshop.id,
        targetName: workshop.title,
      });
    return workshop;
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
    assertApprovedStudio(state);
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
        Object.hasOwn(input, 'depositPercent') ||
        Object.hasOwn(input, 'depositModeOverride'),
    );

    const result = await client.query<WorkshopRow>(
      `UPDATE workshops w
     SET ${assignments.join(', ')},
        status = 'approved'::approval_status
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
    const workshop = result.rows[0] ?? null;
    if (workshop) await assertMinimumDeposit(client, workshop.id);
    if (workshop)
      await writeAuditLog(client, {
        actorId: userId,
        action: 'workshop.updated',
        targetType: 'workshop',
        targetId: workshop.id,
        targetName: workshop.title,
      });
    return workshop;
  });
}

async function lockDepositStudio(
  client: import('pg').PoolClient,
  studioId: string,
  userId: string,
) {
  const result = await client.query<{
    canCollectDeposit: boolean;
    status: string;
    isDraft: boolean;
  }>(
    `SELECT ${studioDepositEligibleSql} AS "canCollectDeposit", st.status, st.is_draft AS "isDraft" FROM studios st JOIN studio_members sm ON sm.studio_id=st.id AND sm.user_id=$2 WHERE st.id=$1 FOR UPDATE OF st`,
    [studioId, userId],
  );
  return result.rows[0] ?? null;
}

async function assertMinimumDeposit(
  client: import('pg').PoolClient,
  id: string,
) {
  const minimum = Number(process.env.PAYMENT_MIN_AMOUNT ?? 0);
  if (!minimum) return;
  const result = await client.query<{ price: number; percent: number }>(
    `SELECT LEAST(w.base_price,COALESCE(min(s.price),w.base_price)) AS price,effective_deposit_percent(st,w) AS percent FROM workshops w JOIN studios st ON st.id=w.studio_id LEFT JOIN sessions s ON s.workshop_id=w.id AND s.status='scheduled' AND s.starts_at>now() WHERE w.id=$1 GROUP BY w.id,st.id`,
    [id],
  );
  const row = result.rows[0];
  if (
    row &&
    row.price > 0 &&
    row.percent > 0 &&
    calculateDeposit(row.price, row.percent) < minimum
  )
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      `Tiền cọc thấp hơn mức thanh toán tối thiểu ${minimum.toLocaleString('vi-VN')} đ. Vui lòng tăng mức cọc hoặc chọn không cọc.`,
    );
}

function assertApprovedStudio(state: { status: string; isDraft: boolean }) {
  if (state.status !== 'approved' || state.isDraft)
    throw new AppError(
      403,
      'FORBIDDEN',
      'Studio cần được duyệt trước khi tạo hoặc cập nhật workshop.',
    );
}
