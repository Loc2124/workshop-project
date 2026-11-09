import type { PoolClient } from 'pg';
import { calculateDeposit } from '@workshop/shared';
import { AppError } from '../../errors/app-error.js';
import { query, withTransaction } from '../../db/pool.js';
import { releaseExpiredHolds } from '../bookings/bookings.repository.js';
import { loadConfig } from '../../config.js';
import {
  cancelChangedScheduleBookings,
  expireScheduleResponses,
  scheduleResponseDeadline,
} from '../bookings/schedule-changes.js';
import type { SessionInput, SessionUpdate } from './sessions.schemas.js';

export type SessionRow = {
  id: string;
  workshopId: string;
  workshopTitle?: string;
  startsAt: string;
  endsAt: string;
  price: number;
  capacity: number;
  seatsHeld: number;
  seatsSold: number;
  status: 'scheduled' | 'cancelled' | 'completed';
  registrationDeadline: string | null;
  scheduleVersion: number;
  createdAt: string;
};

export async function listStudioSessions(
  studioId: string,
  userId: string,
): Promise<SessionRow[] | null> {
  const membership = await query(
    `SELECT 1
     FROM studio_members
     WHERE studio_id = $1 AND user_id = $2`,
    [studioId, userId],
  );
  if (!membership.rowCount) return null;

  const result = await query<SessionRow>(
    `SELECT
       s.id,
       s.workshop_id AS "workshopId",
       w.title AS "workshopTitle",
       s.starts_at AS "startsAt",
       s.ends_at AS "endsAt",
       s.price,
       s.capacity,
       s.seats_held AS "seatsHeld",
       s.seats_sold AS "seatsSold",
       s.status,
       s.registration_deadline AS "registrationDeadline",
       s.schedule_version AS "scheduleVersion",
       s.created_at AS "createdAt"
     FROM sessions s
     JOIN workshops w ON w.id = s.workshop_id
     JOIN studio_members sm ON sm.studio_id = w.studio_id
     WHERE w.studio_id = $1 AND sm.user_id = $2
     ORDER BY s.starts_at, s.id`,
    [studioId, userId],
  );
  return result.rows;
}

const sessionColumns = `id,
  workshop_id AS "workshopId",
  starts_at AS "startsAt",
  ends_at AS "endsAt",
  price,
  capacity,
  seats_held AS "seatsHeld",
  seats_sold AS "seatsSold",
  status,
  registration_deadline AS "registrationDeadline",
  schedule_version AS "scheduleVersion",
  created_at AS "createdAt"`;
const ownedSessionColumns = `s.id,
  s.workshop_id AS "workshopId",
  s.starts_at AS "startsAt",
  s.ends_at AS "endsAt",
  s.price,
  s.capacity,
  s.seats_held AS "seatsHeld",
  s.seats_sold AS "seatsSold",
  s.status,
  s.registration_deadline AS "registrationDeadline",
  s.schedule_version AS "scheduleVersion",
  s.created_at AS "createdAt",
  sm.role AS "memberRole"`;
type OwnedSessionRow = SessionRow & { memberRole: 'owner' | 'staff' };

export async function createSession(
  studioId: string,
  userId: string,
  workshopId: string,
  input: SessionInput,
): Promise<SessionRow | null> {
  return withTransaction(async (client) => {
    await validateDepositAmount(
      client,
      studioId,
      userId,
      workshopId,
      input.price,
    );
    const result = await client.query<SessionRow>(
      `INSERT INTO sessions (workshop_id, starts_at, ends_at, price, capacity, registration_deadline)
     SELECT w.id, $3, $4, COALESCE($5::integer, w.base_price), $6, $9
     FROM workshops w
     JOIN studio_members sm ON sm.studio_id = w.studio_id
     WHERE w.id = $1
       AND w.studio_id = $2
       AND sm.user_id = $7
       AND (NOT $8::boolean OR sm.role = 'owner')
     RETURNING ${sessionColumns}`,
      [
        workshopId,
        studioId,
        input.startsAt,
        input.endsAt,
        input.price ?? null,
        input.capacity,
        userId,
        Object.hasOwn(input, 'price'),
        input.registrationDeadline ?? null,
      ],
    );

    return result.rows[0] ?? null;
  });
}

export async function updateSession(
  studioId: string,
  userId: string,
  sessionId: string,
  input: SessionUpdate,
): Promise<
  | { session: SessionRow; conflict: null }
  | {
      session: null;
      conflict:
        | 'capacity'
        | 'price_locked'
        | 'schedule_locked'
        | 'session_closed'
        | 'invalid_schedule'
        | 'reschedule_too_soon'
        | 'owner_required';
    }
  | null
> {
  return withTransaction(async (client) => {
    const existing = await findOwnedSession(
      client,
      studioId,
      userId,
      sessionId,
    );
    if (!existing) {
      return null;
    }
    const serverNow = (
      await client.query<{ now: Date }>('SELECT clock_timestamp() AS now')
    ).rows[0]!.now.getTime();
    await expireScheduleResponses(client, [sessionId]);
    const allocation = (
      await client.query<{ held: number; sold: number }>(
        'SELECT seats_held AS held,seats_sold AS sold FROM sessions WHERE id=$1',
        [sessionId],
      )
    ).rows[0]!;
    existing.seatsHeld = allocation.held;
    existing.seatsSold = allocation.sold;
    if (
      existing.status !== 'scheduled' ||
      new Date(existing.startsAt).getTime() <= serverNow
    ) {
      return { session: null, conflict: 'session_closed' };
    }
    if (Object.hasOwn(input, 'price') && existing.memberRole !== 'owner') {
      return { session: null, conflict: 'owner_required' };
    }
    await validateDepositAmount(
      client,
      studioId,
      userId,
      existing.workshopId,
      input.price ?? existing.price,
    );

    const startsAt = input.startsAt ?? existing.startsAt;
    const endsAt = input.endsAt ?? existing.endsAt;
    if (new Date(endsAt) <= new Date(startsAt)) {
      return { session: null, conflict: 'invalid_schedule' };
    }
    const registrationDeadline =
      input.registrationDeadline === undefined
        ? existing.registrationDeadline
        : input.registrationDeadline;
    if (
      registrationDeadline &&
      new Date(registrationDeadline) > new Date(startsAt)
    ) {
      return { session: null, conflict: 'invalid_schedule' };
    }

    if (
      input.capacity !== undefined &&
      input.capacity < existing.seatsHeld + existing.seatsSold
    ) {
      return { session: null, conflict: 'capacity' };
    }

    const scheduleChanged =
      new Date(startsAt).getTime() !== new Date(existing.startsAt).getTime() ||
      new Date(endsAt).getTime() !== new Date(existing.endsAt).getTime();
    const responseDeadline = scheduleChanged
      ? scheduleResponseDeadline(startsAt, serverNow)
      : null;
    if (scheduleChanged && !responseDeadline)
      return { session: null, conflict: 'reschedule_too_soon' };
    const priceChanged =
      input.price !== undefined && input.price !== existing.price;
    if (priceChanged) {
      const bookings = await client.query(
        `SELECT 1
         FROM bookings b
         WHERE b.session_id = $1
           AND b.status IN ('pending', 'paid', 'refund_needed')
           AND EXISTS (
             SELECT 1
             FROM sessions s
             JOIN workshops w ON w.id = s.workshop_id
             WHERE s.id = b.session_id
               AND w.studio_id = $2
               AND EXISTS (
                 SELECT 1 FROM studio_members sm
                 WHERE sm.studio_id = $2 AND sm.user_id = $3
               )
           )
         LIMIT 1`,
        [sessionId, studioId, userId],
      );
      if (bookings.rowCount) {
        return {
          session: null,
          conflict: scheduleChanged ? 'schedule_locked' : 'price_locked',
        };
      }
    }

    if (scheduleChanged) {
      await cancelChangedScheduleBookings(
        client,
        sessionId,
        'hold_changed',
        userId,
      );
      await client.query(
        `UPDATE bookings SET original_starts_at=booked_starts_at,original_ends_at=booked_ends_at,
          reschedule_pending=true,proposed_schedule_version=$2,reschedule_notified_at=$3,reschedule_deadline=$4,
          attendance_confirmed_at=NULL WHERE session_id=$1 AND reservation_status='confirmed'`,
        [
          sessionId,
          existing.scheduleVersion + 1,
          new Date(serverNow),
          responseDeadline,
        ],
      );
      await client.query(
        `INSERT INTO user_notifications(user_id,booking_id,type,title,body,href) SELECT user_id,id,'session_rescheduled','Studio đã đổi giờ học','Vui lòng xem giờ học mới và chọn giữ chỗ hoặc hủy trước hạn phản hồi. Nếu không phản hồi, đặt chỗ sẽ tự hủy và số tiền đã trả được hoàn toàn bộ.','/me/bookings/'||id::text FROM bookings WHERE session_id=$1 AND reservation_status='confirmed'`,
        [sessionId],
      );
      await client.query(
        `UPDATE email_outbox SET status='cancelled' WHERE booking_id IN (SELECT id FROM bookings WHERE session_id=$1) AND status IN ('pending','failed')`,
        [sessionId],
      );
      const when = (date: string | Date) =>
        new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(new Date(date));
      await client.query(
        `INSERT INTO email_outbox(booking_id,recipient,subject,body,idempotency_key,delivery_type,schedule_version)
         SELECT b.id,u.email,'Studio đã đổi giờ học',$3 || E'\n' || $4 || '/me/bookings/'||b.id::text,
          b.id::text||':schedule:'||$2::integer::text,'schedule_change',$2 FROM bookings b JOIN users u ON u.id=b.user_id
         WHERE b.session_id=$1 AND b.reservation_status='confirmed'`,
        [
          sessionId,
          existing.scheduleVersion + 1,
          `Giờ mới: ${when(startsAt)}–${when(endsAt)}. Vui lòng chọn giữ chỗ hoặc hủy trước ${when(responseDeadline!)}. Nếu không phản hồi, đặt chỗ sẽ tự hủy và số tiền đã trả được hoàn toàn bộ trong tối đa 7 ngày làm việc.`,
          loadConfig().CLIENT_URL,
        ],
      );
      await client.query(
        `INSERT INTO session_schedule_history(session_id,actor_id,previous_starts_at,previous_ends_at,starts_at,ends_at,schedule_version,response_deadline) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          sessionId,
          userId,
          existing.startsAt,
          existing.endsAt,
          startsAt,
          endsAt,
          existing.scheduleVersion + 1,
          responseDeadline,
        ],
      );
    }
    const updated = await client.query<SessionRow>(
      `UPDATE sessions
       SET starts_at = $1,
           ends_at = $2,
           price = $3,
           capacity = $4,
           registration_deadline = $9,
           schedule_version = schedule_version + $10
       WHERE id = $5
         AND EXISTS (
           SELECT 1
           FROM workshops w
           WHERE w.id = sessions.workshop_id
             AND w.studio_id = $6
             AND EXISTS (
               SELECT 1 FROM studio_members sm
               WHERE sm.studio_id = $6 AND sm.user_id = $7
             )
         )
         AND (
           NOT $8::boolean
           OR EXISTS (
               SELECT 1
               FROM studio_members sm
               WHERE sm.studio_id = $6
                 AND sm.user_id = $7
                 AND sm.role = 'owner'
           )
         )
       RETURNING ${sessionColumns}`,
      [
        startsAt,
        endsAt,
        input.price ?? existing.price,
        input.capacity ?? existing.capacity,
        sessionId,
        studioId,
        userId,
        Object.hasOwn(input, 'price'),
        registrationDeadline,
        scheduleChanged ? 1 : 0,
      ],
    );

    const updatedSession = updated.rows[0];
    if (!updatedSession) {
      throw new AppError(
        409,
        'CONFLICT',
        'Quyền quản lý buổi học đã thay đổi. Vui lòng tải lại trước khi lưu.',
      );
    }
    return { session: updatedSession, conflict: null };
  });
}

export async function cancelSession(
  studioId: string,
  userId: string,
  sessionId: string,
): Promise<SessionRow | null> {
  return withTransaction(async (client) => {
    const existing = await findOwnedSession(
      client,
      studioId,
      userId,
      sessionId,
    );
    if (!existing) {
      return null;
    }

    if (existing.status === 'completed') {
      return null;
    }
    if (existing.status === 'cancelled') {
      return toSessionRow(existing);
    }

    await releaseExpiredHolds(client, [sessionId]);
    const active = await client.query<{
      id: string;
      userId: string;
      quantity: number;
      reservationStatus: string;
      paidAmount: number;
      status: string;
    }>(
      `SELECT b.id, b.user_id AS "userId", b.quantity,
         b.reservation_status AS "reservationStatus",
         b.paid_amount AS "paidAmount", b.status
       FROM bookings b
       WHERE b.session_id = $1
         AND b.reservation_status IN ('pending', 'confirmed')
         AND b.status IN ('pending', 'paid')
         AND EXISTS (
           SELECT 1
           FROM sessions s
           JOIN workshops w ON w.id = s.workshop_id
           WHERE s.id = b.session_id
             AND w.studio_id = $2
             AND EXISTS (
               SELECT 1 FROM studio_members sm
               WHERE sm.studio_id = $2 AND sm.user_id = $3
             )
         )
       FOR UPDATE OF b`,
      [sessionId, studioId, userId],
    );
    const activeBookings = active.rows;
    const heldSeatsToRelease = activeBookings.reduce(
      (total, booking) =>
        booking.reservationStatus === 'pending'
          ? total + booking.quantity
          : total,
      0,
    );
    const soldSeatsToRelease = activeBookings.reduce(
      (total, booking) =>
        booking.reservationStatus === 'confirmed'
          ? total + booking.quantity
          : total,
      0,
    );
    const bookingIds = activeBookings.map((booking) => booking.id);
    if (bookingIds.length) {
      await client.query(
        `UPDATE bookings
         SET status = CASE
           WHEN paid_amount > 0 OR (status = 'paid' AND total_amount > 0)
             THEN 'refund_needed'::booking_status
           ELSE 'cancelled'::booking_status
         END,
         reservation_status = 'cancelled',refund_due_amount=paid_amount,refund_status=CASE WHEN paid_amount>0 THEN 'pending' ELSE 'not_applicable' END
         WHERE id = ANY($1::uuid[])`,
        [bookingIds],
      );
      await client.query(
        `UPDATE payments SET status = 'cancelled'
         WHERE booking_id = ANY($1::uuid[]) AND status = 'created'`,
        [bookingIds],
      );
      await client.query(
        `UPDATE tickets SET status = 'void'
         WHERE booking_id = ANY($1::uuid[]) AND status = 'valid'`,
        [bookingIds],
      );
      await client.query(
        `INSERT INTO user_notifications
           (user_id, booking_id, type, title, body, href)
         SELECT b.user_id, b.id,
           CASE WHEN b.status = 'refund_needed'
             THEN 'session_cancelled_refund_needed'
             ELSE 'session_cancelled'
           END,
           CASE WHEN b.status = 'refund_needed'
             THEN 'Buổi bị hủy, cần xử lý hoàn tiền'
             ELSE 'Buổi workshop đã bị hủy'
           END,
           CASE WHEN b.status = 'refund_needed'
             THEN 'Khoản đã thanh toán cần được studio xử lý hoàn thủ công.'
             ELSE 'Đặt chỗ của bạn đã được hủy và chỗ được trả lại.'
           END,
           '/me/bookings/' || b.id::text
         FROM bookings b
         WHERE b.id = ANY($1::uuid[])`,
        [bookingIds],
      );
    }

    const result = await client.query<SessionRow>(
      `UPDATE sessions
       SET status = 'cancelled',
           seats_held = seats_held - $1,
           seats_sold = seats_sold - $2
       WHERE id = $3
         AND seats_held >= $1
         AND seats_sold >= $2
         AND EXISTS (
           SELECT 1
           FROM workshops w
           WHERE w.id = sessions.workshop_id
             AND w.studio_id = $4
             AND EXISTS (
               SELECT 1 FROM studio_members sm
               WHERE sm.studio_id = $4 AND sm.user_id = $5
             )
         )
       RETURNING ${sessionColumns}`,
      [heldSeatsToRelease, soldSeatsToRelease, sessionId, studioId, userId],
    );
    if (!result.rows[0]) {
      throw new Error(
        'Pending booking quantities exceed the session seats currently held.',
      );
    }
    return result.rows[0];
  });
}

function toSessionRow(session: OwnedSessionRow): SessionRow {
  return {
    id: session.id,
    workshopId: session.workshopId,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    price: session.price,
    capacity: session.capacity,
    seatsHeld: session.seatsHeld,
    seatsSold: session.seatsSold,
    status: session.status,
    registrationDeadline: session.registrationDeadline,
    scheduleVersion: session.scheduleVersion,
    createdAt: session.createdAt,
  };
}

async function validateDepositAmount(
  client: PoolClient,
  studioId: string,
  userId: string,
  workshopId: string,
  price?: number,
) {
  const minimum = Number(process.env.PAYMENT_MIN_AMOUNT ?? 0);
  if (!minimum) return;
  const result = await client.query<{ price: number; percent: number }>(
    `SELECT COALESCE($4::integer,w.base_price) AS price,effective_deposit_percent(st,w) AS percent FROM studios st JOIN workshops w ON w.studio_id=st.id JOIN studio_members sm ON sm.studio_id=st.id WHERE st.id=$1 AND sm.user_id=$2 AND w.id=$3 FOR SHARE OF st`,
    [studioId, userId, workshopId, price ?? null],
  );
  const row = result.rows[0];
  if (
    row &&
    row.price > 0 &&
    row.percent > 0 &&
    calculateDeposit(row.price, row.percent) < minimum
  )
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      `Tiền cọc của buổi này thấp hơn mức thanh toán tối thiểu ${minimum.toLocaleString('vi-VN')} đ. Vui lòng đổi giá hoặc mức cọc trước khi lưu.`,
    );
}

async function findOwnedSession(
  client: PoolClient,
  studioId: string,
  userId: string,
  sessionId: string,
): Promise<OwnedSessionRow | null> {
  const result = await client.query<OwnedSessionRow>(
    `SELECT ${ownedSessionColumns}
     FROM sessions s
     JOIN workshops w ON w.id = s.workshop_id
     JOIN studio_members sm ON sm.studio_id = w.studio_id
     WHERE s.id = $1 AND w.studio_id = $2 AND sm.user_id = $3
     FOR UPDATE OF s`,
    [sessionId, studioId, userId],
  );
  return result.rows[0] ?? null;
}
