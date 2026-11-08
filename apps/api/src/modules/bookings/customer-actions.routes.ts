import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import { expireScheduleResponses } from './schedule-changes.js';
import { releaseUnconfirmedBookings } from './attendance-confirmation.js';

export const bookingActionsRouter = Router();
const acceptScheduleSchema = z
  .object({ scheduleVersion: z.number().int().positive() })
  .strict();

bookingActionsRouter.post(
  '/bookings/:id/accept-schedule',
  requireAuth(['customer']),
  validateUuidParam('id'),
  async (req, res) => {
    const input = acceptScheduleSchema.parse(req.body);
    const result = await withTransaction(async (client) => {
      const lookup = await client.query<{ sessionId: string }>(
        'SELECT session_id AS "sessionId" FROM bookings WHERE id=$1 AND user_id=$2',
        [req.params.id, req.user!.sub],
      );
      if (!lookup.rows[0]) return 'not_found';
      const sessionId = lookup.rows[0].sessionId;
      await client.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE', [
        sessionId,
      ]);
      // Commit expiration even if this late acceptance is rejected.
      await expireScheduleResponses(client, [sessionId]);
      const updated = await client.query(
        `UPDATE bookings b SET reschedule_pending=false,schedule_version=s.schedule_version,
        booked_starts_at=s.starts_at,booked_ends_at=s.ends_at,schedule_accepted_at=clock_timestamp()
       FROM sessions s WHERE b.id=$1 AND b.user_id=$2 AND s.id=b.session_id
        AND b.reservation_status='confirmed' AND b.status IN ('pending','paid') AND s.status='scheduled' AND s.starts_at>clock_timestamp()
        AND s.schedule_version=$3 AND b.reschedule_pending AND b.proposed_schedule_version=$3 AND b.reschedule_deadline>clock_timestamp()
       RETURNING b.id`,
        [req.params.id, req.user!.sub, input.scheduleVersion],
      );
      if (!updated.rowCount) {
        await expireScheduleResponses(client, [sessionId]);
        const already = await client.query(
          `SELECT 1 FROM bookings b JOIN sessions s ON s.id=b.session_id
        WHERE b.id=$1 AND b.user_id=$2 AND b.reservation_status='confirmed' AND NOT b.reschedule_pending
          AND b.schedule_version=$3 AND s.schedule_version=$3 AND s.status='scheduled' AND s.starts_at>clock_timestamp()
          AND EXISTS (SELECT 1 FROM booking_schedule_acceptances a WHERE a.booking_id=b.id AND a.schedule_version=$3)`,
          [req.params.id, req.user!.sub, input.scheduleVersion],
        );
        return already.rowCount ? 'accepted' : 'conflict';
      }
      await client.query(
        `INSERT INTO booking_schedule_acceptances(booking_id,schedule_version,user_id,starts_at,ends_at)
      SELECT id,schedule_version,user_id,booked_starts_at,booked_ends_at FROM bookings WHERE id=$1 ON CONFLICT DO NOTHING`,
        [req.params.id],
      );
      await client.query(
        `UPDATE email_outbox SET status='cancelled' WHERE booking_id=$1 AND delivery_type='schedule_change' AND status IN ('pending','failed')`,
        [req.params.id],
      );
      return 'accepted';
    });
    if (result === 'not_found')
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đặt chỗ.');
    if (result === 'conflict')
      throw new AppError(
        409,
        'CONFLICT',
        'Giờ học hoặc hạn phản hồi đã thay đổi. Vui lòng xem lại đặt chỗ trước khi xác nhận.',
      );
    res.json({ ok: true });
  },
);

bookingActionsRouter.post(
  '/bookings/:id/confirm-attendance',
  requireAuth(['customer']),
  validateUuidParam('id'),
  async (req, res) => {
    const result = await withTransaction(async (client) => {
      const lookup = await client.query<{ sessionId: string }>(
        'SELECT session_id AS "sessionId" FROM bookings WHERE id=$1 AND user_id=$2',
        [req.params.id, req.user!.sub],
      );
      if (!lookup.rows[0]) return 'not_found';
      await client.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE', [
        lookup.rows[0].sessionId,
      ]);
      await expireScheduleResponses(client, [lookup.rows[0].sessionId]);
      await releaseUnconfirmedBookings(client, [lookup.rows[0].sessionId]);
      const updated = await client.query(
        `UPDATE bookings b SET attendance_confirmed_at=COALESCE(attendance_confirmed_at,clock_timestamp()) FROM sessions s
      WHERE b.id=$1 AND b.user_id=$2 AND s.id=b.session_id AND b.reservation_status='confirmed' AND NOT b.reschedule_pending
        AND s.status='scheduled' AND s.starts_at>clock_timestamp() AND b.payment_mode<>'payos_deposit'
        RETURNING b.id`,
        [req.params.id, req.user!.sub],
      );
      return updated.rowCount ? 'confirmed' : 'conflict';
    });
    if (result === 'not_found')
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đặt chỗ.');
    if (result === 'conflict')
      throw new AppError(
        409,
        'CONFLICT',
        'Đặt chỗ đã thay đổi. Vui lòng xem lại trạng thái.',
      );
    res.json({ ok: true });
  },
);
