ALTER TABLE studio_payout_accounts
  ADD COLUMN bank_bin varchar(6) CHECK (bank_bin IS NULL OR bank_bin ~ '^[0-9]{6}$');
