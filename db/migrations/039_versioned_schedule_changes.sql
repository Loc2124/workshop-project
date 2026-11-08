ALTER TABLE sessions ADD COLUMN schedule_version integer NOT NULL DEFAULT 1 CHECK (schedule_version > 0);
ALTER TABLE bookings
  ADD COLUMN schedule_version integer NOT NULL DEFAULT 1 CHECK (schedule_version > 0),
  ADD COLUMN proposed_schedule_version integer CHECK (proposed_schedule_version > 0),
  ADD COLUMN booked_starts_at timestamptz,
  ADD COLUMN booked_ends_at timestamptz,
  ADD COLUMN reschedule_notified_at timestamptz,
  ADD COLUMN reschedule_deadline timestamptz,
  ADD COLUMN schedule_accepted_at timestamptz,
  ADD COLUMN cancelled_at timestamptz;

-- Existing pending changes have no reliable notification/acceptance version.
-- Establish a baseline without extending the new start minus 12-hour cutoff.
UPDATE bookings b SET
  booked_starts_at = CASE WHEN b.reschedule_pending THEN COALESCE(b.original_starts_at,s.starts_at) ELSE s.starts_at END,
  booked_ends_at = CASE WHEN b.reschedule_pending THEN COALESCE(b.original_ends_at,s.ends_at) ELSE s.ends_at END,
  proposed_schedule_version = CASE WHEN b.reschedule_pending THEN s.schedule_version END,
  reschedule_notified_at = CASE WHEN b.reschedule_pending THEN now() END,
  reschedule_deadline = CASE WHEN b.reschedule_pending THEN LEAST(now()+interval '48 hours',s.starts_at-interval '12 hours') END
FROM sessions s WHERE s.id=b.session_id;
ALTER TABLE bookings ALTER COLUMN booked_starts_at SET NOT NULL, ALTER COLUMN booked_ends_at SET NOT NULL;

CREATE FUNCTION snapshot_booking_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT starts_at,ends_at,schedule_version INTO NEW.booked_starts_at,NEW.booked_ends_at,NEW.schedule_version FROM sessions WHERE id=NEW.session_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER booking_schedule_snapshot BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION snapshot_booking_schedule();
CREATE FUNCTION record_booking_cancellation_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reservation_status='cancelled' AND OLD.reservation_status<>'cancelled' THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at,clock_timestamp());
    NEW.reschedule_pending := false;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER booking_cancellation_time BEFORE UPDATE OF reservation_status ON bookings FOR EACH ROW EXECUTE FUNCTION record_booking_cancellation_time();

ALTER TABLE session_schedule_history ADD COLUMN schedule_version integer CHECK (schedule_version > 0), ADD COLUMN response_deadline timestamptz;
CREATE UNIQUE INDEX session_schedule_version_unique ON session_schedule_history(session_id,schedule_version) WHERE schedule_version IS NOT NULL;
CREATE INDEX booking_reschedule_due ON bookings(session_id,reschedule_deadline) WHERE reschedule_pending AND reservation_status='confirmed';
CREATE TABLE booking_schedule_acceptances (
  booking_id uuid NOT NULL REFERENCES bookings(id),
  schedule_version integer NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (booking_id,schedule_version)
);
ALTER TABLE booking_schedule_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_schedule_acceptances FROM PUBLIC,anon,authenticated;

ALTER TABLE email_outbox
  ADD COLUMN delivery_type text NOT NULL DEFAULT 'reminder' CHECK (delivery_type IN ('reminder','schedule_change')),
  ADD COLUMN schedule_version integer;
ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_status_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_status_check CHECK (status IN ('pending','processing','sent','failed','cancelled'));

INSERT INTO user_notifications(user_id,booking_id,type,title,body,href)
SELECT user_id,id,'session_rescheduled','Vui lòng phản hồi giờ học mới',
  'Vui lòng chọn giữ chỗ hoặc hủy trước '||to_char(reschedule_deadline AT TIME ZONE 'Asia/Ho_Chi_Minh','HH24:MI, DD/MM/YYYY')||'. Nếu không phản hồi đúng hạn, đặt chỗ sẽ tự hủy và số tiền đã trả được hoàn toàn bộ.',
  '/me/bookings/'||id::text FROM bookings WHERE reschedule_pending AND reservation_status='confirmed' AND reschedule_deadline>now();
