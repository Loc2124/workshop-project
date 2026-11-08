-- Stage 5 financial workflow foundation. Deadlines remain nullable until the
-- working-day calendar is selected and configured; this migration does not
-- initiate or record any real-world transfer.
CREATE TABLE financial_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id),
  studio_id uuid NOT NULL REFERENCES studios(id),
  ticket_id uuid REFERENCES tickets(id),
  kind text NOT NULL CHECK (kind IN ('customer_refund','studio_payout','studio_recovery')),
  source_key text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'awaiting_funds'
    CHECK (status IN ('awaiting_funds','awaiting_approval','approved','processing','partially_paid','paid','failed','manual_review','cancelled')),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (kind, source_key)
);
CREATE INDEX financial_obligations_queue_idx
  ON financial_obligations (due_at NULLS LAST, created_at)
  WHERE status NOT IN ('paid','cancelled');
CREATE INDEX financial_obligations_booking_idx ON financial_obligations (booking_id, created_at);

CREATE TABLE financial_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id uuid NOT NULL REFERENCES financial_obligations(id),
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  purpose text NOT NULL CHECK (purpose IN ('studio_repayment','customer_refund','studio_payout','platform_advance')),
  amount bigint NOT NULL CHECK (amount > 0),
  provider_fee bigint CHECK (provider_fee IS NULL OR provider_fee >= 0),
  provider text,
  reference text,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'recorded'
    CHECK (status IN ('recorded','pending_approval','approved','processing','succeeded','failed','manual_review')),
  created_by uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  settled_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((status <> 'succeeded') OR settled_at IS NOT NULL),
  CHECK ((status <> 'approved') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE UNIQUE INDEX financial_transfer_reference_unique
  ON financial_transfers (provider, reference) WHERE reference IS NOT NULL;
CREATE INDEX financial_transfers_obligation_idx ON financial_transfers (obligation_id, created_at);

CREATE TABLE financial_transfer_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transfer_id uuid NOT NULL REFERENCES financial_transfers(id),
  actor_id uuid REFERENCES users(id),
  event text NOT NULL CHECK (event IN ('created','approved','submitted','succeeded','failed','manual_review','corrected')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX financial_transfer_events_transfer_idx ON financial_transfer_events (transfer_id, created_at);

ALTER TABLE financial_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transfer_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON financial_obligations, financial_transfers, financial_transfer_events FROM PUBLIC, anon, authenticated;

-- Every transfer requires an approving admin before it can be submitted or
-- recorded as settled. This includes reconciled incoming studio repayments.
CREATE FUNCTION guard_financial_transfer_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.obligation_id IS DISTINCT FROM OLD.obligation_id
     OR NEW.direction IS DISTINCT FROM OLD.direction
     OR NEW.purpose IS DISTINCT FROM OLD.purpose
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Financial transfer details are immutable';
  END IF;
  IF OLD.provider_fee IS NOT NULL AND NEW.provider_fee IS DISTINCT FROM OLD.provider_fee THEN
    RAISE EXCEPTION 'Recorded provider fee cannot be overwritten';
  END IF;
  IF OLD.status IN ('succeeded','failed') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Terminal financial transfer status cannot be overwritten';
  END IF;
  IF NEW.status IN ('approved','processing','succeeded')
     AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL) THEN
    RAISE EXCEPTION 'Financial transfer requires admin approval';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER financial_transfer_update_guard BEFORE UPDATE ON financial_transfers
  FOR EACH ROW EXECUTE FUNCTION guard_financial_transfer_update();

CREATE FUNCTION prevent_financial_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Financial transfer events are append-only';
END;
$$;
CREATE TRIGGER financial_transfer_events_immutable
  BEFORE UPDATE OR DELETE ON financial_transfer_events
  FOR EACH ROW EXECUTE FUNCTION prevent_financial_event_mutation();
