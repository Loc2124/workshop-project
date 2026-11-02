import { draftStudioProfile } from '../helpers/studio-evidence.js';
vi.mock('../../src/modules/auth/password-check.js', () => ({
  assertPasswordNotCompromised: vi.fn().mockResolvedValue(undefined),
}));
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { createApp } from '../../src/app.js';
import { query } from '../../src/db/pool.js';
import { closeTestPool } from '../helpers/database.js';

const app = createApp();

describe('studio and admin module', () => {
  beforeAll(async () => {
    assertSafeTestDatabase();
    const databaseUrl = process.env.DATABASE_URL_TEST;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL_TEST is required for studio flow tests.');
    }
    await migrateDatabase(databaseUrl);
  });

  afterAll(async () => {
    await closeTestPool();
  });

  it('creates a pending studio and promotes the account to studio_owner', async () => {
    const email = `studio.${randomUUID()}@example.test`;
    const password = 'WillowFern72!';

    await request(app).post('/auth/register').send({
      fullName: 'Studio Owner',
      email,
      password,
    });

    const login = await request(app).post('/auth/login').send({
      email,
      password,
    });

    const profileFields = await draftStudioProfile(
      app,
      login.headers['set-cookie'][0],
    );
    const profile = await request(app)
      .post('/studios')
      .set('Cookie', login.headers['set-cookie'][0])
      .send({
        ...profileFields,
        name: 'Làng Gốm Mới',
        categoryIds: ['ceramics', 'candles'],
        description: 'Workshop làm gốm thủ công cho các nhóm bạn.',
        provinceId: 'ho-chi-minh',
        address: '123 Đường Sáng Tạo',
      });

    expect(profile.status).toBe(201);
    expect(profile.body.studio.status).toBe('pending');
    expect(profile.body.studio.categoryIds).toEqual(['ceramics', 'candles']);
    const studios = await request(app)
      .get('/me/studios')
      .set('Cookie', login.headers['set-cookie'][0]);
    expect(studios.status).toBe(200);
    expect(
      studios.body.studios.find(
        (studio: { id: string }) => studio.id === profile.body.studio.id,
      ).categoryIds,
    ).toEqual(['candles', 'ceramics']);
    const invalid = await request(app)
      .post('/studios')
      .set('Cookie', login.headers['set-cookie'][0])
      .send({
        ...profileFields,
        name: 'Invalid types',
        provinceId: 'ho-chi-minh',
        address: '12 Nguyen Trai',
        categoryIds: ['ceramics', 'missing-category'],
      });
    expect(invalid.status).toBe(422);

    expect(profile.body.studio.name).toBe('Làng Gốm Mới');

    const me = await request(app)
      .get('/me')
      .set('Cookie', login.headers['set-cookie'][0]);
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('studio_owner');

    const membership = await query<{ role: string }>(
      `SELECT role
       FROM studio_members
       WHERE studio_id = $1 AND user_id = $2`,
      [profile.body.studio.id, me.body.user.id],
    );
    expect(membership.rows[0].role).toBe('owner');
  });

  it('allows admins to approve studios and blocks customers from admin routes', async () => {
    const proposal = `Needlecraft ${randomUUID()}`;
    const customerEmail = `customer.${randomUUID()}@example.test`;
    const customerPassword = 'WillowFern72!';
    await request(app).post('/auth/register').send({
      fullName: 'Customer Test',
      email: customerEmail,
      password: customerPassword,
    });
    const customerLogin = await request(app).post('/auth/login').send({
      email: customerEmail,
      password: customerPassword,
    });
    const profileFields = await draftStudioProfile(
      app,
      customerLogin.headers['set-cookie'][0],
    );
    const studioProfile = await request(app)
      .post('/studios')
      .set('Cookie', customerLogin.headers['set-cookie'][0])
      .send({
        ...profileFields,
        categoryIds: ['ceramics', 'other'],
        proposedCategoryName: proposal,
        name: 'Workshop Cắm Hoa',
        description: 'Workshop cắm hoa cho gia đình.',
        provinceId: 'ho-chi-minh',
        address: '456 Đường Cây Cỏ',
      });
    expect(studioProfile.status).toBe(201);
    expect(studioProfile.body.studio.proposedCategoryName).toBe(proposal);
    expect(
      (await query('SELECT id FROM categories WHERE name = $1', [proposal]))
        .rowCount,
    ).toBe(0);

    const adminEmail = `admin.${randomUUID()}@example.test`;
    const adminPassword = 'WillowFern72!';
    await query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'admin')`,
      [adminEmail, await argon2.hash(adminPassword), 'System Admin'],
    );
    const adminLogin = await request(app).post('/auth/login').send({
      email: adminEmail,
      password: adminPassword,
    });

    const list = await request(app)
      .get('/admin/studios')
      .set('Cookie', adminLogin.headers['set-cookie'][0]);
    expect(list.status).toBe(200);
    expect(
      list.body.items.some(
        (studio: { id: string }) => studio.id === studioProfile.body.studio.id,
      ),
    ).toBe(true);

    const approval = await request(app)
      .patch(`/admin/studios/${studioProfile.body.studio.id}/status`)
      .set('Cookie', adminLogin.headers['set-cookie'][0])
      .send({ status: 'approved' });
    expect(approval.status).toBe(200);
    expect(approval.body.studio.status).toBe('approved');
    expect(approval.body.studio.proposedCategoryName).toBeNull();
    const approvedCategory = await query<{ id: string }>(
      'SELECT id FROM categories WHERE name = $1 AND status = $2',
      [proposal, 'active'],
    );
    expect(approvedCategory.rowCount).toBe(1);
    const types = await query<{ category_id: string }>(
      'SELECT category_id FROM studio_categories WHERE studio_id = $1 AND deleted_at IS NULL',
      [studioProfile.body.studio.id],
    );
    expect(types.rows.map((row) => row.category_id).sort()).toEqual(
      ['ceramics', approvedCategory.rows[0].id].sort(),
    );

    const forbidden = await request(app)
      .get('/admin/studios')
      .set('Cookie', customerLogin.headers['set-cookie'][0]);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });
  it('stores review decisions, blocks incomplete approval and sends reasons back to the owner', async () => {
    const hash = await argon2.hash('WillowFern72!');
    const accounts: { id: string; cookie: string }[] = [];
    for (const role of ['customer', 'admin', 'customer']) {
      const email = `review.${randomUUID()}@example.test`;
      const user = await query<{ id: string }>(
        'INSERT INTO users(email,password_hash,full_name,role) VALUES($1,$2,$3,$4) RETURNING id',
        [email, hash, 'Studio review test', role],
      );
      const login = await request(app)
        .post('/auth/login')
        .send({ email, password: 'WillowFern72!' });
      expect(login.status).toBe(200);
      accounts.push({
        id: user.rows[0].id,
        cookie: login.headers['set-cookie'][0],
      });
    }
    const [owner, admin, outsider] = accounts;
    const fields = await draftStudioProfile(app, owner.cookie);
    const created = await request(app)
      .post('/studios')
      .set('Cookie', owner.cookie)
      .send({
        ...fields,
        name: 'Studio xét duyệt',
        categoryIds: ['ceramics'],
        provinceId: 'ho-chi-minh',
        address: '12 Nguyễn Trãi',
      });
    expect(created.status).toBe(201);
    const studioId = created.body.studio.id;
    const endpoint = `/admin/studios/${studioId}/status`;
    await query('UPDATE studios SET contact_phone=NULL WHERE id=$1', [
      studioId,
    ]);
    expect(
      (
        await request(app)
          .patch(endpoint)
          .set('Cookie', admin.cookie)
          .send({ status: 'approved' })
      ).status,
    ).toBe(400);
    const unchanged = await query(
      'SELECT status, reviewed_by FROM studios WHERE id=$1',
      [studioId],
    );
    expect(unchanged.rows[0]).toMatchObject({
      status: 'pending',
      reviewed_by: null,
    });
    for (const status of ['needs_changes', 'rejected']) {
      expect(
        (
          await request(app)
            .patch(endpoint)
            .set('Cookie', admin.cookie)
            .send({ status, reason: 'short' })
        ).status,
      ).toBe(422);
    }
    const reason = 'Vui lòng bổ sung số điện thoại liên hệ.';
    const changes = await request(app)
      .patch(endpoint)
      .set('Cookie', admin.cookie)
      .send({ status: 'needs_changes', reason });
    expect(changes.status).toBe(200);
    expect(changes.body.studio).toMatchObject({
      status: 'needs_changes',
      rejectionReason: reason,
      reviewedBy: admin.id,
    });
    expect(changes.body.studio.reviewedAt).toEqual(expect.any(String));
    const mine = await request(app)
      .get('/me/studios')
      .set('Cookie', owner.cookie);
    expect(
      mine.body.studios.find(
        (studio: { id: string }) => studio.id === studioId,
      ),
    ).toMatchObject({
      status: 'needs_changes',
      rejectionReason: reason,
      reviewedBy: admin.id,
    });
    expect(
      (
        await request(app)
          .get('/admin/studios?status=needs_changes')
          .set('Cookie', admin.cookie)
      ).body.items.some((studio: { id: string }) => studio.id === studioId),
    ).toBe(true);
    expect(
      (
        await request(app)
          .patch(endpoint)
          .set('Cookie', outsider.cookie)
          .send({ status: 'approved' })
      ).status,
    ).toBe(403);
    const evidence = {
      contactPhone: fields.contactPhone,
      contactEmail: fields.contactEmail,
      photoIds: fields.photoIds,
    };
    const resubmitted = await request(app)
      .patch(`/studios/${studioId}/evidence`)
      .set('Cookie', owner.cookie)
      .send(evidence);
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.status).toBe('pending');
    const approved = await request(app)
      .patch(endpoint)
      .set('Cookie', admin.cookie)
      .send({ status: 'approved' });
    expect(approved.status).toBe(200);
    expect(approved.body.studio).toMatchObject({
      status: 'approved',
      reviewedBy: admin.id,
      rejectionReason: null,
    });
    const rejectionReason = 'Studio cần cung cấp thông tin địa điểm rõ hơn.';
    const rejected = await request(app)
      .patch(endpoint)
      .set('Cookie', admin.cookie)
      .send({ status: 'suspended', reason: rejectionReason });
    expect(rejected.status).toBe(200);
    const stored = await query(
      'SELECT status, reviewed_by, reviewed_at, rejection_reason FROM studios WHERE id=$1',
      [studioId],
    );
    expect(stored.rows[0]).toMatchObject({
      status: 'suspended',
      reviewed_by: admin.id,
      rejection_reason: rejectionReason,
    });
    expect(stored.rows[0].reviewed_at).toBeTruthy();
    const blocked = await request(app)
      .patch(`/studios/${studioId}/evidence`)
      .set('Cookie', owner.cookie)
      .send(evidence);
    expect(blocked.status).toBe(409);
    const detail = await request(app)
      .get(`/admin/studios/${studioId}`)
      .set('Cookie', admin.cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.studio.statusHistory.at(-1)).toMatchObject({
      toStatus: 'suspended',
      actorId: admin.id,
      reason: rejectionReason,
    });
    const audit = await query(
      "SELECT reason,previous_status,new_status FROM admin_activity_log WHERE entity_id=$1 AND action='studio.suspended'",
      [studioId],
    );
    expect(audit.rows[0]).toMatchObject({
      reason: rejectionReason,
      previous_status: 'approved',
      new_status: 'suspended',
    });
    const restored = await request(app)
      .patch(endpoint)
      .set('Cookie', admin.cookie)
      .send({ status: 'approved' });
    expect(restored.status).toBe(200);
    const restoredDetail = await request(app)
      .get(`/admin/studios/${studioId}`)
      .set('Cookie', admin.cookie);
    expect(restoredDetail.body.studio.statusHistory.at(-1)).toMatchObject({
      fromStatus: 'suspended',
      toStatus: 'approved',
      actorId: admin.id,
    });
  });
});
