CREATE TABLE settings (
 key text PRIMARY KEY CHECK(key='site'), value jsonb NOT NULL CHECK(jsonb_typeof(value)='object'),
 updated_by uuid REFERENCES users(id) ON DELETE SET NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO settings(key,value) VALUES('site','{"studio":{"minPhotos":3,"maxPhotos":8,"maxImageMb":10},"support":{"hotline":"1900 8889","workingHours":"8:30–21:00","email":"hotro@openslot.vn"},"booking":{"cancellationHours":24,"maxActiveSlots":5}}');
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON settings FROM PUBLIC,anon,authenticated;
CREATE FUNCTION site_settings() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT value FROM settings WHERE key='site' $$;
REVOKE ALL ON FUNCTION site_settings() FROM PUBLIC,anon,authenticated;
ALTER TABLE studios DROP CONSTRAINT studio_photo_count;
ALTER TABLE studios ADD CONSTRAINT studio_photo_count CHECK(cardinality(photo_ids)<=20);
ALTER TABLE images DROP CONSTRAINT images_byte_size_check;
ALTER TABLE images ADD CONSTRAINT images_byte_size_check CHECK(byte_size BETWEEN 1 AND 20971520);
CREATE OR REPLACE FUNCTION studio_profile_complete(st studios) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce(st.contact_phone ~ '^(0[1-9][0-9]{8,9}|\+84[1-9][0-9]{8,9})$' AND st.contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 AND cardinality(st.photo_ids) BETWEEN (site_settings()->'studio'->>'minPhotos')::int AND (site_settings()->'studio'->>'maxPhotos')::int
 AND (SELECT count(DISTINCT p.id) FROM images p WHERE p.id=ANY(st.photo_ids) AND p.state='ready' AND p.studio_id=st.id AND p.workshop_id IS NULL)=cardinality(st.photo_ids),false)
$$;
CREATE FUNCTION guard_booking_slot_limit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE maximum int; active_count int;
BEGIN
 IF NEW.reservation_status NOT IN ('pending','confirmed') OR NEW.status NOT IN ('pending','paid') OR (NEW.status='pending' AND NEW.reservation_status='pending' AND NEW.hold_expires_at<=now()) THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM sessions WHERE id=NEW.session_id AND starts_at>now() AND status='scheduled') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.user_id=NEW.user_id AND OLD.session_id=NEW.session_id AND OLD.reservation_status IN ('pending','confirmed') AND OLD.status IN ('pending','paid') AND NOT(OLD.status='pending' AND OLD.reservation_status='pending' AND OLD.hold_expires_at<=now()) THEN RETURN NEW; END IF;
 PERFORM id FROM users WHERE id=NEW.user_id FOR UPDATE;
 maximum:=(site_settings()->'booking'->>'maxActiveSlots')::int;
 IF EXISTS(SELECT 1 FROM bookings b JOIN sessions s ON s.id=b.session_id WHERE b.user_id=NEW.user_id AND b.id<>NEW.id AND b.session_id=NEW.session_id AND b.reservation_status IN ('pending','confirmed') AND b.status IN ('pending','paid') AND s.starts_at>now() AND s.status='scheduled' AND NOT(b.status='pending' AND b.reservation_status='pending' AND b.hold_expires_at<=now())) THEN RETURN NEW; END IF;
 SELECT count(DISTINCT b.session_id) INTO active_count FROM bookings b JOIN sessions s ON s.id=b.session_id
 WHERE b.user_id=NEW.user_id AND b.id<>NEW.id AND b.reservation_status IN ('pending','confirmed') AND b.status IN ('pending','paid') AND s.starts_at>now() AND s.status='scheduled' AND NOT(b.status='pending' AND b.reservation_status='pending' AND b.hold_expires_at<=now());
 IF active_count>=maximum THEN RAISE EXCEPTION 'BOOKING_SLOT_LIMIT: maximum % upcoming slots',maximum USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER policy_booking_slots BEFORE INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION guard_booking_slot_limit();
REVOKE ALL ON FUNCTION guard_booking_slot_limit() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION mirror_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state jsonb; identifier text:=NEW.entity_id::text; setting text;
BEGIN
 setting:='app.audit_'||NEW.entity_type||'_'||replace(NEW.entity_id::text,'-','');
 IF NEW.entity_type NOT IN ('category','message_template','settings') THEN setting:='app.audit_'||NEW.entity_type||'_'||md5(identifier); END IF;
 state:=nullif(current_setting(setting,true),'')::jsonb;
 IF state IS NOT NULL THEN identifier:=state->>'targetId'; END IF;
 PERFORM write_audit_log(NEW.actor_id,NEW.actor_name,NEW.action,NEW.entity_type,identifier,NEW.entity_name,NEW.reason,
 CASE WHEN state IS NOT NULL THEN state->'before' WHEN NEW.previous_status IS NOT NULL THEN jsonb_build_object('status',NEW.previous_status) END,
 CASE WHEN state IS NOT NULL THEN state->'after' WHEN NEW.new_status IS NOT NULL THEN jsonb_build_object('status',NEW.new_status) END,NEW.created_at);
 PERFORM set_config(setting,'',true); RETURN NEW;
END;
$$;
