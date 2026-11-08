CREATE TABLE studio_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id),
  bank_name text NOT NULL CHECK(length(trim(bank_name)) BETWEEN 2 AND 120),
  account_holder text NOT NULL CHECK(length(trim(account_holder)) BETWEEN 2 AND 160),
  account_last4 text NOT NULL CHECK(account_last4 ~ '^[0-9]{4}$'),
  encrypted_number bytea NOT NULL,
  encryption_iv bytea NOT NULL,
  encryption_tag bytea NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected')),
  is_current boolean NOT NULL DEFAULT true,
  changed_by uuid NOT NULL REFERENCES users(id),
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  verification_reference text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((status='verified')=(verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  CHECK (status<>'verified' OR verification_reference IS NOT NULL)
);
CREATE UNIQUE INDEX studio_payout_account_current_idx ON studio_payout_accounts(studio_id) WHERE is_current;
CREATE INDEX studio_payout_account_history_idx ON studio_payout_accounts(studio_id,created_at DESC);
ALTER TABLE studio_payout_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON studio_payout_accounts FROM PUBLIC,anon,authenticated;

ALTER TABLE financial_transfers
  ADD COLUMN destination_studio_account_id uuid REFERENCES studio_payout_accounts(id);

CREATE FUNCTION guard_financial_destination_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.destination_studio_account_id IS NOT NULL
     AND NEW.destination_studio_account_id IS DISTINCT FROM OLD.destination_studio_account_id THEN
    RAISE EXCEPTION 'Approved transfer destination is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER financial_destination_update_guard BEFORE UPDATE ON financial_transfers
  FOR EACH ROW EXECUTE FUNCTION guard_financial_destination_update();
