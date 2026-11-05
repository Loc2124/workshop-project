ALTER TABLE payments
  ADD COLUMN qr_code text;

ALTER TABLE payments
  ADD CONSTRAINT payments_qr_code_check
  CHECK (qr_code IS NULL OR length(qr_code) <= 4096);
