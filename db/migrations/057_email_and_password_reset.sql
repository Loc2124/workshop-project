CREATE TABLE password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_created ON password_resets(user_id, created_at DESC);
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON password_resets FROM anon, authenticated;

ALTER TABLE bookings ADD COLUMN reminder24h_sent_at timestamptz;
ALTER TABLE bookings ADD COLUMN reminder24h_lock_at timestamptz;
CREATE TABLE workshop_schedule_unsubscribe_tokens (
  workshop_id uuid NOT NULL,
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workshop_id, user_id, token_hash),
  FOREIGN KEY (workshop_id, user_id)
    REFERENCES workshop_schedule_subscriptions(workshop_id, user_id) ON DELETE CASCADE
);
ALTER TABLE workshop_schedule_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON workshop_schedule_unsubscribe_tokens FROM anon, authenticated;

CREATE TABLE email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'complaint')),
  resend_id text,
  idempotency_key text UNIQUE,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX email_logs_retry ON email_logs(status, created_at)
  WHERE status = 'failed';
CREATE INDEX email_logs_recipient ON email_logs(recipient, created_at DESC);
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_logs FROM anon, authenticated;

CREATE TABLE email_suppressions (
  email text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('bounce', 'complaint')),
  source_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_suppressions FROM anon, authenticated;
