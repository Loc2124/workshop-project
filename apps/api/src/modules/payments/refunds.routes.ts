import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import { writeAuditLog } from '../admin/audit-log.js';

export const refundRouter = Router();
refundRouter.use('/studios/:studioId/refund-obligations', requireAuth());
refundRouter.use('/studios/:studioId/bookings/:id/refund', requireAuth());

refundRouter.get(
  '/studios/:studioId/refund-obligations',
  validateUuidParam('studioId'),
  async (req, res) => {
    const rows = await withTransaction(async (client) => {
      const owner = await client.query(
        `SELECT 1 FROM studio_members WHERE studio_id=$1 AND user_id=$2 AND role='owner'`,
        [req.params.studioId, req.user!.sub],
      );
      if (!owner.rowCount)
        throw new AppError(
          403,
          'FORBIDDEN',
          'Chỉ chủ studio mới xem được các khoản này.',
        );
      return client.query(
        `SELECT o.id,o.booking_id AS "bookingId",b.order_code::text AS "orderCode",u.full_name AS "customerName",
        w.title AS "workshopTitle",t.seq AS "ticketNumber",o.amount,
        COALESCE((SELECT sum(x.amount) FROM financial_transfers x WHERE x.obligation_id=o.id AND x.direction='inbound' AND x.status='succeeded'),0)::bigint AS "receivedAmount",
        o.due_at AS "dueAt",o.status,
        COALESCE(x.reason,CASE WHEN t.attendance_status='absent' THEN 'Khách vắng mặt: hoàn phần đã trả vượt tiền cọc'
          WHEN t.status='void' THEN 'Vé đã hủy: xử lý khoản hoàn theo chính sách đặt chỗ'
          ELSE 'Khoản hoàn theo chính sách đặt chỗ' END) AS reason
       FROM financial_obligations o JOIN bookings b ON b.id=o.booking_id JOIN users u ON u.id=b.user_id
       JOIN sessions s ON s.id=b.session_id JOIN workshops w ON w.id=s.workshop_id
       LEFT JOIN tickets t ON t.id=o.ticket_id
       LEFT JOIN booking_extra_refunds x ON o.source_key='extra:'||x.id::text AND x.booking_id=o.booking_id
       WHERE o.studio_id=$1 AND o.kind='studio_recovery' AND o.status NOT IN ('paid','cancelled')
       ORDER BY o.due_at NULLS LAST,o.created_at`,
        [req.params.studioId],
      );
    });
    res.json({ items: rows.rows });
  },
);

refundRouter.post(
  '/studios/:studioId/refund-obligations/:id/repayment',
  validateUuidParam('studioId'),
  validateUuidParam('id'),
  async (req, res) => {
    const input = z
      .object({
        amount: z.number().int().positive(),
        provider: z.string().trim().min(2).max(80),
        reference: z.string().trim().min(3).max(200),
        idempotencyKey: z.string().trim().min(8).max(120),
        reason: z.string().trim().min(10).max(500),
      })
      .strict()
      .parse(req.body);
    const transfer = await withTransaction(async (client) => {
      const row = await client.query<{
        bookingId: string;
        amount: string;
        status: string;
        studioId: string;
      }>(
        `SELECT o.booking_id AS "bookingId",o.amount::text,o.status,o.studio_id AS "studioId"
       FROM financial_obligations o JOIN studio_members m ON m.studio_id=o.studio_id
       WHERE o.id=$1 AND o.studio_id=$2 AND o.kind='studio_recovery' AND m.user_id=$3 AND m.role='owner' FOR UPDATE OF o`,
        [req.params.id, req.params.studioId, req.user!.sub],
      );
      const obligation = row.rows[0];
      if (!obligation)
        throw new AppError(
          404,
          'NOT_FOUND',
          'Không tìm thấy khoản studio cần hoàn.',
        );
      if (['paid', 'cancelled', 'manual_review'].includes(obligation.status))
        throw new AppError(
          409,
          'CONFLICT',
          'Khoản này đang được đối soát hoặc đã xử lý xong.',
        );
      const duplicate = await client.query(
        `SELECT 1 FROM financial_transfers WHERE idempotency_key=$1`,
        [input.idempotencyKey],
      );
      if (duplicate.rowCount)
        throw new AppError(
          409,
          'CONFLICT',
          'Yêu cầu này đã được gửi. Vui lòng tải lại danh sách.',
        );
      const reserved = await client.query<{ amount: string }>(
        `SELECT COALESCE(sum(amount),0)::text AS amount FROM financial_transfers WHERE obligation_id=$1 AND direction='inbound' AND status<>'failed'`,
        [req.params.id],
      );
      if (
        BigInt(reserved.rows[0]!.amount) + BigInt(input.amount) >
        BigInt(obligation.amount)
      )
        throw new AppError(
          409,
          'CONFLICT',
          'Số tiền vượt quá khoản studio còn cần hoàn.',
        );
      const created = await client.query<{ id: string }>(
        `INSERT INTO financial_transfers(obligation_id,direction,purpose,amount,provider,reference,idempotency_key,status,created_by)
       VALUES($1,'inbound','studio_repayment',$2,$3,$4,$5,'pending_approval',$6) RETURNING id`,
        [
          req.params.id,
          input.amount,
          input.provider,
          input.reference,
          input.idempotencyKey,
          req.user!.sub,
        ],
      );
      const id = created.rows[0]!.id;
      await client.query(
        `INSERT INTO financial_transfer_events(transfer_id,actor_id,event,details) VALUES($1,$2,'created',$3::jsonb)`,
        [
          id,
          req.user!.sub,
          JSON.stringify({
            amount: input.amount,
            provider: input.provider,
            reference: input.reference,
            reason: input.reason,
            source: 'studio-repayment-claim',
          }),
        ],
      );
      await client.query(
        `UPDATE financial_obligations SET status='awaiting_approval',updated_at=clock_timestamp() WHERE id=$1`,
        [req.params.id],
      );
      await writeAuditLog(client, {
        actorId: req.user!.sub,
        action: 'financial.studio_repayment.submitted',
        targetType: 'booking',
        targetId: obligation.bookingId,
        targetName: 'Studio gửi xác nhận hoàn tiền về Open Slot',
        reason: input.reason,
        after: {
          transferId: id,
          amount: input.amount,
          provider: input.provider,
          reference: input.reference,
        },
      });
      return { id, status: 'pending_approval' };
    });
    res.status(201).json(transfer);
  },
);

// The former studio-to-customer receipt endpoint is intentionally disabled;
// only a verified inbound repayment and an approved platform payout settle a refund.
refundRouter.post(
  '/studios/:studioId/bookings/:id/refund',
  validateUuidParam('studioId'),
  validateUuidParam('id'),
  async () => {
    throw new AppError(
      409,
      'CONFLICT',
      'Studio chuyển khoản hoàn về Open Slot trước. Quản trị sẽ đối soát rồi chuyển tiền cho khách.',
    );
  },
);
