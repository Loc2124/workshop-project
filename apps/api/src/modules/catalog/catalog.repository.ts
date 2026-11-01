import { query, withTransaction } from '../../db/pool.js';
import { releaseExpiredHolds } from '../bookings/bookings.repository.js';
import type { CatalogFilters } from './catalog.schemas.js';

export type CatalogSession = {
  id: string;
  startsAt: string;
  endsAt: string;
  price: number;
  availableSeats: number;
};

export type CatalogCandidate = {
  id: string;
  slug: string;
  studioId: string;
  studioSlug: string;
  title: string;
  description: string;
  categoryId: string;
  level: string;
  audience: string[];
  takeaway: string | null;
  durationMinutes: number;
  basePrice: number;
  requirements: string | null;
  district: string | null;
  province: string;
  provinceId: string;
  areaId: string | null;
  address: string;
  isSimulated: boolean;
  studioName: string;
  studioDescription: string | null;
  nextStartsAt: string;
  sessions: CatalogSession[];
};

export type CatalogPage = {
  items: CatalogCandidate[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};

type WorkshopDetail = Omit<CatalogCandidate, 'nextStartsAt'>;
type CandidateCount = { total: number };

export type PublicStudio = {
  categoryId: string;
  id: string;
  slug: string;
  name: string;
  description: string | null;
  province: string;
  provinceId: string;
  areaId: string | null;
  areaName: string | null;
  address: string;
  workshops: WorkshopDetail[];
};

export async function listProvinces() {
  const result = await query<{
    id: string;
    name: string;
    studioCount: number;
  }>(
    `SELECT p.id, p.name, count(DISTINCT st.id)::integer AS "studioCount"
     FROM provinces p
     JOIN studios st ON st.province_id = p.id AND st.status = 'approved'
     WHERE EXISTS (
       SELECT 1
       FROM workshops w
       JOIN sessions s ON s.workshop_id = w.id
       WHERE w.studio_id = st.id
         AND w.status = 'approved'
         AND s.status = 'scheduled'
         AND s.starts_at > now()
         AND s.capacity - s.seats_held - s.seats_sold >= 1
     )
     GROUP BY p.id
     ORDER BY p.sort_order`,
  );
  return result.rows;
}

export async function listAreas(provinceId: string) {
  const result = await query<{
    id: string;
    name: string;
    studioCount: number;
  }>(
    `SELECT a.id, a.name, count(DISTINCT st.id)::integer AS "studioCount"
     FROM areas a
     JOIN studios st ON st.area_id = a.id AND st.status = 'approved'
     WHERE a.province_id = $1
       AND EXISTS (
         SELECT 1
         FROM workshops w
         JOIN sessions s ON s.workshop_id = w.id
         WHERE w.studio_id = st.id
           AND w.status = 'approved'
           AND s.status = 'scheduled'
           AND s.starts_at > now()
           AND s.capacity - s.seats_held - s.seats_sold >= 1
       )
     GROUP BY a.id
     ORDER BY a.sort_order, a.name`,
    [provinceId],
  );
  return result.rows;
}

const sessionColumns = `s.id,
  s.workshop_id AS "workshopId",
  s.starts_at AS "startsAt",
  s.ends_at AS "endsAt",
  s.price,
  (s.capacity - s.seats_held - s.seats_sold) AS "availableSeats"`;

function createCandidateFilters(filters: CatalogFilters) {
  const values: unknown[] = [];
  const sessionConditions = [
    `s.status = 'scheduled'`,
    's.starts_at > now()',
    's.capacity - s.seats_held - s.seats_sold >= 1',
  ];
  const workshopConditions = [
    `w.status = 'approved'`,
    `st.status = 'approved'`,
  ];
  const addValue = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.dateFrom !== undefined) {
    const parameter = addValue(filters.dateFrom);
    sessionConditions.push(
      `s.starts_at >= (${parameter}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
    );
  }
  if (filters.dateTo !== undefined) {
    const parameter = addValue(filters.dateTo);
    sessionConditions.push(
      `s.starts_at < ((${parameter}::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
    );
  }
  if (filters.priceMin !== undefined) {
    sessionConditions.push(`s.price >= ${addValue(filters.priceMin)}`);
  }
  if (filters.priceMax !== undefined) {
    sessionConditions.push(`s.price <= ${addValue(filters.priceMax)}`);
  }
  if (filters.provinceId !== undefined) {
    workshopConditions.push(`st.province_id = ${addValue(filters.provinceId)}`);
  }
  if (filters.areaIds !== undefined) {
    workshopConditions.push(
      `st.area_id = ANY(${addValue(filters.areaIds)}::uuid[])`,
    );
  }
  if (filters.categoryId !== undefined) {
    workshopConditions.push(`w.category_id = ${addValue(filters.categoryId)}`);
  }
  if (filters.level !== undefined) {
    workshopConditions.push(`w.level = ${addValue(filters.level)}`);
  }
  if (filters.audience !== undefined) {
    workshopConditions.push(
      `w.audience @> ARRAY[${addValue(filters.audience)}]::text[]`,
    );
  }

  return {
    values,
    sessionWhere: sessionConditions.join('\n AND '),
    workshopWhere: workshopConditions.join('\n AND '),
  };
}

export async function findCandidates(
  filters: CatalogFilters,
): Promise<CatalogPage> {
  return withTransaction(async (client) => {
    await releaseExpiredHolds(client);
    const { values, sessionWhere, workshopWhere } =
      createCandidateFilters(filters);

    const countResult = await client.query<CandidateCount>(
      `SELECT count(DISTINCT w.id)::integer AS total
       FROM workshops w
       JOIN studios st ON st.id = w.studio_id
       WHERE ${workshopWhere}
         AND st.province_id IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM sessions s
           WHERE s.workshop_id = w.id AND ${sessionWhere}
         )`,
      values,
    );

    const pageSizeParameter = `$${values.length + 1}`;
    const offsetParameter = `$${values.length + 2}`;
    const rows = await client.query<CatalogCandidate>(
      `WITH eligible_sessions AS (
         SELECT ${sessionColumns}
         FROM sessions s
         WHERE ${sessionWhere}
       ),
       page AS (
         SELECT w.id, min(es."startsAt") AS "nextStartsAt"
         FROM workshops w
         JOIN studios st ON st.id = w.studio_id
         JOIN eligible_sessions es ON es."workshopId" = w.id
         WHERE ${workshopWhere}
           AND st.province_id IS NOT NULL
         GROUP BY w.id
         ORDER BY min(es."startsAt"), w.id
         LIMIT ${pageSizeParameter}
         OFFSET ${offsetParameter}
       )
       SELECT w.id,
         w.slug,
         st.id AS "studioId",
         st.slug AS "studioSlug",
         w.title,
         w.description,
         w.category_id AS "categoryId",
         w.level,
         w.audience,
         w.takeaway,
         w.duration_minutes AS "durationMinutes",
         w.base_price AS "basePrice",
         w.requirements,
         st.district,
         p.name AS province,
         st.province_id AS "provinceId",
         st.area_id AS "areaId",
         st.address,
         w.is_simulated AS "isSimulated",
         st.name AS "studioName",
         st.description AS "studioDescription",
         page."nextStartsAt",
         json_agg(
           json_build_object(
             'id', es.id,
             'startsAt', es."startsAt",
             'endsAt', es."endsAt",
             'price', es.price,
             'availableSeats', es."availableSeats"
           )
           ORDER BY es."startsAt"
         ) AS sessions
       FROM page
       JOIN workshops w ON w.id = page.id
       JOIN studios st ON st.id = w.studio_id
       JOIN provinces p ON p.id = st.province_id
       JOIN eligible_sessions es ON es."workshopId" = w.id
       GROUP BY w.id, st.id, p.id, page."nextStartsAt"
       ORDER BY page."nextStartsAt", w.id`,
      [...values, filters.pageSize, (filters.page - 1) * filters.pageSize],
    );

    return {
      items: rows.rows,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: countResult.rows[0]?.total ?? 0,
      },
    };
  });
}

export async function getPublicWorkshop(
  workshopId: string,
): Promise<WorkshopDetail | null> {
  return withTransaction(async (client) => {
    await releaseExpiredHolds(client);
    const result = await client.query<WorkshopDetail>(
      `SELECT w.id,
         w.slug,
         st.id AS "studioId",
         st.slug AS "studioSlug",
         st.slug AS "studioSlug",
         w.title,
         w.description,
         w.category_id AS "categoryId",
         w.level,
         w.audience,
         w.takeaway,
         w.duration_minutes AS "durationMinutes",
         w.base_price AS "basePrice",
         w.requirements,
         st.district,
         p.name AS province,
         st.province_id AS "provinceId",
         st.area_id AS "areaId",
         st.address,
         w.is_simulated AS "isSimulated",
         st.name AS "studioName",
         st.description AS "studioDescription",
         COALESCE(
           json_agg(
             json_build_object(
               'id', s.id,
               'startsAt', s.starts_at,
               'endsAt', s.ends_at,
               'price', s.price,
               'availableSeats', s.capacity - s.seats_held - s.seats_sold
             )
             ORDER BY s.starts_at
           ) FILTER (WHERE s.id IS NOT NULL),
           '[]'::json
         ) AS sessions
       FROM workshops w
       JOIN studios st ON st.id = w.studio_id
       JOIN provinces p ON p.id = st.province_id
       LEFT JOIN sessions s
         ON s.workshop_id = w.id
        AND s.status = 'scheduled'
        AND s.starts_at > now()
        AND s.capacity - s.seats_held - s.seats_sold >= 1
       WHERE (w.id::text = $1 OR w.slug = $1)
         AND w.status = 'approved'
         AND st.status = 'approved'
       GROUP BY w.id, st.id, p.id`,
      [workshopId],
    );
    return result.rows[0] ?? null;
  });
}

export async function getPublicStudio(
  studioId: string,
): Promise<PublicStudio | null> {
  return withTransaction(async (client) => {
    await releaseExpiredHolds(client);
    const studioResult = await client.query<Omit<PublicStudio, 'workshops'>>(
      `SELECT st.id,
         st.slug,
         st.category_id AS "categoryId",
         st.name,
         st.description,
         p.name AS province,
         st.province_id AS "provinceId",
         st.area_id AS "areaId",
         a.name AS "areaName",
         st.address
       FROM studios st
       JOIN provinces p ON p.id = st.province_id
       LEFT JOIN areas a ON a.id = st.area_id
       WHERE (st.id::text = $1 OR st.slug = $1)
         AND st.status = 'approved'`,
      [studioId],
    );
    const studio = studioResult.rows[0];
    if (!studio) return null;

    const workshopResult = await client.query<WorkshopDetail>(
      `SELECT w.id,
         w.slug,
         st.id AS "studioId",
         st.slug AS "studioSlug",
         w.title,
         w.description,
         w.category_id AS "categoryId",
         w.level,
         w.audience,
         w.takeaway,
         w.duration_minutes AS "durationMinutes",
         w.base_price AS "basePrice",
         w.requirements,
         st.district,
         p.name AS province,
         st.province_id AS "provinceId",
         st.area_id AS "areaId",
         st.address,
         w.is_simulated AS "isSimulated",
         st.name AS "studioName",
         st.description AS "studioDescription",
         COALESCE(
           json_agg(
             json_build_object(
               'id', s.id,
               'startsAt', s.starts_at,
               'endsAt', s.ends_at,
               'price', s.price,
               'availableSeats', s.capacity - s.seats_held - s.seats_sold
             )
             ORDER BY s.starts_at
           ) FILTER (WHERE s.id IS NOT NULL),
           '[]'::json
         ) AS sessions
       FROM workshops w
       JOIN studios st ON st.id = w.studio_id
       JOIN provinces p ON p.id = st.province_id
       LEFT JOIN sessions s
         ON s.workshop_id = w.id
        AND s.status = 'scheduled'
        AND s.starts_at > now()
        AND s.capacity - s.seats_held - s.seats_sold >= 1
       WHERE (st.id::text = $1 OR st.slug = $1)
         AND w.status = 'approved'
       GROUP BY w.id, st.id, p.id
       ORDER BY min(s.starts_at), w.id`,
      [studioId],
    );

    return { ...studio, workshops: workshopResult.rows };
  });
}
