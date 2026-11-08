ALTER TABLE studios ADD COLUMN deposit_mode text NOT NULL DEFAULT 'none' CHECK(deposit_mode IN ('none','optional','required')),
  ADD COLUMN deposit_percent integer,
  ADD COLUMN release_if_unconfirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN release_before_minutes integer NOT NULL DEFAULT 120 CHECK(release_before_minutes BETWEEN 15 AND 1440),
  ADD CONSTRAINT studio_deposit_policy CHECK((deposit_mode='none' AND deposit_percent IS NULL) OR (deposit_mode IN ('optional','required') AND deposit_percent IS NOT NULL AND deposit_percent BETWEEN 1 AND 50));
ALTER TABLE workshops DROP CONSTRAINT IF EXISTS workshops_deposit_percent_check;
ALTER TABLE workshops ALTER COLUMN deposit_percent DROP NOT NULL, ALTER COLUMN deposit_percent DROP DEFAULT;
ALTER TABLE workshops ADD COLUMN deposit_mode_override text CHECK(deposit_mode_override IN ('none','optional','required')),
  ADD COLUMN included text[] NOT NULL DEFAULT '{}';
DROP TRIGGER IF EXISTS workshop_deposit_guard ON workshops;
-- Preserve an existing uniform studio rate; no percentage is invented for new studios.
UPDATE studios st SET deposit_mode='required',deposit_percent=r.rate FROM (
 SELECT studio_id,min(deposit_percent) AS rate FROM workshops GROUP BY studio_id
 HAVING min(deposit_percent)>0 AND count(DISTINCT deposit_percent)=1
) r WHERE st.id=r.studio_id AND st.status='approved' AND st.verified_at IS NOT NULL AND studio_profile_complete(st);
UPDATE workshops w SET
 deposit_mode_override=CASE WHEN st.deposit_mode='required' AND st.deposit_percent=w.deposit_percent THEN NULL WHEN w.deposit_percent>0 THEN 'required' END,
 deposit_percent=CASE WHEN st.deposit_mode='required' AND st.deposit_percent=w.deposit_percent THEN NULL ELSE NULLIF(w.deposit_percent,0) END
FROM studios st WHERE st.id=w.studio_id;
ALTER TABLE workshops ADD CONSTRAINT workshop_deposit_policy CHECK(
  (deposit_mode_override IS NULL AND deposit_percent IS NULL) OR
  (deposit_mode_override='none' AND deposit_percent IS NULL) OR
  (deposit_mode_override IS NOT NULL AND deposit_mode_override IN ('optional','required') AND deposit_percent IS NOT NULL AND deposit_percent BETWEEN 1 AND 50));
CREATE OR REPLACE FUNCTION guard_workshop_deposit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE st studios;
BEGIN
  SELECT * INTO st FROM studios WHERE id=NEW.studio_id FOR UPDATE;
  IF NEW.deposit_mode_override IN ('optional','required') AND NOT (st.status='approved' AND st.verified_at IS NOT NULL AND studio_profile_complete(st)) THEN
    RAISE EXCEPTION 'Studio chưa được xác minh để bật đặt cọc' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS workshop_deposit_guard ON workshops;
CREATE TRIGGER workshop_deposit_guard BEFORE INSERT OR UPDATE OF deposit_percent,deposit_mode_override ON workshops FOR EACH ROW EXECUTE FUNCTION guard_workshop_deposit();
CREATE FUNCTION effective_deposit_mode(st studios,w workshops) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN (st).status='approved' AND (st).verified_at IS NOT NULL AND studio_profile_complete(st) THEN COALESCE((w).deposit_mode_override,(st).deposit_mode) ELSE 'none' END
$$;
CREATE FUNCTION effective_deposit_percent(st studios,w workshops) RETURNS integer LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN effective_deposit_mode(st,w)='none' THEN 0 ELSE COALESCE((w).deposit_percent,(st).deposit_percent,0) END
$$;
ALTER TABLE bookings ADD COLUMN deposit_percent integer CHECK(deposit_percent BETWEEN 1 AND 50),
  ADD COLUMN deposit_mode text CHECK(deposit_mode IN ('none','optional','required')),
  ADD COLUMN refund_due_amount integer NOT NULL DEFAULT 0 CHECK(refund_due_amount>=0),
  ADD COLUMN refund_status text NOT NULL DEFAULT 'not_applicable' CHECK(refund_status IN ('not_applicable','pending','forfeited','refunded')),
  ADD COLUMN refund_reference text, ADD COLUMN refunded_at timestamptz,
  ADD COLUMN attendance_status text NOT NULL DEFAULT 'unmarked' CHECK(attendance_status IN ('unmarked','attended','absent')),
  ADD COLUMN attendance_marked_by uuid REFERENCES users(id), ADD COLUMN attendance_marked_at timestamptz,
  ADD COLUMN attendance_confirmed_at timestamptz,
  ADD COLUMN release_if_unconfirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN release_before_minutes integer,
  ADD COLUMN reschedule_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN original_starts_at timestamptz, ADD COLUMN original_ends_at timestamptz;
ALTER TABLE payments ADD COLUMN transfer_description text;
CREATE TABLE studio_deposit_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,actor_id uuid REFERENCES users(id) ON DELETE SET NULL,actor_name text,before_state jsonb NOT NULL,after_state jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO studio_deposit_history(studio_id,before_state,after_state) SELECT id,'{"depositMode":"none","depositPercent":null}'::jsonb,jsonb_build_object('depositMode',deposit_mode,'depositPercent',deposit_percent) FROM studios WHERE deposit_mode<>'none';
ALTER TABLE studio_deposit_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON studio_deposit_history FROM anon,authenticated;
CREATE TABLE booking_reminders(booking_id uuid NOT NULL REFERENCES bookings(id),kind text NOT NULL CHECK(kind IN ('24h','2h')),starts_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(booking_id,kind,starts_at));
CREATE TABLE email_outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid REFERENCES bookings(id),recipient text NOT NULL,subject text NOT NULL,body text NOT NULL,idempotency_key text NOT NULL UNIQUE,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed')),attempts integer NOT NULL DEFAULT 0,locked_at timestamptz,sent_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE booking_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_reminders,email_outbox FROM anon,authenticated;
CREATE TABLE session_schedule_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES sessions(id),actor_id uuid NOT NULL REFERENCES users(id),previous_starts_at timestamptz NOT NULL,previous_ends_at timestamptz NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE session_schedule_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON session_schedule_history FROM anon,authenticated;
UPDATE settings SET value=jsonb_set(value::jsonb,'{booking,cancellationHours}','24'::jsonb) WHERE key='site';
CREATE FUNCTION guard_studio_payment_settings() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status<>'approved' OR NEW.verified_at IS NULL OR NOT studio_profile_complete(NEW) THEN
   IF OLD.deposit_mode<>'none' THEN
     INSERT INTO studio_deposit_history(studio_id,actor_id,before_state,after_state)
     VALUES(NEW.id,NEW.reviewed_by,jsonb_build_object('depositMode',OLD.deposit_mode,'depositPercent',OLD.deposit_percent),jsonb_build_object('depositMode','none','depositPercent',NULL));
   END IF;
   NEW.deposit_mode:='none'; NEW.deposit_percent:=NULL;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER studio_payment_settings_guard BEFORE UPDATE OF deposit_mode,deposit_percent,verified_at,status ON studios FOR EACH ROW EXECUTE FUNCTION guard_studio_payment_settings();
