CREATE TABLE featured_items (
 type text NOT NULL CHECK(type IN ('studio','workshop')),
 target_id uuid NOT NULL,
 sort_order integer NOT NULL,
 PRIMARY KEY(type,target_id),
 UNIQUE(type,sort_order),
 CHECK(sort_order>=1 AND sort_order<=CASE WHEN type='studio' THEN 6 ELSE 8 END)
);
ALTER TABLE featured_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON featured_items FROM anon,authenticated;
