-- Drafts remain private via studios.is_draft; submitted profiles use approval_status.
ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'needs_changes';

ALTER TABLE studios
  ADD COLUMN reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN rejection_reason text;

ALTER TABLE studios ADD CONSTRAINT studio_review_reason_length
  CHECK (rejection_reason IS NULL OR char_length(btrim(rejection_reason)) BETWEEN 10 AND 1000);
