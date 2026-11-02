-- Keep selection history instead of physically deleting administrative relationships.
ALTER TABLE featured_items ADD COLUMN deleted_at timestamptz;
ALTER TABLE featured_items DROP CONSTRAINT featured_items_type_sort_order_key;
CREATE UNIQUE INDEX featured_items_active_order_idx ON featured_items(type,sort_order) WHERE deleted_at IS NULL;
ALTER TABLE studio_categories ADD COLUMN deleted_at timestamptz;
CREATE INDEX studio_categories_active_idx ON studio_categories(studio_id,category_id) WHERE deleted_at IS NULL;
