-- Private proposal submitted with a studio application; never a public category before approval.
ALTER TABLE studios ADD COLUMN proposed_category_name text
  CHECK (proposed_category_name IS NULL OR char_length(trim(proposed_category_name)) BETWEEN 2 AND 80);
