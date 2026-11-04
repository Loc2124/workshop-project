ALTER TABLE bookings
  ADD COLUMN contact_name text,
  ADD COLUMN contact_phone text,
  ADD COLUMN deposit_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN paid_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN payment_mode text NOT NULL DEFAULT 'legacy';

UPDATE bookings b
SET paid_amount = CASE
  WHEN b.status = 'paid' THEN b.total_amount
  ELSE LEAST(
    b.total_amount,
    COALESCE((
      SELECT sum(p.amount)
      FROM payments p
      WHERE p.booking_id = b.id AND p.status = 'paid'
    ), 0)
  )::integer
END;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_contact_name_check
    CHECK (contact_name IS NULL OR length(trim(contact_name)) BETWEEN 1 AND 120),
  ADD CONSTRAINT bookings_contact_phone_check
    CHECK (contact_phone IS NULL OR length(trim(contact_phone)) BETWEEN 8 AND 30),
  ADD CONSTRAINT bookings_deposit_amount_check
    CHECK (deposit_amount BETWEEN 0 AND total_amount),
  ADD CONSTRAINT bookings_paid_amount_check
    CHECK (paid_amount BETWEEN 0 AND total_amount),
  ADD CONSTRAINT bookings_payment_mode_check
    CHECK (payment_mode IN ('payos_deposit', 'in_studio', 'free', 'legacy'));

ALTER TABLE payments
  ADD COLUMN kind text NOT NULL DEFAULT 'legacy',
  ADD CONSTRAINT payments_kind_check
    CHECK (kind IN ('deposit', 'balance', 'in_studio', 'legacy'));

CREATE SEQUENCE booking_order_code_seq
  AS integer
  MINVALUE 1
  MAXVALUE 999999999
  START WITH 100000000;
REVOKE ALL ON SEQUENCE booking_order_code_seq FROM PUBLIC, anon, authenticated;

CREATE TABLE user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  booking_id uuid REFERENCES bookings(id),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  href text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CHECK (length(trim(type)) BETWEEN 1 AND 80),
  CHECK (length(trim(title)) BETWEEN 1 AND 200),
  CHECK (length(trim(href)) BETWEEN 1 AND 500)
);
CREATE INDEX user_notifications_user_idx
  ON user_notifications(user_id, created_at DESC);
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_notifications FROM anon, authenticated;
