import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../db/pool.js';
import type { SessionInput, SessionUpdate } from './sessions.schemas.js';

export type SessionRow = {
  id: string;
  workshopId: string;
  startsAt: string;
  endsAt: string;
  price: number;
  capacity: number;
  seatsHeld: number;
  seatsSold: number;
  status: 'scheduled' | 'cancelled' | 'completed';
  createdAt: string;
};

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
        'capacity' | 'price_locked' | 'invalid_schedule' | 'owner_required';
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

    if (input.price !== undefined && input.price !== existing.price) {
      const bookings = await client.query(
        `SELECT 1
         FROM bookings b
         WHERE b.session_id = $1
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
         LIMIT 1`,
        [sessionId, studioId, userId],
      );
      if (bookings.rowCount) {
        return { session: null, conflict: 'price_locked' };
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

    const pending = await client.query<{ quantity: number }>(
      `UPDATE bookings b
       SET status = 'cancelled'
       WHERE b.session_id = $1
         AND b.status = 'pending'
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
       RETURNING quantity`,
      [sessionId, studioId, userId],
    );
    const heldSeatsToRelease = pending.rows.reduce(
      (total, booking) => total + booking.quantity,
      0,
    );

    await client.query(
      `UPDATE bookings b
       SET status = 'refund_needed'
       WHERE b.session_id = $1
         AND b.status = 'paid'
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
         )`,
      [sessionId, studioId, userId],
    );

    const result = await client.query<SessionRow>(
      `UPDATE sessions
       SET status = 'cancelled',
           seats_held = seats_held - $1
       WHERE id = $2
         AND EXISTS (
           SELECT 1
           FROM workshops w
           WHERE w.id = sessions.workshop_id
             AND w.studio_id = $3
             AND EXISTS (
               SELECT 1 FROM studio_members sm
               WHERE sm.studio_id = $3 AND sm.user_id = $4
             )
         )
       RETURNING ${sessionColumns}`,
      [heldSeatsToRelease, sessionId, studioId, userId],
    );
    return result.rows[0] ?? null;
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
