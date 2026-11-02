-- Category approval metadata is separate from the rejection-only reason field.
ALTER TABLE workshop_review_history ADD COLUMN category_name text;
