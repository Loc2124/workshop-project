import {
  messageTemplateKeySchema,
  messageTemplateSpecs,
  renderMessageTemplate,
} from '@workshop/shared';
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
let defaults: {
  key: string;
  subject: string;
  body: string;
  updated_by: string | null;
  updated_at: Date;
}[] = [];
beforeAll(async () => {
  defaults = (
    await query<{
      key: string;
      subject: string;
      body: string;
      updated_by: string | null;
      updated_at: Date;
    }>('SELECT key,subject,body,updated_by,updated_at FROM message_templates')
  ).rows;
});
afterAll(async () => {
  try {
    for (const row of defaults)
      await query(
        'UPDATE message_templates SET subject=$2,body=$3,updated_by=$4,updated_at=$5 WHERE key=$1',
        [row.key, row.subject, row.body, row.updated_by, row.updated_at],
      );
  } finally {
    await closePool();
  }
});
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

it('renders allowlisted variables once and uses saved templates for studio and booking events', async () => {
  const admin = await account('admin'),
    owner = await account('customer');
  const endpoint = '/admin/mau-thong-bao';
  expect(
    (await request(app).get(endpoint).set('Cookie', owner.cookie)).status,
  ).toBe(403);
  let list = await request(app).get(endpoint).set('Cookie', admin.cookie);
  expect(list.status).toBe(200);
  expect(list.body.items).toHaveLength(6);
  for (const key of messageTemplateKeySchema.options) {
    const variables = (
      await query<{ vars: string[] }>(
        'SELECT message_template_variables($1) AS vars',
        [key],
      )
    ).rows[0].vars;
    expect(variables).toEqual([...messageTemplateSpecs[key].variables]);
  }
  const nested = {
    studioName: 'Studio Literal',
    reason: '{{studioName}} <script>never executed</script>',
  };
  const text = {
    subject: '{{ studioName }} {{unknown}}',
    body: '{{reason}} | {{studioName}} | {{__proto__}} | {{unknown}}',
  };
  const ts = renderMessageTemplate('studio_needs_changes', text, nested);
  const sql = (
    await query<{ subject: string; body: string }>(
      "SELECT trim(regexp_replace(render_message_text($1,$2,$4::jsonb),E'[\\r\\n]+',' ','g')) AS subject,render_message_text($1,$3,$4::jsonb) AS body",
      ['studio_needs_changes', text.subject, text.body, JSON.stringify(nested)],
    )
  ).rows[0];
  expect(sql).toEqual(ts);
  expect(ts.body).toContain('{{studioName}} <script>never executed</script>');
  expect(ts.subject).toBe('Studio Literal');
  const approved = list.body.items.find(
    (t: { key: string }) => t.key === 'studio_approved',
  );
  const preview = await request(app)
    .post(endpoint + '/studio_approved/preview')
    .set('Cookie', admin.cookie)
    .send({
      subject: 'Preview {{studioName}} {{notAllowed}}',
      body: 'Body {{studioName}} {{bookingCode}}',
    });
  expect(preview.status).toBe(200);
  expect(preview.body.preview.subject).not.toContain('{{');
  expect(preview.body.preview.body).not.toContain('bookingCode');
  expect(
    (
      await request(app).get(endpoint).set('Cookie', admin.cookie)
    ).body.items.find((t: { key: string }) => t.key === 'studio_approved')
      .version,
  ).toBe(approved.version);
  const save = await request(app)
    .put(endpoint + '/studio_approved')
    .set('Cookie', admin.cookie)
    .send({
      subject: 'Custom approved {{studioName}} {{unknown}}',
      body: 'Hello {{studioName}}. {{reason}}',
      expectedVersion: approved.version,
    });
  expect(save.status).toBe(200);
  expect(
    (
      await request(app)
        .put(endpoint + '/studio_approved')
        .set('Cookie', admin.cookie)
        .send({
          subject: 'Stale',
          body: 'Stale template',
          expectedVersion: approved.version,
        })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .put(endpoint + '/unlisted_key')
        .set('Cookie', admin.cookie)
        .send({
          subject: 'Bad',
          body: 'Bad',
          expectedVersion: approved.version,
        })
    ).status,
  ).toBe(422);
  const studio = randomUUID(),
    workshop = randomUUID(),
    slot = randomUUID(),
    booking = randomUUID();
  await query(
    "INSERT INTO studios(id,name,province_id,address,status) VALUES($1,'Studio Literal','ho-chi-minh','Test address','pending')",
    [studio],
  );
  await query(
    "INSERT INTO studio_members(studio_id,user_id,role) VALUES($1,$2,'owner')",
    [studio, owner.id],
  );
  await seedStudioEvidence(studio, owner.id);
  const decide = async (status: string) =>
    request(app)
      .patch(`/admin/studios/${studio}/status`)
      .set('Cookie', admin.cookie)
      .send({
        status,
        ...(status === 'approved'
          ? {}
          : { reason: 'Additional information required for review' }),
      });
  expect((await decide('needs_changes')).status).toBe(200);
  expect(
    (
      await query(
        "SELECT title,body FROM studio_notifications WHERE studio_id=$1 AND template_key='studio_needs_changes'",
        [studio],
      )
    ).rows[0].body,
  ).toContain('Additional information required for review');
  await query("UPDATE studios SET status='pending' WHERE id=$1", [studio]);
  expect((await decide('rejected')).status).toBe(200);
  await query("UPDATE studios SET status='pending' WHERE id=$1", [studio]);
  expect((await decide('approved')).status).toBe(200);
  const delivered = (
    await query(
      "SELECT title,body FROM studio_notifications WHERE studio_id=$1 AND template_key='studio_approved'",
      [studio],
    )
  ).rows[0];
  expect(delivered).toEqual({
    title: 'Custom approved Studio Literal',
    body: 'Hello Studio Literal. ',
  });
  expect((await decide('suspended')).status).toBe(200);
  expect(
    (
      await query(
        "SELECT count(*)::int AS n FROM studio_notifications WHERE studio_id=$1 AND template_key='studio_suspended'",
        [studio],
      )
    ).rows[0].n,
  ).toBe(1);
  list = await request(app).get(endpoint).set('Cookie', admin.cookie);
  const bookingTemplate = list.body.items.find(
    (t: { key: string }) => t.key === 'booking_success',
  );
  expect(
    (
      await request(app)
        .put(endpoint + '/booking_success')
        .set('Cookie', admin.cookie)
        .send({
          subject: 'Success {{bookingCode}}',
          body: 'Customer {{customerName}} / {{bookingStatus}} / {{paymentStatus}} / {{unknown}}',
          expectedVersion: bookingTemplate.version,
        })
    ).status,
  ).toBe(200);
  await query(
    "INSERT INTO workshops(id,studio_id,title,slug,description,category_id,duration_minutes,base_price) VALUES($1,$2,'Template Workshop',$3,'Workshop description','ceramics',90,200000)",
    [workshop, studio, 'template-' + workshop],
  );
  await query(
    "INSERT INTO sessions(id,workshop_id,starts_at,ends_at,price,capacity,seats_held) VALUES($1,$2,now()+interval '2 days',now()+interval '2 days 90 minutes',200000,8,2)",
    [slot, workshop],
  );
  const code = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  await query(
    "INSERT INTO bookings(id,user_id,session_id,quantity,unit_price,total_amount,hold_expires_at,order_code) VALUES($1,$2,$3,2,200000,400000,now()+interval '1 hour',$4)",
    [booking, owner.id, slot, code],
  );
  const success = (
    await query(
      "SELECT title,body FROM studio_notifications WHERE booking_id=$1 AND template_key='booking_success'",
      [booking],
    )
  ).rows[0];
  expect(success.title).toBe('Success ' + code);
  expect(success.body).toContain('Chờ xác nhận');
  expect(success.body).toContain('Chưa thanh toán');
  expect(success.body).not.toContain('{{');
  const cancelled = await request(app)
    .patch(`/admin/dat-cho/${booking}/status`)
    .set('Cookie', admin.cookie)
    .send({
      status: 'cancelled',
      expectedStatus: 'pending',
      reason: 'Customer requested cancellation of booking',
    });
  expect(cancelled.status).toBe(200);
  expect(
    (
      await query(
        "SELECT body FROM studio_notifications WHERE booking_id=$1 AND template_key='booking_cancelled'",
        [booking],
      )
    ).rows[0].body,
  ).toContain('Customer requested cancellation of booking');
  const notifications = await request(app)
    .get('/me/notifications')
    .set('Cookie', owner.cookie);
  expect(notifications.status).toBe(200);
  expect(
    notifications.body.notifications.some(
      (n: { bookingId: string; body: string }) =>
        n.bookingId === booking &&
        n.body.includes('Customer requested cancellation'),
    ),
  ).toBe(true);
  list = await request(app).get(endpoint).set('Cookie', admin.cookie);
  const current = list.body.items.find(
    (t: { key: string }) => t.key === 'studio_approved',
  );
  const reset = await request(app)
    .post(endpoint + '/studio_approved/reset')
    .set('Cookie', admin.cookie)
    .send({ expectedVersion: current.version });
  expect(reset.status).toBe(200);
  const restored = reset.body.templates.find(
    (t: { key: string }) => t.key === 'studio_approved',
  );
  const original = (
    await query('SELECT * FROM default_message_template($1)', [
      'studio_approved',
    ])
  ).rows[0];
  expect(restored.subject).toBe(original.subject);
  expect(restored.body).toBe(original.body);
  expect(
    (
      await query(
        "SELECT title FROM studio_notifications WHERE studio_id=$1 AND template_key='studio_approved'",
        [studio],
      )
    ).rows[0].title,
  ).toBe(delivered.title);
});
