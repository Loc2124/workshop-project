ALTER TABLE studios ADD COLUMN is_hidden boolean NOT NULL DEFAULT false, ADD COLUMN hidden_reason text;
ALTER TABLE reviews ADD COLUMN is_hidden boolean NOT NULL DEFAULT false, ADD COLUMN hidden_reason text;
ALTER TABLE studio_notifications ALTER COLUMN workshop_id DROP NOT NULL;
ALTER TABLE content_reports RENAME TO reports;
ALTER TABLE reports RENAME COLUMN reported_by TO reporter_id;
ALTER TABLE reports RENAME COLUMN reviewed_by TO handled_by;
ALTER TABLE reports RENAME COLUMN reviewed_at TO handled_at;
ALTER TABLE reports DROP CONSTRAINT content_reports_status_check;
ALTER TABLE reports ADD COLUMN target_type text, ADD COLUMN target_id uuid, ADD COLUMN detail text NOT NULL DEFAULT '';
UPDATE reports SET target_type=CASE WHEN studio_id IS NOT NULL THEN 'studio' ELSE 'workshop' END,target_id=coalesce(studio_id,workshop_id),status=CASE WHEN status='pending' THEN 'new' ELSE status END;
ALTER TABLE reports ALTER COLUMN target_type SET NOT NULL, ALTER COLUMN target_id SET NOT NULL;
ALTER TABLE reports ALTER COLUMN status SET DEFAULT 'new';
ALTER TABLE reports ADD CONSTRAINT reports_status_check CHECK(status IN ('new','in_progress','resolved','dismissed')),
 ADD CONSTRAINT reports_target_type_check CHECK(target_type IN ('studio','workshop','review')),
 ADD CONSTRAINT reports_reporter_target_unique UNIQUE(reporter_id,target_type,target_id);
ALTER TABLE reports DROP COLUMN studio_id, DROP COLUMN workshop_id;
CREATE INDEX reports_target_idx ON reports(target_type,target_id);
CREATE TABLE report_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),report_id uuid NOT NULL REFERENCES reports(id),author_id uuid REFERENCES users(id) ON DELETE SET NULL,author_name text NOT NULL,body text NOT NULL CHECK(length(trim(body)) BETWEEN 2 AND 3000),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE report_attachments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reporter_id uuid NOT NULL REFERENCES users(id),report_id uuid REFERENCES reports(id),key text NOT NULL UNIQUE,byte_size integer NOT NULL CHECK(byte_size BETWEEN 30 AND 1048576),state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready')),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX report_attachments_report_idx ON report_attachments(report_id);
CREATE INDEX report_attachments_cleanup_idx ON report_attachments(created_at) WHERE report_id IS NULL;
ALTER TABLE report_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reports,report_notes,report_attachments FROM anon,authenticated;
-- Read compatibility for older internal reporting screens.
CREATE VIEW content_reports AS SELECT id,reporter_id AS reported_by,
 CASE WHEN target_type='studio' THEN target_id END AS studio_id,
 CASE WHEN target_type='workshop' THEN target_id END AS workshop_id,
 reason,CASE WHEN status IN ('new','in_progress') THEN 'pending' ELSE status END AS status,
 handled_by AS reviewed_by,handled_at AS reviewed_at,created_at FROM reports;
REVOKE ALL ON content_reports FROM anon,authenticated;
