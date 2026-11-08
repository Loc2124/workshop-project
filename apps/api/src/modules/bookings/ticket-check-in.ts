import { query } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import { markTicketAttendance } from './ticket-attendance.js';

const ticketCodePattern = /^[A-Za-z0-9_-]{24}$/;

export function parseTicketCode(value: string): string {
  const code = value.trim().replace(/^OS-TICKET:/i, '');
  if (!ticketCodePattern.test(code))
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      'Mã vé tham gia không hợp lệ.',
    );
  return code;
}

export async function findTicketForCheckIn(
  studioId: string,
  userId: string,
  suppliedCode: string,
) {
  const code = parseTicketCode(suppliedCode);
  const result = await query<{
    ticketId: string;
    bookingId: string;
    ticketNumber: number;
    version: number;
    ticketStatus: string;
    attendanceStatus: string;
    checkedInAt: Date | null;
    checkedInBy: string | null;
    workshopTitle: string;
    startsAt: Date;
    endsAt: Date;
    customerName: string;
    quantity: number;
    checkedInCount: number;
    remainingAmount: number;
    paymentStatus: string;
    reservationStatus: string;
    sessionStatus: string;
    reschedulePending: boolean;
    serverNow: Date;
  }>(
    `SELECT t.id AS "ticketId",b.id AS "bookingId",t.seq AS "ticketNumber",
       t.version,t.status AS "ticketStatus",t.attendance_status AS "attendanceStatus",
       t.attendance_marked_at AS "checkedInAt",marker.full_name AS "checkedInBy",
       w.title AS "workshopTitle",s.starts_at AS "startsAt",s.ends_at AS "endsAt",
       COALESCE(b.contact_name,customer.full_name) AS "customerName",b.quantity,
       (SELECT count(*)::integer FROM tickets checked WHERE checked.booking_id=b.id
         AND checked.attendance_status='attended' AND checked.status<>'void') AS "checkedInCount",
       GREATEST(0,b.total_amount-b.paid_amount) AS "remainingAmount",
       b.status AS "paymentStatus",b.reservation_status AS "reservationStatus",
       s.status AS "sessionStatus",b.reschedule_pending AS "reschedulePending",
       clock_timestamp() AS "serverNow"
     FROM tickets t JOIN bookings b ON b.id=t.booking_id
       JOIN users customer ON customer.id=b.user_id
       JOIN sessions s ON s.id=b.session_id JOIN workshops w ON w.id=s.workshop_id
       LEFT JOIN users marker ON marker.id=t.attendance_marked_by
     WHERE t.code=$1 AND w.studio_id=$2
       AND EXISTS(SELECT 1 FROM studio_members m WHERE m.studio_id=$2 AND m.user_id=$3)`,
    [code, studioId, userId],
  );
  const ticket = result.rows[0];
  if (!ticket)
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy vé tại studio này.');
  const canCheckIn =
    ticket.ticketStatus === 'valid' &&
    ticket.attendanceStatus === 'unmarked' &&
    ['confirmed', 'completed'].includes(ticket.reservationStatus) &&
    ticket.sessionStatus === 'scheduled' &&
    !ticket.reschedulePending &&
    ticket.serverNow.getTime() >= ticket.startsAt.getTime();
  return { ...ticket, canCheckIn };
}

export async function confirmTicketCheckIn(
  studioId: string,
  userId: string,
  suppliedCode: string,
  expectedVersion: number,
) {
  const ticket = await findTicketForCheckIn(studioId, userId, suppliedCode);
  if (!ticket.canCheckIn)
    throw new AppError(
      409,
      'CONFLICT',
      ticket.attendanceStatus === 'attended'
        ? 'Vé đã check-in trước đó.'
        : 'Vé chưa đủ điều kiện check-in.',
    );
  await markTicketAttendance(
    ticket.bookingId,
    ticket.ticketId,
    userId,
    { status: 'attended', expectedVersion, checkInOnly: true },
    studioId,
  );
  return findTicketForCheckIn(studioId, userId, suppliedCode);
}
