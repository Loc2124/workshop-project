import type { PoolClient } from 'pg';
import { withTransaction } from '../../db/pool.js';

export function scheduleResponseDeadline(
  startsAt: string | Date,
  notifiedAt: number,
) {
  const start = new Date(startsAt).getTime();
  if (start <= notifiedAt + 12 * 3600000) return null;
  return new Date(Math.min(notifiedAt + 48 * 3600000, start - 12 * 3600000));
}

/** Caller holds the session lock. Both pathways cancel only active allocations. */
export async function cancelChangedScheduleBookings(
  client: PoolClient,
  sessionId: string,
  reason: 'hold_changed' | 'response_expired',
  actorId?: string,
) {
  const rows = (
    await client.query<{
      id: string;
      quantity: number;
      reservationStatus: string;
    }>(
      `SELECT id,quantity,reservation_status AS "reservationStatus" FROM bookings
     WHERE session_id=$1 AND status IN ('pending','paid') AND
       ${reason === 'hold_changed' ? "reservation_status='pending'" : "reservation_status='confirmed' AND reschedule_pending AND reschedule_deadline<=clock_timestamp()"}
     ORDER BY id FOR UPDATE`,
      [sessionId],
    )
  ).rows;
  if (!rows.length) return 0;
  const held = rows.reduce(
    (n, b) => n + (b.reservationStatus === 'pending' ? b.quantity : 0),
    0,
  );
  const sold = rows.reduce(
    (n, b) => n + (b.reservationStatus === 'confirmed' ? b.quantity : 0),
    0,
  );
  const released = await client.query(
    `UPDATE sessions SET seats_held=seats_held-$2,seats_sold=seats_sold-$3 WHERE id=$1 AND seats_held>=$2 AND seats_sold>=$3 RETURNING id`,
    [sessionId, held, sold],
  );
  if (!released.rowCount)
    throw new Error('Schedule cancellation exceeds allocated seats.');
  const explanation =
    reason === 'hold_changed'
      ? 'Studio đã đổi giờ học. Chỗ đang giữ đã được hủy; bạn có thể đặt lại theo lịch mới.'
      : 'Đã hết hạn phản hồi giờ học mới. Đặt chỗ của bạn đã được hủy.';
  await client.query(
    "SELECT set_config('app.booking_actor',$1,true),set_config('app.booking_reason',$2,true)",
    [actorId ?? '', explanation],
  );
  const ids = rows.map((b) => b.id);
  await client.query(
    `UPDATE bookings SET reservation_status='cancelled',reschedule_pending=false,
      status=CASE WHEN paid_amount>0 THEN 'refund_needed'::booking_status ELSE 'cancelled'::booking_status END,
      refund_due_amount=paid_amount,refund_status=CASE WHEN paid_amount>0 THEN 'pending' ELSE 'not_applicable' END WHERE id=ANY($1::uuid[])`,
    [ids],
  );
  await client.query(
    "UPDATE payments SET status='cancelled' WHERE booking_id=ANY($1::uuid[]) AND status='created'",
    [ids],
  );
  await client.query(
    "UPDATE tickets SET status='void' WHERE booking_id=ANY($1::uuid[]) AND status='valid'",
    [ids],
  );
  await client.query(
    "UPDATE email_outbox SET status='cancelled' WHERE booking_id=ANY($1::uuid[]) AND status IN ('pending','failed')",
    [ids],
  );
  await client.query(
    `INSERT INTO user_notifications(user_id,booking_id,type,title,body,href)
     SELECT user_id,id,$2,'Đã hủy đặt chỗ', $3 || CASE WHEN paid_amount>0 THEN ' Bạn sẽ được hoàn toàn bộ số tiền đã trả trong tối đa 7 ngày làm việc.' ELSE '' END,'/me/bookings/'||id::text FROM bookings WHERE id=ANY($1::uuid[])`,
    [
      ids,
      reason === 'hold_changed'
        ? 'schedule_hold_cancelled'
        : 'schedule_response_expired',
      explanation,
    ],
  );
  return rows.length;
}

export async function expireScheduleResponses(
  client: PoolClient,
  sessionIds: readonly string[],
) {
  const locked = await client.query<{ id: string }>(
    `SELECT s.id FROM sessions s WHERE s.id=ANY($1::uuid[]) AND EXISTS (SELECT 1 FROM bookings b WHERE b.session_id=s.id AND b.reschedule_pending AND b.reservation_status='confirmed' AND b.reschedule_deadline<=clock_timestamp()) ORDER BY s.id FOR UPDATE OF s`,
    [sessionIds],
  );
  let count = 0;
  for (const row of locked.rows)
    count += await cancelChangedScheduleBookings(
      client,
      row.id,
      'response_expired',
    );
  return count;
}

export async function expirePendingScheduleResponses(
  onlySessionIds?: readonly string[],
) {
  return withTransaction(async (client) => {
    const lock = await client.query<{ ok: boolean }>(
      'SELECT pg_try_advisory_xact_lock(731904,47) AS ok',
    );
    if (!lock.rows[0]?.ok) return 0;
    const sessions = await client.query<{ id: string }>(
      `SELECT DISTINCT session_id AS id FROM bookings WHERE reschedule_pending AND reservation_status='confirmed' AND reschedule_deadline<=clock_timestamp() AND ($1::uuid[] IS NULL OR session_id=ANY($1::uuid[])) ORDER BY session_id`,
      [onlySessionIds ?? null],
    );
    return expireScheduleResponses(
      client,
      sessions.rows.map((s) => s.id),
    );
  });
}
