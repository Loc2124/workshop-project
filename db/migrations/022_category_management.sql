ALTER TABLE categories ADD COLUMN is_visible boolean NOT NULL DEFAULT true,
 ADD CONSTRAINT category_other_visible CHECK (id <> 'other' OR is_visible);
-- Preserve configured order and place the special choice after every ordinary category.
UPDATE categories SET sort_order=(SELECT coalesce(max(sort_order),0)+1 FROM categories WHERE id<>'other') WHERE id='other';
CREATE INDEX categories_visible_order_idx ON categories(is_visible,sort_order,id);
