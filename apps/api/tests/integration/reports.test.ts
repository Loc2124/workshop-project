import { randomUUID, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { query, closePool } from '../../src/db/pool.js';
import { loadConfig } from '../../src/config.js';
import { seedStudioEvidence } from '../helpers/studio-evidence.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
vi.setConfig({ testTimeout: 120000, hookTimeout: 60000 });
const app = createApp();
beforeAll(async () => {
  assertSafeTestDatabase();
  await migrateDatabase(process.env.DATABASE_URL_TEST!);
});
afterAll(async () => closePool());
async function account(role: 'admin' | 'customer') {
  const id = randomUUID(),
    sid = randomUUID();
  const config = loadConfig();
  await query(
    'INSERT INTO users(id,email,password_hash,full_name,role) VALUES($1,$2,$3,$4,$5)',
    [id, `${id}@example.test`, 'unused-test-hash', 'Moderation account', role],
  );
  await query(
    "INSERT INTO auth_sessions(id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 day')",
    [sid, id, createHash('sha256').update(sid).digest('hex')],
  );
  return {
    id,
    cookie: `${config.COOKIE_NAME}=${jwt.sign({ sub: id, sid, role }, config.JWT_SECRET, { expiresIn: '1h' })}`,
  };
}

vi.mock('../../src/modules/images/image-storage.js', async (original) => ({
  ...(await original<
    typeof import('../../src/modules/images/image-storage.js')
  >()),
  createSignedUploadUrl: vi.fn(
    async () => 'https://storage.example.test/upload?token=scoped-upload',
  ),
  inspectUploadedImage: vi.fn(async () => undefined),
  storageRequest: vi.fn(async () =>
    Response.json({
      signedURL:
        '/object/sign/report-attachments/evidence.webp?token=scoped-read',
    }),
  ),
}));
it('accepts private evidence, prevents duplicates, keeps notes private and applies moderation atomically', async () => {
  const admin = await account('admin'),
    customer = await account('customer'),
    other = await account('customer');
  const studio = randomUUID(),
    workshop = randomUUID(),
    slot = randomUUID(),
    booking = randomUUID(),
    review = randomUUID();
  await query(
    "INSERT INTO studios(id,name,province_id,address,status) VALUES($1,'Report Studio','ho-chi-minh','Test address','approved')",
    [studio],
  );
  await query(
    "INSERT INTO studio_members(studio_id,user_id,role) VALUES($1,$2,'owner')",
    [studio, other.id],
  );
  await seedStudioEvidence(studio, other.id);
  await query(
    "INSERT INTO workshops(id,studio_id,title,slug,description,category_id,duration_minutes,base_price,status) VALUES($1,$2,'Report Workshop',$3,'Report workshop details','ceramics',90,200000,'approved')",
    [workshop, studio, 'report-' + workshop],
  );
  await query(
    "INSERT INTO sessions(id,workshop_id,starts_at,ends_at,price,capacity) VALUES($1,$2,now()+interval '2 days',now()+interval '2 days 90 minutes',200000,8)",
    [slot, workshop],
  );
  await query(
    "INSERT INTO bookings(id,user_id,session_id,quantity,unit_price,total_amount,status,hold_expires_at,order_code) VALUES($1,$2,$3,1,200000,200000,'paid',now()+interval '1 hour',$4)",
    [
      booking,
      customer.id,
      slot,
      Date.now() * 1000 + Math.floor(Math.random() * 1000),
    ],
  );
  await query(
    "INSERT INTO reviews(id,booking_id,user_id,workshop_id,rating,comment) VALUES($1,$2,$3,$4,2,'Review content under investigation')",
    [review, booking, customer.id, workshop],
  );
  const payload = (
    targetType: string,
    targetId: string,
    attachmentIds: string[] = [],
  ) => ({
    targetType,
    targetId,
    reason: 'misleading',
    detail: 'The supplied information is misleading.',
    attachmentIds,
  });
  expect(
    (await request(app).post('/reports').send(payload('studio', studio)))
      .status,
  ).toBe(401);
  expect(
    (
      await request(app)
        .post('/reports')
        .set('Cookie', customer.cookie)
        .send({ ...payload('studio', studio), internalNotes: 'not allowed' })
    ).status,
  ).toBe(422);
  const concurrent = await Promise.all(
    [1, 2].map(() =>
      request(app)
        .post('/reports')
        .set('Cookie', customer.cookie)
        .send(payload('studio', studio)),
    ),
  );
  expect(concurrent.map((r) => r.status).sort()).toEqual([201, 409]);
  const studioReport = concurrent.find((r) => r.status === 201)!.body.report.id;
  const upload = await request(app)
    .post('/reports/attachments/upload-url')
    .set('Cookie', customer.cookie)
    .send({ byteSize: 40 });
  expect(upload.status).toBe(200);
  expect(
    (
      await request(app)
        .post(`/reports/attachments/${upload.body.id}/confirm`)
        .set('Cookie', other.cookie)
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .post(`/reports/attachments/${upload.body.id}/confirm`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(200);
  const imageRecord = (
    await query('SELECT key FROM report_attachments WHERE id=$1', [
      upload.body.id,
    ])
  ).rows[0];
  expect(imageRecord.key).toContain(`reports/${customer.id}/`);
  const report = await request(app)
    .post('/reports')
    .set('Cookie', customer.cookie)
    .send(payload('workshop', workshop, [upload.body.id]));
  expect(report.status).toBe(201);
  const wid = report.body.report.id;
  expect(
    (
      await request(app)
        .post('/reports')
        .set('Cookie', customer.cookie)
        .send(payload('workshop', workshop, [upload.body.id]))
    ).status,
  ).toBe(409);
  const reviewReport = await request(app)
    .post('/reports')
    .set('Cookie', customer.cookie)
    .send(payload('review', review));
  expect(reviewReport.status).toBe(201);
  const hiddenStudioReport = await request(app)
    .post('/reports')
    .set('Cookie', other.cookie)
    .send(payload('studio', studio));
  expect(hiddenStudioReport.status).toBe(201);
  const suspendReport = await request(app)
    .post('/reports')
    .set('Cookie', other.cookie)
    .send(payload('workshop', workshop));
  expect(suspendReport.status).toBe(201);
  expect(
    (
      await request(app)
        .get(`/admin/bao-cao/${wid}`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(403);
  const detail = await request(app)
    .get(`/admin/bao-cao/${wid}`)
    .set('Cookie', admin.cookie);
  expect(detail.status).toBe(200);
  expect(detail.body.report.images[0].url).toContain(
    '/object/sign/report-attachments/',
  );
  expect(detail.body.report.images[0].url).not.toContain('/object/public/');
  expect(
    (
      await request(app)
        .post(`/admin/bao-cao/${wid}/notes`)
        .set('Cookie', admin.cookie)
        .send({ body: 'Private investigation note' })
    ).status,
  ).toBe(201);
  expect(
    (
      await request(app)
        .get(`/admin/bao-cao/${wid}`)
        .set('Cookie', admin.cookie)
    ).body.report.notes[0].body,
  ).toBe('Private investigation note');
  const act = (
    id: string,
    action: string,
    expectedStatus = 'new',
    reason = 'Moderation reason confirmed by admin',
  ) =>
    request(app)
      .patch(`/admin/bao-cao/${id}/action`)
      .set('Cookie', admin.cookie)
      .send({ action, expectedStatus, reason });
  expect((await act(studioReport, 'start')).status).toBe(200);
  expect((await act(studioReport, 'dismiss')).status).toBe(409);
  expect(
    (await act(studioReport, 'dismiss', 'in_progress', 'short')).status,
  ).toBe(422);
  expect((await act(studioReport, 'dismiss', 'in_progress')).status).toBe(200);
  const before = await request(app).get(`/workshops/${workshop}/reviews`);
  expect(before.body.reviews.some((r: { id: string }) => r.id === review)).toBe(
    true,
  );
  expect((await act(reviewReport.body.report.id, 'hide')).status).toBe(200);
  expect(
    (await request(app).get(`/workshops/${workshop}/reviews`)).body.reviews,
  ).toEqual([]);
  expect((await act(wid, 'hide')).status).toBe(200);
  expect((await request(app).get(`/workshops/${workshop}`)).status).toBe(404);
  expect(
    (
      await query('SELECT visibility_status FROM workshops WHERE id=$1', [
        workshop,
      ])
    ).rows[0].visibility_status,
  ).toBe('hidden');
  expect((await act(hiddenStudioReport.body.report.id, 'hide')).status).toBe(
    200,
  );
  expect((await request(app).get(`/studios/${studio}`)).status).toBe(404);
  const hiddenState = (
    await query('SELECT is_hidden,status FROM studios WHERE id=$1', [studio])
  ).rows[0];
  expect(hiddenState).toMatchObject({ is_hidden: true, status: 'approved' });
  expect(
    (
      await request(app)
        .patch(`/admin/studios/${studio}/visibility`)
        .set('Cookie', admin.cookie)
        .send({ hidden: false, reason: 'Studio content checked and restored' })
    ).status,
  ).toBe(200);
  expect((await act(suspendReport.body.report.id, 'suspend')).status).toBe(200);
  expect(
    (
      await query('SELECT status,reviewed_by FROM studios WHERE id=$1', [
        studio,
      ])
    ).rows[0],
  ).toMatchObject({ status: 'suspended', reviewed_by: admin.id });
  const final = (
    await query(
      'SELECT status,handled_by,handled_at FROM reports WHERE id=$1',
      [wid],
    )
  ).rows[0];
  expect(final).toMatchObject({ status: 'resolved', handled_by: admin.id });
  expect(final.handled_at).toBeTruthy();
  expect(
    (
      await query(
        "SELECT count(*)::int AS n FROM admin_activity_log WHERE entity_id=$1 AND action='report.hide'",
        [wid],
      )
    ).rows[0].n,
  ).toBe(1);
  expect(
    (
      await request(app)
        .get('/admin/bao-cao')
        .query({ status: 'all', targetType: 'review' })
        .set('Cookie', admin.cookie)
    ).status,
  ).toBe(200);
});
