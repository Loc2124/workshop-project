import { withTransaction } from '../../db/pool.js';
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
  title: string;
  description: string;
  category: string;
  level: string;
  audience: string[];
  takeaway: string | null;
  durationMinutes: number;
  basePrice: number;
  requirements: string | null;
  district: string;
  address: string | null;
  isSimulated: boolean;
  organizerName: string;
  organizerDescription: string | null;
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

type WorkshopDetail = Omit<CatalogCandidate, 'nextStartsAt'> & {
  sessions: CatalogSession[];
};

type CandidateCount = {
  total: number;
};

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
  const workshopConditions = [`w.status = 'approved'`, `o.status = 'approved'`];
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
      `s.starts_at < ((${
        parameter
      }::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
    );
  }
  if (filters.priceMin !== undefined) {
    sessionConditions.push(`s.price >= ${addValue(filters.priceMin)}`);
  }
  if (filters.priceMax !== undefined) {
    sessionConditions.push(`s.price <= ${addValue(filters.priceMax)}`);
  }
  if (filters.district !== undefined) {
    workshopConditions.push(`w.district = ${addValue(filters.district)}`);
  }
  if (filters.category !== undefined) {
    workshopConditions.push(`w.category = ${addValue(filters.category)}`);
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
       JOIN organizers o ON o.id = w.organizer_id
       WHERE ${workshopWhere}
         AND EXISTS (
           SELECT 1
           FROM sessions s
           WHERE s.workshop_id = w.id
             AND ${sessionWhere}
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
         JOIN organizers o ON o.id = w.organizer_id
         JOIN eligible_sessions es ON es."workshopId" = w.id
         WHERE ${workshopWhere}
         GROUP BY w.id
         ORDER BY min(es."startsAt"), w.id
         LIMIT ${pageSizeParameter}
         OFFSET ${offsetParameter}
       )
       SELECT w.id,
         w.title,
         w.description,
         w.category,
         w.level,
         w.audience,
         w.takeaway,
         w.duration_minutes AS "durationMinutes",
         w.base_price AS "basePrice",
         w.requirements,
         w.district,
         w.address,
         w.is_simulated AS "isSimulated",
         o.name AS "organizerName",
         o.description AS "organizerDescription",
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
       JOIN organizers o ON o.id = w.organizer_id
       JOIN eligible_sessions es ON es."workshopId" = w.id
       GROUP BY w.id, o.id, page."nextStartsAt"
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
         w.title,
         w.description,
         w.category,
         w.level,
         w.audience,
         w.takeaway,
         w.duration_minutes AS "durationMinutes",
         w.base_price AS "basePrice",
         w.requirements,
         w.district,
         w.address,
         w.is_simulated AS "isSimulated",
         o.name AS "organizerName",
         o.description AS "organizerDescription",
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
       JOIN organizers o ON o.id = w.organizer_id
       LEFT JOIN sessions s
         ON s.workshop_id = w.id
        AND s.status = 'scheduled'
        AND s.starts_at > now()
        AND s.capacity - s.seats_held - s.seats_sold >= 1
       WHERE w.id = $1::uuid
         AND w.status = 'approved'
         AND o.status = 'approved'
       GROUP BY w.id, o.id`,
      [workshopId],
    );

    return result.rows[0] ?? null;
  });
}
