ALTER TABLE sessions ADD COLUMN registration_deadline timestamptz;
ALTER TABLE workshops ADD COLUMN is_discontinued boolean NOT NULL DEFAULT false;
ALTER TABLE sessions ADD CONSTRAINT sessions_registration_deadline_before_start
  CHECK (registration_deadline IS NULL OR registration_deadline <= starts_at);

CREATE TABLE workshop_schedule_subscriptions (
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workshop_id, user_id)
);
ALTER TABLE workshop_schedule_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON workshop_schedule_subscriptions FROM anon, authenticated;

CREATE FUNCTION notify_workshop_schedule_subscribers() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'scheduled' AND NEW.starts_at > now() THEN
    INSERT INTO user_notifications (user_id,type,title,body,href)
    SELECT sub.user_id,'workshop_schedule','Workshop đã có lịch mới',
      w.title || ' đã có buổi mới. Xem lịch và chọn chỗ phù hợp.',
      '/workshop/' || w.slug
    FROM workshop_schedule_subscriptions sub
    JOIN workshops w ON w.id = sub.workshop_id
    WHERE sub.workshop_id = NEW.workshop_id
      AND w.status = 'approved' AND w.publication_status = 'published'
      AND w.visibility_status = 'active' AND NOT w.is_discontinued;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER workshop_schedule_subscriber_notification
  AFTER INSERT ON sessions FOR EACH ROW
  EXECUTE FUNCTION notify_workshop_schedule_subscribers();
