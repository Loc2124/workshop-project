import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { createApp } from '../../src/app.js';
import { query, closePool } from '../../src/db/pool.js';

const app = createApp();
vi.setConfig({ hookTimeout: 60000, testTimeout: 60000 });

let ownerCookie: string;
let staffCookie: string;
let studioId: string;

beforeAll(async () => {
  assertSafeTestDatabase();
  const password = 'StudioFinancesPassword123!';
  const hash = await argon2.hash(password);

  const ownerId = randomUUID();
  const ownerEmail = `finances.owner.${ownerId}@example.test`;
  await query(
    `INSERT INTO users(id, email, password_hash, full_name, role) VALUES($1, $2, $3, 'Studio Owner', 'studio_owner')`,
    [ownerId, ownerEmail, hash],
  );
  const ownerLogin = await request(app)
    .post('/auth/login')
    .send({ email: ownerEmail, password });
  ownerCookie = ownerLogin.headers['set-cookie'][0];

  const staffId = randomUUID();
  const staffEmail = `finances.staff.${staffId}@example.test`;
  await query(
    `INSERT INTO users(id, email, password_hash, full_name, role) VALUES($1, $2, $3, 'Studio Staff', 'customer')`,
    [staffId, staffEmail, hash],
  );
  const staffLogin = await request(app)
    .post('/auth/login')
    .send({ email: staffEmail, password });
  staffCookie = staffLogin.headers['set-cookie'][0];

  studioId = randomUUID();
  await query(
    `INSERT INTO studios(id, name, slug, address, status, is_draft)
     VALUES($1, 'Finances Test Studio', $2, '123 Test St', 'approved', false)`,
    [studioId, `finances-studio-${studioId}`],
  );
  await query(
    `INSERT INTO studio_members(studio_id, user_id, role) VALUES($1, $2, 'owner')`,
    [studioId, ownerId],
  );
  await query(
    `INSERT INTO studio_members(studio_id, user_id, role) VALUES($1, $2, 'staff')`,
    [studioId, staffId],
  );
});

afterAll(async () => {
  await closePool();
});

describe('studio finances API', () => {
  it('forbids non-owner from viewing studio finances', async () => {
    const res = await request(app)
      .get(`/studios/${studioId}/finances`)
      .set('Cookie', staffCookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows studio owner to view finances, settlements, and upcoming bookings', async () => {
    const res = await request(app)
      .get(`/studios/${studioId}/finances`)
      .set('Cookie', ownerCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toMatchObject({
      totalPaidOut: expect.any(Number),
      pendingPayout: expect.any(Number),
      estimatedUpcoming: expect.any(Number),
      directCollected: expect.any(Number),
    });
    expect(res.body).toHaveProperty('settlements');
    expect(Array.isArray(res.body.settlements)).toBe(true);
    expect(res.body).toHaveProperty('upcomingBookings');
    expect(Array.isArray(res.body.upcomingBookings)).toBe(true);
  });
});
