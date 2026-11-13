import { AppError } from '../../errors/app-error.js';
import { getSiteSettings } from '../settings/settings.repository.js';
import type { StudioEvidenceInput } from '@workshop/shared';
import {
  studioTrustSql,
  studioDepositEligibleSql,
  studioEvidenceColumns,
} from './studio-profile-sql.js';
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

export type StudioEvidenceRow = {
  paymentQrImageId?: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  photoIds: string[];
  facebookUrl: string | null;
  instagramUrl: string | null;
  googleMapsUrl: string | null;
  profileComplete: boolean;
  canCollectDeposit?: boolean;
};

export type StudioRow = StudioEvidenceRow & {
  categoryId: string;
  categoryIds: string[];
  trustLevel: 'unapproved' | 'approved' | 'verified';
  proposedCategoryName: string | null;
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

export type MemberStudioRow = StudioEvidenceRow & {
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  isDraft: boolean;
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryIds: string[];
  trustLevel: 'unapproved' | 'approved' | 'verified';
  proposedCategoryName: string | null;
  provinceId: string | null;
  province: string | null;
  areaId: string | null;
  area: string | null;
  address: string;
  status: 'pending' | 'needs_changes' | 'approved' | 'rejected' | 'suspended';
  role: StudioMemberRole;
  createdAt: string;
};

export async function listMemberStudios(
  userId: string,
): Promise<MemberStudioRow[]> {
  const result = await query<MemberStudioRow>(
    `SELECT
       st.id,
       st.slug,
       st.name,
       st.description,
       st.proposed_category_name AS "proposedCategoryName",
       ${studioTrustSql} AS "trustLevel",
       ${studioDepositEligibleSql} AS "canCollectDeposit",
       ${studioEvidenceColumns},
       st.category_id AS "categoryId",
       ARRAY(SELECT sc.category_id FROM studio_categories sc WHERE sc.deleted_at IS NULL AND sc.studio_id = st.id ORDER BY sc.category_id) AS "categoryIds",
       st.province_id AS "provinceId",
       p.name AS province,
       st.area_id AS "areaId",
       a.name AS area,
       st.address,
       st.status,
       st.reviewed_by AS "reviewedBy", st.reviewed_at AS "reviewedAt", st.rejection_reason AS "rejectionReason",
       st.is_draft AS "isDraft",
       sm.role,
       st.created_at AS "createdAt"
     FROM studio_members sm
     JOIN studios st ON st.id = sm.studio_id
     LEFT JOIN provinces p ON p.id = st.province_id
     LEFT JOIN areas a
       ON a.id = st.area_id AND a.province_id = st.province_id
     WHERE sm.user_id = $1 AND (NOT st.is_draft OR sm.role = 'owner')
     ORDER BY st.is_draft ASC, (st.status = 'approved') DESC, st.created_at DESC, st.id`,
    [userId],
  );
  return result.rows;
}

export async function createStudioDraft(userId: string) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO studios(name, slug, address, category_id, status, is_draft) VALUES ($1, $2, '', 'other', 'pending', true) RETURNING id`,
      ['Studio draft', createSlug('studio-draft')],
    );
    const studio = result.rows[0];
    await client.query(
      `INSERT INTO studio_members(studio_id,user_id,role) VALUES ($1,$2,'owner')`,
      [studio.id, userId],
    );
    return studio;
  });
}

export async function createStudio(
  userId: string,
  input: StudioProfileInput,
): Promise<StudioRow | null> {
  return withTransaction(async (client) => {
    const locked = await client.query(
      `SELECT st.id FROM studios st JOIN studio_members sm ON sm.studio_id=st.id AND sm.user_id=$2 AND sm.role='owner' WHERE st.id=$1 AND st.is_draft FOR UPDATE OF st`,
      [input.draftStudioId, userId],
    );
    if (!locked.rowCount) return null;
    await assertPaymentQr(
      client,
      input.draftStudioId,
      userId,
      input.paymentQrImageId,
    );
    await assertProfilePhotos(
      client,
      input.draftStudioId,
      userId,
      input.photoIds,
    );
    const result = await client.query<StudioRow>(
      `UPDATE studios st SET name=$3, slug=$4, description=$5, province_id=p.id, area_id=a.id, address=$8, category_id=$9, proposed_category_name=$10, contact_phone=$11, contact_email=$12, photo_ids=$13, facebook_url=$14, instagram_url=$15, google_maps_url=$16, payment_qr_image_id=$17, is_draft=false
      FROM provinces p LEFT JOIN areas a ON a.id=$7::uuid AND a.province_id=p.id
      WHERE st.id=$1 AND p.id=$6 AND ($7::uuid IS NULL OR a.id IS NOT NULL)
        AND EXISTS(SELECT 1 FROM studio_members sm WHERE sm.studio_id=st.id AND sm.user_id=$2 AND sm.role='owner')
      RETURNING st.id, st.slug, st.name, st.description, st.category_id AS "categoryId", st.proposed_category_name AS "proposedCategoryName", st.province_id AS "provinceId", st.area_id AS "areaId", st.address, st.status, st.created_at AS "createdAt", ${studioEvidenceColumns}`,
      [
        input.draftStudioId,
        userId,
        input.name,
        createSlug(input.name),
        input.description ?? null,
        input.provinceId,
        input.areaId ?? null,
        input.address,
        input.categoryIds?.[0] ?? input.categoryId,
        input.proposedCategoryName ?? null,
        input.contactPhone,
        input.contactEmail,
        input.photoIds,
        input.facebookUrl ?? null,
        input.instagramUrl ?? null,
        input.googleMapsUrl ?? null,
        input.paymentQrImageId ?? null,
      ],
    );
    const studio = result.rows[0];
    if (!studio) return null;
    const categoryIds = input.categoryIds ?? [input.categoryId];
    await client.query(
      `INSERT INTO studio_categories(studio_id,category_id) SELECT $1,unnest($2::text[])`,
      [studio.id, categoryIds],
    );
    studio.categoryIds = categoryIds;
    studio.trustLevel = 'unapproved';
    return studio;
  });
}

async function assertProfilePhotos(
  client: import('pg').PoolClient,
  studioId: string,
  userId: string,
  photoIds: string[],
) {
  const policy = (await getSiteSettings(client)).studio;
  if (photoIds.length < policy.minPhotos || photoIds.length > policy.maxPhotos)
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      `Hồ sơ cần từ ${policy.minPhotos} đến ${policy.maxPhotos} ảnh.`,
    );
  const images = await client.query(
    `SELECT id FROM images WHERE id=ANY($1::uuid[]) AND studio_id=$2 AND uploaded_by=$3 AND workshop_id IS NULL AND state='ready' FOR SHARE`,
    [photoIds, studioId, userId],
  );
  if (images.rowCount !== photoIds.length)
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      'Ảnh phải được tải lên và xác nhận cho đúng hồ sơ studio của bạn.',
    );
}

export async function updateStudioEvidence(
  studioId: string,
  userId: string,
  input: StudioEvidenceInput,
) {
  return withTransaction(async (client) => {
    const locked = await client.query<{
      role: string;
      status: string;
      verifiedAt: string | null;
      name: string;
      address: string;
      photoIds: string[];
      paymentQrImageId: string | null;
    }>(
      `SELECT sm.role,st.status,st.name,st.address,st.photo_ids AS "photoIds",st.payment_qr_image_id AS "paymentQrImageId", st.verified_at AS "verifiedAt" FROM studios st JOIN studio_members sm ON sm.studio_id=st.id AND sm.user_id=$2 WHERE st.id=$1 AND NOT st.is_draft FOR UPDATE OF st`,
      [studioId, userId],
    );
    if (!locked.rows[0])
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
    if (locked.rows[0].role !== 'owner')
      throw new AppError(
        403,
        'FORBIDDEN',
        'Chỉ chủ studio được bổ sung hồ sơ.',
      );
    if (locked.rows[0].status === 'suspended')
      throw new AppError(
        409,
        'CONFLICT',
        'Studio đang tạm ngưng. Chỉ quản trị có thể khôi phục hoạt động.',
      );
    await assertProfilePhotos(client, studioId, userId, input.photoIds);
    await assertPaymentQr(client, studioId, userId, input.paymentQrImageId);
    const current = locked.rows[0];
    const sensitive =
      (input.name !== undefined && input.name !== current.name) ||
      (input.address !== undefined && input.address !== current.address) ||
      input.photoIds[0] !== current.photoIds[0] ||
      (input.paymentQrImageId !== undefined &&
        input.paymentQrImageId !== current.paymentQrImageId);
    const status =
      current.status === 'approved' && !sensitive ? 'approved' : 'pending';
    if (sensitive && current.verifiedAt)
      await client.query(
        `INSERT INTO studio_verification_history(studio_id,reviewed_by,action,reason) VALUES($1,$2,'revoked',$3)`,
        [studioId, userId, 'Chủ studio cập nhật hồ sơ; cần xét duyệt lại.'],
      );
    await client.query(
      `UPDATE studios SET contact_phone=$3,contact_email=$4,photo_ids=$5,facebook_url=$6,instagram_url=$7,google_maps_url=$8,status=$9::approval_status,verified_at=CASE WHEN $10 THEN NULL ELSE verified_at END,verified_by=CASE WHEN $10 THEN NULL ELSE verified_by END,name=COALESCE($11,name),address=COALESCE($12,address),payment_qr_image_id=CASE WHEN $13 THEN $14::uuid ELSE payment_qr_image_id END WHERE id=$1 AND EXISTS(SELECT 1 FROM studio_members WHERE studio_id=$1 AND user_id=$2 AND role='owner')`,
      [
        studioId,
        userId,
        input.contactPhone,
        input.contactEmail,
        input.photoIds,
        input.facebookUrl ?? null,
        input.instagramUrl ?? null,
        input.googleMapsUrl ?? null,
        status,
        sensitive,
        input.name ?? null,
        input.address ?? null,
        input.paymentQrImageId !== undefined,
        input.paymentQrImageId ?? null,
      ],
    );
    return { studioId, status };
  });
}

export async function deleteStudioDraft(
  studioId: string,
  userId: string,
): Promise<boolean> {
  return withTransaction(async (client) => {
    const locked = await client.query<{ id: string }>(
      `SELECT st.id
       FROM studios st
       JOIN studio_members sm
         ON sm.studio_id = st.id AND sm.user_id = $2 AND sm.role = 'owner'
       WHERE st.id = $1 AND st.is_draft = true
       FOR UPDATE OF st`,
      [studioId, userId],
    );
    if (!locked.rowCount) return false;
    await client.query(`DELETE FROM images WHERE studio_id = $1`, [studioId]);
    await client.query(`DELETE FROM studio_categories WHERE studio_id = $1`, [
      studioId,
    ]);
    await client.query(`DELETE FROM studio_members WHERE studio_id = $1`, [
      studioId,
    ]);
    await client.query(
      `DELETE FROM studios WHERE id = $1 AND is_draft = true`,
      [studioId],
    );
    return true;
  });
}

async function assertPaymentQr(
  client: import('pg').PoolClient,
  studioId: string,
  userId: string,
  imageId?: string | null,
) {
  if (!imageId) return;
  const result = await client.query(
    `SELECT id FROM images WHERE id=$1 AND studio_id=$2 AND uploaded_by=$3 AND workshop_id IS NULL AND state='ready' FOR SHARE`,
    [imageId, studioId, userId],
  );
  if (!result.rowCount)
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      'Mã QR phải là ảnh đã tải lên cho studio của bạn.',
    );
}
