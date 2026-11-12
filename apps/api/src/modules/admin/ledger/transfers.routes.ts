import { Router } from 'express';
import { z } from 'zod';
import { getPool, withTransaction } from '../../../db/pool.js';
import { loadConfig } from '../../../config.js';
import { AppError } from '../../../errors/app-error.js';
import { writeAuditLog } from '../audit-log.js';
import { queueRefundEmail } from '../../../services/booking-emails.js';
import { createPayoutProvider } from '../../payments/providers/index.js';
import {
  processTransferResult,
  executeAutomatedPayoutTransfer,
} from '../../payments/transfer-execution.js';

export const transfersRouter = Router();

transfersRouter.get('/chuyen-tien', async (req, res) => {
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

transfersRouter.get('/chuyen-tien/:id/lich-su', async (req, res) => {
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

transfersRouter.post('/chuyen-tien/:id/duyet', async (req, res) => {
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
    isOutbound = [
      'customer_refund',
      'platform_advance',
      'studio_payout',
    ].includes(purpose);

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
    const payoutResult = await executeAutomatedPayoutTransfer(
      id,
      req.user!.sub,
      refundNotice,
    );
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

transfersRouter.post('/chuyen-tien/:id/ghi-nhan-ket-qua', async (req, res) => {
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
    await processTransferResult(client, id, req.user!.sub, input, refundNotice);
  });
  if (refundNotice.value)
    queueRefundEmail(
      refundNotice.value.bookingId,
      id,
      refundNotice.value.amount,
      refundNotice.value.reference,
    );
  res.json({ ok: true, status: input.result });
});

transfersRouter.post('/chuyen-tien/:id/dong-bo-payout', async (req, res) => {
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
});
