ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'suspended';
ALTER TABLE admin_activity_log ADD COLUMN reason text, ADD COLUMN previous_status text, ADD COLUMN new_status text;

CREATE TABLE studio_status_history (
  id bigserial PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES studios(id),
  from_status text,
  to_status text NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX studio_status_history_timeline_idx ON studio_status_history(studio_id,created_at,id);
ALTER TABLE studio_status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON studio_status_history FROM anon,authenticated;
REVOKE ALL ON SEQUENCE studio_status_history_id_seq FROM anon,authenticated;

-- Only recover reasons and transitions actually present in stored audit data.
UPDATE admin_activity_log a SET reason=st.rejection_reason
FROM studios st WHERE a.entity_type='studio' AND a.entity_id=st.id
  AND a.created_at=st.reviewed_at AND a.action='studio.'||st.status::text
  AND a.action IN ('studio.approved','studio.needs_changes','studio.rejected');
WITH events AS (
  SELECT a.*,CASE WHEN action IN ('studio.submitted','studio.resubmitted') THEN 'pending' ELSE split_part(action,'.',2) END AS target
  FROM admin_activity_log a WHERE entity_type='studio'
  AND action IN ('studio.submitted','studio.resubmitted','studio.pending','studio.approved','studio.needs_changes','studio.rejected')
), timeline AS (
  SELECT *,lag(target) OVER(PARTITION BY entity_id ORDER BY created_at,id) AS previous FROM events
)
INSERT INTO studio_status_history(studio_id,from_status,to_status,actor_id,actor_name,reason,created_at)
SELECT entity_id,previous,target,actor_id,actor_name,reason,created_at FROM timeline;

CREATE OR REPLACE FUNCTION append_admin_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid; action_name text; entity_kind text; entity uuid; label text;
  event_reason text; previous text; target text;
BEGIN
  IF TG_TABLE_NAME='studios' THEN
    entity:=NEW.id;entity_kind:='studio';label:=NEW.name;
    previous:=CASE WHEN OLD.is_draft THEN 'draft' ELSE OLD.status::text END;target:=NEW.status::text;
    IF NEW.status<>'pending' AND NEW.reviewed_by IS NOT NULL AND NEW.reviewed_at IS NOT NULL
      AND (NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR NEW.status IS DISTINCT FROM OLD.status) THEN
      actor:=NEW.reviewed_by;event_reason:=NEW.rejection_reason;
      action_name:=CASE WHEN OLD.status::text='suspended' AND NEW.status='approved' THEN 'studio.restored' ELSE 'studio.'||NEW.status::text END;
    ELSIF NEW.status='pending' AND NOT NEW.is_draft AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      SELECT user_id INTO actor FROM studio_members WHERE studio_id=NEW.id AND role='owner';
      action_name:=CASE WHEN OLD.is_draft THEN 'studio.submitted' ELSE 'studio.resubmitted' END;
    ELSE RETURN NEW;
    END IF;
    INSERT INTO studio_status_history(studio_id,from_status,to_status,actor_id,actor_name,reason)
      SELECT entity,previous,target,actor,full_name,event_reason FROM users WHERE id=actor;
  ELSIF TG_TABLE_NAME='workshop_review_history' THEN
    actor:=NEW.reviewed_by;entity_kind:='workshop';entity:=NEW.workshop_id;
    action_name:='workshop.'||NEW.decision::text;event_reason:=NEW.reason;previous:='pending';target:=NEW.decision::text;
    SELECT title INTO label FROM workshops WHERE id=entity;
  ELSE
    actor:=NEW.reviewed_by;entity_kind:='studio';entity:=NEW.studio_id;
    action_name:='verification.'||NEW.action;event_reason:=NEW.reason;
    SELECT name INTO label FROM studios WHERE id=entity;
  END IF;
  INSERT INTO admin_activity_log(actor_id,actor_name,action,entity_type,entity_id,entity_name,reason,previous_status,new_status)
    SELECT actor,full_name,action_name,entity_kind,entity,label,event_reason,previous,target FROM users WHERE id=actor;
  RETURN NEW;
END;
$$;
