import {
  studioTrustSql,
  studioDepositEligibleSql,
} from '../studios/studio-profile-sql.js';
import type { PoolClient } from 'pg';
import { withTransaction } from '../../db/pool.js';
import { releaseExpiredHolds } from '../bookings/bookings.repository.js';
import type {
  PublicStudioResponseDto,
  PublicWorkshopDto,
} from '@workshop/shared';
import type { CatalogFilters } from './catalog.schemas.js';

export type CatalogSession = PublicWorkshopDto['sessions'][number];

export type CatalogCandidate = Omit<PublicWorkshopDto, 'nextStartsAt'> & {
  nextStartsAt: string;
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
type StudioCandidate = Omit<PublicStudio, 'workshops' | 'description'> & {
  description: string;
  workshopCount: number;
  categoryIds: string[];
  startingPrice: number;
  availableSessions: number;
};

export type PublicStudio = PublicStudioResponseDto['studio'];

export type StudioCatalogPage = {
  items: StudioCandidate[];
  pagination: CatalogPage['pagination'];
};

async function releaseExpiredHoldsInScope(
  client: PoolClient,
  joins: string,
  where: string,
  values: unknown[] = [],
): Promise<void> {
  const result = await client.query<{ id: string }>(
    `SELECT DISTINCT s.id
     FROM sessions s
     ${joins}
     WHERE s.status = 'scheduled'
       AND s.starts_at > now()
       AND ${where}
       AND EXISTS (
         SELECT 1
         FROM bookings b
         WHERE b.session_id = s.id
           AND b.status = 'pending'
           AND b.hold_expires_at < now()
       )
     ORDER BY s.id`,
    values,
  );
  await releaseExpiredHolds(
    client,
    result.rows.map(({ id }) => id),
  );
}

export async function listProvinces(includeEmpty = false) {
  return withTransaction(async (client) => {
    await releaseExpiredHoldsInScope(
      client,
      `JOIN workshops w ON w.id = s.workshop_id
       JOIN studios st ON st.id = w.studio_id`,
      `w.status = 'approved' AND NOT w.is_simulated AND w.visibility_status = 'active' AND w.publication_status = 'published'
       AND st.status = 'approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st)
       AND st.province_id IS NOT NULL`,
    );
    const result = await client.query<{
      id: string;
      name: string;
      studioCount: number;
    }>(
      `SELECT p.id, p.name, count(DISTINCT st.id)::integer AS "studioCount"
       FROM provinces p
       LEFT JOIN studios st
         ON st.province_id = p.id
        AND st.status = 'approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st)
        AND EXISTS (
          SELECT 1
          FROM workshops w
          JOIN sessions s ON s.workshop_id = w.id
          WHERE w.studio_id = st.id
            AND w.status = 'approved' AND NOT w.is_simulated AND w.visibility_status = 'active' AND w.publication_status = 'published'
            AND NOT w.is_discontinued
            AND s.status = 'scheduled'
            AND s.starts_at > now()
            AND COALESCE(s.registration_deadline, s.starts_at) > now()
            AND s.capacity - s.seats_held - s.seats_sold >= 1
        )
       WHERE $1::boolean OR st.id IS NOT NULL
       GROUP BY p.id
       ORDER BY p.sort_order`,
      [includeEmpty],
    );
    return result.rows;
  });
}

export async function listAreas(provinceId: string) {
  return withTransaction(async (client) => {
    await releaseExpiredHoldsInScope(
      client,
      `JOIN workshops w ON w.id = s.workshop_id
       JOIN studios st ON st.id = w.studio_id`,
      `w.status = 'approved' AND NOT w.is_simulated AND w.visibility_status = 'active' AND w.publication_status = 'published'
       AND st.status = 'approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st)
       AND st.province_id = $1`,
      [provinceId],
    );
    const result = await client.query<{
      id: string;
      name: string;
      studioCount: number;
    }>(
      `SELECT a.id, a.name, count(DISTINCT st.id)::integer AS "studioCount"
       FROM areas a
       JOIN studios st ON st.area_id = a.id AND st.status = 'approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st)
       WHERE a.province_id = $1
         AND EXISTS (
           SELECT 1
           FROM workshops w
           JOIN sessions s ON s.workshop_id = w.id
           WHERE w.studio_id = st.id
             AND w.status = 'approved' AND NOT w.is_simulated AND w.visibility_status = 'active' AND w.publication_status = 'published'
             AND NOT w.is_discontinued
             AND s.status = 'scheduled'
             AND s.starts_at > now()
             AND COALESCE(s.registration_deadline, s.starts_at) > now()
             AND s.capacity - s.seats_held - s.seats_sold >= 1
         )
       GROUP BY a.id
       ORDER BY a.sort_order, a.name`,
      [provinceId],
    );
    return result.rows;
  });
}

const sessionColumns = `s.id,
  s.workshop_id AS "workshopId",
  s.starts_at AS "startsAt",
  s.ends_at AS "endsAt",
  s.price,
  (s.capacity - s.seats_held - s.seats_sold) AS "availableSeats",
  s.status, s.registration_deadline AS "registrationDeadline"`;

const vietnameseAccentSource =
  'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ';
const vietnameseAccentTarget =
  'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';

function normalizedSql(expression: string): string {
  return `translate(lower(coalesce(${expression}, '')), '${vietnameseAccentSource}', '${vietnameseAccentTarget}')`;
}

function createCandidateFilters(filters: CatalogFilters) {
  const values: unknown[] = [];
  const sessionScopeConditions = [
    `s.status = 'scheduled'`,
    's.starts_at > now()',
  ];
  const sessionConditions = ['TRUE'];
  const workshopConditions = [
    `w.status = 'approved' AND NOT w.is_simulated AND w.visibility_status = 'active' AND w.publication_status = 'published'`,
    `st.status = 'approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st)`,
  ];
  const addValue = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.dateFrom !== undefined) {
    const parameter = addValue(filters.dateFrom);
    const condition = `s.starts_at >= (${parameter}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
    sessionConditions.push(condition);
    sessionScopeConditions.push(condition);
  }
  if (filters.dateTo !== undefined) {
    const parameter = addValue(filters.dateTo);
    const condition = `s.starts_at < ((${parameter}::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
    sessionConditions.push(condition);
    sessionScopeConditions.push(condition);
  }
  if (filters.priceMin !== undefined) {
    const condition = `s.price >= ${addValue(filters.priceMin)}`;
    sessionConditions.push(condition);
    sessionScopeConditions.push(condition);
  }
  if (filters.priceMax !== undefined) {
    const condition = `s.price <= ${addValue(filters.priceMax)}`;
    sessionConditions.push(condition);
    sessionScopeConditions.push(condition);
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
  if (filters.takeawaySameDay) {
    workshopConditions.push(`coalesce(w.takeaway, '') ~* 'ngay|ngày'`);
  }

  const searchFields = [
    normalizedSql('w.title'),
    normalizedSql('w.description'),
    normalizedSql('c.name'),
    normalizedSql('c.description'),
    normalizedSql("array_to_string(c.keywords, ' ')"),
    normalizedSql('st.name'),
    normalizedSql('p.name'),
    normalizedSql("array_to_string(w.audience, ' ')"),
  ];
  const titleField = normalizedSql('w.title');
  const categoryField = normalizedSql(
    "concat_ws(' ', c.name, array_to_string(c.keywords, ' '))",
  );
  const categoryDescriptionField = normalizedSql('c.description');
  const studioField = normalizedSql('st.name');
  const provinceField = normalizedSql('p.name');
  const workshopDescriptionField = normalizedSql('w.description');
  const audienceField = normalizedSql("array_to_string(w.audience, ' ')");
  const searchConditions: string[] = [];
  const relevanceParts: string[] = [];

  const searchTerms = (filters.query ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLocaleLowerCase('vi')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  for (const term of new Set(searchTerms)) {
    const parameter = addValue(term);
    const matches = (field: string) => `position(${parameter} in ${field}) > 0`;
    searchConditions.push(`(${searchFields.map(matches).join(' OR ')})`);
    relevanceParts.push(
      `(CASE WHEN ${matches(titleField)} THEN 8 ELSE 0 END
        + CASE WHEN ${matches(categoryField)} THEN 5 ELSE 0 END
        + CASE WHEN ${matches(categoryDescriptionField)} THEN 2 ELSE 0 END
        + CASE WHEN ${matches(studioField)} THEN 4 ELSE 0 END
        + CASE WHEN ${matches(provinceField)} THEN 2 ELSE 0 END
        + CASE WHEN ${matches(workshopDescriptionField)} THEN 1 ELSE 0 END
        + CASE WHEN ${matches(audienceField)} THEN 2 ELSE 0 END)`,
    );
  }
  if (searchConditions.length > 0) {
    workshopConditions.push(`(${searchConditions.join(' OR ')})`);
  }

  return {
    values,
    sessionWhere: sessionConditions.join('\n AND '),
    sessionScopeWhere: sessionScopeConditions.join('\n AND '),
    workshopWhere: workshopConditions.join('\n AND '),
    relevance: relevanceParts.length ? relevanceParts.join(' + ') : '0',
  };
}

function getCatalogOrderBy(sort: CatalogFilters['sort']): string {
  switch (sort) {
    case 'price-asc':
      return '"startingPrice" ASC';
    case 'price-desc':
      return '"startingPrice" DESC';
    case 'soonest':
      return '"nextStartsAt" ASC';
    case 'recommended':
      return '"relevance" DESC, "verifiedPriority" DESC, "nextStartsAt" ASC';
  }
}

function createFilteredWorkshopCte(
  workshopWhere: string,
  relevance: string,
): string {
  return `filtered_workshops AS (
    SELECT w.id, w.studio_id AS "studioId", ${relevance} AS relevance,
      CASE WHEN st.verified_at IS NOT NULL THEN 1 ELSE 0 END AS "verifiedPriority"
    FROM workshops w
    JOIN studios st ON st.id = w.studio_id
    JOIN provinces p ON p.id = st.province_id
    JOIN categories c ON c.id = w.category_id
    WHERE ${workshopWhere}
      AND st.province_id IS NOT NULL
  )`;
}

export async function findCandidates(
  filters: CatalogFilters,
): Promise<CatalogPage> {
  return withTransaction(async (client) => {
    const {
      values,
      sessionWhere,
      sessionScopeWhere,
      workshopWhere,
      relevance,
    } = createCandidateFilters(filters);
    await releaseExpiredHoldsInScope(
      client,
      `JOIN workshops w ON w.id = s.workshop_id
       JOIN studios st ON st.id = w.studio_id
       JOIN provinces p ON p.id = st.province_id
       JOIN categories c ON c.id = w.category_id`,
      `${sessionScopeWhere} AND ${workshopWhere}`,
      values,
    );
    const filteredWorkshops = createFilteredWorkshopCte(
      workshopWhere,
      relevance,
    );
    const countResult = await client.query<CandidateCount>(
      `WITH ${filteredWorkshops}
       SELECT count(*)::integer AS total
       FROM filtered_workshops fw
       WHERE EXISTS (
         SELECT 1 FROM sessions s
         WHERE s.workshop_id = fw.id AND ${sessionWhere}
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
       ${filteredWorkshops},
       page AS (
         SELECT fw.id,
           min(es."startsAt") AS "nextStartsAt",
           min(es.price)::integer AS "startingPrice",
           fw.relevance, fw."verifiedPriority"
         FROM filtered_workshops fw
         JOIN eligible_sessions es ON es."workshopId" = fw.id
         GROUP BY fw.id, fw.relevance, fw."verifiedPriority"
         ORDER BY ${getCatalogOrderBy(filters.sort)}, fw.id
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
         effective_deposit_percent(st,w) AS "depositPercent",
         effective_deposit_mode(st,w) AS "depositMode",w.included,st.contact_phone AS "studioContactPhone",st.contact_email AS "studioContactEmail",
         effective_deposit_percent(st,w) AS "effectiveDepositPercent",
         w.requirements,
         w.cancellation_policy AS "cancellationPolicy",
         w.payment_policy AS "paymentPolicy",
         st.district,
         p.name AS province,
         st.province_id AS "provinceId",
         st.area_id AS "areaId",
         st.address,
         w.is_simulated AS "isSimulated",
         w.is_discontinued AS "isDiscontinued",
         st.name AS "studioName",
         st.description AS "studioDescription", ${studioTrustSql} AS "studioTrustLevel",
         page."nextStartsAt",
         json_agg(
           json_build_object(
             'id', es.id,
             'startsAt', es."startsAt",
             'endsAt', es."endsAt",
             'price', es.price,
             'availableSeats', es."availableSeats"
             ,'status', es.status, 'registrationDeadline', es."registrationDeadline"
           )
           ORDER BY es."startsAt"
         ) AS sessions
       FROM page
       JOIN workshops w ON w.id = page.id
       JOIN studios st ON st.id = w.studio_id
       JOIN provinces p ON p.id = st.province_id
       JOIN eligible_sessions es ON es."workshopId" = w.id
       GROUP BY
         w.id, st.id, p.id, page."nextStartsAt", page."startingPrice",
         page.relevance, page."verifiedPriority"
       ORDER BY ${getCatalogOrderBy(filters.sort)}, w.id`,
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

export async function findStudioCandidates(
  filters: CatalogFilters,
): Promise<StudioCatalogPage> {
  return withTransaction(async (client) => {
    const {
      values,
      sessionWhere,
      sessionScopeWhere,
      workshopWhere,
      relevance,
    } = createCandidateFilters(filters);
    await releaseExpiredHoldsInScope(
      client,
      `JOIN workshops w ON w.id = s.workshop_id
       JOIN studios st ON st.id = w.studio_id
       JOIN provinces p ON p.id = st.province_id
       JOIN categories c ON c.id = w.category_id`,
      `${sessionScopeWhere} AND ${workshopWhere}`,
      values,
    );
    const filteredWorkshops = createFilteredWorkshopCte(
      workshopWhere,
      relevance,
    );
    const countResult = await client.query<CandidateCount>(
      `WITH ${filteredWorkshops}
       SELECT count(DISTINCT fw."studioId")::integer AS total
       FROM filtered_workshops fw
       JOIN workshops active_workshop ON active_workshop.id=fw.id AND NOT active_workshop.is_discontinued
       WHERE EXISTS (
         SELECT 1 FROM sessions s
         WHERE s.workshop_id = fw.id AND ${sessionWhere}
           AND s.status = 'scheduled' AND s.starts_at > now()
           AND COALESCE(s.registration_deadline,s.starts_at)>now()
           AND s.capacity>s.seats_held+s.seats_sold
       )`,
      values,
    );
    const pageSizeParameter = `$${values.length + 1}`;
    const offsetParameter = `$${values.length + 2}`;
    const pageResult = await client.query<StudioCandidate>(
      `WITH eligible_sessions AS (
         SELECT ${sessionColumns}
         FROM sessions s
         WHERE ${sessionWhere}
           AND s.status = 'scheduled' AND s.starts_at > now()
           AND COALESCE(s.registration_deadline,s.starts_at)>now()
           AND s.capacity>s.seats_held+s.seats_sold
       ),
       ${filteredWorkshops},
       filtered_studio_workshops AS (
         SELECT fw."studioId",
           w.category_id AS "categoryId",
           min(es.price)::integer AS "startingPrice",
           min(es."startsAt") AS "nextStartsAt",
           count(es.id)::integer AS "availableSessions",
           fw.relevance
         FROM filtered_workshops fw
         JOIN workshops w ON w.id = fw.id
         JOIN eligible_sessions es ON es."workshopId" = fw.id
         WHERE NOT w.is_discontinued
         GROUP BY fw."studioId", fw.id, w.category_id, fw.relevance
       ),
       studios AS (
         SELECT st.id,
           st.slug,
           ${studioTrustSql} AS "trustLevel",
         ${studioDepositEligibleSql} AS "canCollectDeposit",
         st.category_id AS "categoryId",
           st.name,
           coalesce(st.description, '') AS description,
           p.name AS province,
           st.province_id AS "provinceId",
           st.area_id AS "areaId",
           a.name AS "areaName",
           st.address,
           count(*)::integer AS "workshopCount",
           array_agg(DISTINCT fsw."categoryId" ORDER BY fsw."categoryId") AS "categoryIds",
           min(fsw."startingPrice")::integer AS "startingPrice",
           sum(fsw."availableSessions")::integer AS "availableSessions",
           min(fsw."nextStartsAt") AS "nextStartsAt",
           max(fsw.relevance) AS relevance,
           CASE WHEN st.verified_at IS NOT NULL THEN 1 ELSE 0 END AS "verifiedPriority"
         FROM filtered_studio_workshops fsw
         JOIN studios st ON st.id = fsw."studioId"
         JOIN provinces p ON p.id = st.province_id
         LEFT JOIN areas a ON a.id = st.area_id
         GROUP BY st.id, p.id, a.id
       ),
       page AS (
         SELECT *
         FROM studios
         ORDER BY ${getCatalogOrderBy(filters.sort)}, id
         LIMIT ${pageSizeParameter}
         OFFSET ${offsetParameter}
       )
       SELECT id, slug, "categoryId", name, description, "trustLevel", "canCollectDeposit", province,
         "provinceId", "areaId", "areaName", address, "workshopCount",
         "categoryIds", "startingPrice", "availableSessions"
       FROM page
       ORDER BY ${getCatalogOrderBy(filters.sort)}, id`,
      [...values, filters.pageSize, (filters.page - 1) * filters.pageSize],
    );

    return {
      items: pageResult.rows,
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
    await releaseExpiredHoldsInScope(
      client,
      `JOIN workshops w ON w.id = s.workshop_id
       JOIN studios st ON st.id = w.studio_id`,
      `(w.id::text = $1 OR w.slug = $1)
       AND w.status = 'approved' AND NOT w.is_simulated AND w.visibility_status = 'active' AND w.publication_status = 'published'
       AND st.status = 'approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st)`,
      [workshopId],
    );
    const result = await client.query<WorkshopDetail>(
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
         effective_deposit_percent(st,w) AS "depositPercent",
         effective_deposit_mode(st,w) AS "depositMode",w.included,st.contact_phone AS "studioContactPhone",st.contact_email AS "studioContactEmail",
         effective_deposit_percent(st,w) AS "effectiveDepositPercent",
         w.requirements,
         w.cancellation_policy AS "cancellationPolicy",
         w.payment_policy AS "paymentPolicy",
         st.district,
         p.name AS province,
         st.province_id AS "provinceId",
         st.area_id AS "areaId",
         st.address,
         w.is_simulated AS "isSimulated",
         w.is_discontinued AS "isDiscontinued",
         st.name AS "studioName",
         st.description AS "studioDescription", ${studioTrustSql} AS "studioTrustLevel",
         COALESCE(
           json_agg(
             json_build_object(
               'id', s.id,
               'startsAt', s.starts_at,
               'endsAt', s.ends_at,
               'price', s.price,
               'availableSeats', s.capacity - s.seats_held - s.seats_sold
               ,'status', s.status, 'registrationDeadline', s.registration_deadline
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
        AND s.id IS NOT NULL
       WHERE (w.id::text = $1 OR w.slug = $1)
         AND w.status = 'approved' AND NOT w.is_simulated AND w.visibility_status = 'active' AND w.publication_status = 'published'
         AND st.status = 'approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st)
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
    await releaseExpiredHoldsInScope(
      client,
      `JOIN workshops w ON w.id = s.workshop_id
       JOIN studios st ON st.id = w.studio_id`,
      `(st.id::text = $1 OR st.slug = $1)
       AND w.status = 'approved' AND NOT w.is_simulated AND w.visibility_status = 'active' AND w.publication_status = 'published'
       AND st.status = 'approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st)`,
      [studioId],
    );
    const studioResult = await client.query<
      Omit<PublicStudio, 'workshops'> & { photoIds: string[] }
    >(
      `SELECT st.id,
         st.slug,
         ${studioTrustSql} AS "trustLevel",
         ${studioDepositEligibleSql} AS "canCollectDeposit",
         st.category_id AS "categoryId",
         st.name,
         st.description,
         p.name AS province,
         st.province_id AS "provinceId",
         st.area_id AS "areaId",
         a.name AS "areaName",
         st.address, st.contact_phone AS "contactPhone", st.contact_email AS "contactEmail", st.facebook_url AS "facebookUrl", st.instagram_url AS "instagramUrl", st.google_maps_url AS "googleMapsUrl", st.photo_ids AS "photoIds"
       FROM studios st
       JOIN provinces p ON p.id = st.province_id
       LEFT JOIN areas a ON a.id = st.area_id
       WHERE (st.id::text = $1 OR st.slug = $1)
         AND st.status = 'approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st)
         AND (NOT EXISTS (SELECT 1 FROM workshops demo WHERE demo.studio_id=st.id AND demo.is_simulated) OR EXISTS (SELECT 1 FROM workshops real WHERE real.studio_id=st.id AND NOT real.is_simulated))`,
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
         effective_deposit_percent(st,w) AS "depositPercent",
         effective_deposit_mode(st,w) AS "depositMode",w.included,st.contact_phone AS "studioContactPhone",st.contact_email AS "studioContactEmail",
         effective_deposit_percent(st,w) AS "effectiveDepositPercent",
         w.requirements,
         w.cancellation_policy AS "cancellationPolicy",
         w.payment_policy AS "paymentPolicy",
         st.district,
         p.name AS province,
         st.province_id AS "provinceId",
         st.area_id AS "areaId",
         st.address,
         w.is_simulated AS "isSimulated",
         w.is_discontinued AS "isDiscontinued",
         st.name AS "studioName",
         st.description AS "studioDescription", ${studioTrustSql} AS "studioTrustLevel",
         COALESCE(
           json_agg(
             json_build_object(
               'id', s.id,
               'startsAt', s.starts_at,
               'endsAt', s.ends_at,
               'price', s.price,
               'availableSeats', s.capacity - s.seats_held - s.seats_sold
               ,'status', s.status, 'registrationDeadline', s.registration_deadline
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
        AND s.id IS NOT NULL
       WHERE (st.id::text = $1 OR st.slug = $1)
         AND w.status = 'approved' AND NOT w.is_simulated AND w.visibility_status = 'active' AND w.publication_status = 'published'
       GROUP BY w.id, st.id, p.id
       ORDER BY min(s.starts_at), w.id`,
      [studioId],
    );

    return { ...studio, workshops: workshopResult.rows };
  });
}
