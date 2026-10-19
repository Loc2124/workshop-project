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
  s.created_at AS "createdAt"`;

export async function createSession(
  organizerId: string,
  workshopId: string,
  input: SessionInput,
): Promise<SessionRow | null> {
  const result = await query<SessionRow>(
    `INSERT INTO sessions (workshop_id, starts_at, ends_at, price, capacity)
     SELECT id, $3, $4, $5, $6
     FROM workshops
     WHERE id = $1 AND organizer_id = $2
     RETURNING ${sessionColumns}`,
    [
      workshopId,
      organizerId,
      input.startsAt,
      input.endsAt,
      input.price,
      input.capacity,
    ],
  );

  return result.rows[0] ?? null;
}

export async function updateSession(
  organizerId: string,
  sessionId: string,
  input: SessionUpdate,
): Promise<
  | { session: SessionRow; conflict: null }
  | {
      session: null;
      conflict: 'capacity' | 'price_locked' | 'invalid_schedule';
    }
  | null
> {
  return withTransaction(async (client) => {
    const existing = await findOwnedSession(client, organizerId, sessionId);
    if (!existing) {
      return null;
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
             WHERE s.id = b.session_id AND w.organizer_id = $2
           )
         LIMIT 1`,
        [sessionId, organizerId],
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
           WHERE w.id = sessions.workshop_id AND w.organizer_id = $6
         )
       RETURNING ${sessionColumns}`,
      [
        startsAt,
        endsAt,
        input.price ?? existing.price,
        input.capacity ?? existing.capacity,
        sessionId,
        organizerId,
      ],
    );

    return { session: updated.rows[0], conflict: null };
  });
}

export async function cancelSession(
  organizerId: string,
  sessionId: string,
): Promise<SessionRow | null> {
  return withTransaction(async (client) => {
    const existing = await findOwnedSession(client, organizerId, sessionId);
    if (!existing) {
      return null;
    }

    if (existing.status === 'completed') {
      return null;
    }
    if (existing.status === 'cancelled') {
      return existing;
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
           WHERE s.id = b.session_id AND w.organizer_id = $2
         )
       RETURNING quantity`,
      [sessionId, organizerId],
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
           WHERE s.id = b.session_id AND w.organizer_id = $2
         )`,
      [sessionId, organizerId],
    );

    const result = await client.query<SessionRow>(
      `UPDATE sessions
       SET status = 'cancelled',
           seats_held = seats_held - $1
       WHERE id = $2
         AND EXISTS (
           SELECT 1
           FROM workshops w
           WHERE w.id = sessions.workshop_id AND w.organizer_id = $3
         )
       RETURNING ${sessionColumns}`,
      [heldSeatsToRelease, sessionId, organizerId],
    );
    return result.rows[0] ?? null;
  });
}

async function findOwnedSession(
  client: PoolClient,
  organizerId: string,
  sessionId: string,
): Promise<SessionRow | null> {
  const result = await client.query<SessionRow>(
    `SELECT ${ownedSessionColumns}
     FROM sessions s
     JOIN workshops w ON w.id = s.workshop_id
     WHERE s.id = $1 AND w.organizer_id = $2
     FOR UPDATE OF s`,
    [sessionId, organizerId],
  );
  return result.rows[0] ?? null;
}
