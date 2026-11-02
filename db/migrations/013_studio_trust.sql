-- Approval is tier 1. Only an explicit admin decision grants tier 2.
ALTER TABLE studios
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN verified_by uuid REFERENCES users(id),
  ADD CONSTRAINT studios_verification_consistent CHECK (
    (verified_at IS NULL AND verified_by IS NULL) OR
    (verified_at IS NOT NULL AND verified_by IS NOT NULL AND status = 'approved')
  );

CREATE TABLE studio_verification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id),
  reviewed_by uuid NOT NULL REFERENCES users(id),
  action text NOT NULL CHECK (action IN ('verified', 'revoked')),
  method text CHECK (method IN ('identity_address', 'business_registration')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((action = 'verified' AND method IS NOT NULL AND reason IS NULL) OR
         (action = 'revoked' AND method IS NULL AND length(trim(reason)) BETWEEN 1 AND 500 AND reason IS NOT NULL))
);
CREATE INDEX studio_verification_history_studio_idx ON studio_verification_history(studio_id, created_at DESC);
ALTER TABLE studio_verification_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON studio_verification_history FROM anon, authenticated;
