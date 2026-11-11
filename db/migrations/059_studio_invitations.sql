CREATE TABLE IF NOT EXISTS studio_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('staff')),
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  accepted_by uuid REFERENCES users(id),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_invitations_studio ON studio_invitations(studio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_invitations_token ON studio_invitations(token_hash) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_studio_invitations_email ON studio_invitations(email, status);
