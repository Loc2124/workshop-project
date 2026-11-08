import { writeAuditLog } from './audit-log.js';
import { z } from 'zod';
import { adminListFields } from './admin-list-query.js';
import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import { imagePublicUrl } from '../images/image-storage.js';
import { releaseExpiredHolds } from '../bookings/bookings.repository.js';
import { studioTrustSql } from '../studios/studio-profile-sql.js';
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
  "st.status='approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st) AND (NOT EXISTS (SELECT 1 FROM workshops demo WHERE demo.studio_id=st.id AND demo.is_simulated) OR EXISTS (SELECT 1 FROM workshops real WHERE real.studio_id=st.id AND NOT real.is_simulated))";
const workshopEligible = `w.status='approved' AND NOT w.is_simulated AND w.visibility_status='active' AND w.publication_status='published' AND ${studioEligible}`;
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
    const selection = (
      await client.query<{
        studioIds: string[];
        workshopIds: string[];
        sessionIds: string[];
      }>(
        `WITH selected_workshops AS MATERIALIZED (
           SELECT w.id, row_number() OVER (
             ORDER BY (w.id=ANY($1::uuid[])) DESC,array_position($1::uuid[],w.id),
               w.created_at DESC,w.id
           ) AS position
           FROM workshops w JOIN studios st ON st.id=w.studio_id
           WHERE ${workshopEligible} AND NOT w.is_discontinued
             AND EXISTS (SELECT 1 FROM sessions bookable WHERE bookable.workshop_id=w.id
               AND bookable.status='scheduled' AND bookable.starts_at>now()
               AND COALESCE(bookable.registration_deadline,bookable.starts_at)>now()
               AND bookable.capacity>bookable.seats_held+bookable.seats_sold)
           ORDER BY (w.id=ANY($1::uuid[])) DESC,array_position($1::uuid[],w.id),
             w.created_at DESC,w.id
           LIMIT 8
         ), selected_studios AS MATERIALIZED (
           SELECT st.id, row_number() OVER (
             ORDER BY (st.id=ANY($2::uuid[])) DESC,array_position($2::uuid[],st.id),
               st.created_at DESC,st.id
           ) AS position
           FROM studios st
           WHERE ${studioEligible}
           ORDER BY (st.id=ANY($2::uuid[])) DESC,array_position($2::uuid[],st.id),
             st.created_at DESC,st.id
           LIMIT 6
         )
         SELECT
           COALESCE((SELECT array_agg(id ORDER BY position) FROM selected_studios),ARRAY[]::uuid[]) AS "studioIds",
           COALESCE((SELECT array_agg(id ORDER BY position) FROM selected_workshops),ARRAY[]::uuid[]) AS "workshopIds",
           ARRAY(
             SELECT s.id
             FROM sessions s JOIN workshops w ON w.id=s.workshop_id
             WHERE (w.id IN (SELECT id FROM selected_workshops)
               OR w.studio_id IN (SELECT id FROM selected_studios))
               AND s.status='scheduled' AND s.starts_at>now()
               AND COALESCE(s.registration_deadline,s.starts_at)>now()
           ) AS "sessionIds"`,
        [saved.workshopIds, saved.studioIds],
      )
    ).rows[0];
    await releaseExpiredHolds(client, selection.sessionIds);

    const result = (
      await client.query<{
        studios: Array<
          Record<string, unknown> & {
            imageKey: string | null;
            thumbnailKey: string | null;
            mediumKey: string | null;
          }
        >;
        workshops: Array<
          Record<string, unknown> & {
            imageKey: string | null;
            thumbnailKey: string | null;
            mediumKey: string | null;
          }
        >;
      }>(
        `WITH selected_studios AS (
           SELECT id,position FROM unnest($1::uuid[]) WITH ORDINALITY AS selected(id,position)
         ), selected_workshops AS (
           SELECT id,position FROM unnest($2::uuid[]) WITH ORDINALITY AS selected(id,position)
         ), studio_items AS (
           SELECT ss.position,st.id,st.slug,st.name,coalesce(st.description,'') AS description,
             st.category_id AS "categoryId",${studioTrustSql} AS "trustLevel",
             p.name AS province,st.province_id AS "provinceId",st.area_id AS "areaId",
             a.name AS "areaName",st.address,
             ARRAY(SELECT category_id FROM studio_categories WHERE deleted_at IS NULL AND studio_id=st.id ORDER BY category_id) AS "categoryIds",
             stats."workshopCount",stats."availableSessions",stats."startingPrice",
             cover.key AS "imageKey",cover.thumbnail_key AS "thumbnailKey",
             cover.medium_key AS "mediumKey"
           FROM selected_studios ss
           JOIN studios st ON st.id=ss.id
           JOIN provinces p ON p.id=st.province_id
           LEFT JOIN areas a ON a.id=st.area_id AND a.province_id=st.province_id
           LEFT JOIN LATERAL (
             SELECT count(DISTINCT w.id) FILTER (WHERE s.id IS NOT NULL)::integer AS "workshopCount",
               count(s.id)::integer AS "availableSessions",min(s.price)::integer AS "startingPrice"
             FROM workshops w LEFT JOIN sessions s ON s.workshop_id=w.id
               AND s.status='scheduled' AND s.starts_at>now()
               AND COALESCE(s.registration_deadline,s.starts_at)>now()
               AND s.capacity>s.seats_held+s.seats_sold
             WHERE w.studio_id=st.id AND w.status='approved' AND NOT w.is_simulated AND NOT w.is_discontinued
               AND w.visibility_status='active' AND w.publication_status='published'
           ) stats ON true
           LEFT JOIN LATERAL (
             SELECT i.key,i.thumbnail_key,i.medium_key
             FROM images i
             WHERE i.id=ANY(st.photo_ids) AND i.state='ready'
             ORDER BY array_position(st.photo_ids,i.id)
             LIMIT 1
           ) cover ON true
           WHERE ${studioEligible}
         ), workshop_items AS (
           SELECT sw.position,w.id,w.slug,st.id AS "studioId",st.slug AS "studioSlug",
             w.title,w.description,w.category_id AS "categoryId",w.level,w.audience,w.takeaway,
             w.duration_minutes AS "durationMinutes",w.base_price AS "basePrice",
             effective_deposit_percent(st,w) AS "depositPercent",
         effective_deposit_mode(st,w) AS "depositMode",w.included,st.contact_phone AS "studioContactPhone",st.contact_email AS "studioContactEmail",
             w.requirements,w.cancellation_policy AS "cancellationPolicy",
             w.payment_policy AS "paymentPolicy",st.district,p.name AS province,
             st.province_id AS "provinceId",st.area_id AS "areaId",st.address,
             w.is_simulated AS "isSimulated",w.is_discontinued AS "isDiscontinued",st.name AS "studioName",
             st.description AS "studioDescription",${studioTrustSql} AS "studioTrustLevel",
             cover.key AS "imageKey",cover.thumbnail_key AS "thumbnailKey",
             cover.medium_key AS "mediumKey",
             coalesce((
               SELECT json_agg(json_build_object('id',s.id,'startsAt',s.starts_at,
                 'endsAt',s.ends_at,'price',s.price,
                 'availableSeats',s.capacity-s.seats_held-s.seats_sold,
                 'status',s.status,'registrationDeadline',s.registration_deadline)
                 ORDER BY s.starts_at,s.id)
               FROM sessions s
               WHERE s.workshop_id=w.id AND s.status='scheduled' AND s.starts_at>now()
                 AND COALESCE(s.registration_deadline,s.starts_at)>now()
                 AND s.capacity>s.seats_held+s.seats_sold
             ),'[]'::json) AS sessions
           FROM selected_workshops sw
           JOIN workshops w ON w.id=sw.id
           JOIN studios st ON st.id=w.studio_id
           JOIN provinces p ON p.id=st.province_id
           LEFT JOIN LATERAL (
             SELECT i.key,i.thumbnail_key,i.medium_key
             FROM images i
             WHERE i.workshop_id=w.id AND i.state='ready'
             ORDER BY i.created_at,i.id
             LIMIT 1
           ) cover ON true
           WHERE ${workshopEligible}
         )
         SELECT
           COALESCE((SELECT jsonb_agg(to_jsonb(item)-'position' ORDER BY position) FROM studio_items item),'[]'::jsonb) AS studios,
           COALESCE((SELECT jsonb_agg(to_jsonb(item)-'position' ORDER BY position) FROM workshop_items item),'[]'::jsonb) AS workshops`,
        [selection.studioIds, selection.workshopIds],
      )
    ).rows[0];
    const withImageUrls = <
      T extends {
        imageKey: string | null;
        thumbnailKey: string | null;
        mediumKey: string | null;
      },
    >(
      items: T[],
    ) =>
      items.map(({ imageKey, thumbnailKey, mediumKey, ...item }) => ({
        ...item,
        ...(imageKey ? { imageUrl: imagePublicUrl(imageKey) } : {}),
        ...(thumbnailKey ? { thumbnailUrl: imagePublicUrl(thumbnailKey) } : {}),
        ...(mediumKey ? { mediumUrl: imagePublicUrl(mediumKey) } : {}),
      }));
    return {
      studios: withImageUrls(result.studios),
      workshops: withImageUrls(result.workshops),
    };
  });
}
