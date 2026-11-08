ALTER TABLE financial_obligations
  ADD COLUMN related_obligation_id uuid REFERENCES financial_obligations(id);
CREATE INDEX financial_obligations_related_idx ON financial_obligations (related_obligation_id)
  WHERE related_obligation_id IS NOT NULL;

-- Each new refund liability has a matching studio-funding obligation.
