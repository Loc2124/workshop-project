CREATE TABLE financial_due_alerts (
  obligation_id uuid NOT NULL REFERENCES financial_obligations(id),
  stage text NOT NULL CHECK (stage IN ('due_soon','overdue')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(obligation_id,stage)
);
ALTER TABLE financial_due_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON financial_due_alerts FROM PUBLIC,anon,authenticated;
