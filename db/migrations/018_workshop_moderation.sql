-- Review status remains independent of public visibility.
ALTER TABLE workshops ADD COLUMN visibility_status text NOT NULL DEFAULT 'active'
  CHECK (visibility_status IN ('active','hidden','removed')),
  ADD COLUMN hidden_reason text,
  ADD COLUMN moderated_by uuid REFERENCES users(id),
  ADD COLUMN moderated_at timestamptz;
CREATE INDEX workshops_visibility_idx ON workshops(visibility_status,created_at DESC);
CREATE TABLE studio_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  studio_id uuid NOT NULL REFERENCES studios(id),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  title text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX studio_notifications_user_idx ON studio_notifications(user_id,created_at DESC);
ALTER TABLE studio_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON studio_notifications FROM anon,authenticated;
