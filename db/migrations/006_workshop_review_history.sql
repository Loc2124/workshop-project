CREATE TABLE workshop_review_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  reviewed_by uuid NOT NULL REFERENCES users(id),
  decision approval_status NOT NULL
    CHECK (decision IN ('approved', 'rejected')),
  reason text,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_workshop_review_reason CHECK (
    (decision = 'rejected' AND nullif(btrim(reason), '') IS NOT NULL)
    OR (decision = 'approved' AND reason IS NULL)
  )
);

CREATE INDEX idx_workshop_review_history_workshop
  ON workshop_review_history (workshop_id, reviewed_at DESC, id);

ALTER TABLE workshop_review_history ENABLE ROW LEVEL SECURITY;
