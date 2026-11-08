import type { PoolClient } from 'pg';

/** Caller holds each session lock, following the booking allocation lock order. */
export async function releaseUnconfirmedBookings(
  client: PoolClient,
  sessionIds: string[],
) {
  if (!sessionIds.length) return;
  const due = await client.query<{
    id: string;
    userId: string;
    sessionId: string;
    quantity: number;
  }>(
    `SELECT b.id,b.user_id AS "userId",b.session_id AS "sessionId",b.quantity FROM bookings b JOIN sessions s ON s.id=b.session_id
  WHERE b.session_id=ANY($1::uuid[]) AND s.starts_at>clock_timestamp()
   AND attendance_confirmation_deadline(b.id)<=clock_timestamp() ORDER BY b.id FOR UPDATE OF b`,
    [sessionIds],
  );
  if (!due.rows.length) return;
  const context = (
    await client.query<{ actor: string | null; reason: string | null }>(
      "SELECT current_setting('app.booking_actor',true) AS actor,current_setting('app.booking_reason',true) AS reason",
    )
  ).rows[0];
  for (const booking of due.rows) {
    const capacity = await client.query(
      'UPDATE sessions SET seats_sold=seats_sold-$2 WHERE id=$1 AND seats_sold>=$2 RETURNING id',
      [booking.sessionId, booking.quantity],
    );
    if (!capacity.rowCount)
      throw new Error('Attendance release exceeds allocated seats.');
    await client.query(
      "SELECT set_config('app.booking_actor','',true),set_config('app.booking_reason','Chưa xác nhận sẽ đến sau ít nhất 2 giờ từ email gửi thành công.',true)",
    );
    await client.query(
      "UPDATE bookings SET reservation_status='cancelled',status='cancelled' WHERE id=$1",
      [booking.id],
    );
    await client.query(
      "UPDATE tickets SET status='void' WHERE booking_id=$1 AND status='valid'",
      [booking.id],
    );
    await client.query(
      "UPDATE payments SET status='cancelled' WHERE booking_id=$1 AND status='created'",
      [booking.id],
    );
    await client.query(
      "UPDATE email_outbox SET status='cancelled' WHERE booking_id=$1 AND status IN ('pending','failed')",
      [booking.id],
    );
    await client.query(
      `INSERT INTO user_notifications(user_id,booking_id,type,title,body,href) VALUES($1,$2,'attendance_hold_released','Chỗ của bạn đã được nhả','Đã hết thời gian xác nhận bạn sẽ đến. Bạn có thể xem các buổi học khác.','/me/bookings/'||$2::uuid::text)`,
      [booking.userId, booking.id],
    );
    await client.query(
      `INSERT INTO admin_activity_log(actor_id,actor_name,action,entity_type,entity_id,entity_name,reason) VALUES(NULL,'Hệ thống','booking.attendance_hold_released','booking',$1::uuid,$1::uuid::text,'Hết hạn xác nhận; email gửi thành công trước ít nhất 2 giờ.')`,
      [booking.id],
    );
  }
  await client.query(
    "SELECT set_config('app.booking_actor',$1,true),set_config('app.booking_reason',$2,true)",
    [context.actor ?? '', context.reason ?? ''],
  );
}
