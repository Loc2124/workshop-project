CREATE TABLE provinces (
  id          text PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  sort_order  integer NOT NULL UNIQUE CHECK (sort_order > 0)
);

INSERT INTO provinces (id, name, sort_order) VALUES
  ('an-giang', 'An Giang', 1),
  ('bac-ninh', 'Bắc Ninh', 2),
  ('ca-mau', 'Cà Mau', 3),
  ('cao-bang', 'Cao Bằng', 4),
  ('can-tho', 'Cần Thơ', 5),
  ('da-nang', 'Đà Nẵng', 6),
  ('dak-lak', 'Đắk Lắk', 7),
  ('dien-bien', 'Điện Biên', 8),
  ('dong-nai', 'Đồng Nai', 9),
  ('dong-thap', 'Đồng Tháp', 10),
  ('gia-lai', 'Gia Lai', 11),
  ('ha-noi', 'Hà Nội', 12),
  ('ha-tinh', 'Hà Tĩnh', 13),
  ('hai-phong', 'Hải Phòng', 14),
  ('ho-chi-minh', 'TP. Hồ Chí Minh', 15),
  ('hue', 'Huế', 16),
  ('hung-yen', 'Hưng Yên', 17),
  ('khanh-hoa', 'Khánh Hòa', 18),
  ('lai-chau', 'Lai Châu', 19),
  ('lam-dong', 'Lâm Đồng', 20),
  ('lang-son', 'Lạng Sơn', 21),
  ('lao-cai', 'Lào Cai', 22),
  ('nghe-an', 'Nghệ An', 23),
  ('ninh-binh', 'Ninh Bình', 24),
  ('phu-tho', 'Phú Thọ', 25),
  ('quang-ngai', 'Quảng Ngãi', 26),
  ('quang-ninh', 'Quảng Ninh', 27),
  ('quang-tri', 'Quảng Trị', 28),
  ('son-la', 'Sơn La', 29),
  ('tay-ninh', 'Tây Ninh', 30),
  ('thai-nguyen', 'Thái Nguyên', 31),
  ('thanh-hoa', 'Thanh Hóa', 32),
  ('tuyen-quang', 'Tuyên Quang', 33),
  ('vinh-long', 'Vĩnh Long', 34);

CREATE TABLE areas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id text NOT NULL REFERENCES provinces(id),
  name        text NOT NULL,
  sort_order  integer NOT NULL CHECK (sort_order > 0),
  UNIQUE (province_id, name),
  UNIQUE (id, province_id)
);

ALTER TABLE organizers RENAME TO studios;
ALTER TABLE studios
  ADD COLUMN province_id text REFERENCES provinces(id),
  ADD COLUMN area_id uuid,
  ADD CONSTRAINT fk_studios_area_province
    FOREIGN KEY (area_id, province_id) REFERENCES areas(id, province_id),
  ADD CONSTRAINT chk_studios_area_requires_province
    CHECK (area_id IS NULL OR province_id IS NOT NULL);

CREATE TABLE studio_members (
  studio_id   uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('owner', 'staff')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (studio_id, user_id)
);

INSERT INTO studio_members (studio_id, user_id, role)
SELECT id, user_id, 'owner'
FROM studios
WHERE user_id IS NOT NULL;

ALTER TABLE studios DROP COLUMN user_id;
ALTER TABLE workshops RENAME COLUMN organizer_id TO studio_id;
ALTER TABLE workshops ALTER COLUMN district DROP NOT NULL;

CREATE INDEX idx_studios_province_area_status
  ON studios (province_id, area_id, status);
CREATE INDEX idx_studio_members_user ON studio_members (user_id, studio_id);
CREATE UNIQUE INDEX uq_studio_owner
  ON studio_members (studio_id) WHERE role = 'owner';

DROP VIEW v_organizer_revenue;
CREATE VIEW v_studio_revenue AS
SELECT w.studio_id,
       date_trunc('month', b.paid_at) AS month,
       count(*)                       AS paid_bookings,
       sum(b.quantity)                AS tickets,
       sum(b.total_amount)            AS revenue
FROM bookings b
JOIN sessions s ON s.id = b.session_id
JOIN workshops w ON w.id = s.workshop_id
WHERE b.status = 'paid' AND s.status <> 'cancelled'
GROUP BY w.studio_id, date_trunc('month', b.paid_at);
ALTER VIEW v_studio_revenue SET (security_invoker = true);

UPDATE users SET role = 'customer' WHERE role = 'organizer';

ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
CREATE TYPE user_role_v2 AS ENUM ('customer', 'admin');
ALTER TABLE users
  ALTER COLUMN role TYPE user_role_v2 USING role::text::user_role_v2;
DROP TYPE user_role;
ALTER TYPE user_role_v2 RENAME TO user_role;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'customer';

ALTER TABLE provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE studios ENABLE ROW LEVEL SECURITY;
