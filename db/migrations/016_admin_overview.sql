ALTER TABLE studios ADD COLUMN submitted_at timestamptz, ADD COLUMN resubmitted_at timestamptz;
UPDATE studios SET submitted_at = created_at WHERE NOT is_draft;
CREATE INDEX studios_review_queue_idx ON studios(status, submitted_at) WHERE NOT is_draft;
CREATE INDEX bookings_created_idx ON bookings(created_at);
CREATE INDEX users_created_idx ON users(created_at);

CREATE TABLE content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  studio_id uuid REFERENCES studios(id),
  workshop_id uuid REFERENCES workshops(id),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(studio_id, workshop_id) = 1)
);
CREATE INDEX content_reports_queue_idx ON content_reports(status, created_at DESC);

CREATE TABLE admin_activity_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  entity_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_activity_recent_idx ON admin_activity_log(created_at DESC, id DESC);
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON content_reports, admin_activity_log FROM anon, authenticated;
REVOKE ALL ON SEQUENCE admin_activity_log_id_seq FROM anon, authenticated;

-- Preserve existing recorded decisions; new events are appended atomically by triggers.
INSERT INTO admin_activity_log(actor_id,actor_name,action,entity_type,entity_id,entity_name,created_at)
SELECT s.reviewed_by,u.full_name,'studio.'||s.status::text,'studio',s.id,s.name,s.reviewed_at
FROM studios s JOIN users u ON u.id=s.reviewed_by WHERE s.reviewed_at IS NOT NULL
UNION ALL
SELECT h.reviewed_by,u.full_name,'workshop.'||h.decision::text,'workshop',w.id,w.title,h.reviewed_at
FROM workshop_review_history h JOIN users u ON u.id=h.reviewed_by JOIN workshops w ON w.id=h.workshop_id
UNION ALL
SELECT h.reviewed_by,u.full_name,'verification.'||h.action,'studio',s.id,s.name,h.created_at
FROM studio_verification_history h JOIN users u ON u.id=h.reviewed_by JOIN studios s ON s.id=h.studio_id;

CREATE FUNCTION track_studio_submission_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW.is_draft AND NEW.status='pending' THEN
    NEW.submitted_at := now();
    IF OLD.status='needs_changes' THEN NEW.resubmitted_at := now(); END IF;
  ELSIF NEW.status<>'pending' THEN NEW.resubmitted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER studio_submission_time BEFORE UPDATE OF status,is_draft ON studios FOR EACH ROW EXECUTE FUNCTION track_studio_submission_time();

CREATE FUNCTION append_admin_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid; action_name text; entity_kind text; entity uuid; label text;
BEGIN
  IF TG_TABLE_NAME='studios' THEN
    entity := NEW.id; entity_kind := 'studio'; label := NEW.name;
    IF NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at AND NEW.reviewed_by IS NOT NULL THEN
      actor := NEW.reviewed_by; action_name := 'studio.'||NEW.status::text;
    ELSIF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at AND NOT NEW.is_draft THEN
      SELECT user_id INTO actor FROM studio_members WHERE studio_id=NEW.id AND role='owner';
      action_name := CASE WHEN OLD.is_draft THEN 'studio.submitted' ELSE 'studio.resubmitted' END;
    ELSE RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME='workshop_review_history' THEN
    actor := NEW.reviewed_by; entity_kind := 'workshop'; entity := NEW.workshop_id; action_name := 'workshop.'||NEW.decision::text;
    SELECT title INTO label FROM workshops WHERE id=entity;
  ELSE
    actor := NEW.reviewed_by; entity_kind := 'studio'; entity := NEW.studio_id; action_name := 'verification.'||NEW.action;
    SELECT name INTO label FROM studios WHERE id=entity;
  END IF;
  INSERT INTO admin_activity_log(actor_id,actor_name,action,entity_type,entity_id,entity_name)
    SELECT actor,full_name,action_name,entity_kind,entity,label FROM users WHERE id=actor;
  RETURN NEW;
END;
$$;
CREATE TRIGGER studio_activity AFTER UPDATE ON studios FOR EACH ROW EXECUTE FUNCTION append_admin_activity();
CREATE TRIGGER workshop_review_activity AFTER INSERT ON workshop_review_history FOR EACH ROW EXECUTE FUNCTION append_admin_activity();
CREATE TRIGGER studio_verification_activity AFTER INSERT ON studio_verification_history FOR EACH ROW EXECUTE FUNCTION append_admin_activity();
