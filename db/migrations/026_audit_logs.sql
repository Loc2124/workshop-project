CREATE TABLE audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid,
 actor_name text NOT NULL,
 action text NOT NULL,
 target_type text NOT NULL,
 target_id text NOT NULL,
 target_name text NOT NULL,
 reason text,
 "before" jsonb,
 "after" jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX audit_logs_recent_idx ON audit_logs(created_at DESC,id DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs(actor_id,created_at DESC);
CREATE INDEX audit_logs_action_idx ON audit_logs(action,created_at DESC);
CREATE INDEX audit_logs_target_idx ON audit_logs(target_type,target_id,created_at DESC);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON audit_logs FROM PUBLIC,anon,authenticated;

-- Historical rows retain only recorded facts; unavailable snapshots remain NULL.
INSERT INTO audit_logs(actor_id,actor_name,action,target_type,target_id,target_name,reason,"before","after",created_at)
 SELECT actor_id,actor_name,action,entity_type,entity_id::text,entity_name,reason,
 CASE WHEN previous_status IS NOT NULL THEN jsonb_build_object('status',previous_status) END,
 CASE WHEN new_status IS NOT NULL THEN jsonb_build_object('status',new_status) END,created_at
 FROM admin_activity_log ORDER BY id;

-- Transaction-local snapshots: never a second persistent copy of credentials.
CREATE FUNCTION capture_audit_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind text:=TG_ARGV[0]; identifier text; prior jsonb; next jsonb; state jsonb; setting text;
BEGIN
 IF TG_OP<>'INSERT' THEN prior:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN next:=to_jsonb(NEW); END IF;
 identifier:=coalesce(next->>'id',prior->>'id',next->>'key',prior->>'key');
 IF kind='user' THEN
  IF prior IS NOT NULL THEN prior:=jsonb_build_object('id',prior->'id','full_name',prior->'full_name','email',prior->'email','role',prior->'role','is_blocked',prior->'is_blocked','blocked_reason',prior->'blocked_reason','blocked_by',prior->'blocked_by','blocked_at',prior->'blocked_at'); END IF;
  IF next IS NOT NULL THEN next:=jsonb_build_object('id',next->'id','full_name',next->'full_name','email',next->'email','role',next->'role','is_blocked',next->'is_blocked','blocked_reason',next->'blocked_reason','blocked_by',next->'blocked_by','blocked_at',next->'blocked_at'); END IF;
 END IF;
 setting:='app.audit_'||kind||'_'||md5(identifier);
 state:=nullif(current_setting(setting,true),'')::jsonb;
 IF state IS NOT NULL THEN prior:=state->'before'; END IF;
 PERFORM set_config(setting,jsonb_build_object('targetId',identifier,'before',prior,'after',next)::text,true);
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON studios FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('studio');
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON workshops FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('workshop');
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON bookings FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('booking');
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('user');
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON categories FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('category');
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON reports FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('report');
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('review');
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON message_templates FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('message_template');

CREATE FUNCTION write_audit_log(actor uuid,actor_label text,event_action text,kind text,identifier text,label text,event_reason text,prior jsonb,next jsonb,event_time timestamptz DEFAULT clock_timestamp()) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE result uuid;
BEGIN
 INSERT INTO audit_logs(actor_id,actor_name,action,target_type,target_id,target_name,reason,"before","after",created_at)
 VALUES(actor,actor_label,event_action,kind,identifier,label,event_reason,prior,next,event_time) RETURNING id INTO result;
 RETURN result;
END;
$$;

-- Existing DB-driven studio/booking/review actions and the shared API helper use one writer.
CREATE FUNCTION mirror_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state jsonb; identifier text:=NEW.entity_id::text; setting text;
BEGIN
 setting:='app.audit_'||NEW.entity_type||'_'||replace(NEW.entity_id::text,'-','');
 IF NEW.entity_type NOT IN ('category','message_template') THEN setting:='app.audit_'||NEW.entity_type||'_'||md5(identifier); END IF;
 state:=nullif(current_setting(setting,true),'')::jsonb;
 IF state IS NOT NULL THEN identifier:=state->>'targetId'; END IF;
 PERFORM write_audit_log(NEW.actor_id,NEW.actor_name,NEW.action,NEW.entity_type,identifier,NEW.entity_name,NEW.reason,
  CASE WHEN state IS NOT NULL THEN state->'before' WHEN NEW.previous_status IS NOT NULL THEN jsonb_build_object('status',NEW.previous_status) END,
  CASE WHEN state IS NOT NULL THEN state->'after' WHEN NEW.new_status IS NOT NULL THEN jsonb_build_object('status',NEW.new_status) END,NEW.created_at);
 PERFORM set_config(setting,'',true);
 RETURN NEW;
END;
$$;
CREATE TRIGGER admin_audit_mirror AFTER INSERT ON admin_activity_log FOR EACH ROW EXECUTE FUNCTION mirror_admin_audit();

CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit logs are append-only' USING ERRCODE='42501'; END;
$$;
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_logs FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
REVOKE ALL ON FUNCTION capture_audit_snapshot(),write_audit_log(uuid,text,text,text,text,text,text,jsonb,jsonb,timestamptz),mirror_admin_audit(),reject_audit_mutation() FROM PUBLIC,anon,authenticated;
