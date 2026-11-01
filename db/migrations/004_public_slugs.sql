ALTER TABLE studios ADD COLUMN slug text;
ALTER TABLE workshops ADD COLUMN slug text;

UPDATE studios
SET slug = 'xuong-' || id::text;

UPDATE workshops
SET slug = 'workshop-' || id::text;

ALTER TABLE studios ALTER COLUMN slug SET NOT NULL;
ALTER TABLE workshops ALTER COLUMN slug SET NOT NULL;
ALTER TABLE studios
  ALTER COLUMN slug SET DEFAULT ('studio-' || gen_random_uuid()::text);
ALTER TABLE workshops
  ALTER COLUMN slug SET DEFAULT ('workshop-' || gen_random_uuid()::text);

CREATE UNIQUE INDEX uq_studios_slug ON studios (slug);
CREATE UNIQUE INDEX uq_workshops_slug ON workshops (slug);
