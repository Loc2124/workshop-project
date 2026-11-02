-- Preserve existing studio categories while allowing multiple workshop types.
CREATE TABLE studio_categories (
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  category_id text NOT NULL REFERENCES categories(id),
  PRIMARY KEY (studio_id, category_id)
);
CREATE INDEX studio_categories_category_id_idx ON studio_categories(category_id);
ALTER TABLE studio_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON studio_categories FROM anon, authenticated;
INSERT INTO studio_categories (studio_id, category_id)
SELECT id, category_id FROM studios;
