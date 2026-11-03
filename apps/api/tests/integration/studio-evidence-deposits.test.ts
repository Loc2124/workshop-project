import { defaultSiteSettings } from '@workshop/shared';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => ({
  createSignedUploadUrl: vi.fn(
    async (key: string) =>
      `https://storage.example.test/upload/${key}?token=scoped-token`,
  ),
  inspectUploadedImage: vi.fn().mockResolvedValue(undefined),
  removeStorageImages: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/modules/images/image-storage.js', () => ({
  ...storage,
  imagePublicUrl: (key: string) =>
    `https://storage.example.test/storage/v1/object/public/studio-images/${key}`,
}));
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { createApp } from '../../src/app.js';
import { query, closePool } from '../../src/db/pool.js';
const app = createApp();
vi.setConfig({ hookTimeout: 60000, testTimeout: 60000 });
let ownerCookie: string,
  adminCookie: string,
  otherCookie: string,
  otherUserId: string;
let studioId: string;
const photos: string[] = [];
const workshop = {
  title: 'Trải nghiệm thêu túi',
  description: 'Thêu một chiếc túi tote tại studio.',
  categoryId: 'ceramics',
  durationMinutes: 90,
  basePrice: 500000,
};
const evidence = {
  contactPhone: '0901234567',
  contactEmail: 'studio@example.test',
  facebookUrl: null,
  instagramUrl: null,
  googleMapsUrl: null,
};
beforeAll(async () => {
  assertSafeTestDatabase();
  await migrateDatabase(process.env.DATABASE_URL_TEST!);
  const hash = await argon2.hash('WillowFern72!');
  for (const role of ['owner', 'admin', 'other']) {
    const email = `evidence.${role}.${randomUUID()}@example.test`;
    const user = await query<{ id: string }>(
      `INSERT INTO users(email,password_hash,full_name,role) VALUES($1,$2,$3,$4) RETURNING id`,
      [email, hash, role, role === 'admin' ? 'admin' : 'customer'],
    );
    const login = await request(app)
      .post('/auth/login')
      .send({ email, password: 'WillowFern72!' });
    expect(login.status).toBe(200);
    if (role === 'owner') ownerCookie = login.headers['set-cookie'][0];
    else if (role === 'admin') adminCookie = login.headers['set-cookie'][0];
    else {
      otherCookie = login.headers['set-cookie'][0];
      otherUserId = user.rows[0].id;
    }
  }
  const draft = await request(app)
    .post('/studios/drafts')
    .set('Cookie', ownerCookie);
  expect(draft.status).toBe(201);
  studioId = draft.body.studio.id;
});
afterAll(closePool);
async function uploadPhoto() {
  const signed = await request(app)
    .post('/images/upload-url')
    .set('Cookie', ownerCookie)
    .send({ studioId, byteSize: 100 });
  expect(signed.status).toBe(201);
  expect(signed.body.key).toBe(
    `studios/${studioId}/profile/${signed.body.id}.webp`,
  );
  expect(signed.body).not.toHaveProperty('serviceRoleKey');
  const done = await request(app)
    .post(`/images/${signed.body.id}/complete`)
    .set('Cookie', ownerCookie);
  expect(done.status).toBe(200);
  return signed.body.id as string;
}
describe('studio evidence and owner deposit settings', () => {
  it('keeps drafts private and prevents cross-studio uploads and oversized upload requests', async () => {
    const mine = await request(app)
      .get('/me/studios')
      .set('Cookie', ownerCookie);
    expect(
      mine.body.studios.some(
        (st: { id: string; isDraft: boolean }) =>
          st.id === studioId && st.isDraft,
      ),
    ).toBe(true);
    expect(
      (
        await request(app)
          .post('/images/upload-url')
          .set('Cookie', otherCookie)
          .send({ studioId, byteSize: 100 })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post('/images/upload-url')
          .set('Cookie', ownerCookie)
          .send({
            studioId,
            byteSize: defaultSiteSettings.studio.maxImageMb * 1024 * 1024 + 1,
          })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .patch(`/admin/studios/${studioId}/status`)
          .set('Cookie', adminCookie)
          .send({ status: 'approved' })
      ).status,
    ).toBe(404);
    expect((await request(app).get(`/studios/${studioId}`)).status).toBe(404);
  });
  it('requires both contacts and three confirmed owned photos before submission', async () => {
    for (let index = 0; index < 3; index++) photos.push(await uploadPhoto());
    const payload = {
      draftStudioId: studioId,
      name: 'Studio Thêu An',
      categoryId: 'ceramics',
      provinceId: 'ho-chi-minh',
      address: '12 Nguyễn Trãi',
      ...evidence,
      photoIds: photos,
    };
    for (const invalid of [
      { ...payload, contactEmail: '' },
      { ...payload, contactPhone: '' },
      { ...payload, photoIds: photos.slice(0, 2) },
      { ...payload, photoIds: [photos[0], photos[1], randomUUID()] },
    ])
      expect(
        (
          await request(app)
            .post('/studios')
            .set('Cookie', ownerCookie)
            .send(invalid)
        ).status,
      ).toBe(422);
    const submitted = await request(app)
      .post('/studios')
      .set('Cookie', ownerCookie)
      .send(payload);
    expect(submitted.status).toBe(201);
    expect(submitted.body.studio.images).toHaveLength(3);
    expect(submitted.body.studio.contactPhone).toBe(evidence.contactPhone);
    expect(
      (
        await request(app)
          .delete(`/images/${photos[0]}`)
          .set('Cookie', ownerCookie)
      ).status,
    ).toBe(409);
  });
  it('allows zero deposit at tier 1 and owner-selected deposits only at tier 2', async () => {
    expect(
      (
        await request(app)
          .patch(`/admin/studios/${studioId}/status`)
          .set('Cookie', adminCookie)
          .send({ status: 'approved' })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/studios/${studioId}/workshops`)
          .set('Cookie', ownerCookie)
          .send({ ...workshop, depositPercent: 20 })
      ).status,
    ).toBe(403);
    const zero = await request(app)
      .post(`/studios/${studioId}/workshops`)
      .set('Cookie', ownerCookie)
      .send(workshop);
    expect(zero.status).toBe(201);
    expect(zero.body.workshop.depositPercent).toBe(0);
    expect(
      (
        await request(app)
          .patch(`/admin/studios/${studioId}/verification`)
          .set('Cookie', adminCookie)
          .send({ verified: true, method: 'identity_address', confirmed: true })
      ).status,
    ).toBe(200);
    const created = await request(app)
      .post(`/studios/${studioId}/workshops`)
      .set('Cookie', ownerCookie)
      .send(workshop);
    expect(created.status).toBe(201);
    expect(created.body.workshop.depositPercent).toBe(20);
    const workshopId = created.body.workshop.id;
    expect(
      (
        await request(app)
          .patch(`/studios/${studioId}/workshops/${workshopId}`)
          .set('Cookie', ownerCookie)
          .send({ depositPercent: 30 })
      ).status,
    ).toBe(200);
    for (const percent of [-1, 31, 10.5])
      expect(
        (
          await request(app)
            .patch(`/studios/${studioId}/workshops/${workshopId}`)
            .set('Cookie', ownerCookie)
            .send({ depositPercent: percent })
        ).status,
      ).toBe(422);
    await query(
      `INSERT INTO studio_members(studio_id,user_id,role) VALUES($1,$2,'staff')`,
      [studioId, otherUserId],
    );
    expect(
      (
        await request(app)
          .patch(`/studios/${studioId}/workshops/${workshopId}`)
          .set('Cookie', otherCookie)
          .send({ depositPercent: 10 })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/images/upload-url')
          .set('Cookie', otherCookie)
          .send({ studioId, byteSize: 100 })
      ).status,
    ).toBe(403);
    const replacement = await uploadPhoto();
    const updated = await request(app)
      .patch(`/studios/${studioId}/evidence`)
      .set('Cookie', ownerCookie)
      .send({ ...evidence, photoIds: [photos[1], photos[2], replacement] });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('pending');
    const managed = await request(app)
      .get(`/studios/${studioId}/workshops`)
      .set('Cookie', ownerCookie);
    expect(
      managed.body.workshops.find((w: { id: string }) => w.id === workshopId)
        .effectiveDepositPercent,
    ).toBe(0);
    storage.removeStorageImages.mockRejectedValueOnce(
      new Error('Temporary storage error'),
    );
    const failed = await request(app)
      .delete(`/images/${photos[0]}`)
      .set('Cookie', ownerCookie);
    expect(failed.status).toBeGreaterThanOrEqual(500);
    expect(
      (await query(`SELECT state FROM images WHERE id=$1`, [photos[0]])).rows[0]
        .state,
    ).toBe('deleting');
    expect(
      (
        await request(app)
          .delete(`/images/${photos[0]}`)
          .set('Cookie', ownerCookie)
      ).status,
    ).toBe(204);
    expect(storage.removeStorageImages).toHaveBeenCalledWith([
      `studios/${studioId}/profile/${photos[0]}.webp`,
    ]);
    expect(
      (await query(`SELECT state FROM images WHERE id=$1`, [photos[0]])).rows[0]
        .state,
    ).toBe('deleted');
  });
});
