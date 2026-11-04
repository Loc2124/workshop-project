-- Publication and moderation are independent: owners cannot undo an admin hide.
ALTER TABLE workshops ADD COLUMN publication_status text NOT NULL DEFAULT 'published'
  CHECK (publication_status IN ('draft', 'published'));
-- Preserve existing review decisions. Existing pending records still require review.
CREATE INDEX workshops_publication_idx ON workshops(publication_status, status, visibility_status);
ALTER TABLE studios ADD COLUMN payment_qr_image_id uuid REFERENCES images(id);
