-- Optional for existing images/older clients; ready confirms both uploads.
ALTER TABLE images
  ADD COLUMN thumbnail_key text,
  ADD COLUMN thumbnail_byte_size integer,
  ADD CONSTRAINT image_thumbnail_pair CHECK (
    (thumbnail_key IS NULL AND thumbnail_byte_size IS NULL) OR
    (thumbnail_key IS NOT NULL AND thumbnail_byte_size BETWEEN 1 AND 204800)
  );
CREATE UNIQUE INDEX images_thumbnail_key_idx ON images(thumbnail_key) WHERE thumbnail_key IS NOT NULL;
