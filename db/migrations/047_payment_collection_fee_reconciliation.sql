CREATE TABLE payment_fee_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL UNIQUE REFERENCES payments(id),
  amount bigint NOT NULL CHECK (amount >= 0),
  provider text NOT NULL,
  provider_reference text NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE payment_fee_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_fee_reconciliations FROM PUBLIC,anon,authenticated;
