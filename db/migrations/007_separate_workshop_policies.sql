ALTER TABLE workshops RENAME COLUMN policy TO cancellation_policy;
ALTER TABLE workshops ADD COLUMN payment_policy text;
