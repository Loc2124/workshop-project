CREATE TABLE customer_saved_refund_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  bank_bin text CHECK (bank_bin IS NULL OR bank_bin ~ '^[0-9]{6}$'),
  account_holder text CHECK (account_holder IS NULL OR length(trim(account_holder)) BETWEEN 2 AND 160),
  account_last4 text NOT NULL CHECK (account_last4 ~ '^[0-9]{4}$'),
  encrypted_number bytea,
  encryption_iv bytea,
  encryption_tag bytea,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  CHECK ((deleted_at IS NULL AND bank_bin IS NOT NULL AND account_holder IS NOT NULL
    AND encrypted_number IS NOT NULL AND encryption_iv IS NOT NULL AND encryption_tag IS NOT NULL)
    OR (deleted_at IS NOT NULL AND bank_bin IS NULL AND account_holder IS NULL
    AND encrypted_number IS NULL AND encryption_iv IS NULL AND encryption_tag IS NULL))
);
CREATE INDEX customer_saved_refund_accounts_user_idx
  ON customer_saved_refund_accounts(user_id,created_at DESC) WHERE deleted_at IS NULL;
ALTER TABLE customer_saved_refund_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON customer_saved_refund_accounts FROM PUBLIC,anon,authenticated;

ALTER TABLE customer_refund_accounts
  ADD COLUMN saved_account_id uuid REFERENCES customer_saved_refund_accounts(id);
ALTER TABLE customer_refund_accounts DROP CONSTRAINT customer_refund_accounts_source_check;
ALTER TABLE customer_refund_accounts ADD CONSTRAINT customer_refund_accounts_source_check
  CHECK (source IN ('legacy_booking','customer_input','payment_source','saved_account'));
ALTER TABLE customer_refund_accounts ADD CONSTRAINT saved_refund_source_link
  CHECK ((source='saved_account')=(saved_account_id IS NOT NULL));
