import { Router } from 'express';
import { z } from 'zod';
import { withTransaction } from '../../../db/pool.js';
import { AppError } from '../../../errors/app-error.js';
import { writeAuditLog } from '../audit-log.js';
import { applySessionFee } from '../../payments/transfer-execution.js';

export const feesRouter = Router();

feesRouter.get('/phi-thu', async (_req, res) => {
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

feesRouter.get('/phi-thu-can-ghi-nhan', async (_req, res) => {
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

async function handlePaymentFee(
  paymentId: string,
  actorId: string,
  rawBody: unknown,
) {
  const body = (rawBody ?? {}) as Record<string, unknown>;
  const input = z
    .object({
      providerFee: z.number().int().nonnegative(),
      provider: z.string().trim().min(2).max(80),
      providerReference: z.string().trim().min(3).max(200),
      reason: z.string().trim().min(10).max(500),
    })
    .strict()
    .parse({
      providerFee:
        body.providerFee !== undefined
          ? Number(body.providerFee)
          : Number(body.fee),
      provider: body.provider,
      providerReference: body.providerReference ?? body.reference,
      reason:
        body.reason ??
        'Đối chiếu phí thực tế với báo cáo giao dịch của nhà cung cấp.',
    });

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
        actorId,
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
      actorId,
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

  return input.providerFee;
}

feesRouter.post('/payments/:id/phi-thu', async (req, res) => {
  const paymentId = z.uuid().parse(req.params.id);
  const providerFee = await handlePaymentFee(
    paymentId,
    req.user!.sub,
    req.body,
  );
  res.json({ ok: true, providerFee });
});

feesRouter.post('/phi-thu/:paymentId', async (req, res) => {
  const paymentId = z.uuid().parse(req.params.paymentId);
  const providerFee = await handlePaymentFee(
    paymentId,
    req.user!.sub,
    req.body,
  );
  res.json({ ok: true, providerFee });
});
