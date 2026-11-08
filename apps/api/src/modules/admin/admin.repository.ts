import type { PoolClient } from 'pg';
import {
  studioTrustSql,
  studioDepositEligibleSql,
  studioEvidenceColumns,
} from '../studios/studio-profile-sql.js';
import type { StudioEvidenceRow } from '../studios/studios.repository.js';
import { createStudioEvidenceSchema, canReviewStudio } from '@workshop/shared';
import { getSiteSettings } from '../settings/settings.repository.js';
import { AppError } from '../../errors/app-error.js';
import type {
  StudioVerificationDecision,
  StudioTrustLevel,
} from '@workshop/shared';
import { query, withTransaction } from '../../db/pool.js';
import { adminListSql, adminStatusCounts } from './admin-list-sql.js';
import type { AdminStudioListQuery } from './admin.schemas.js';
import { approveCategoryProposal } from '../catalog/categories.repository.js';
import type {
  AdminWorkshopListQuery,
  StudioApprovalStatus,
  WorkshopDecision,
} from './admin.schemas.js';

type WorkshopReviewEntry = {
  categoryName: string | null;
  decision: 'approved' | 'rejected';
  reason: string | null;
  reviewerName: string;
  reviewedAt: string;
};

export type AdminWorkshopRow = {
  id: string;
  slug: string;
  studioId: string;
  studioName: string;
  studioStatus: StudioApprovalStatus;
  title: string;
  description: string;
  categoryId: string;
  proposedCategoryName: string | null;
  level: string;
  audience: string[];
  takeaway: string | null;
  durationMinutes: number;
  basePrice: number;
  requirements: string | null;
  cancellationPolicy: string | null;
  paymentPolicy: string | null;
  province: string;
  areaId: string | null;
  address: string;
  status: StudioApprovalStatus;
  createdAt: string;
  reviewHistory: WorkshopReviewEntry[];
};

type AdminWorkshopDecisionResult =
  | { kind: 'not-found' }
  | { kind: 'conflict'; currentStatus: StudioApprovalStatus }
  | { kind: 'updated'; workshop: AdminWorkshopRow };

const adminWorkshopColumns = `w.id,
  w.slug,
  st.id AS "studioId",
  st.name AS "studioName",
  st.status AS "studioStatus",
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
  effective_deposit_percent(st,w) AS "effectiveDepositPercent",
  w.requirements,
  w.cancellation_policy AS "cancellationPolicy",
  w.payment_policy AS "paymentPolicy",
  p.name AS province,
  st.area_id AS "areaId",
  st.address,
  w.status,
  w.created_at AS "createdAt"`;

export type StudioAdminRow = StudioEvidenceRow & {
  categoryIds?: string[];
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  trustLevel: StudioTrustLevel;
  id: string;
  ownerUserId: string;
  ownerFullName: string;
  name: string;
  description: string | null;
  proposedCategoryName: string | null;
  address: string;
  provinceId: string | null;
  province: string | null;
  areaId: string | null;
  status: StudioApprovalStatus;
  createdAt: string;
};

export async function listStudiosForAdmin(
  status?: StudioApprovalStatus,
  filters?: AdminStudioListQuery,
  studioId?: string,
): Promise<StudioAdminRow[]> {
  const sql = adminListSql('studio', filters ?? { status });
  const values = [...sql.values];
  if (studioId) sql.where += ` AND st.id=$${values.push(studioId)}::uuid`;
  const pagination = filters
    ? ` LIMIT $${values.push(filters.pageSize ?? 20)} OFFSET $${values.push(((filters.page ?? 1) - 1) * (filters.pageSize ?? 20))}`
    : '';
  const result = await query<StudioAdminRow>(
    `SELECT
      st.id,
      owner.user_id AS "ownerUserId",
      u.full_name AS "ownerFullName",
      st.name, st.is_hidden AS "isHidden", st.hidden_reason AS "hiddenReason",
      st.description,
      ${studioTrustSql} AS "trustLevel",
      ${studioEvidenceColumns},
      st.verified_at IS NOT NULL AS "verificationActive",
      ${studioDepositEligibleSql} AS "canCollectDeposit",
      COALESCE((SELECT json_agg(json_build_object('action', h.action, 'method', h.method, 'reason', h.reason, 'reviewerName', reviewer.full_name, 'createdAt', h.created_at) ORDER BY h.created_at DESC, h.id DESC)
        FROM studio_verification_history h JOIN users reviewer ON reviewer.id = h.reviewed_by WHERE h.studio_id = st.id), '[]'::json) AS "verificationHistory",
      st.proposed_category_name AS "proposedCategoryName",
      st.address,
      st.province_id AS "provinceId",
      p.name AS province,
      st.area_id AS "areaId",
      st.status,
      st.reviewed_by AS "reviewedBy", st.reviewed_at AS "reviewedAt", st.rejection_reason AS "rejectionReason",
      ARRAY(SELECT sc.category_id FROM studio_categories sc WHERE sc.deleted_at IS NULL AND sc.studio_id = st.id ORDER BY sc.category_id) AS "categoryIds",
      st.submitted_at AS "submittedAt", st.created_at AS "createdAt"
     FROM studios st
     JOIN studio_members owner
       ON owner.studio_id = st.id AND owner.role = 'owner'
     JOIN users u ON u.id = owner.user_id
     LEFT JOIN provinces p ON p.id = st.province_id
     WHERE ${sql.where}
     ORDER BY ${sql.orderBy}${pagination}`,
    values,
  );
  return result.rows;
}

export async function countStudiosForAdmin(filters: AdminStudioListQuery) {
  const sql = adminListSql('studio', filters, false);
  const result = await query<{ status: string; count: number }>(
    `SELECT st.status, count(*)::integer AS count FROM studios st JOIN studio_members owner ON owner.studio_id = st.id AND owner.role = 'owner' JOIN users u ON u.id = owner.user_id WHERE ${sql.where} GROUP BY st.status`,
    sql.values,
  );
  return adminStatusCounts(result.rows);
}
export async function listStudioStatusHistory(studioId: string) {
  return (
    await query(
      `SELECT id::text,from_status AS "fromStatus",to_status AS "toStatus",actor_id AS "actorId",actor_name AS "actorName",reason,created_at AS "createdAt" FROM studio_status_history WHERE studio_id=$1 ORDER BY created_at,id`,
      [studioId],
    )
  ).rows;
}

export async function updateStudioStatus(
  studioId: string,
  status: StudioApprovalStatus,
  reviewerId: string,
  reason?: string,
  transactionClient?: PoolClient,
): Promise<StudioAdminRow | null> {
  const execute = async (client: PoolClient) => {
    const locked = await client.query<{
      proposedCategoryName: string | null;
      status: StudioApprovalStatus;
      verifiedAt: string | null;
      profileComplete: boolean;
      contactPhone: string | null;
      contactEmail: string | null;
      photoIds: string[];
    }>(
      'SELECT status, proposed_category_name AS "proposedCategoryName", verified_at AS "verifiedAt", studio_profile_complete(studios) AS "profileComplete", contact_phone AS "contactPhone", contact_email AS "contactEmail", photo_ids AS "photoIds" FROM studios WHERE id = $1 AND NOT is_draft FOR UPDATE',
      [studioId],
    );
    if (!locked.rows[0]) return null;
    if (!canReviewStudio(locked.rows[0].status, status))
      throw new AppError(
        409,
        'CONFLICT',
        'Trạng thái studio đã thay đổi hoặc thao tác không được phép. Vui lòng tải lại hồ sơ.',
      );
    const proposal = locked.rows[0].proposedCategoryName;
    const photoPolicy = (await getSiteSettings(client)).studio;
    const contactAndPhotosValid = createStudioEvidenceSchema(photoPolicy)
      .pick({ contactPhone: true, contactEmail: true, photoIds: true })
      .safeParse({
        contactPhone: locked.rows[0].contactPhone,
        contactEmail: locked.rows[0].contactEmail,
        photoIds: locked.rows[0].photoIds,
      }).success;
    if (
      status === 'approved' &&
      (!locked.rows[0].profileComplete || !contactAndPhotosValid)
    )
      throw new AppError(
        400,
        'BAD_REQUEST',
        `Hồ sơ chưa đủ điều kiện: cần SĐT, email và từ ${photoPolicy.minPhotos} đến ${photoPolicy.maxPhotos} ảnh đã tải lên.`,
      );
    if (status !== 'approved' && locked.rows[0].verifiedAt) {
      if (!reviewerId)
        throw new Error('Reviewer is required to revoke verification.');
      await client.query(
        `INSERT INTO studio_verification_history (studio_id, reviewed_by, action, reason) VALUES ($1, $2, 'revoked', $3)`,
        [studioId, reviewerId, 'Hồ sơ studio không còn được duyệt.'],
      );
    }

    let categoryId: string | null = null;
    if (status === 'approved' && proposal) {
      categoryId = await approveCategoryProposal(client, proposal);
      await client.query(
        `INSERT INTO studio_categories (studio_id, category_id) VALUES ($1, $2) ON CONFLICT(studio_id,category_id) DO UPDATE SET deleted_at=NULL`,
        [studioId, categoryId],
      );
      if (categoryId !== 'other')
        await client.query(
          `UPDATE studio_categories SET deleted_at=clock_timestamp() WHERE studio_id = $1 AND category_id = 'other' AND deleted_at IS NULL`,
          [studioId],
        );
    }
    const result = await client.query<StudioAdminRow>(
      `WITH updated AS (
       UPDATE studios st
       SET status = $1::approval_status,
         reviewed_by = $4, reviewed_at = now(), rejection_reason = $5,
         verified_at = CASE WHEN $1 = 'approved' THEN st.verified_at ELSE NULL END,
         verified_by = CASE WHEN $1 = 'approved' THEN st.verified_by ELSE NULL END,
         category_id = CASE WHEN st.category_id = 'other' THEN COALESCE($3, st.category_id) ELSE st.category_id END,
         proposed_category_name = CASE WHEN $1 = 'approved' THEN NULL ELSE st.proposed_category_name END
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
         st.proposed_category_name,
         st.verified_at,
         st.contact_phone, st.contact_email, st.photo_ids, st.payment_qr_image_id, st.facebook_url, st.instagram_url, st.google_maps_url, studio_profile_complete(st) AS profile_complete,
         st.address,
         st.province_id,
         st.area_id,
         st.status,
         st.reviewed_by, st.reviewed_at, st.rejection_reason,
         st.created_at
     )
     SELECT
       updated.id,
       updated.owner_user_id AS "ownerUserId",
       updated.owner_full_name AS "ownerFullName",
       updated.name,
       CASE WHEN updated.status <> 'approved' OR NOT updated.profile_complete THEN 'unapproved' WHEN updated.verified_at IS NOT NULL THEN 'verified' ELSE 'approved' END AS "trustLevel",
       updated.contact_phone AS "contactPhone", updated.contact_email AS "contactEmail", updated.photo_ids AS "photoIds", updated.facebook_url AS "facebookUrl", updated.instagram_url AS "instagramUrl", updated.google_maps_url AS "googleMapsUrl", updated.profile_complete AS "profileComplete",
       updated.payment_qr_image_id AS "paymentQrImageId",
       updated.description,
       updated.proposed_category_name AS "proposedCategoryName",
       updated.address,
       updated.province_id AS "provinceId",
       p.name AS province,
       updated.area_id AS "areaId",
       updated.status,
       updated.reviewed_by AS "reviewedBy", updated.reviewed_at AS "reviewedAt", updated.rejection_reason AS "rejectionReason",
       ARRAY(SELECT sc.category_id FROM studio_categories sc WHERE sc.deleted_at IS NULL AND sc.studio_id = updated.id ORDER BY sc.category_id) AS "categoryIds",
       updated.created_at AS "createdAt"
     FROM updated
     LEFT JOIN provinces p ON p.id = updated.province_id`,
      [
        status,
        studioId,
        categoryId,
        reviewerId,
        status === 'approved' ? null : (reason?.trim() ?? null),
      ],
    );
    return result.rows[0] ?? null;
  };
  return transactionClient
    ? execute(transactionClient)
    : withTransaction(execute);
}

export async function listWorkshopsForAdmin(
  filters: AdminWorkshopListQuery,
  countsOnly = false,
): Promise<{
  workshops: AdminWorkshopRow[];
  total: number;
  statusCounts: Record<string, number>;
}> {
  const sql = adminListSql('workshop', filters);
  const countsSql = adminListSql('workshop', filters, false);
  const values = [...sql.values];
  const limit = values.push(filters.pageSize ?? 20);
  const offset = values.push(
    ((filters.page ?? 1) - 1) * (filters.pageSize ?? 20),
  );
  const [countResult, workshopResult] = await Promise.all([
    query<{ status: string; count: number }>(
      `SELECT w.status, count(*)::integer AS count FROM workshops w JOIN studios st ON st.id = w.studio_id JOIN provinces p ON p.id = st.province_id WHERE ${countsSql.where} GROUP BY w.status`,
      countsSql.values,
    ),
    countsOnly
      ? Promise.resolve({ rows: [] as AdminWorkshopRow[] })
      : query<AdminWorkshopRow>(
          `SELECT ${adminWorkshopColumns},
         COALESCE(history.entries, '[]'::json) AS "reviewHistory"
       FROM workshops w
       JOIN studios st ON st.id = w.studio_id
       JOIN provinces p ON p.id = st.province_id
       LEFT JOIN LATERAL (
         SELECT json_agg(
           json_build_object(
             'decision', review.decision,
             'reason', review.reason,
             'categoryName', review.category_name,
             'reviewerName', reviewer.full_name,
             'reviewedAt', review.reviewed_at
           )
           ORDER BY review.reviewed_at DESC, review.id DESC
         ) AS entries
         FROM workshop_review_history review
         JOIN users reviewer ON reviewer.id = review.reviewed_by
         WHERE review.workshop_id = w.id
       ) history ON true
       WHERE ${sql.where}
       ORDER BY ${sql.orderBy}
       LIMIT $${limit} OFFSET $${offset}`,
          values,
        ),
  ]);
  const statusCounts = adminStatusCounts(countResult.rows);
  return {
    workshops: workshopResult.rows,
    total: statusCounts[filters.status ?? 'pending'] ?? 0,
    statusCounts,
  };
}

export async function decideWorkshop(
  workshopId: string,
  reviewerId: string,
  decision: WorkshopDecision,
): Promise<AdminWorkshopDecisionResult> {
  return withTransaction(async (client) => {
    const existing = await client.query<{
      status: StudioApprovalStatus;
      proposedCategoryName: string | null;
    }>(
      'SELECT status, proposed_category_name AS "proposedCategoryName" FROM workshops WHERE id = $1 FOR UPDATE',
      [workshopId],
    );
    const currentStatus = existing.rows[0]?.status;
    if (!currentStatus) return { kind: 'not-found' };
    if (currentStatus !== 'pending') {
      return { kind: 'conflict', currentStatus };
    }

    let approvedCategoryId: string | null = null;
    const proposal = existing.rows[0]?.proposedCategoryName;
    if (decision.status === 'approved' && proposal) {
      approvedCategoryId = await approveCategoryProposal(client, proposal);
    }

    const updateResult = await client.query<{ status: StudioApprovalStatus }>(
      `UPDATE workshops
       SET status = $2::approval_status,
         category_id = COALESCE($3, category_id),
         proposed_category_name = CASE WHEN $2 = 'approved' THEN NULL ELSE proposed_category_name END
       WHERE id = $1 AND status = 'pending'
       RETURNING status`,
      [workshopId, decision.status, approvedCategoryId],
    );
    if (!updateResult.rows[0]) {
      throw new Error('Locked workshop status changed unexpectedly.');
    }

    await client.query(
      `INSERT INTO workshop_review_history
         (workshop_id, reviewed_by, decision, reason, category_name)
       VALUES ($1, $2, $3::approval_status, $4, $5)`,
      [
        workshopId,
        reviewerId,
        decision.status,
        decision.reason ?? null,
        proposal && decision.status === 'approved' ? proposal : null,
      ],
    );

    const workshopResult = await client.query<AdminWorkshopRow>(
      `SELECT ${adminWorkshopColumns},
         COALESCE((
           SELECT json_agg(
             json_build_object(
               'decision', review.decision,
               'reason', review.reason,
               'categoryName', review.category_name,
               'reviewerName', reviewer.full_name,
               'reviewedAt', review.reviewed_at
             )
             ORDER BY review.reviewed_at DESC, review.id DESC
           )
           FROM workshop_review_history review
           JOIN users reviewer ON reviewer.id = review.reviewed_by
           WHERE review.workshop_id = w.id
         ), '[]'::json) AS "reviewHistory"
       FROM workshops w
       JOIN studios st ON st.id = w.studio_id
       JOIN provinces p ON p.id = st.province_id
       WHERE w.id = $1
       LIMIT 1`,
      [workshopId],
    );
    const workshop = workshopResult.rows[0];
    if (!workshop) {
      throw new Error('Updated workshop was not available for its response.');
    }

    return { kind: 'updated', workshop };
  });
}

export async function updateStudioVerification(
  studioId: string,
  reviewerId: string,
  decision: StudioVerificationDecision,
) {
  return withTransaction(async (client) => {
    const existing = await client.query<{
      status: StudioApprovalStatus;
      verifiedAt: string | null;
      profileComplete: boolean;
    }>(
      'SELECT status, verified_at AS "verifiedAt", studio_profile_complete(studios) AS "profileComplete" FROM studios WHERE id = $1 AND NOT is_draft FOR UPDATE',
      [studioId],
    );
    const studio = existing.rows[0];
    if (!studio) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
    if (studio.status !== 'approved')
      throw new AppError(
        409,
        'CONFLICT',
        'Chỉ studio đã được duyệt mới được thay đổi xác minh.',
      );
    if (decision.verified && !studio.profileComplete)
      throw new AppError(
        422,
        'UNPROCESSABLE_ENTITY',
        'Cần bổ sung đủ hồ sơ bậc 1 trước khi xác minh bậc 2.',
      );
    if (Boolean(studio.verifiedAt) === decision.verified)
      throw new AppError(
        409,
        'CONFLICT',
        'Trạng thái xác minh đã thay đổi. Tải lại danh sách để kiểm tra.',
      );
    const result = await client.query<{ verifiedAt: string | null }>(
      `UPDATE studios SET verified_at = CASE WHEN $2 THEN now() ELSE NULL END,
       verified_by = CASE WHEN $2 THEN $3::uuid ELSE NULL END WHERE id = $1 RETURNING verified_at AS "verifiedAt"`,
      [studioId, decision.verified, reviewerId],
    );
    await client.query(
      `INSERT INTO studio_verification_history (studio_id, reviewed_by, action, method, reason) VALUES ($1, $2, $3, $4, $5)`,
      [
        studioId,
        reviewerId,
        decision.verified ? 'verified' : 'revoked',
        decision.verified ? decision.method : null,
        decision.verified ? null : decision.reason,
      ],
    );
    return {
      trustLevel: decision.verified
        ? ('verified' as const)
        : ('approved' as const),
      verifiedAt: result.rows[0].verifiedAt,
    };
  });
}
