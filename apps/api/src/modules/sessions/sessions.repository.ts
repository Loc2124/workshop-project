import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../db/pool.js';
import { releaseExpiredHolds } from '../bookings/bookings.repository.js';
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
  s.created_at AS "createdAt",
  sm.role AS "memberRole"`;
type OwnedSessionRow = SessionRow & { memberRole: 'owner' | 'staff' };

export async function createSession(
  studioId: string,
  userId: string,
  workshopId: string,
  input: SessionInput,
): Promise<SessionRow | null> {
  const result = await query<SessionRow>(
    `INSERT INTO sessions (workshop_id, starts_at, ends_at, price, capacity)
     SELECT w.id, $3, $4, COALESCE($5::integer, w.base_price), $6
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
    ],
  );

  return result.rows[0] ?? null;
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
    if (
      existing.status !== 'scheduled' ||
      new Date(existing.startsAt) <= new Date()
    ) {
      return { session: null, conflict: 'session_closed' };
    }
    if (Object.hasOwn(input, 'price') && existing.memberRole !== 'owner') {
      return { session: null, conflict: 'owner_required' };
    }

    const startsAt = input.startsAt ?? existing.startsAt;
    const endsAt = input.endsAt ?? existing.endsAt;
    if (new Date(endsAt) <= new Date(startsAt)) {
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
    const priceChanged =
      input.price !== undefined && input.price !== existing.price;
    if (scheduleChanged || priceChanged) {
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

    const updated = await client.query<SessionRow>(
      `UPDATE sessions
       SET starts_at = $1,
           ends_at = $2,
           price = $3,
           capacity = $4
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
      ],
    );

    const updatedSession = updated.rows[0];
    if (!updatedSession) {
      return Object.hasOwn(input, 'price')
        ? { session: null, conflict: 'owner_required' }
        : null;
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
         reservation_status = 'cancelled'
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
    createdAt: session.createdAt,
  };
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
