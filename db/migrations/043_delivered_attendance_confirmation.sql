-- A queued or in-app notice is not evidence that a confirmation email was sent.
-- Legacy emails are deliberately not backfilled as confirmation requests.
ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_delivery_type_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_delivery_type_check
 CHECK(delivery_type IN ('reminder','schedule_change','attendance_confirmation'));
ALTER TABLE email_outbox ADD COLUMN reminder_starts_at timestamptz;
CREATE UNIQUE INDEX email_attendance_confirmation_version
 ON email_outbox(booking_id,schedule_version) WHERE delivery_type='attendance_confirmation';
ALTER TABLE email_outbox ADD CONSTRAINT email_attendance_confirmation_terms CHECK(
 delivery_type<>'attendance_confirmation' OR
 (booking_id IS NOT NULL AND schedule_version IS NOT NULL AND schedule_version>0 AND reminder_starts_at IS NOT NULL));

-- Caller serializes on the session before acting on this deadline.
CREATE FUNCTION attendance_confirmation_deadline(target_booking uuid) RETURNS timestamptz
 LANGUAGE sql STABLE AS $$
 WITH terms AS (
  SELECT s.starts_at,GREATEST(s.starts_at-make_interval(mins=>b.release_before_minutes),min(e.sent_at)+interval '2 hours') AS deadline
  FROM bookings b JOIN sessions s ON s.id=b.session_id
  JOIN email_outbox e ON e.booking_id=b.id AND e.delivery_type='attendance_confirmation'
   AND e.status='sent' AND e.sent_at IS NOT NULL AND e.schedule_version=s.schedule_version
   AND e.reminder_starts_at=s.starts_at
  WHERE b.id=target_booking AND b.reservation_status='confirmed' AND NOT b.reschedule_pending
   AND b.schedule_version=s.schedule_version AND b.payment_mode<>'payos_deposit' AND b.paid_amount=0
   AND b.release_if_unconfirmed AND b.release_before_minutes IS NOT NULL AND b.attendance_confirmed_at IS NULL
   AND s.status='scheduled'
   AND NOT EXISTS(SELECT 1 FROM tickets t WHERE t.booking_id=b.id AND t.status='valid' AND t.attendance_status<>'unmarked')
  GROUP BY s.starts_at,b.release_before_minutes
 ) SELECT deadline FROM terms WHERE deadline<starts_at
$$;
REVOKE ALL ON FUNCTION attendance_confirmation_deadline(uuid) FROM PUBLIC,anon,authenticated;
