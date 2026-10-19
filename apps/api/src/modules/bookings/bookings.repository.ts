import type { PoolClient } from 'pg';

export async function releaseExpiredHolds(
  client: PoolClient,
  sessionId?: string,
): Promise<void> {
  await client.query(
    `WITH expired AS (
       UPDATE bookings
       SET status = 'expired'
       WHERE status = 'pending'
         AND hold_expires_at < now()
         AND ($1::uuid IS NULL OR session_id = $1::uuid)
       RETURNING session_id, quantity
     ),
     released AS (
       UPDATE sessions s
       SET seats_held = s.seats_held - agg.quantity
       FROM (
         SELECT session_id, sum(quantity)::integer AS quantity
         FROM expired
         GROUP BY session_id
       ) agg
       WHERE s.id = agg.session_id
       RETURNING s.id
     )
     SELECT count(*) FROM released`,
    [sessionId ?? null],
  );
}
