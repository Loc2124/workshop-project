ALTER TABLE studios
  ADD COLUMN contact_phone text,
  ADD COLUMN contact_email text,
  ADD COLUMN photo_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN facebook_url text,
  ADD COLUMN instagram_url text,
  ADD COLUMN google_maps_url text,
  ADD CONSTRAINT studio_photo_count CHECK (cardinality(photo_ids) <= 8);

ALTER TABLE studios ADD COLUMN is_draft boolean NOT NULL DEFAULT false;
CREATE TABLE images (
  id uuid PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES studios(id),
  workshop_id uuid REFERENCES workshops(id),
  uploaded_by uuid NOT NULL REFERENCES users(id),
  key text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'ready', 'deleting', 'deleted')),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 1048576),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX images_studio_idx ON images(studio_id, state);
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON images FROM anon, authenticated;

ALTER TABLE workshops ADD COLUMN deposit_percent integer NOT NULL DEFAULT 0 CHECK (deposit_percent BETWEEN 0 AND 30);

-- Incomplete legacy profiles remain editable but cannot claim a trust tier or collect deposits.
CREATE FUNCTION studio_profile_complete(st studios) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(length(trim(st.contact_phone)) > 0 AND length(trim(st.contact_email)) > 0
    AND cardinality(st.photo_ids) >= 3
    AND (SELECT count(DISTINCT p.id) FROM images p WHERE p.id = ANY(st.photo_ids) AND p.state = 'ready' AND p.studio_id = st.id AND p.workshop_id IS NULL) = cardinality(st.photo_ids), false)
$$;

-- Keep stored deposit settings inert when eligibility is lost. New financial mutations lock the studio first.
CREATE FUNCTION guard_workshop_deposit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE st studios;
BEGIN
  SELECT * INTO st FROM studios WHERE id = NEW.studio_id FOR UPDATE;
  IF NEW.deposit_percent > 0 AND NOT (st.status = 'approved' AND st.verified_at IS NOT NULL AND studio_profile_complete(st)) THEN
    RAISE EXCEPTION 'Only verified studios with complete profiles may configure deposits' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER workshop_deposit_guard BEFORE INSERT OR UPDATE OF deposit_percent ON workshops
  FOR EACH ROW EXECUTE FUNCTION guard_workshop_deposit();
