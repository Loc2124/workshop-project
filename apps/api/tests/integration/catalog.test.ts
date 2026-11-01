import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { createApp } from '../../src/app.js';
import { closePool, query } from '../../src/db/pool.js';

const app = createApp();
vi.setConfig({ testTimeout: 30_000 });

type FixtureOptions = {
  district: string;
  categoryId: string;
  provinceId?: string;
  level?: 'beginner' | 'intermediate' | 'all';
  audience?: string[];
  studioStatus?: 'pending' | 'approved' | 'rejected';
  workshopStatus?: 'pending' | 'approved' | 'rejected';
};

type SessionOptions = {
  startsAt: string;
  price?: number;
  capacity?: number;
  seatsHeld?: number;
  seatsSold?: number;
  status?: 'scheduled' | 'cancelled' | 'completed';
};

describe('public workshop catalog', () => {
  beforeAll(async () => {
    assertSafeTestDatabase();
    const databaseUrl = process.env.DATABASE_URL_TEST;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL_TEST is required for catalog tests.');
    }
    await migrateDatabase(databaseUrl);
  });

  afterAll(async () => {
    await closePool();
  });

  it('applies each public filter to the matching workshop or session', async () => {
    const suffix = randomUUID();
    const district = `District ${suffix}`;
    const categoryId = `Category ${suffix}`;
    const targetId = await createWorkshop({
      district,
      categoryId,
    });
    const otherCategoryId = await createWorkshop({
      district,
      categoryId: `Other ${suffix}`,
    });

    await addSession(targetId, {
      startsAt: '2032-04-30T17:30:00.000Z',
      price: 100,
    });
    await addSession(targetId, {
      startsAt: '2032-05-01T17:30:00.000Z',
      price: 200,
    });
    await addSession(targetId, {
      startsAt: '2032-05-02T17:30:00.000Z',
      price: 300,
    });
    await addSession(otherCategoryId, {
      startsAt: '2032-05-01T17:30:00.000Z',
      price: 50,
    });

    const otherProvinceId = await createWorkshop({
      district: `Other province ${suffix}`,
      categoryId,
      provinceId: 'ha-noi',
    });
    await addSession(otherProvinceId, {
      startsAt: '2032-05-01T17:30:00.000Z',
    });
    const provinceResult = await request(app)
      .get('/workshops')
      .query({ province_id: 'ho-chi-minh', category_id: categoryId });
    expect(provinceResult.status).toBe(200);
    expect(idsOf(provinceResult.body.items)).toContain(targetId);
    expect(idsOf(provinceResult.body.items)).not.toContain(otherProvinceId);

    const categoryResult = await request(app)
      .get('/workshops')
      .query({ category_id: categoryId });
    expect(categoryResult.status).toBe(200);
    expect(idsOf(categoryResult.body.items)).toContain(targetId);
    expect(idsOf(categoryResult.body.items)).not.toContain(otherCategoryId);

    const minimumPriceResult = await request(app)
      .get('/workshops')
      .query({
        province_id: 'ho-chi-minh',
        category_id: categoryId,
        price_min: 200,
      });
    expect(minimumPriceResult.status).toBe(200);
    expect(idsOf(minimumPriceResult.body.items)).toEqual([targetId]);
    expect(sessionPrices(minimumPriceResult.body.items[0].sessions)).toEqual([
      200, 300,
    ]);

    const maximumPriceResult = await request(app)
      .get('/workshops')
      .query({
        province_id: 'ho-chi-minh',
        category_id: categoryId,
        price_max: 200,
      });
    expect(maximumPriceResult.status).toBe(200);
    expect(idsOf(maximumPriceResult.body.items)).toEqual([targetId]);
    expect(sessionPrices(maximumPriceResult.body.items[0].sessions)).toEqual([
      100, 200,
    ]);

    const dateResult = await request(app).get('/workshops').query({
      province_id: 'ho-chi-minh',
      category_id: categoryId,
      date_from: '2032-05-02',
      date_to: '2032-05-02',
    });
    expect(dateResult.status).toBe(200);
    expect(idsOf(dateResult.body.items)).toEqual([targetId]);
    expect(sessionPrices(dateResult.body.items[0].sessions)).toEqual([200]);
  });

  it('filters by level and audience and allows combining them with existing filters', async () => {
    const suffix = randomUUID();
    const district = `Level audience ${suffix}`;
    const categoryId = `Level audience ${suffix}`;
    const audience = `cặp đôi ${suffix}`;
    const targetId = await createWorkshop({
      district,
      categoryId,
      level: 'beginner',
      audience: [audience, 'nhóm bạn'],
    });
    const otherLevelId = await createWorkshop({
      district,
      categoryId,
      level: 'intermediate',
      audience: [audience],
    });
    const otherAudienceId = await createWorkshop({
      district,
      categoryId,
      level: 'beginner',
      audience: ['một mình'],
    });
    for (const workshopId of [targetId, otherLevelId, otherAudienceId]) {
      await addSession(workshopId, {
        startsAt: '2032-05-01T17:30:00.000Z',
      });
    }

    const byLevel = await request(app)
      .get('/workshops')
      .query({ category_id: categoryId, level: 'beginner' });
    expect(byLevel.status).toBe(200);
    expect(idsOf(byLevel.body.items)).toContain(targetId);
    expect(idsOf(byLevel.body.items)).not.toContain(otherLevelId);

    const byAudience = await request(app)
      .get('/workshops')
      .query({ category_id: categoryId, audience });
    expect(byAudience.status).toBe(200);
    expect(idsOf(byAudience.body.items)).toContain(targetId);
    expect(idsOf(byAudience.body.items)).toContain(otherLevelId);
    expect(idsOf(byAudience.body.items)).not.toContain(otherAudienceId);

    const combined = await request(app)
      .get('/workshops')
      .query({ category_id: categoryId, level: 'beginner', audience });
    expect(combined.status).toBe(200);
    expect(idsOf(combined.body.items)).toEqual([targetId]);
  });

  it('rejects unsupported level and province filter values', async () => {
    const invalidLevel = await request(app)
      .get('/workshops')
      .query({ level: 'expert' });
    expect(invalidLevel.status).toBe(422);

    const invalidProvince = await request(app)
      .get('/workshops')
      .query({ province: 'Atlantis' });
    expect(invalidProvince.status).toBe(422);
  });

  it('uses inclusive Vietnam calendar days at both date-range boundaries', async () => {
    const suffix = randomUUID();
    const workshopId = await createWorkshop({
      district: `Boundary ${suffix}`,
      categoryId: `Boundary ${suffix}`,
    });

    const boundarySessions = [
      '2032-04-09T17:30:00.000Z', // first day at 00:30 Vietnam time
      '2032-04-10T16:30:00.000Z', // first day at 23:30 Vietnam time
      '2032-04-10T17:30:00.000Z', // last day at 00:30 Vietnam time
      '2032-04-11T16:30:00.000Z', // last day at 23:30 Vietnam time
      '2032-04-09T16:30:00.000Z', // previous day at 23:30 Vietnam time
      '2032-04-11T17:30:00.000Z', // following day at 00:30 Vietnam time
    ];
    for (const startsAt of boundarySessions) {
      await addSession(workshopId, { startsAt });
    }

    const result = await request(app)
      .get('/workshops')
      .query({
        category_id: `Boundary ${suffix}`,
        date_from: '2032-04-10',
        date_to: '2032-04-11',
      });

    expect(result.status).toBe(200);
    expect(sessionStartTimes(result.body.items[0].sessions)).toEqual(
      boundarySessions
        .slice(0, 4)
        .map((startsAt) => new Date(startsAt).toISOString())
        .sort(),
    );
  });

  it('hides unapproved, cancelled, past, and sold-out catalog entries', async () => {
    const suffix = randomUUID();
    const district = `Hidden ${suffix}`;
    const categoryId = `Hidden ${suffix}`;
    const pendingWorkshop = await createWorkshop({
      district,
      categoryId,
      workshopStatus: 'pending',
    });
    const rejectedStudioWorkshop = await createWorkshop({
      district,
      categoryId,
      studioStatus: 'rejected',
    });
    const pendingStudioWorkshop = await createWorkshop({
      district,
      categoryId,
      studioStatus: 'pending',
    });
    const rejectedWorkshop = await createWorkshop({
      district,
      categoryId,
      workshopStatus: 'rejected',
    });
    const unavailableWorkshop = await createWorkshop({ district, categoryId });

    await addSession(pendingWorkshop, {
      startsAt: '2032-05-01T17:30:00.000Z',
    });
    await addSession(rejectedStudioWorkshop, {
      startsAt: '2032-05-01T17:30:00.000Z',
    });
    await addSession(pendingStudioWorkshop, {
      startsAt: '2032-05-01T17:30:00.000Z',
    });
    await addSession(rejectedWorkshop, {
      startsAt: '2032-05-01T17:30:00.000Z',
    });
    await addSession(unavailableWorkshop, {
      startsAt: '2032-05-01T17:30:00.000Z',
      status: 'cancelled',
    });
    await addSession(unavailableWorkshop, {
      startsAt: '2020-05-01T17:30:00.000Z',
    });
    await addSession(unavailableWorkshop, {
      startsAt: '2032-05-01T17:30:00.000Z',
      capacity: 1,
      seatsSold: 1,
    });

    const result = await request(app)
      .get('/workshops')
      .query({ category_id: categoryId });

    expect(result.status).toBe(200);
    expect(result.body.items).toEqual([]);
    expect(result.body.pagination.total).toBe(0);
  });

  it('returns available sessions after releasing expired holds and handles empty results', async () => {
    const suffix = randomUUID();
    const listWorkshopId = await createWorkshop({
      district: `List ${suffix}`,
      categoryId: `List ${suffix}`,
    });
    const listSessionId = await addSession(listWorkshopId, {
      startsAt: '2032-05-01T17:30:00.000Z',
      capacity: 2,
      seatsHeld: 1,
    });
    const listUserId = await createCustomer();
    const listBooking = await query<{ id: string }>(
      `INSERT INTO bookings (
         user_id, session_id, quantity, unit_price, total_amount,
         hold_expires_at, order_code
       )
       VALUES ($1, $2, 1, 100, 100, now() - interval '1 minute', $3)
       RETURNING id`,
      [
        listUserId,
        listSessionId,
        Date.now() + Number.parseInt(randomUUID().slice(0, 8), 16),
      ],
    );
    const listedWorkshops = await request(app)
      .get('/workshops')
      .query({ category_id: `List ${suffix}` });
    expect(listedWorkshops.status).toBe(200);
    expect(listedWorkshops.body.items[0].sessions[0].availableSeats).toBe(2);
    const listedBookingStatus = await query<{ status: string }>(
      'SELECT status FROM bookings WHERE id = $1',
      [listBooking.rows[0].id],
    );
    expect(listedBookingStatus.rows[0].status).toBe('expired');

    const workshopId = await createWorkshop({
      district: `Detail ${suffix}`,
      categoryId: `Detail ${suffix}`,
    });
    const sessionId = await addSession(workshopId, {
      startsAt: '2032-05-01T17:30:00.000Z',
      capacity: 3,
      seatsHeld: 2,
    });
    const userId = await createCustomer();
    const booking = await query<{ id: string }>(
      `INSERT INTO bookings (
         user_id, session_id, quantity, unit_price, total_amount,
         hold_expires_at, order_code
       )
       VALUES ($1, $2, 2, 100, 200, now() - interval '1 minute', $3)
       RETURNING id`,
      [
        userId,
        sessionId,
        Date.now() + Number.parseInt(randomUUID().slice(0, 8), 16),
      ],
    );

    const detail = await request(app).get(`/workshops/${workshopId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.workshop.id).toBe(workshopId);
    expect(detail.body.workshop.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(detail.body.workshop.sessions).toHaveLength(1);
    expect(detail.body.workshop.sessions[0].availableSeats).toBe(3);
    const slugDetail = await request(app).get(
      `/workshops/${detail.body.workshop.slug}`,
    );
    expect(slugDetail.status).toBe(200);
    expect(slugDetail.body.workshop.id).toBe(workshopId);

    const releasedBooking = await query<{ status: string }>(
      'SELECT status FROM bookings WHERE id = $1',
      [booking.rows[0].id],
    );
    expect(releasedBooking.rows[0].status).toBe('expired');

    const missingWorkshop = await request(app).get(
      `/workshops/${randomUUID()}`,
    );
    expect(missingWorkshop.status).toBe(404);

    const emptyList = await request(app)
      .get('/workshops')
      .query({ category_id: `No match ${suffix}` });
    expect(emptyList.status).toBe(200);
    expect(emptyList.body.items).toEqual([]);
    expect(emptyList.body.pagination.total).toBe(0);
  });

  it('returns public studio details with its available workshops', async () => {
    const suffix = randomUUID();
    const workshopId = await createWorkshop({
      district: `Studio ${suffix}`,
      categoryId: `Studio ${suffix}`,
    });
    await addSession(workshopId, {
      startsAt: '2032-05-01T17:30:00.000Z',
    });
    const studioResult = await query<{ studio_id: string }>(
      'SELECT studio_id FROM workshops WHERE id = $1',
      [workshopId],
    );

    const response = await request(app).get(
      `/studios/${studioResult.rows[0].studio_id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.studio.id).toBe(studioResult.rows[0].studio_id);
    expect(response.body.studio.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(response.body.studio.workshops).toHaveLength(1);
    expect(response.body.studio.workshops[0].id).toBe(workshopId);
    const slugResponse = await request(app).get(
      `/studios/${response.body.studio.slug}`,
    );
    expect(slugResponse.status).toBe(200);
    expect(slugResponse.body.studio.id).toBe(studioResult.rows[0].studio_id);
  });

  it('validates query parameters and paginates candidates by their next session', async () => {
    const suffix = randomUUID();
    const district = `Page ${suffix}`;
    const categoryId = `Page ${suffix}`;
    const laterWorkshop = await createWorkshop({ district, categoryId });
    const earlierWorkshop = await createWorkshop({ district, categoryId });
    await addSession(laterWorkshop, {
      startsAt: '2032-05-02T17:30:00.000Z',
    });
    await addSession(earlierWorkshop, {
      startsAt: '2032-05-01T17:30:00.000Z',
    });

    const firstPage = await request(app)
      .get('/workshops')
      .query({ category_id: categoryId, page: 1, page_size: 1 });
    const secondPage = await request(app)
      .get('/workshops')
      .query({ category_id: categoryId, page: 2, page_size: 1 });
    expect(firstPage.status).toBe(200);
    expect(secondPage.status).toBe(200);
    expect(firstPage.body.items[0].id).toBe(earlierWorkshop);
    expect(secondPage.body.items[0].id).toBe(laterWorkshop);
    expect(firstPage.body.pagination.total).toBe(2);

    const invalidQuery = await request(app)
      .get('/workshops')
      .query({ price_min: 500, price_max: 100 });
    expect(invalidQuery.status).toBe(422);
  });
});

async function createWorkshop(options: FixtureOptions): Promise<string> {
  const suffix = randomUUID();
  const user = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, 'test-password-hash', 'Catalog test', 'customer')
     RETURNING id`,
    [`catalog.${suffix}@example.test`],
  );
  const studio = await query<{ id: string }>(
    `INSERT INTO studios (
       name, description, district, province_id, address, status
     )
     VALUES ($1, 'Catalog fixture', $2, $3, '12 Example Street, Ward 1', $4::approval_status)
     RETURNING id`,
    [
      `Studio ${suffix}`,
      options.district,
      options.provinceId ?? 'ho-chi-minh',
      options.studioStatus ?? 'approved',
    ],
  );
  await query(
    `INSERT INTO studio_members (studio_id, user_id, role)
     VALUES ($1, $2, 'owner')`,
    [studio.rows[0].id, user.rows[0].id],
  );
  await query(
    'INSERT INTO categories (id, slug, name) VALUES ($1, $1, $1) ON CONFLICT (id) DO NOTHING',
    [options.categoryId],
  );
  const workshop = await query<{ id: string }>(
    `INSERT INTO workshops (
      studio_id, title, description, category_id, level, audience,
     duration_minutes, base_price, status,
     is_simulated
    )
    VALUES (
     $1, $2, 'Catalog fixture description', $3, $4::text,
     $5::text[], 60, 100, $6, true
    )
     RETURNING id`,
    [
      studio.rows[0].id,
      `Workshop ${suffix}`,
      options.categoryId,
      options.level ?? 'beginner',
      options.audience ?? [],
      options.workshopStatus ?? 'approved',
    ],
  );
  return workshop.rows[0].id;
}

async function addSession(
  workshopId: string,
  options: SessionOptions,
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO sessions (
       workshop_id, starts_at, ends_at, price, capacity, seats_held,
       seats_sold, status
     )
     VALUES (
       $1, $2, $2::timestamptz + interval '1 hour', $3, $4, $5, $6,
       $7::session_status
     )
     RETURNING id`,
    [
      workshopId,
      options.startsAt,
      options.price ?? 100,
      options.capacity ?? 10,
      options.seatsHeld ?? 0,
      options.seatsSold ?? 0,
      options.status ?? 'scheduled',
    ],
  );
  return result.rows[0].id;
}

async function createCustomer(): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, 'test-password-hash', 'Catalog customer', 'customer')
     RETURNING id`,
    [`customer.${randomUUID()}@example.test`],
  );
  return result.rows[0].id;
}

function idsOf(items: Array<{ id: string }>): string[] {
  return items.map((item) => item.id);
}

function sessionPrices(sessions: Array<{ price: number }>): number[] {
  return sessions.map((session) => session.price).sort((a, b) => a - b);
}

function sessionStartTimes(sessions: Array<{ startsAt: string }>): string[] {
  return sessions
    .map((session) => new Date(session.startsAt).toISOString())
    .sort();
}
