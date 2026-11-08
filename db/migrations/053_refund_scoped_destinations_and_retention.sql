ALTER TABLE customer_refund_accounts
  ADD COLUMN refund_id uuid REFERENCES financial_obligations(id),
  ADD COLUMN bank_bin text,
  ADD COLUMN source text NOT NULL DEFAULT 'legacy_booking'
    CHECK (source IN ('legacy_booking','customer_input','payment_source')),
  ADD COLUMN purged_at timestamptz;

ALTER TABLE customer_refund_accounts
  ALTER COLUMN bank_name DROP NOT NULL,
  ALTER COLUMN account_holder DROP NOT NULL,
  ALTER COLUMN encrypted_number DROP NOT NULL,
  ALTER COLUMN encryption_iv DROP NOT NULL,
  ALTER COLUMN encryption_tag DROP NOT NULL;

ALTER TABLE customer_refund_accounts
  ADD CONSTRAINT refund_destination_minimal_data CHECK (
    (source='legacy_booking' OR (refund_id IS NOT NULL AND (purged_at IS NOT NULL OR bank_bin ~ '^[0-9]{6}$')))
    AND ((purged_at IS NULL AND encrypted_number IS NOT NULL AND encryption_iv IS NOT NULL AND encryption_tag IS NOT NULL)
      OR (purged_at IS NOT NULL AND encrypted_number IS NULL AND encryption_iv IS NULL AND encryption_tag IS NULL))
  );

-- Booking-scoped rows predate refund-specific destinations. Preserve their
-- audit/transfer references, but require a new refund-scoped destination.
UPDATE customer_refund_accounts SET is_current=false WHERE refund_id IS NULL;
DROP INDEX customer_refund_account_current_idx;
CREATE UNIQUE INDEX customer_refund_account_current_refund_idx
  ON customer_refund_accounts(refund_id) WHERE is_current AND refund_id IS NOT NULL;
CREATE INDEX customer_refund_account_purge_idx
  ON customer_refund_accounts(refund_id,created_at) WHERE purged_at IS NULL;

CREATE FUNCTION guard_refund_destination_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.refund_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM financial_obligations o
    WHERE o.id=NEW.refund_id AND o.kind='customer_refund' AND o.booking_id=NEW.booking_id
  ) THEN
    RAISE EXCEPTION 'Refund destination must match a customer refund obligation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER refund_destination_scope_guard BEFORE INSERT OR UPDATE OF refund_id,booking_id
  ON customer_refund_accounts FOR EACH ROW EXECUTE FUNCTION guard_refund_destination_scope();
