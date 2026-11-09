import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import { writeAuditLog } from '../admin/audit-log.js';
import { expireScheduleResponses } from './schedule-changes.js';

export type TicketAttendanceInput = {
  status: 'attended' | 'absent';
  expectedVersion?: number;
  reason?: string;
  refundAction?: 'preserve' | 'cancel_pending';
  checkInOnly?: boolean;
};
export async function listAttendanceTickets(
  bookingId: string,
  userId: string,
  studioId?: string,
  admin = false,
) {
  const allowed = await query(
    `SELECT 1 FROM bookings b JOIN sessions s ON s.id=b.session_id JOIN workshops w ON w.id=s.workshop_id
    WHERE b.id=$1 AND ($4::boolean OR (w.studio_id=$3::uuid AND EXISTS(SELECT 1 FROM studio_members m WHERE m.studio_id=w.studio_id AND m.user_id=$2)))`,
    [bookingId, userId, studioId ?? null, admin],
  );
  if (!allowed.rowCount)
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đặt chỗ.');
  const result = await query(
    `SELECT t.id,t.seq,t.status,t.attendance_status AS "attendanceStatus",t.attendance_method AS "attendanceMethod",t.attendance_marked_at AS "attendanceMarkedAt",
    t.version,t.total_amount AS "totalAmount",t.deposit_amount AS "depositAmount",t.paid_amount AS "paidAmount",
    t.refund_due_amount AS "refundDueAmount",t.refunded_amount AS "refundedAmount",t.refund_history_locked AS "refundHistoryLocked",
    s.starts_at AS "startsAt",s.ends_at AS "endsAt",clock_timestamp() AS "serverNow",
    (s.status<>'cancelled' AND NOT b.reschedule_pending AND b.reservation_status IN ('confirmed','completed') AND t.status<>'void') AS "canMark"
    FROM tickets t JOIN bookings b ON b.id=t.booking_id JOIN sessions s ON s.id=b.session_id WHERE b.id=$1 ORDER BY t.seq`,
    [bookingId],
  );
  return result.rows;
}

export async function markTicketAttendance(
  bookingId: string,
  ticketId: string | null,
  userId: string,
  input: TicketAttendanceInput,
  studioId?: string,
  admin = false,
) {
  const outcome = await withTransaction(async (client) => {
    const owned = await client.query<{ sessionId: string }>(
      `SELECT b.session_id AS "sessionId" FROM bookings b JOIN sessions s ON s.id=b.session_id JOIN workshops w ON w.id=s.workshop_id
      WHERE b.id=$1 AND ($4::boolean OR (w.studio_id=$3::uuid AND EXISTS(SELECT 1 FROM studio_members m WHERE m.studio_id=w.studio_id AND m.user_id=$2)))`,
      [bookingId, userId, studioId ?? null, admin],
    );
    const sessionId = owned.rows[0]?.sessionId;
    if (!sessionId)
      return {
        error: new AppError(404, 'NOT_FOUND', 'Không tìm thấy đặt chỗ.'),
      };
    await client.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE', [
      sessionId,
    ]);
    await expireScheduleResponses(client, [sessionId]);
    const booking = (
      await client.query<{
        reservationStatus: string;
        reschedulePending: boolean;
        sessionStatus: string;
        startsAt: Date;
        endsAt: Date;
        now: Date;
        quantity: number;
      }>(
        `SELECT b.reservation_status AS "reservationStatus",b.reschedule_pending AS "reschedulePending",b.quantity,s.status AS "sessionStatus",s.starts_at AS "startsAt",s.ends_at AS "endsAt",clock_timestamp() AS now
       FROM bookings b JOIN sessions s ON s.id=b.session_id WHERE b.id=$1 FOR UPDATE OF b`,
        [bookingId],
      )
    ).rows[0]!;
    if (
      !['confirmed', 'completed'].includes(booking.reservationStatus) ||
      booking.reschedulePending ||
      booking.sessionStatus === 'cancelled'
    )
      return {
        error: new AppError(
          409,
          'CONFLICT',
          'Chỉ điểm danh vé còn hiệu lực và đã đồng ý giờ học hiện tại.',
        ),
      };
    const now = booking.now.getTime(),
      start = booking.startsAt.getTime();
    const end = booking.endsAt.getTime();
    if (
      now < start ||
      (input.checkInOnly && now >= end) ||
      (input.status === 'absent' && now < start + 30 * 60000)
    )
      return {
        error: new AppError(
          409,
          'CONFLICT',
          input.status === 'absent'
            ? 'Chỉ ghi nhận vắng mặt từ 30 phút sau giờ bắt đầu.'
            : 'Chỉ ghi nhận đã đến từ giờ bắt đầu buổi học.',
        ),
      };
    if (
      input.status === 'attended' &&
      !input.checkInOnly &&
      now >= end &&
      (!input.reason?.trim() || input.reason.trim().length < 3)
    )
      return {
        error: new AppError(
          422,
          'UNPROCESSABLE_ENTITY',
          'Vui lòng nhập lý do xác nhận tham dự thủ công (ít nhất 3 ký tự).',
        ),
      };
    if (!ticketId && booking.quantity !== 1)
      return {
        error: new AppError(
          409,
          'CONFLICT',
          'Vui lòng ghi nhận tham dự cho từng vé.',
        ),
      };
    const ticket = (
      await client.query<{
        id: string;
        seq: number;
        status: string;
        attendanceStatus: string;
        version: number;
        paid: number;
        deposit: number;
        refundDue: number;
        refunded: number;
        refundHistoryLocked: boolean;
      }>(
        `SELECT id,seq,status,attendance_status AS "attendanceStatus",version,paid_amount AS paid,deposit_amount AS deposit,refund_due_amount AS "refundDue",refunded_amount AS refunded,refund_history_locked AS "refundHistoryLocked"
       FROM tickets WHERE booking_id=$1 AND ($2::uuid IS NULL OR id=$2) ORDER BY seq FOR UPDATE`,
        [bookingId, ticketId],
      )
    ).rows[0];
    if (!ticket || ticket.status === 'void')
      return {
        error: new AppError(
          409,
          'CONFLICT',
          'Vé không còn hiệu lực để điểm danh.',
        ),
      };
    if (input.checkInOnly && ticket.attendanceStatus !== 'unmarked')
      return {
        error: new AppError(
          409,
          'CONFLICT',
          'Vé đã được điểm danh. Vui lòng tải lại thông tin vé.',
        ),
      };
    if (ticket.attendanceStatus === input.status)
      return { ticketId: ticket.id, alreadyRecorded: true };
    if (ticket.refundHistoryLocked && !admin)
      return {
        error: new AppError(
          409,
          'CONFLICT',
          'Vé đã phát sinh khoản hoàn. Vui lòng liên hệ quản trị để điều chỉnh điểm danh.',
        ),
      };
    if (
      input.expectedVersion !== undefined &&
      input.expectedVersion !== ticket.version
    )
      return {
        error: new AppError(
          409,
          'CONFLICT',
          'Thông tin vé đã thay đổi. Vui lòng xem lại trước khi xác nhận.',
        ),
      };
    if (
      admin &&
      (!input.reason?.trim() ||
        (ticket.refundHistoryLocked &&
          input.status === 'attended' &&
          !input.refundAction))
    )
      return {
        error: new AppError(
          422,
          'UNPROCESSABLE_ENTITY',
          'Vui lòng ghi lý do và chọn cách xử lý khoản hoàn.',
        ),
      };
    if (input.refundAction === 'cancel_pending' && input.status !== 'attended')
      return {
        error: new AppError(
          422,
          'UNPROCESSABLE_ENTITY',
          'Chỉ dừng khoản hoàn khi điều chỉnh vé thành đã đến.',
        ),
      };
    if (input.refundAction === 'cancel_pending' && ticket.refunded > 0)
      return {
        error: new AppError(
          409,
          'CONFLICT',
          'Khoản hoàn đã được ghi nhận chuyển cho khách. Không thể xóa khoản này; cần đối soát riêng.',
        ),
      };
    const due =
      input.refundAction === 'cancel_pending'
        ? 0
        : Math.max(
            ticket.refundDue,
            input.status === 'absent'
              ? Math.max(0, ticket.paid - ticket.deposit)
              : 0,
          );
    await client.query(
      `UPDATE tickets SET attendance_status=$2,attendance_method=CASE WHEN $2='attended' THEN CASE WHEN $5::boolean THEN 'check_in' ELSE 'manual_confirmation' END ELSE NULL END,attendance_marked_by=$3,attendance_marked_at=clock_timestamp(),
      status=CASE WHEN $2='attended' THEN 'used'::ticket_status ELSE 'valid'::ticket_status END,
      checked_in_at=CASE WHEN $2='attended' THEN COALESCE(checked_in_at,clock_timestamp()) ELSE checked_in_at END,
      refund_due_amount=$4,refund_history_locked=refund_history_locked OR $4>0,
      refund_started_at=CASE WHEN $4>0 THEN COALESCE(refund_started_at,clock_timestamp()) ELSE refund_started_at END WHERE id=$1`,
      [ticket.id, input.status, userId, due, input.checkInOnly ?? false],
    );
    await client.query(
      "SELECT set_config('app.booking_actor',$1,true),set_config('app.booking_reason',$2,true)",
      [
        userId,
        input.reason ??
          `Studio ghi nhận vé số ${ticket.seq} ${input.status === 'attended' ? 'đã đến' : 'vắng mặt'}.`,
      ],
    );
    await client.query(
      `WITH totals AS (
      SELECT count(*) FILTER(WHERE status<>'void') AS total,count(*) FILTER(WHERE status<>'void' AND attendance_status='attended') AS attended,
        count(*) FILTER(WHERE status<>'void' AND attendance_status='absent') AS absent,COALESCE(sum(refund_due_amount),0)::integer AS due
      FROM tickets WHERE booking_id=$1)
      UPDATE bookings b SET attendance_status=CASE WHEN a.attended=a.total AND a.total>0 THEN 'attended' WHEN a.absent=a.total AND a.total>0 THEN 'absent' ELSE 'unmarked' END,
        attendance_marked_by=$2,attendance_marked_at=clock_timestamp(),
        reservation_status=CASE WHEN a.attended=a.total AND a.total>0 THEN 'completed' ELSE 'confirmed' END,
      refund_due_amount=a.due,refund_status=CASE WHEN a.due+b.extra_refund_due_amount>b.refunded_amount+b.extra_refunded_amount THEN 'pending' WHEN a.due+b.extra_refund_due_amount>0 THEN 'refunded' WHEN a.absent>0 AND b.paid_amount>0 AND b.deposit_amount>0 THEN 'forfeited' ELSE 'not_applicable' END
      FROM totals a WHERE b.id=$1`,
      [bookingId, userId],
    );
    await writeAuditLog(client, {
      actorId: userId,
      action: admin
        ? 'ticket.attendance.corrected'
        : 'ticket.attendance.updated',
      targetType: 'ticket',
      targetId: ticket.id,
      targetName: `Vé số ${ticket.seq}`,
      reason: input.reason,
      before: ticket,
      after: {
        status: input.status,
        refundDueAmount: due,
        refundAction: input.refundAction ?? 'preserve',
      },
    });
    if (due > ticket.refundDue) {
      await client.query(
        `INSERT INTO user_notifications(user_id,booking_id,type,title,body,href) SELECT user_id,id,'absence_refund_needed','Đã ghi nhận khoản cần hoàn',$2,'/me/bookings/'||id::text FROM bookings WHERE id=$1`,
        [
          bookingId,
          `Vé số ${ticket.seq} được ghi nhận vắng mặt. Phần tiền đã trả vượt cọc là ${(due - ticket.refundDue).toLocaleString('vi-VN')} đ sẽ được hoàn trong tối đa 7 ngày làm việc.`,
        ],
      );
    }
    return { ticketId: ticket.id, alreadyRecorded: false };
  });
  if ('error' in outcome) throw outcome.error;
  return outcome;
}
