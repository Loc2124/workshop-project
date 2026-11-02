import type { PoolClient } from 'pg';

export async function releaseExpiredHolds(
  client: PoolClient,
  sessionIds: readonly string[],
): Promise<void> {
  const ids = [...new Set(sessionIds)];
  if (ids.length === 0) return;

  const lockedSessions = await client.query<{ id: string }>(
    `SELECT id
     FROM sessions
     WHERE id = ANY($1::uuid[])
     ORDER BY id
     FOR UPDATE`,
    [ids],
  );
  const lockedIds = lockedSessions.rows.map(({ id }) => id);
  if (lockedIds.length === 0) return;

  const result = await client.query<{
    expected: number;
    released: number;
  }>(
    `WITH expired AS (
       UPDATE bookings
       SET status = 'expired'
       WHERE status = 'pending'
         AND reservation_status = 'pending'
         AND hold_expires_at < now()
         AND session_id = ANY($1::uuid[])
       RETURNING session_id, quantity
     ),
     quantities AS (
       SELECT session_id, sum(quantity)::integer AS quantity
       FROM expired
       GROUP BY session_id
     ),
     released_sessions AS (
       UPDATE sessions s
       SET seats_held = s.seats_held - quantities.quantity
       FROM quantities
       WHERE s.id = quantities.session_id
         AND s.seats_held >= quantities.quantity
       RETURNING s.id
     )
     SELECT
       (SELECT count(*)::integer FROM quantities) AS expected,
       (SELECT count(*)::integer FROM released_sessions) AS released`,
    [lockedIds],
  );

  if (result.rows[0]?.expected !== result.rows[0]?.released) {
    throw new Error(
      'Expired booking quantities exceed the session seats currently held.',
    );
  }
}
