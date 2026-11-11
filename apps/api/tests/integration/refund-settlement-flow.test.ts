import request from 'supertest';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import {
  app,
  account,
  mockWebhook,
  placeBooking,
  publicWorkshop,
  session,
} from '../helpers/partial-booking-fixtures.js';
import { query, closePool } from '../../src/db/pool.js';
import { migrateDatabase } from '../../../../scripts/migrate.js';
import { assertSafeTestDatabase } from '../../../../scripts/assert-safe-test-db.js';
import { syncRefundObligations } from '../../src/modules/payments/financial-obligation-job.js';

vi.setConfig({ testTimeout: 120000, hookTimeout: 60000 });
beforeAll(async () => {
  assertSafeTestDatabase();
  await migrateDatabase(process.env.DATABASE_URL_TEST!);
});
afterAll(async () => closePool());

it('keeps saved accounts separate and resolves uncertain, failed, partial, and completed refunds once', async () => {
  const { studioId, workshopId } = await publicWorkshop(0);
  const slot = await session(workshopId, 2);
  const customer = await account();
  const admin = await account('admin');
  const password = 'Refund flow password 2026!';
  await query('UPDATE users SET password_hash=$2 WHERE id=$1', [
    customer.id,
    await argon2.hash(password),
  ]);
  const booked = await placeBooking(customer, slot);
  expect(booked.status).toBe(201);
  const bookingId = booked.body.booking.id as string;
  const makeRefund = async (amount: number) => {
    const row = await query<{ id: string }>(
      `INSERT INTO financial_obligations(booking_id,studio_id,kind,source_key,amount,status,reason)
       VALUES($1,$2,'customer_refund',$3,$4,'awaiting_funds','Khoản hoàn kiểm tra luồng') RETURNING id`,
      [bookingId, studioId, `flow:${randomUUID()}`, amount],
    );
    return row.rows[0]!.id;
  };
  const firstRefund = await makeRefund(1000);
  const secondRefund = await makeRefund(20000);
  const saveAccount = (
    refundId: string,
    number: string,
    saveForLater = false,
  ) =>
    request(app)
      .put(`/refunds/${refundId}/account`)
      .set('Cookie', customer.cookie)
      .send({
        bankBin: '970415',
        accountHolder: 'Nguyen Van A',
        accountNumber: number,
        password,
        saveForLater,
      });

  expect((await saveAccount(firstRefund, '123456789012')).status).toBe(200);
  expect(
    (
      await request(app)
        .get('/me/refund-accounts')
        .set('Cookie', customer.cookie)
    ).body.items,
  ).toHaveLength(0);
  expect((await saveAccount(firstRefund, '123456789013', true)).status).toBe(
    200,
  );
  const saved = (
    await request(app).get('/me/refund-accounts').set('Cookie', customer.cookie)
  ).body.items;
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ last4: '9013', bankBin: '970415' });
  expect(JSON.stringify(saved[0])).not.toContain('123456789013');
  const reused = await request(app)
    .post(`/refunds/${secondRefund}/account/from-saved`)
    .set('Cookie', customer.cookie)
    .send({ savedAccountId: saved[0].id, password });
  expect(reused.status).toBe(200);
  expect(reused.body.last4).toBe('9013');
  expect(
    (
      await request(app)
        .delete(`/me/refund-accounts/${saved[0].id}`)
        .set('Cookie', customer.cookie)
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .get('/me/refund-accounts')
        .set('Cookie', customer.cookie)
    ).body.items,
  ).toHaveLength(0);
  expect(
    (
      await query(
        `SELECT encrypted_number IS NOT NULL AS preserved FROM customer_refund_accounts
    WHERE refund_id=$1 AND is_current`,
        [secondRefund],
      )
    ).rows[0].preserved,
  ).toBe(true);

  const verify = async (accountId: string) =>
    request(app)
      .post(`/admin/tai-chinh/tai-khoan-hoan/${accountId}/duyet`)
      .set('Cookie', admin.cookie)
      .send({
        decision: 'verified',
        verificationReference: `VERIFY-${randomUUID()}`,
        reason: 'Đã đối chiếu tài khoản nhận hoàn với chứng từ.',
      });
  expect((await verify(reused.body.id)).status).toBe(200);
  const createTransfer = async (amount: number) =>
    request(app)
      .post(`/admin/tai-chinh/nghia-vu/${secondRefund}/chuyen-tien`)
      .set('Cookie', admin.cookie)
      .send({
        amount,
        purpose: 'platform_advance',
        idempotencyKey: randomUUID(),
        reason: 'Kiểm tra khoản hoàn đã được ghi nhận.',
      });
  const approve = async (id: string) =>
    request(app)
      .post(`/admin/tai-chinh/chuyen-tien/${id}/duyet`)
      .set('Cookie', admin.cookie)
      .send({ reason: 'Đã đối chiếu khoản hoàn và tài khoản nhận.' });
  const outcome = async (
    id: string,
    result: 'manual_review' | 'failed' | 'succeeded',
    reference?: string,
  ) =>
    request(app)
      .post(`/admin/tai-chinh/chuyen-tien/${id}/ghi-nhan-ket-qua`)
      .set('Cookie', admin.cookie)
      .send({
        result,
        reason: 'Đã đối chiếu với chứng từ ngân hàng.',
        ...(result === 'succeeded'
          ? { reference, provider: 'ngan_hang_test', providerFee: 0 }
          : {}),
      });
  const uncertain = await createTransfer(10000);
  expect(uncertain.status).toBe(201);
  expect((await approve(uncertain.body.id)).status).toBe(200);
  expect((await outcome(uncertain.body.id, 'manual_review')).status).toBe(200);
  const queueDuringReview = await request(app)
    .get('/admin/tai-chinh/chuyen-tien?view=queue')
    .set('Cookie', admin.cookie);
  expect(queueDuringReview.status).toBe(200);
  expect(
    queueDuringReview.body.items.find(
      (item: { id: string }) => item.id === uncertain.body.id,
    ),
  ).toMatchObject({ status: 'manual_review', obligationId: secondRefund });
  const history = await request(app)
    .get(`/admin/tai-chinh/chuyen-tien/${uncertain.body.id}/lich-su`)
    .set('Cookie', admin.cookie);
  expect(history.status).toBe(200);
  expect(
    history.body.items.map((item: { event: string }) => item.event),
  ).toEqual(['created', 'approved', 'manual_review']);
  expect(history.body.items[2].actorName).toBeTruthy();
  expect(
    (
      await request(app)
        .get(`/bookings/${bookingId}/refund-destinations`)
        .set('Cookie', customer.cookie)
    ).body.items.find(
      (item: { refundId: string }) => item.refundId === secondRefund,
    ).transferStatus,
  ).toBe('manual_review');
  expect((await createTransfer(10000)).status).toBe(409);
  expect((await saveAccount(secondRefund, '123456789014')).status).toBe(409);
  expect((await outcome(uncertain.body.id, 'failed')).status).toBe(200);
  expect(
    (
      await request(app)
        .get('/admin/tai-chinh/chuyen-tien?view=queue')
        .set('Cookie', admin.cookie)
    ).body.items.some((item: { id: string }) => item.id === uncertain.body.id),
  ).toBe(true);
  expect(
    (
      await request(app)
        .get(`/bookings/${bookingId}/refund-destinations`)
        .set('Cookie', customer.cookie)
    ).body.items.find(
      (item: { refundId: string }) => item.refundId === secondRefund,
    ).transferStatus,
  ).toBe('failed');
  expect((await saveAccount(secondRefund, '123456789014')).status).toBe(200);
  const destination = (
    await request(app)
      .get(`/refunds/${secondRefund}/account`)
      .set('Cookie', customer.cookie)
  ).body.items[0];
  expect((await verify(destination.id)).status).toBe(200);

  const partial = await createTransfer(10000);
  expect(partial.status).toBe(201);
  expect((await approve(partial.body.id)).status).toBe(200);
  expect(
    (await outcome(partial.body.id, 'succeeded', `REF-${randomUUID()}`)).status,
  ).toBe(200);
  expect(
    (await outcome(partial.body.id, 'succeeded', `REF-${randomUUID()}`)).status,
  ).toBe(409);
  expect(
    (
      await query(`SELECT status FROM financial_obligations WHERE id=$1`, [
        secondRefund,
      ])
    ).rows[0].status,
  ).toBe('partially_paid');
  const finalTransfer = await createTransfer(10000);
  expect(finalTransfer.status).toBe(201);
  expect((await approve(finalTransfer.body.id)).status).toBe(200);
  expect(
    (await outcome(finalTransfer.body.id, 'succeeded', `REF-${randomUUID()}`))
      .status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .get('/admin/tai-chinh/chuyen-tien?view=queue')
        .set('Cookie', admin.cookie)
    ).body.items.some((item: { id: string }) => item.id === uncertain.body.id),
  ).toBe(false);
  const customerView = await request(app)
    .get(`/bookings/${bookingId}/refund-destinations`)
    .set('Cookie', customer.cookie);
  expect(customerView.status).toBe(200);
  expect(
    customerView.body.items.find(
      (item: { refundId: string }) => item.refundId === secondRefund,
    ),
  ).toMatchObject({ status: 'paid', settledAmount: '20000' });

  await query(
    `UPDATE financial_transfers SET settled_at=clock_timestamp()-interval '6 days'
    WHERE obligation_id=$1 AND status='succeeded'`,
    [secondRefund],
  );
  await syncRefundObligations();
  expect(
    (
      await query(
        `SELECT encrypted_number IS NOT NULL AS preserved FROM customer_refund_accounts
    WHERE refund_id=$1 AND id=$2`,
        [secondRefund, destination.id],
      )
    ).rows[0].preserved,
  ).toBe(true);
  await query(
    `UPDATE financial_transfers SET settled_at=clock_timestamp()-interval '8 days'
    WHERE obligation_id=$1 AND status='succeeded'`,
    [secondRefund],
  );
  await syncRefundObligations();
  const retained = await query(
    `SELECT encrypted_number,purged_at,account_last4 FROM customer_refund_accounts
    WHERE refund_id=$1 AND id=$2`,
    [secondRefund, destination.id],
  );
  expect(retained.rows[0]).toMatchObject({
    encrypted_number: null,
    account_last4: '9014',
  });
  expect(retained.rows[0].purged_at).not.toBeNull();
  expect(
    (
      await query(
        `SELECT count(*)::int AS total FROM financial_transfers WHERE obligation_id=$1`,
        [secondRefund],
      )
    ).rows[0].total,
  ).toBe(3);
});

it('settles deposit-covered refund in 1 step via VietQR without requiring studio_recovery', async () => {
  const { workshopId } = await publicWorkshop(30);
  const slot = await session(workshopId, 2);
  const customer = await account();
  const admin = await account('admin');
  const password = 'VietQR refund password 2026!';
  await query('UPDATE users SET password_hash=$2 WHERE id=$1', [
    customer.id,
    await argon2.hash(password),
  ]);

  const booked = await placeBooking(customer, slot);
  expect(booked.status).toBe(201);
  const bookingId = booked.body.booking.id as string;
  const orderCode = booked.body.booking.orderCode as number;
  const depositAmount = booked.body.booking.depositAmount as number;

  const paid = await request(app)
    .post('/webhooks/mock')
    .set('Content-Type', 'application/json')
    .send(mockWebhook(orderCode, depositAmount, `PAY-${orderCode}`, true));
  expect(paid.status).toBe(200);

  const quoteRes = await request(app)
    .get(`/bookings/${bookingId}/cancellation-quote`)
    .set('Cookie', customer.cookie);
  expect(quoteRes.status).toBe(200);
  const quoteToken = (quoteRes.body.quote?.quoteToken ??
    quoteRes.body.quote?.token ??
    quoteRes.body.quoteToken) as string;

  const cancelRes = await request(app)
    .post(`/bookings/${bookingId}/cancel`)
    .set('Cookie', customer.cookie)
    .send({ quoteToken });
  expect(cancelRes.status).toBe(200);

  await syncRefundObligations();

  const obRows = await query<{ id: string; kind: string; status: string }>(
    `SELECT id, kind, status FROM financial_obligations WHERE booking_id=$1 AND status<>'cancelled'`,
    [bookingId],
  );
  expect(obRows.rows).toHaveLength(1);
  expect(obRows.rows[0]).toMatchObject({
    kind: 'customer_refund',
    status: 'awaiting_approval',
  });
  const refundObligationId = obRows.rows[0]!.id;

  const saveAcc = await request(app)
    .put(`/refunds/${refundObligationId}/account`)
    .set('Cookie', customer.cookie)
    .send({
      bankBin: '970422',
      accountHolder: 'TRAN VAN B',
      accountNumber: '098765432100',
      password,
      saveForLater: false,
    });
  expect(saveAcc.status).toBe(200);

  const vietqrRes = await request(app)
    .get(`/admin/tai-chinh/nghia-vu/${refundObligationId}/vietqr`)
    .set('Cookie', admin.cookie);
  expect(vietqrRes.status).toBe(200);
  expect(vietqrRes.body).toMatchObject({
    obligationId: refundObligationId,
    kind: 'customer_refund',
    amount: depositAmount,
    bankBin: '970422',
    accountHolder: 'TRAN VAN B',
    accountNumber: '098765432100',
    transferContent: `OS HOAN ${orderCode}`,
  });
  expect(vietqrRes.body.vietqrUrl).toContain(
    `https://img.vietqr.io/image/970422-098765432100-compact2.png?amount=${depositAmount}`,
  );

  const quickSettle = await request(app)
    .post(`/admin/tai-chinh/nghia-vu/${refundObligationId}/chuyen-nhanh-vietqr`)
    .set('Cookie', admin.cookie)
    .send({
      amount: depositAmount,
      reference: `FT-VIETQR-${orderCode}`,
      provider: 'VietQR Napas 247',
      providerFee: 0,
      idempotencyKey: randomUUID(),
      reason: 'Quản trị quét mã VietQR chuyển khoản hoàn cọc cho khách.',
    });
  expect(quickSettle.status).toBe(200);
  expect(quickSettle.body).toMatchObject({
    ok: true,
    status: 'succeeded',
    reference: `FT-VIETQR-${orderCode}`,
  });

  const finalObligation = await query<{ status: string }>(
    `SELECT status FROM financial_obligations WHERE id=$1`,
    [refundObligationId],
  );
  expect(finalObligation.rows[0]!.status).toBe('paid');

  const finalBooking = await query<{
    refund_status: string;
    refunded_amount: number;
  }>(`SELECT refund_status, refunded_amount FROM bookings WHERE id=$1`, [
    bookingId,
  ]);
  expect(finalBooking.rows[0]).toMatchObject({
    refund_status: 'refunded',
    refunded_amount: depositAmount,
  });
});
