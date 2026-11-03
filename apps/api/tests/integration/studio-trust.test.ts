import { draftStudioProfile } from '../helpers/studio-evidence.js';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { publicStudioResponseSchema } from '@workshop/shared';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { createApp } from '../../src/app.js';
import { query, closePool } from '../../src/db/pool.js';

const app = createApp();
vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
const decision = {
  verified: true,
  method: 'identity_address',
  confirmed: true,
};
let adminCookie: string;
let ownerCookie: string;
let studioId: string;
let studioName: string;

beforeAll(async () => {
  assertSafeTestDatabase();
  await migrateDatabase(process.env.DATABASE_URL_TEST!);
  const password = 'WillowFern72!';
  const passwordHash = await argon2.hash(password);
  for (const role of ['admin', 'customer']) {
    const email = `trust.${role}.${randomUUID()}@example.test`;
    await query(
      'INSERT INTO users(email, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
      [email, passwordHash, `Trust ${role}`, role],
    );
    const login = await request(app)
      .post('/auth/login')
      .send({ email, password });
    expect(login.status).toBe(200);
    if (role === 'admin') adminCookie = login.headers['set-cookie'][0];
    else ownerCookie = login.headers['set-cookie'][0];
  }
  const profileFields = await draftStudioProfile(app, ownerCookie);
  const created = await request(app)
    .post('/studios')
    .set('Cookie', ownerCookie)
    .send({
      ...profileFields,
      name: `Trust studio ${randomUUID()}`,
      provinceId: 'ho-chi-minh',
      address: '12 Nguyen Trai',
      categoryIds: ['ceramics'],
      trustLevel: 'verified',
    });
  expect(created.status).toBe(201);
  expect(created.body.studio.trustLevel).toBe('unapproved');
  studioId = created.body.studio.id;
  studioName = created.body.studio.name;
});
afterAll(async () => {
  await closePool();
});

describe('two studio trust tiers', () => {
  it('protects the admin action and refuses verification before approval', async () => {
    expect(
      (
        await request(app)
          .patch(`/admin/studios/${studioId}/verification`)
          .send(decision)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .patch(`/admin/studios/${studioId}/verification`)
          .set('Cookie', ownerCookie)
          .send(decision)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/admin/studios/${studioId}/verification`)
          .set('Cookie', adminCookie)
          .send(decision)
      ).status,
    ).toBe(409);
    const invalid = await request(app)
      .patch(`/admin/studios/${studioId}/verification`)
      .set('Cookie', adminCookie)
      .send({ ...decision, confirmed: false });
    expect(invalid.status).toBeGreaterThanOrEqual(400);
    expect((await request(app).get(`/studios/${studioId}`)).status).toBe(404);
  });
  it('publishes the tier while keeping verification evidence and history private', async () => {
    const approved = await request(app)
      .patch(`/admin/studios/${studioId}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'approved' });
    expect(approved.status).toBe(200);
    expect(approved.body.studio.trustLevel).toBe('approved');
    const verified = await request(app)
      .patch(`/admin/studios/${studioId}/verification`)
      .set('Cookie', adminCookie)
      .send(decision);
    expect(verified.status).toBe(200);
    expect(verified.body.verification.trustLevel).toBe('verified');
    const publicProfile = await request(app).get(`/studios/${studioId}`);
    expect(publicProfile.status).toBe(200);
    expect(
      publicStudioResponseSchema.safeParse(publicProfile.body).success,
    ).toBe(true);
    expect(publicProfile.body.studio.trustLevel).toBe('verified');
    for (const key of [
      'verifiedBy',
      'verifiedAt',
      'verificationHistory',
      'method',
      'reason',
    ])
      expect(publicProfile.body.studio).not.toHaveProperty(key);
    const owner = await request(app)
      .get('/me/studios')
      .set('Cookie', ownerCookie);
    expect(
      owner.body.studios.find(
        (studio: { id: string }) => studio.id === studioId,
      ).trustLevel,
    ).toBe('verified');
    const admin = await request(app)
      .get('/admin/studios')
      .query({ status: 'approved', q: studioName })
      .set('Cookie', adminCookie);
    expect(
      admin.body.items.some((studio: { id: string }) => studio.id === studioId),
    ).toBe(true);
    const adminDetail = await request(app)
      .get(`/admin/studios/${studioId}`)
      .set('Cookie', adminCookie);
    const history = adminDetail.body.studio.verificationHistory;
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'verified',
          method: 'identity_address',
          reviewerName: 'Trust admin',
        }),
      ]),
    );
    const revoked = await request(app)
      .patch(`/admin/studios/${studioId}/verification`)
      .set('Cookie', adminCookie)
      .send({ verified: false, reason: 'Địa chỉ cần đối chiếu lại' });
    expect(revoked.status).toBe(200);
    expect(revoked.body.verification.trustLevel).toBe('approved');
    expect(
      (await request(app).get(`/studios/${studioId}`)).body.studio.trustLevel,
    ).toBe('approved');
  });
  it('serializes duplicate decisions and revokes trust if studio approval is removed', async () => {
    const responses = await Promise.all(
      [0, 1].map(() =>
        request(app)
          .patch(`/admin/studios/${studioId}/verification`)
          .set('Cookie', adminCookie)
          .send(decision),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const removed = await request(app)
      .patch(`/admin/studios/${studioId}/status`)
      .set('Cookie', adminCookie)
      .send({
        status: 'suspended',
        reason: 'Temporary suspension for verification review',
      });
    expect(removed.status).toBe(200);
    expect(removed.body.studio.trustLevel).toBe('unapproved');
    const row = await query(
      'SELECT verified_at, verified_by FROM studios WHERE id = $1',
      [studioId],
    );
    expect(row.rows[0]).toEqual({ verified_at: null, verified_by: null });
    expect((await request(app).get(`/studios/${studioId}`)).status).toBe(404);
    await request(app)
      .patch(`/admin/studios/${studioId}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'approved' });
    expect(
      (await request(app).get(`/studios/${studioId}`)).body.studio.trustLevel,
    ).toBe('approved');
    const history = await query(
      'SELECT action FROM studio_verification_history WHERE studio_id = $1',
      [studioId],
    );
    expect(
      history.rows.filter((row) => row.action === 'verified'),
    ).toHaveLength(2);
    expect(history.rows.filter((row) => row.action === 'revoked')).toHaveLength(
      2,
    );
  });
});
