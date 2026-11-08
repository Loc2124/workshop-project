import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../../src/app.js';
import { query } from '../../src/db/pool.js';
import { loadConfig } from '../../src/config.js';
import { signMockWebhook } from '../../src/modules/payments/providers/mock.provider.js';
import { syncRefundObligations } from '../../src/modules/payments/financial-obligation-job.js';
process.env.PAYMENT_PROVIDER = 'mock';
export const app = createApp();
export type Account = { id: string; cookie: string };

export async function account(
  role: 'customer' | 'admin' = 'customer',
): Promise<Account> {
  const id = randomUUID();
  const sid = randomUUID();
  const config = loadConfig();
  await query(
    `INSERT INTO users (id, email, password_hash, full_name, role)
     VALUES ($1, $2, 'unused-test-hash', $3, $4)`,
    [id, `${id}@example.test`, `Customer ${id.slice(0, 6)}`, role],
  );
  await query(
    `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '1 day')`,
    [sid, id, createHash('sha256').update(sid).digest('hex')],
  );
  return {
    id,
    cookie: `${config.COOKIE_NAME}=${jwt.sign(
      { sub: id, sid, role },
      config.JWT_SECRET,
      { expiresIn: '1h' },
    )}`,
  };
}

export async function publicWorkshop(depositPercent: number) {
  const owner = await account();
  const admin = await account('admin');
  const studioId = randomUUID();
  await query(
    `INSERT INTO studios
       (id, name, province_id, address, status, contact_phone, contact_email,
        verified_at, verified_by)
     VALUES ($1, 'Booking Test Studio', 'ho-chi-minh', 'Test address',
       'approved', '0901234567', 'studio@example.test', now(), $2)`,
    [studioId, admin.id],
  );
  await query(
    `INSERT INTO studio_members (studio_id, user_id, role)
     VALUES ($1, $2, 'owner')`,
    [studioId, owner.id],
  );
  const photoIds = [randomUUID(), randomUUID(), randomUUID()];
  for (const [index, photoId] of photoIds.entries()) {
    await query(
      `INSERT INTO images (id, studio_id, uploaded_by, key, state, byte_size)
       VALUES ($1, $2, $3, $4, 'ready', 100)`,
      [photoId, studioId, owner.id, `studio/${studioId}/photo-${index}.webp`],
    );
  }
  await query('UPDATE studios SET photo_ids = $2 WHERE id = $1', [
    studioId,
    photoIds,
  ]);
  await query(
    'UPDATE studios SET deposit_mode=$2,deposit_percent=$3 WHERE id=$1',
    [
      studioId,
      depositPercent > 0 ? 'required' : 'none',
      depositPercent > 0 ? depositPercent : null,
    ],
  );
  const workshopId = randomUUID();
  await query(
    `INSERT INTO workshops
       (id, studio_id, title, slug, description, category_id, duration_minutes,
        base_price, status, is_simulated, visibility_status, publication_status,
        deposit_percent)
     VALUES ($1, $2, 'Workshop test', $3, 'Details', 'other', 90, 200000,
       'approved', false, 'active', 'published', NULL)`,
    [workshopId, studioId, `booking-${workshopId}`],
  );
  return { owner, studioId, workshopId };
}

export async function session(workshopId: string, capacity: number) {
  const id = randomUUID();
  await query(
    `INSERT INTO sessions
       (id, workshop_id, starts_at, ends_at, price, capacity)
     VALUES ($1, $2, now() + interval '2 days',
       now() + interval '2 days 2 hours', 200000, $3)`,
    [id, workshopId, capacity],
  );
  return id;
}

export async function placeBooking(
  customer: Account,
  sessionId: string,
  quantity = 1,
  requestId = randomUUID(),
) {
  return request(app).post('/bookings').set('Cookie', customer.cookie).send({
    sessionId,
    quantity,
    requestId,
  });
}

export function mockWebhook(
  orderCode: number,
  amount: number,
  reference: string,
  succeeded: boolean,
) {
  const data = {
    orderCode,
    amount,
    reference,
    code: succeeded ? '00' : '01',
    desc: succeeded ? 'success' : 'failed',
  };
  return JSON.stringify({
    code: succeeded ? '00' : '01',
    desc: data.desc,
    success: succeeded,
    data,
    signature: signMockWebhook(data, loadConfig().PAYOS_CHECKSUM_KEY_TEST),
  });
}

export async function settleBookingRefund(
  bookingId: string,
  customer: Account,
  admin: Account,
  amount: number,
) {
  const password = 'Test refund account password 2026!';
  await query('UPDATE users SET password_hash=$2 WHERE id=$1', [
    customer.id,
    await argon2.hash(password),
  ]);
  await syncRefundObligations();
  const obligations = await query<{ id: string; remaining: string }>(
    `SELECT o.id,(o.amount-COALESCE((SELECT sum(t.amount) FROM financial_transfers t
      WHERE t.obligation_id=o.id AND t.direction='outbound' AND t.status='succeeded'),0))::text AS remaining
     FROM financial_obligations o WHERE o.booking_id=$1 AND o.kind='customer_refund'
       AND o.status<>'cancelled' ORDER BY o.created_at,o.id`,
    [bookingId],
  );
  let unsettled = amount;
  for (const obligation of obligations.rows) {
    if (unsettled === 0) break;
    const payment = Math.min(unsettled, Number(obligation.remaining));
    if (payment <= 0) continue;
    const account = await request(app)
      .put(`/refunds/${obligation.id}/account`)
      .set('Cookie', customer.cookie)
      .send({
        bankBin: '970415',
        accountHolder: 'Nguyen Van A',
        accountNumber: '123456789012',
        password,
        saveForLater: false,
      });
    if (account.status !== 200)
      throw new Error(`Refund account setup failed: ${account.status}`);
    const verified = await request(app)
      .post(`/admin/tai-chinh/tai-khoan-hoan/${account.body.id}/duyet`)
      .set('Cookie', admin.cookie)
      .send({
        decision: 'verified',
        verificationReference: `VERIFY-${randomUUID()}`,
        reason: 'Đã đối chiếu tài khoản nhận hoàn với chứng từ.',
      });
    if (verified.status !== 200)
      throw new Error(`Refund account verification failed: ${verified.status}`);
    const transfer = await request(app)
      .post(`/admin/tai-chinh/nghia-vu/${obligation.id}/chuyen-tien`)
      .set('Cookie', admin.cookie)
      .send({
        amount: payment,
        purpose: 'platform_advance',
        idempotencyKey: randomUUID(),
        reason: 'Tạm ứng khoản hoàn trong kiểm tra tích hợp.',
      });
    if (transfer.status !== 201)
      throw new Error(`Refund transfer creation failed: ${transfer.status}`);
    const approved = await request(app)
      .post(`/admin/tai-chinh/chuyen-tien/${transfer.body.id}/duyet`)
      .set('Cookie', admin.cookie)
      .send({ reason: 'Đã đối chiếu khoản hoàn và tài khoản nhận.' });
    if (approved.status !== 200)
      throw new Error(`Refund transfer approval failed: ${approved.status}`);
    const completed = await request(app)
      .post(`/admin/tai-chinh/chuyen-tien/${transfer.body.id}/ghi-nhan-ket-qua`)
      .set('Cookie', admin.cookie)
      .send({
        result: 'succeeded',
        reference: `REF-${randomUUID()}`,
        provider: 'ngan_hang_test',
        providerFee: 0,
        reason: 'Đã đối chiếu với chứng từ ngân hàng.',
      });
    if (completed.status !== 200)
      throw new Error(`Refund transfer settlement failed: ${completed.status}`);
    unsettled -= payment;
  }
  if (unsettled !== 0)
    throw new Error(`Refund obligations are short by ${unsettled} VND`);
}
