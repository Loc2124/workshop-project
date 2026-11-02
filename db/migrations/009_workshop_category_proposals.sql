-- Keep suggestions private with the workshop until an admin approves it.
ALTER TABLE workshops ADD COLUMN proposed_category_name text
  CHECK (proposed_category_name IS NULL OR char_length(trim(proposed_category_name)) BETWEEN 2 AND 80);
