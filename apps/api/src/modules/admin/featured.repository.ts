import { attachCoverImages } from '../images/image-variants.js';
import { writeAuditLog } from './audit-log.js';
import { z } from 'zod';
import { adminListFields } from './admin-list-query.js';
import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import { imagePublicUrl } from '../images/image-storage.js';
import { releaseExpiredHolds } from '../bookings/bookings.repository.js';
import { studioDepositEligibleSql } from '../studios/studio-profile-sql.js';
const ids = (max: number) =>
  z
    .array(z.string().uuid())
    .max(max)
    .refine((v) => new Set(v).size === v.length, {
      message: 'Không chọn trùng mục nổi bật.',
    });
export const featuredSelection = z
  .object({ studioIds: ids(6), workshopIds: ids(8) })
  .strict();
export const featuredSave = featuredSelection
  .extend({ expected: featuredSelection })
  .strict();
export const featuredSearch = z
  .object({
    ...adminListFields,
    status: z.literal('all').default('all'),
    sort: z
      .enum(['createdAt:asc', 'createdAt:desc', 'title:asc', 'title:desc'])
      .default('createdAt:desc'),
    type: z.enum(['studio', 'workshop']),
    q: z.string().trim().max(200).default(''),
  })
  .strict();
const studioEligible =
  "st.status='approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st)";
const workshopEligible = `w.status='approved' AND w.visibility_status='active' AND ${studioEligible}`;
type Item = {
  type: 'studio' | 'workshop';
  targetId: string;
  title: string;
  subtitle: string | null;
  imageKey: string | null;
  eligible: boolean;
  sortOrder?: number;
};
function present({ imageKey, ...item }: Item) {
  return { ...item, imageUrl: imageKey ? imagePublicUrl(imageKey) : null };
}
const studioCover =
  "(SELECT COALESCE(i.thumbnail_key,i.key) FROM images i WHERE i.id=ANY(st.photo_ids) AND i.state='ready' ORDER BY array_position(st.photo_ids,i.id) LIMIT 1)";
const workshopCover =
  "(SELECT COALESCE(i.thumbnail_key,i.key) FROM images i WHERE i.workshop_id=w.id AND i.state='ready' ORDER BY i.created_at,i.id LIMIT 1)";
export async function getFeatured() {
  const saved = (
    await query<{
      type: 'studio' | 'workshop';
      targetId: string;
      sortOrder: number;
    }>(
      'SELECT type,target_id AS "targetId",sort_order AS "sortOrder" FROM featured_items WHERE deleted_at IS NULL ORDER BY type,sort_order',
    )
  ).rows;
  const studios = (
    await query<Item>(
      `SELECT 'studio' AS type,st.id AS "targetId",st.name AS title,p.name AS subtitle,${studioCover} AS "imageKey",(${studioEligible}) AS eligible FROM studios st LEFT JOIN provinces p ON p.id=st.province_id WHERE st.id=ANY($1::uuid[])`,
      [saved.filter((i) => i.type === 'studio').map((i) => i.targetId)],
    )
  ).rows;
  const workshops = (
    await query<Item>(
      `SELECT 'workshop' AS type,w.id AS "targetId",w.title,st.name AS subtitle,${workshopCover} AS "imageKey",(${workshopEligible}) AS eligible FROM workshops w JOIN studios st ON st.id=w.studio_id WHERE w.id=ANY($1::uuid[])`,
      [saved.filter((i) => i.type === 'workshop').map((i) => i.targetId)],
    )
  ).rows;
  const items = saved
    .map((row) =>
      present({
        ...row,
        ...[...studios, ...workshops].find(
          (i) => i.type === row.type && i.targetId === row.targetId,
        ),
      } as Item),
    )
    .map((item) => ({
      ...item,
      title: item.title ?? 'Nội dung không còn tồn tại',
      subtitle: item.subtitle ?? null,
      eligible: item.eligible ?? false,
    }));
  return {
    studioIds: saved.filter((i) => i.type === 'studio').map((i) => i.targetId),
    workshopIds: saved
      .filter((i) => i.type === 'workshop')
      .map((i) => i.targetId),
    items,
  };
}
export async function searchFeatured(input: z.infer<typeof featuredSearch>) {
  const pattern = '%' + input.q.replace(/[\\%_]/g, '\\$&') + '%';
  const studio = input.type === 'studio';
  const from = studio
    ? 'FROM studios st LEFT JOIN provinces p ON p.id=st.province_id'
    : 'FROM workshops w JOIN studios st ON st.id=w.studio_id';
  const where = studio
    ? `${studioEligible} AND st.name ILIKE $1`
    : `${workshopEligible} AND (w.title ILIKE $1 OR st.name ILIKE $1)`;
  const select = studio
    ? `'studio' AS type,st.id AS "targetId",st.name AS title,p.name AS subtitle,${studioCover} AS "imageKey",true AS eligible`
    : `'workshop' AS type,w.id AS "targetId",w.title,st.name AS subtitle,${workshopCover} AS "imageKey",true AS eligible`;
  const total = (
    await query<{ n: number }>(
      `SELECT count(*)::int AS n ${from} WHERE ${where}`,
      [pattern],
    )
  ).rows[0].n;
  const [field, dir] = input.sort.split(':');
  const prefix = studio ? 'st' : 'w';
  const order =
    field === 'title'
      ? studio
        ? 'st.name'
        : 'w.title'
      : `${prefix}.created_at`;
  const items = (
    await query<Item>(
      `SELECT ${select} ${from} WHERE ${where} ORDER BY ${order} ${dir === 'asc' ? 'ASC' : 'DESC'},${prefix}.id LIMIT $2 OFFSET $3`,
      [pattern, input.pageSize, (input.page - 1) * input.pageSize],
    )
  ).rows.map(present);
  return { items, total };
}
export async function saveFeatured(
  actor: string,
  input: z.infer<typeof featuredSave>,
) {
  await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(731904,24)');
    const saved = (
      await client.query<{ type: string; target_id: string }>(
        'SELECT type,target_id FROM featured_items WHERE deleted_at IS NULL ORDER BY type,sort_order FOR UPDATE',
      )
    ).rows;
    const current = {
      studioIds: saved
        .filter((i) => i.type === 'studio')
        .map((i) => i.target_id),
      workshopIds: saved
        .filter((i) => i.type === 'workshop')
        .map((i) => i.target_id),
    };
    if (JSON.stringify(current) !== JSON.stringify(input.expected))
      throw new AppError(
        409,
        'CONFLICT',
        'Nội dung nổi bật đã được admin khác cập nhật. Vui lòng tải lại trước khi lưu.',
      );
    const studios = await client.query(
      `SELECT st.id FROM studios st WHERE st.id=ANY($1::uuid[]) AND ${studioEligible} FOR SHARE OF st`,
      [input.studioIds],
    );
    const workshops = await client.query(
      `SELECT w.id FROM workshops w JOIN studios st ON st.id=w.studio_id WHERE w.id=ANY($1::uuid[]) AND ${workshopEligible} FOR SHARE OF w,st`,
      [input.workshopIds],
    );
    if (
      studios.rowCount !== input.studioIds.length ||
      workshops.rowCount !== input.workshopIds.length
    )
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Có mục chưa được duyệt, đã ẩn/gỡ hoặc studio bị tạm ngưng. Hãy gỡ mục không còn công khai rồi lưu lại.',
      );
    await client.query(
      'UPDATE featured_items SET deleted_at=clock_timestamp() WHERE deleted_at IS NULL',
    );
    for (const [type, list] of [
      ['studio', input.studioIds],
      ['workshop', input.workshopIds],
    ] as const) {
      await client.query(
        'INSERT INTO featured_items(type,target_id,sort_order) SELECT $1,id,rank FROM unnest($2::uuid[]) WITH ORDINALITY AS ordered(id,rank) ON CONFLICT(type,target_id) DO UPDATE SET sort_order=EXCLUDED.sort_order,deleted_at=NULL',
        [type, list],
      );
    }
    await writeAuditLog(client, {
      actorId: actor,
      action: 'featured.updated',
      targetType: 'featured',
      targetId: randomUUID(),
      targetName: 'Nội dung trang chủ',
      reason: JSON.stringify({
        before: current,
        after: { studioIds: input.studioIds, workshopIds: input.workshopIds },
      }),
      before: current,
      after: { studioIds: input.studioIds, workshopIds: input.workshopIds },
    });
  });
  return getFeatured();
}
export async function publicFeatured(
  preview?: z.infer<typeof featuredSelection>,
) {
  return withTransaction(async (client) => {
    const saved =
      preview ??
      (await (async () => {
        const rows = (
          await client.query<{ type: string; target_id: string }>(
            'SELECT type,target_id FROM featured_items WHERE deleted_at IS NULL ORDER BY type,sort_order',
          )
        ).rows;
        return {
          studioIds: rows
            .filter((i) => i.type === 'studio')
            .map((i) => i.target_id),
          workshopIds: rows
            .filter((i) => i.type === 'workshop')
            .map((i) => i.target_id),
        };
      })());
    // Invalid/hidden choices are excluded before ranking; latest eligible records fill every gap.
    const selectedWorkshops = (
      await client.query<{ id: string }>(
        `SELECT w.id FROM workshops w JOIN studios st ON st.id=w.studio_id WHERE ${workshopEligible} ORDER BY (w.id=ANY($1::uuid[])) DESC,array_position($1::uuid[],w.id),w.created_at DESC,w.id LIMIT 8`,
        [saved.workshopIds],
      )
    ).rows.map((w) => w.id);
    const sessionIds = (
      await client.query<{ id: string }>(
        "SELECT id FROM sessions WHERE workshop_id=ANY($1::uuid[]) AND status='scheduled' AND starts_at>now()",
        [selectedWorkshops],
      )
    ).rows.map((s) => s.id);
    await releaseExpiredHolds(client, sessionIds);
    const studios = (
      await client.query<{
        id: string;
        imageKey: string | null;
        [key: string]: unknown;
      }>(
        `SELECT st.id,st.slug,st.name,st.description,p.name AS province,ARRAY(SELECT category_id FROM studio_categories WHERE deleted_at IS NULL AND studio_id=st.id ORDER BY category_id) AS "categoryIds",${studioCover} AS "imageKey" FROM studios st JOIN provinces p ON p.id=st.province_id WHERE ${studioEligible} ORDER BY (st.id=ANY($1::uuid[])) DESC,array_position($1::uuid[],st.id),st.created_at DESC,st.id LIMIT 6`,
        [saved.studioIds],
      )
    ).rows.map(({ imageKey, ...studio }) => ({
      ...studio,
      imageUrl: imageKey ? imagePublicUrl(imageKey) : undefined,
    }));
    const workshops = (
      await client.query<{
        id: string;
        imageKey: string | null;
        [key: string]: unknown;
      }>(
        `SELECT w.id,w.slug,st.id AS "studioId",st.slug AS "studioSlug",w.title,w.description,w.category_id AS "categoryId",w.level,w.audience,w.takeaway,w.duration_minutes AS "durationMinutes",w.base_price AS "basePrice",CASE WHEN ${studioDepositEligibleSql} THEN w.deposit_percent ELSE 0 END AS "depositPercent",w.requirements,w.cancellation_policy AS "cancellationPolicy",w.payment_policy AS "paymentPolicy",st.district,p.name AS province,st.province_id AS "provinceId",st.area_id AS "areaId",st.address,w.is_simulated AS "isSimulated",st.name AS "studioName",st.description AS "studioDescription",${workshopCover} AS "imageKey",coalesce((SELECT json_agg(json_build_object('id',s.id,'startsAt',s.starts_at,'endsAt',s.ends_at,'price',s.price,'availableSeats',s.capacity-s.seats_held-s.seats_sold) ORDER BY s.starts_at,s.id) FROM sessions s WHERE s.workshop_id=w.id AND s.status='scheduled' AND s.starts_at>now() AND s.capacity>s.seats_held+s.seats_sold),'[]'::json) AS sessions FROM workshops w JOIN studios st ON st.id=w.studio_id JOIN provinces p ON p.id=st.province_id WHERE ${workshopEligible} ORDER BY (w.id=ANY($1::uuid[])) DESC,array_position($1::uuid[],w.id),w.created_at DESC,w.id LIMIT 8`,
        [saved.workshopIds],
      )
    ).rows.map(({ imageKey, ...workshop }) => ({
      ...workshop,
      imageUrl: imageKey ? imagePublicUrl(imageKey) : undefined,
    }));
    return {
      studios: await attachCoverImages(studios, 'studio', client),
      workshops: await attachCoverImages(workshops, 'workshop', client),
    };
  });
}
