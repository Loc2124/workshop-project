import { Router } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { getPool, withTransaction } from '../../db/pool.js';
import { loadConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import { writeAuditLog } from './audit-log.js';
import { decryptFinancialAccount } from '../payments/financial-account-crypto.js';
import { queueRefundEmail } from '../../services/booking-emails.js';
import { createPayoutProvider } from '../payments/providers/index.js';
import {
  applySessionFee,
  processTransferResult,
  executeAutomatedPayoutTransfer,
} from '../payments/transfer-execution.js';

export const financialLedgerRouter = Router();
const calendarInput = z
  .object({
    date: z.iso.date(),
    type: z.enum(['non_working', 'working']),
    label: z.string().trim().min(2).max(160),
    officialReference: z.string().trim().min(4).max(500),
  })
  .strict();
const transferInput = z
  .object({
    amount: z.number().int().positive(),
    purpose: z
      .enum([
        'studio_repayment',
        'customer_refund',
        'studio_payout',
        'platform_advance',
      ])
      .optional(),
    reference: z.string().trim().min(3).max(200).optional(),
    provider: z.string().trim().min(2).max(80).optional(),
    idempotencyKey: z.string().trim().min(8).max(120),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

financialLedgerRouter.get('/lich-nghi', async (req, res) => {
  const year = z.coerce
    .number()
    .int()
    .min(2020)
    .max(2100)
    .optional()
    .parse(req.query.year);
  const result = await withTransaction((client) =>
    client.query(
      `SELECT calendar_date AS date,day_type AS type,label,official_reference AS "officialReference",active,updated_at AS "updatedAt"
     FROM business_calendar_overrides WHERE ($1::int IS NULL OR extract(year FROM calendar_date)=$1)
     ORDER BY calendar_date`,
      [year ?? null],
    ),
  );
  res.json({ items: result.rows });
});

financialLedgerRouter.post('/lich-nghi', async (req, res) => {
  const input = calendarInput.parse(req.body);
  await withTransaction(async (client) => {
    const existing = await client.query<{
      label: string;
      type: string;
      officialReference: string;
      active: boolean;
    }>(
      `SELECT label,day_type AS type,official_reference AS "officialReference",active FROM business_calendar_overrides WHERE calendar_date=$1 FOR UPDATE`,
      [input.date],
    );
    const before = existing.rows[0] ?? null;
    const action = !before ? 'created' : before.active ? 'updated' : 'enabled';
    await client.query(
      `INSERT INTO business_calendar_overrides(calendar_date,day_type,label,official_reference,active,created_by,updated_by)
       VALUES($1,$2,$3,$4,true,$5,$5)
       ON CONFLICT(calendar_date) DO UPDATE SET day_type=EXCLUDED.day_type,label=EXCLUDED.label,official_reference=EXCLUDED.official_reference,active=true,updated_by=EXCLUDED.updated_by,updated_at=clock_timestamp()`,
      [
        input.date,
        input.type,
        input.label,
        input.officialReference,
        req.user!.sub,
      ],
    );
    await client.query(
      `INSERT INTO business_calendar_events(calendar_date,actor_id,action,previous,current) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)`,
      [
        input.date,
        req.user!.sub,
        action,
        before ? JSON.stringify(before) : null,
        JSON.stringify({
          type: input.type,
          label: input.label,
          officialReference: input.officialReference,
          active: true,
        }),
      ],
    );
    await writeAuditLog(client, {
      actorId: req.user!.sub,
      action: 'financial.calendar.date_saved',
      targetType: 'settings',
      targetId: input.date,
      targetName: 'Lịch ngày làm việc nhà nước',
      before,
      after: {
        date: input.date,
        type: input.type,
        label: input.label,
        officialReference: input.officialReference,
        active: true,
      },
    });
  });
  res.status(201).json({
    ok: true,
    date: input.date,
    type: input.type,
    label: input.label,
    active: true,
  });
});

financialLedgerRouter.delete('/lich-nghi/:date', async (req, res) => {
  const date = z.iso.date().parse(req.params.date);
  await withTransaction(async (client) => {
    const result = await client.query<{
      label: string;
      dayType: string;
      officialReference: string;
    }>(
      `UPDATE business_calendar_overrides SET active=false,updated_by=$2,updated_at=clock_timestamp() WHERE calendar_date=$1 AND active RETURNING label,day_type AS "dayType",official_reference AS "officialReference"`,
      [date, req.user!.sub],
    );
    if (!result.rows[0])
      throw new AppError(
        404,
        'NOT_FOUND',
        'Không tìm thấy ngày nghỉ đang áp dụng.',
      );
    await client.query(
      `INSERT INTO business_calendar_events(calendar_date,actor_id,action,previous,current) VALUES($1,$2,'disabled',$3::jsonb,$4::jsonb)`,
      [
        date,
        req.user!.sub,
        JSON.stringify({
          type: result.rows[0].dayType,
          label: result.rows[0].label,
          officialReference: result.rows[0].officialReference,
          active: true,
        }),
        JSON.stringify({
          type: result.rows[0].dayType,
          label: result.rows[0].label,
          active: false,
        }),
      ],
    );
    await writeAuditLog(client, {
      actorId: req.user!.sub,
      action: 'financial.calendar.date_disabled',
      targetType: 'settings',
      targetId: date,
      targetName: 'Lịch ngày làm việc nhà nước',
      before: { label: result.rows[0].label, active: true },
      after: { label: result.rows[0].label, active: false },
    });
  });
  res.json({ ok: true, date, active: false });
});

financialLedgerRouter.get('/nghia-vu', async (_req, res) => {
  const result = await withTransaction((client) =>
    client.query(
      `SELECT o.id,o.booking_id AS "bookingId",b.order_code::text AS "orderCode",
      o.studio_id AS "studioId",st.name AS "studioName",o.ticket_id AS "ticketId",
      o.kind,o.source_key AS "sourceKey",o.amount,o.due_at AS "dueAt",o.status,
      o.reason,o.created_at AS "createdAt",
      CASE WHEN o.due_at<clock_timestamp() THEN 'overdue'
           WHEN o.due_at<=clock_timestamp()+interval '1 day' THEN 'due_soon'
           ELSE NULL END AS "dueState",
      COALESCE(sum(t.amount) FILTER (WHERE t.status='succeeded'),0)::bigint AS "settledAmount"
      ,COALESCE(sum(t.amount) FILTER (WHERE t.status NOT IN ('succeeded','failed')),0)::bigint AS "reservedAmount"
     FROM financial_obligations o JOIN bookings b ON b.id=o.booking_id
     JOIN studios st ON st.id=o.studio_id
     LEFT JOIN financial_transfers t ON t.obligation_id=o.id
     WHERE o.status NOT IN ('paid','cancelled')
     GROUP BY o.id,b.order_code,st.name
     ORDER BY o.due_at NULLS LAST,o.created_at`,
    ),
  );
  res.json({ items: result.rows });
});

financialLedgerRouter.get('/doi-soat', async (_req, res) => {
  const result = await withTransaction((client) =>
    client.query(
      `SELECT snap.booking_id AS "bookingId",b.order_code::text AS "orderCode",
      st.name AS "studioName",w.title AS "workshopTitle",snap.session_id AS "sessionId",
      snap.due_at AS "dueAt",snap.created_at AS "closedAt",snap.net_amount AS "netAmount",
      snap.breakdown,o.id AS "payoutObligationId",o.amount AS "currentPayoutAmount",o.status AS "payoutStatus",
      (b.refund_due_amount+b.extra_refund_due_amount)::bigint AS "currentRefunds",
      CASE WHEN snap.breakdown ? 'refundsRecorded' THEN
        GREATEST(0,(b.refund_due_amount+b.extra_refund_due_amount)::bigint
          -(snap.breakdown->>'refundsRecorded')::bigint) ELSE NULL END AS "refundsAfterClose",
      COALESCE((SELECT sum(t.amount) FROM financial_transfers t
        WHERE t.obligation_id=o.id AND t.status='succeeded'),0)::bigint AS "paidToStudio"
     FROM studio_settlement_snapshots snap JOIN bookings b ON b.id=snap.booking_id
     JOIN sessions s ON s.id=snap.session_id JOIN workshops w ON w.id=s.workshop_id
     JOIN studios st ON st.id=w.studio_id
     LEFT JOIN financial_obligations o ON o.booking_id=b.id AND o.kind='studio_payout'
     ORDER BY snap.created_at DESC,snap.booking_id LIMIT 500`,
    ),
  );
  res.json({ items: result.rows });
});

financialLedgerRouter.get('/chuyen-tien', async (req, res) => {
  const view = z.enum(['all', 'queue']).default('all').parse(req.query.view);
  const result = await withTransaction((client) =>
    client.query(
      `SELECT t.id,t.obligation_id AS "obligationId",o.kind,o.booking_id AS "bookingId",
      b.order_code::text AS "orderCode",t.direction,t.purpose,t.amount,t.provider_fee AS "providerFee",
      o.due_at AS "dueAt",
      CASE WHEN o.due_at<clock_timestamp() THEN 'overdue'
           WHEN o.due_at<=clock_timestamp()+interval '1 day' THEN 'due_soon'
           ELSE NULL END AS "dueState",
      t.provider,t.reference,t.status,t.destination_studio_account_id AS "destinationAccountId",
      COALESCE(da.bank_name,ca.bank_bin) AS "destinationBank",
      COALESCE(da.account_holder,ca.account_holder) AS "destinationName",
      COALESCE(da.account_last4,ca.account_last4) AS "destinationLast4",
      CASE WHEN da.id IS NOT NULL THEN da.is_current AND da.status='verified'
           WHEN ca.id IS NOT NULL THEN ca.is_current AND ca.status='verified' AND ca.purged_at IS NULL
           ELSE NULL END AS "destinationValid",
      t.created_by AS "createdBy",t.approved_by AS "approvedBy",
      t.approved_at AS "approvedAt",t.settled_at AS "settledAt",t.failure_reason AS "failureReason",
      t.created_at AS "createdAt"
     FROM financial_transfers t JOIN financial_obligations o ON o.id=t.obligation_id
     LEFT JOIN studio_payout_accounts da ON da.id=t.destination_studio_account_id
     LEFT JOIN customer_refund_accounts ca ON ca.id=t.destination_customer_account_id
     JOIN bookings b ON b.id=o.booking_id
     WHERE ($1::text='all' OR (t.status IN ('pending_approval','approved','processing','manual_review')
       OR (t.status='failed' AND o.status NOT IN ('paid','cancelled')
         AND NOT EXISTS(SELECT 1 FROM financial_transfers newer
           WHERE newer.obligation_id=t.obligation_id AND newer.status<>'failed'
             AND (newer.created_at,newer.id)>(t.created_at,t.id)))))
     ORDER BY CASE WHEN $1::text='queue' THEN o.due_at END ASC NULLS LAST,
       CASE WHEN $1::text='queue' AND t.status='manual_review' THEN 0 ELSE 1 END,
       t.created_at DESC LIMIT 500`,
      [view],
    ),
  );
  res.json({ items: result.rows });
});

financialLedgerRouter.get('/chuyen-tien/:id/lich-su', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const result = await withTransaction(async (client) => {
    const transfer = await client.query(
      `SELECT 1 FROM financial_transfers WHERE id=$1`,
      [id],
    );
    if (!transfer.rowCount)
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy giao dịch.');
    return client.query(
      `SELECT e.id,e.event,e.details,e.created_at AS "createdAt",
         u.full_name AS "actorName"
       FROM financial_transfer_events e LEFT JOIN users u ON u.id=e.actor_id
       WHERE e.transfer_id=$1 ORDER BY e.created_at,e.id`,
      [id],
    );
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ items: result.rows });
});

financialLedgerRouter.get('/tai-khoan-studio', async (_req, res) => {
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

financialLedgerRouter.get(
  '/tai-khoan-studio/:id/so-day-du',
  async (req, res) => {
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
  },
);

financialLedgerRouter.post('/tai-khoan-studio/:id/duyet', async (req, res) => {
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

financialLedgerRouter.get('/tai-khoan-hoan', async (_req, res) => {
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

financialLedgerRouter.get('/tai-khoan-hoan/:id/so-day-du', async (req, res) => {
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

financialLedgerRouter.post('/tai-khoan-hoan/:id/duyet', async (req, res) => {
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

financialLedgerRouter.get('/phi-thu', async (_req, res) => {
  const result = await withTransaction((client) =>
    client.query(
      `SELECT p.id AS "paymentId",p.booking_id AS "bookingId",b.order_code::text AS "orderCode",
      st.id AS "studioId",st.name AS "studioName",w.title AS "workshopTitle",p.amount,p.provider,
      p.provider_ref AS "providerReference",p.paid_at AS "paidAt"
     FROM payments p JOIN bookings b ON b.id=p.booking_id JOIN sessions s ON s.id=b.session_id
     JOIN workshops w ON w.id=s.workshop_id JOIN studios st ON st.id=w.studio_id
     LEFT JOIN payment_fee_reconciliations f ON f.payment_id=p.id
     WHERE p.status='paid' AND p.kind='deposit' AND f.id IS NULL
     ORDER BY p.paid_at NULLS FIRST,p.created_at LIMIT 500`,
    ),
  );
  res.json({ items: result.rows });
});

financialLedgerRouter.post('/payments/:id/phi-thu', async (req, res) => {
  const paymentId = z.uuid().parse(req.params.id);
  const input = z
    .object({
      providerFee: z.number().int().nonnegative(),
      provider: z.string().trim().min(2).max(80),
      providerReference: z.string().trim().min(3).max(200),
      reason: z.string().trim().min(10).max(500),
    })
    .strict()
    .parse(req.body);
  await withTransaction(async (client) => {
    const row = await client.query<{
      bookingId: string;
      studioId: string;
      amount: string;
      provider: string;
      providerReference: string | null;
      paidAt: Date;
    }>(
      `SELECT b.id AS "bookingId",w.studio_id AS "studioId",p.amount::text,p.provider,p.provider_ref AS "providerReference",p.paid_at AS "paidAt"
       FROM payments p JOIN bookings b ON b.id=p.booking_id JOIN sessions s ON s.id=b.session_id JOIN workshops w ON w.id=s.workshop_id
       WHERE p.id=$1 AND p.kind='deposit' AND p.status='paid' FOR UPDATE OF p`,
      [paymentId],
    );
    const payment = row.rows[0];
    if (!payment)
      throw new AppError(
        404,
        'NOT_FOUND',
        'Không tìm thấy khoản cọc đã được xác nhận.',
      );
    if (
      payment.provider !== input.provider ||
      (payment.providerReference &&
        payment.providerReference !== input.providerReference)
    )
      throw new AppError(
        409,
        'CONFLICT',
        'Nhà cung cấp hoặc mã giao dịch không khớp khoản cọc đã nhận.',
      );
    if (!payment.providerReference)
      await client.query(
        `UPDATE payments SET provider_ref=$2 WHERE id=$1 AND provider_ref IS NULL`,
        [paymentId, input.providerReference],
      );
    const duplicate = await client.query(
      `SELECT 1 FROM payment_fee_reconciliations WHERE payment_id=$1`,
      [paymentId],
    );
    if (duplicate.rowCount)
      throw new AppError(
        409,
        'CONFLICT',
        'Phí thực tế của khoản thu này đã được ghi nhận.',
      );
    await client.query(
      `INSERT INTO payment_fee_reconciliations(payment_id,amount,provider,provider_reference,actor_id,reason) VALUES($1,$2,$3,$4,$5,$6)`,
      [
        paymentId,
        input.providerFee,
        input.provider,
        input.providerReference,
        req.user!.sub,
        input.reason,
      ],
    );
    await applySessionFee(
      client,
      payment.bookingId,
      payment.studioId,
      input.providerFee,
      `fee:payment:${paymentId}`,
      `Phí thực tế nhà cung cấp ${input.provider} cho lần thu cọc. Studio chịu khoản phí này.`,
      true,
    );
    await writeAuditLog(client, {
      actorId: req.user!.sub,
      action: 'financial.collection_fee.recorded',
      targetType: 'booking',
      targetId: payment.bookingId,
      targetName: 'Phí thực tế lần thu cọc',
      reason: input.reason,
      after: {
        paymentId,
        provider: input.provider,
        providerReference: input.providerReference,
        providerFee: input.providerFee,
      },
    });
  });
  res.json({ ok: true, providerFee: input.providerFee });
});

financialLedgerRouter.post('/nghia-vu/:id/chuyen-tien', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const input = transferInput.parse(req.body);
  const created = await withTransaction(async (client) => {
    const row = await client.query<{
      kind: string;
      amount: string;
      status: string;
      bookingId: string;
      relatedId: string | null;
    }>(
      `SELECT kind,amount::text,status,booking_id AS "bookingId",related_obligation_id AS "relatedId"
       FROM financial_obligations WHERE id=$1 FOR UPDATE`,
      [id],
    );
    const obligation = row.rows[0];
    if (
      !obligation ||
      ['paid', 'cancelled', 'manual_review'].includes(obligation.status)
    )
      throw new AppError(
        409,
        'CONFLICT',
        'Nghĩa vụ này không còn nhận giao dịch.',
      );
    const direction =
      obligation.kind === 'studio_recovery' ? 'inbound' : 'outbound';
    const purpose =
      input.purpose ??
      (direction === 'inbound'
        ? 'studio_repayment'
        : obligation.kind === 'studio_payout'
          ? 'studio_payout'
          : 'customer_refund');
    const purposeAllowed =
      obligation.kind === 'studio_recovery'
        ? purpose === 'studio_repayment'
        : obligation.kind === 'studio_payout'
          ? purpose === 'studio_payout'
          : purpose === 'customer_refund' || purpose === 'platform_advance';
    if (!purposeAllowed)
      throw new AppError(
        422,
        'UNPROCESSABLE_ENTITY',
        'Loại giao dịch không khớp khoản cần xử lý.',
      );
    const duplicate = await client.query(
      `SELECT 1 FROM financial_transfers WHERE idempotency_key=$1`,
      [input.idempotencyKey],
    );
    if (duplicate.rowCount)
      throw new AppError(
        409,
        'CONFLICT',
        'Mã yêu cầu này đã được ghi nhận. Hãy kiểm tra giao dịch trước khi thử lại.',
      );
    const sum = await client.query<{ settled: string; reserved: string }>(
      `SELECT COALESCE(sum(amount) FILTER (WHERE status='succeeded'),0)::text AS settled,
        COALESCE(sum(amount) FILTER (WHERE status <> 'failed'),0)::text AS reserved
       FROM financial_transfers WHERE obligation_id=$1 AND direction=$2`,
      [id, direction],
    );
    const remaining = BigInt(obligation.amount) - BigInt(sum.rows[0]!.reserved);
    if (BigInt(input.amount) > remaining)
      throw new AppError(
        409,
        'CONFLICT',
        'Số tiền vượt quá khoản còn phải xử lý.',
      );
    if (obligation.kind === 'customer_refund') {
      const funding = await client.query<{ funded: string }>(
        `SELECT COALESCE(sum(t.amount) FILTER(WHERE t.status='succeeded'),0)::text AS funded
         FROM financial_transfers t WHERE t.obligation_id=$1 AND t.direction='inbound'`,
        [obligation.relatedId],
      );
      const payouts = await client.query<{ reserved: string }>(
        `SELECT COALESCE(sum(amount),0)::text AS reserved FROM financial_transfers WHERE obligation_id=$1 AND direction='outbound' AND purpose IN ('customer_refund','platform_advance') AND status<>'failed'`,
        [id],
      );
      if (
        purpose === 'customer_refund' &&
        BigInt(funding.rows[0]!.funded) - BigInt(payouts.rows[0]!.reserved) <
          BigInt(input.amount)
      )
        throw new AppError(
          409,
          'CONFLICT',
          'Studio chưa hoàn đủ tiền về Open Slot cho khoản này.',
        );
      if (purpose === 'platform_advance') {
        const advances = await client.query<{ reserved: string }>(
          `SELECT COALESCE(sum(amount),0)::text AS reserved FROM financial_transfers WHERE obligation_id=$1 AND purpose='platform_advance' AND status<>'failed'`,
          [id],
        );
        if (
          BigInt(obligation.amount) -
            BigInt(funding.rows[0]!.funded) -
            BigInt(advances.rows[0]!.reserved) <
          BigInt(input.amount)
        )
          throw new AppError(
            409,
            'CONFLICT',
            'Khoản tạm ứng vượt phần studio chưa hoàn về.',
          );
      }
    }
    const status = 'pending_approval';
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO financial_transfers(obligation_id,direction,purpose,amount,provider_fee,provider,reference,idempotency_key,status,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        id,
        direction,
        purpose,
        input.amount,
        null,
        input.provider ?? null,
        input.reference ?? null,
        input.idempotencyKey,
        status,
        req.user!.sub,
      ],
    );
    const tid = inserted.rows[0]!.id;
    await client.query(
      `INSERT INTO financial_transfer_events(transfer_id,actor_id,event,details) VALUES($1,$2,'created',$3::jsonb)`,
      [
        tid,
        req.user!.sub,
        JSON.stringify({
          direction,
          purpose,
          amount: input.amount,
          reason: input.reason,
          reference: input.reference ?? null,
        }),
      ],
    );
    await client.query(
      `UPDATE financial_obligations SET status=$2,updated_at=clock_timestamp() WHERE id=$1`,
      [id, 'awaiting_approval'],
    );
    await writeAuditLog(client, {
      actorId: req.user!.sub,
      action: 'financial.transfer.created',
      targetType: 'booking',
      targetId: obligation.bookingId,
      targetName: 'Giao dịch tài chính',
      reason: input.reason,
      after: { transferId: tid, direction, amount: input.amount, status },
    });
    return { id: tid, status };
  });
  res.status(201).json(created);
});

financialLedgerRouter.post('/chuyen-tien/:id/duyet', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const { reason } = z
    .object({ reason: z.string().trim().min(10).max(500) })
    .strict()
    .parse(req.body);

  let isOutbound = false;
  await withTransaction(async (client) => {
    const requested = await client.query<{
      purpose: string;
      studioId: string;
      bookingId: string;
      obligationId: string;
    }>(
      `SELECT t.purpose,o.studio_id AS "studioId",o.booking_id AS "bookingId",o.id AS "obligationId" FROM financial_transfers t
       JOIN financial_obligations o ON o.id=t.obligation_id WHERE t.id=$1 FOR UPDATE OF t`,
      [id],
    );
    if (!requested.rows[0]) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy giao dịch.');
    }
    const purpose = requested.rows[0].purpose;
    isOutbound = ['customer_refund', 'platform_advance', 'studio_payout'].includes(purpose);

    let destinationId: string | null = null;
    let customerDestinationId: string | null = null;
    if (purpose === 'studio_payout') {
      const destination = await client.query<{ id: string }>(
        `SELECT id FROM studio_payout_accounts WHERE studio_id=$1 AND is_current AND status='verified' FOR SHARE`,
        [requested.rows[0].studioId],
      );
      if (!destination.rows[0])
        throw new AppError(
          409,
          'CONFLICT',
          'Studio chưa có tài khoản nhận tiền đã được đối chiếu.',
        );
      destinationId = destination.rows[0].id;
    }
    if (['customer_refund', 'platform_advance'].includes(purpose)) {
      const destination = await client.query<{ id: string }>(
        `SELECT id FROM customer_refund_accounts WHERE refund_id=$1 AND is_current
           AND status='verified' AND purged_at IS NULL FOR SHARE`,
        [requested.rows[0].obligationId],
      );
      if (!destination.rows[0])
        throw new AppError(
          409,
          'CONFLICT',
          'Khách chưa có tài khoản nhận hoàn đã được đối chiếu.',
        );
      customerDestinationId = destination.rows[0].id;
    }
    const result = await client.query<{ bookingId: string; amount: string }>(
      `UPDATE financial_transfers t SET status='approved',approved_by=$2,approved_at=clock_timestamp(),
         destination_studio_account_id=COALESCE($3::uuid,t.destination_studio_account_id),
         destination_customer_account_id=COALESCE($4::uuid,t.destination_customer_account_id)
       FROM financial_obligations o WHERE t.id=$1 AND t.obligation_id=o.id AND t.status='pending_approval'
       RETURNING o.booking_id AS "bookingId",t.amount::text`,
      [id, req.user!.sub, destinationId, customerDestinationId],
    );
    const transfer = result.rows[0];
    if (!transfer)
      throw new AppError(
        409,
        'CONFLICT',
        'Giao dịch không ở trạng thái chờ duyệt.',
      );
    await client.query(
      `INSERT INTO financial_transfer_events(transfer_id,actor_id,event,details) VALUES($1,$2,'approved',$3::jsonb)`,
      [id, req.user!.sub, JSON.stringify({ reason })],
    );
    await client.query(
      `UPDATE financial_obligations SET status='approved',updated_at=clock_timestamp() WHERE id=(SELECT obligation_id FROM financial_transfers WHERE id=$1)`,
      [id],
    );
    await writeAuditLog(client, {
      actorId: req.user!.sub,
      action: 'financial.transfer.approved',
      targetType: 'booking',
      targetId: transfer.bookingId,
      targetName: 'Duyệt giao dịch chi',
      reason,
      after: { transferId: id, amount: transfer.amount },
    });
  });

  if (loadConfig().PAYOUT_PROVIDER !== 'manual' && isOutbound) {
    const refundNotice: {
      value?: { bookingId: string; amount: string; reference?: string };
    } = {};
    const payoutResult = await executeAutomatedPayoutTransfer(id, req.user!.sub, refundNotice);
    if (refundNotice.value) {
      queueRefundEmail(
        refundNotice.value.bookingId,
        id,
        refundNotice.value.amount,
        refundNotice.value.reference,
      );
    }
    return res.json({
      ok: true,
      status: payoutResult.status,
      reference: payoutResult.reference,
      errorMessage: payoutResult.errorMessage,
    });
  }

  res.json({ ok: true, status: 'approved' });
});

financialLedgerRouter.post(
  '/chuyen-tien/:id/ghi-nhan-ket-qua',
  async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const input = z
      .object({
        result: z.enum(['succeeded', 'failed', 'manual_review']),
        reference: z.string().trim().min(3).max(200).optional(),
        provider: z.string().trim().min(2).max(80).optional(),
        providerFee: z.number().int().nonnegative().optional(),
        reason: z.string().trim().min(10).max(500),
      })
      .strict()
      .refine(
        (v) =>
          v.result !== 'succeeded' ||
          Boolean(v.reference && v.provider && v.providerFee !== undefined),
        {
          message:
            'Giao dịch thành công cần mã đối chiếu, nhà cung cấp và phí thực tế.',
        },
      )
      .parse(req.body);
    const refundNotice: {
      value?: { bookingId: string; amount: string; reference?: string };
    } = {};
    await withTransaction(async (client) => {
      await processTransferResult(
        client,
        id,
        req.user!.sub,
        input,
        refundNotice,
      );
    });
    if (refundNotice.value)
      queueRefundEmail(
        refundNotice.value.bookingId,
        id,
        refundNotice.value.amount,
        refundNotice.value.reference,
      );
    res.json({ ok: true, status: input.result });
  },
);

financialLedgerRouter.post(
  '/chuyen-tien/:id/dong-bo-payout',
  async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const provider = createPayoutProvider();
    const transferRes = await getPool().query<{
      status: string;
      reference: string | null;
      purpose: string;
    }>(
      `SELECT status, reference, purpose FROM financial_transfers WHERE id = $1`,
      [id],
    );
    const transfer = transferRes.rows[0];
    if (!transfer) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy giao dịch.');
    }
    if (!['processing', 'manual_review', 'approved'].includes(transfer.status)) {
      return res.json({
        ok: true,
        status: transfer.status,
        message: 'Giao dịch đã ở trạng thái kết thúc, không cần đồng bộ.',
      });
    }

    const syncRef = transfer.reference ?? id;
    const remote = await provider.getPayout(syncRef);
    if (remote.status === 'succeeded' || remote.status === 'failed') {
      const refundNotice: {
        value?: { bookingId: string; amount: string; reference?: string };
      } = {};
      await withTransaction(async (client) => {
        await processTransferResult(
          client,
          id,
          req.user!.sub,
          {
            result: remote.status as 'succeeded' | 'failed',
            reference: remote.reference,
            provider: loadConfig().PAYOUT_PROVIDER,
            providerFee: remote.providerFee,
            reason:
              remote.status === 'succeeded'
                ? 'Đồng bộ kết quả thành công từ payOS'
                : remote.failureReason || 'Đồng bộ kết quả thất bại từ payOS',
          },
          refundNotice,
        );
      });
      if (refundNotice.value) {
        queueRefundEmail(
          refundNotice.value.bookingId,
          id,
          refundNotice.value.amount,
          refundNotice.value.reference,
        );
      }
    }

    res.json({
      ok: true,
      status: remote.status,
      reference: remote.reference,
      providerFee: remote.providerFee,
      failureReason: remote.failureReason,
    });
  },
);
