import { Router } from 'express';
import { z } from 'zod';
import { withTransaction } from '../../../db/pool.js';
import { AppError } from '../../../errors/app-error.js';
import { writeAuditLog } from '../audit-log.js';
import { decryptFinancialAccount } from '../../payments/financial-account-crypto.js';

export const accountsRouter = Router();

accountsRouter.get('/tai-khoan-studio', async (_req, res) => {
  const rows = await withTransaction((client) =>
    client.query<{
      id: string;
      studioId: string;
      studioName: string;
      bankName: string;
      bankBin: string | null;
      accountHolder: string;
      status: string;
      last4: string;
      createdAt: Date;
    }>(
      `SELECT a.id,a.studio_id AS "studioId",st.name AS "studioName",a.bank_name AS "bankName",a.bank_bin AS "bankBin",a.status,
      a.account_holder AS "accountHolder",a.account_last4 AS last4,
      a.created_at AS "createdAt"
     FROM studio_payout_accounts a JOIN studios st ON st.id=a.studio_id
     WHERE a.is_current AND a.status IN ('pending','verified') ORDER BY (a.status='pending') DESC,a.created_at DESC LIMIT 100`,
    ),
  );
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    items: rows.rows.map((row) => ({
      id: row.id,
      studioId: row.studioId,
      studioName: row.studioName,
      bankName: row.bankName,
      bankBin: row.bankBin,
      accountHolder: row.accountHolder,
      last4: row.last4,
      status: row.status,
      createdAt: row.createdAt,
    })),
  });
});

accountsRouter.get('/tai-khoan-studio/:id/so-day-du', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const number = await withTransaction(async (client) => {
    const result = await client.query<{
      studioId: string;
      encryptedNumber: Buffer;
      iv: Buffer;
      tag: Buffer;
      last4: string;
    }>(
      `SELECT studio_id AS "studioId",encrypted_number AS "encryptedNumber",encryption_iv AS iv,
        encryption_tag AS tag,account_last4 AS last4 FROM studio_payout_accounts WHERE id=$1`,
      [id],
    );
    if (!result.rows[0])
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản.');
    const row = result.rows[0];
    const accountNumber = decryptFinancialAccount(
      row.encryptedNumber,
      row.iv,
      row.tag,
    );
    await writeAuditLog(client, {
      actorId: req.user!.sub,
      action: 'financial.studio_account.full_viewed',
      targetType: 'studio',
      targetId: row.studioId,
      targetName: 'Xem số tài khoản nhận tiền',
      after: { accountId: id, last4: row.last4 },
    });
    return accountNumber;
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ accountNumber: number });
});

accountsRouter.post('/tai-khoan-studio/:id/duyet', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const input = z
    .object({
      decision: z.enum(['verified', 'rejected']),
      verificationReference: z.string().trim().min(5).max(300),
      reason: z.string().trim().min(10).max(500),
    })
    .strict()
    .parse(req.body);
  await withTransaction(async (client) => {
    const result = await client.query<{ studioId: string; last4: string }>(
      `UPDATE studio_payout_accounts SET status=$2,verified_by=CASE WHEN $2='verified' THEN $3::uuid ELSE NULL END,
        verified_at=CASE WHEN $2='verified' THEN clock_timestamp() ELSE NULL END,
        verification_reference=$4 WHERE id=$1 AND status='pending' AND is_current
       RETURNING studio_id AS "studioId",account_last4 AS last4`,
      [id, input.decision, req.user!.sub, input.verificationReference],
    );
    if (!result.rows[0])
      throw new AppError(
        409,
        'CONFLICT',
        'Tài khoản đã đổi hoặc đã được xử lý.',
      );
    await client.query(
      `INSERT INTO user_notifications(user_id,type,title,body,href)
       SELECT sm.user_id,'studio_payout_account_reviewed',
         CASE WHEN $2='verified' THEN 'Tài khoản nhận tiền đã được đối chiếu' ELSE 'Cần nhập lại tài khoản nhận tiền' END,
         CASE WHEN $2='verified' THEN 'Studio có thể nhận chi trả vào tài khoản đã lưu.' ELSE 'Vui lòng kiểm tra và nhập lại tài khoản nhận tiền.' END,
         '/studio/'||$1::uuid::text||'/profile'
       FROM studio_members sm WHERE sm.studio_id=$1 AND sm.role='owner'`,
      [result.rows[0].studioId, input.decision],
    );
    await writeAuditLog(client, {
      actorId: req.user!.sub,
      action: `financial.studio_account.${input.decision}`,
      targetType: 'studio',
      targetId: result.rows[0].studioId,
      targetName: 'Xác minh tài khoản nhận tiền',
      reason: input.reason,
      after: {
        accountId: id,
        last4: result.rows[0].last4,
        decision: input.decision,
        verificationReference: input.verificationReference,
      },
    });
  });
  res.json({ ok: true, status: input.decision });
});

accountsRouter.get('/tai-khoan-hoan', async (_req, res) => {
  const rows = await withTransaction((client) =>
    client.query<{
      id: string;
      bookingId: string;
      refundId: string;
      orderCode: string;
      bankBin: string;
      source: string;
      accountHolder: string;
      status: string;
      isCurrent: boolean;
      last4: string;
      createdAt: Date;
    }>(
      `SELECT a.id,a.booking_id AS "bookingId",a.refund_id AS "refundId",
      b.order_code::text AS "orderCode",a.bank_bin AS "bankBin",a.source,
      a.account_holder AS "accountHolder",a.status,a.is_current AS "isCurrent",
      a.account_last4 AS last4,a.created_at AS "createdAt"
     FROM customer_refund_accounts a JOIN bookings b ON b.id=a.booking_id
     WHERE a.refund_id IS NOT NULL AND a.purged_at IS NULL
       AND (a.is_current OR EXISTS(SELECT 1 FROM financial_transfers t
         WHERE t.destination_customer_account_id=a.id AND
           (t.status NOT IN ('succeeded','failed') OR
             (t.status='succeeded' AND t.settled_at>clock_timestamp()-interval '7 days'))))
     ORDER BY (a.status='pending') DESC,a.created_at DESC LIMIT 100`,
    ),
  );
  res.setHeader('Cache-Control', 'no-store');
  res.json({ items: rows.rows });
});

accountsRouter.get('/tai-khoan-hoan/:id/so-day-du', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const number = await withTransaction(async (client) => {
    const result = await client.query<{
      bookingId: string;
      refundId: string;
      last4: string;
      encryptedNumber: Buffer;
      iv: Buffer;
      tag: Buffer;
    }>(
      `SELECT booking_id AS "bookingId",refund_id AS "refundId",account_last4 AS last4,
        encrypted_number AS "encryptedNumber",encryption_iv AS iv,encryption_tag AS tag
       FROM customer_refund_accounts WHERE id=$1 AND refund_id IS NOT NULL AND purged_at IS NULL`,
      [id],
    );
    if (!result.rows[0])
      throw new AppError(
        404,
        'NOT_FOUND',
        'Số tài khoản đầy đủ đã được xóa hoặc không còn.',
      );
    const row = result.rows[0];
    const accountNumber = decryptFinancialAccount(
      row.encryptedNumber,
      row.iv,
      row.tag,
    );
    await writeAuditLog(client, {
      actorId: req.user!.sub,
      action: 'financial.customer_account.full_viewed',
      targetType: 'booking',
      targetId: row.bookingId,
      targetName: 'Xem số tài khoản nhận hoàn',
      after: { refundId: row.refundId, accountId: id, last4: row.last4 },
    });
    return accountNumber;
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ accountNumber: number });
});

accountsRouter.post('/tai-khoan-hoan/:id/duyet', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const input = z
    .object({
      decision: z.enum(['verified', 'rejected']),
      verificationReference: z.string().trim().min(5).max(300),
      reason: z.string().trim().min(10).max(500),
    })
    .strict()
    .parse(req.body);
  await withTransaction(async (client) => {
    const result = await client.query<{
      bookingId: string;
      refundId: string;
      last4: string;
    }>(
      `UPDATE customer_refund_accounts SET status=$2,verified_by=CASE WHEN $2='verified' THEN $3::uuid ELSE NULL END,
        verified_at=CASE WHEN $2='verified' THEN clock_timestamp() ELSE NULL END,
        verification_reference=$4,
        encrypted_number=CASE WHEN $2='rejected' THEN NULL ELSE encrypted_number END,
        encryption_iv=CASE WHEN $2='rejected' THEN NULL ELSE encryption_iv END,
        encryption_tag=CASE WHEN $2='rejected' THEN NULL ELSE encryption_tag END,
        bank_bin=CASE WHEN $2='rejected' THEN NULL ELSE bank_bin END,
        account_holder=CASE WHEN $2='rejected' THEN NULL ELSE account_holder END,
        purged_at=CASE WHEN $2='rejected' THEN clock_timestamp() ELSE purged_at END,
        is_current=CASE WHEN $2='rejected' THEN false ELSE is_current END
       WHERE id=$1 AND status='pending' AND is_current AND refund_id IS NOT NULL
       RETURNING booking_id AS "bookingId",refund_id AS "refundId",account_last4 AS last4`,
      [id, input.decision, req.user!.sub, input.verificationReference],
    );
    if (!result.rows[0])
      throw new AppError(
        409,
        'CONFLICT',
        'Tài khoản đã đổi hoặc đã được xử lý.',
      );
    await client.query(
      `INSERT INTO user_notifications(user_id,booking_id,type,title,body,href)
       SELECT b.user_id,b.id,'refund_account_reviewed',
         CASE WHEN $2='verified' THEN 'Tài khoản nhận hoàn đã được đối chiếu' ELSE 'Cần nhập lại tài khoản nhận hoàn' END,
         CASE WHEN $2='verified' THEN 'Open Slot sẽ dùng tài khoản này để xử lý khoản hoàn.' ELSE 'Tài khoản nhận hoàn chưa đối chiếu được. Vui lòng kiểm tra và nhập lại.' END,
         '/me/bookings/'||b.id::text||'?refund='||$3::uuid::text
       FROM bookings b WHERE b.id=$1`,
      [result.rows[0].bookingId, input.decision, result.rows[0].refundId],
    );
    await writeAuditLog(client, {
      actorId: req.user!.sub,
      action: `financial.customer_account.${input.decision}`,
      targetType: 'booking',
      targetId: result.rows[0].bookingId,
      targetName: 'Xác minh tài khoản nhận hoàn',
      reason: input.reason,
      after: {
        refundId: result.rows[0].refundId,
        accountId: id,
        last4: result.rows[0].last4,
        decision: input.decision,
        verificationReference: input.verificationReference,
      },
    });
  });
  res.json({ ok: true, status: input.decision });
});
