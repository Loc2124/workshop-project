ALTER TABLE financial_obligations
  ADD COLUMN payout_snapshot_at timestamptz,
  ADD COLUMN payout_snapshot jsonb;

ALTER TABLE financial_obligations
  ADD CONSTRAINT studio_payout_snapshot_pair CHECK (
    (payout_snapshot_at IS NULL) = (payout_snapshot IS NULL)
  );
