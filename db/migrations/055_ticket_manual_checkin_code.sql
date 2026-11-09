ALTER TABLE tickets
  ADD COLUMN manual_code text NOT NULL
  DEFAULT upper(
    translate(
      substr(encode(uuid_send(gen_random_uuid()), 'base64'), 1, 8),
      '+/',
      '-_'
    )
  );

ALTER TABLE tickets
  ADD CONSTRAINT tickets_manual_code_format
  CHECK (manual_code ~ '^[A-Za-z0-9_-]{8}$');

CREATE UNIQUE INDEX tickets_manual_code_unique
  ON tickets(manual_code);
