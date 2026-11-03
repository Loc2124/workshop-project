ALTER TABLE images
  ADD COLUMN medium_key text,
  ADD COLUMN medium_byte_size integer,
  ADD CONSTRAINT image_medium_pair CHECK (
    (medium_key IS NULL AND medium_byte_size IS NULL) OR
    (medium_key IS NOT NULL AND medium_byte_size IS NOT NULL AND medium_byte_size BETWEEN 1 AND 614400)
  );
CREATE UNIQUE INDEX images_medium_key_idx ON images(medium_key) WHERE medium_key IS NOT NULL;
