--
-- Open Slot Platform - Complete Database Schema Snapshot
-- Auto-generated from 62 migrations (001 to 061_studio_invitation_optional_email)
-- For development, initial database setup, and graduation thesis reference.
--


-- =============================================================================
-- Migration: 001_init.sql
-- =============================================================================

-- 001_init.sql — PostgreSQL. Tiền là số nguyên VND.
-- Không sửa file này sau khi đã chạy; thay đổi mới dùng migration mới.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ===== Kiểu liệt kê =====
CREATE TYPE user_role        AS ENUM ('customer', 'organizer', 'admin');
CREATE TYPE approval_status    AS ENUM ('pending', 'approved', 'rejected');   -- cờ duyệt dùng chung
CREATE TYPE session_status   AS ENUM ('scheduled', 'cancelled', 'completed');
CREATE TYPE booking_status   AS ENUM ('pending', 'paid', 'expired', 'cancelled', 'refund_needed');
CREATE TYPE payment_status   AS ENUM ('created', 'paid', 'failed', 'cancelled');
CREATE TYPE ticket_status    AS ENUM ('valid', 'used', 'void');

-- ===== Người dùng và đơn vị tổ chức =====
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name     text NOT NULL,
  role          user_role NOT NULL DEFAULT 'customer',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organizers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE REFERENCES users(id),
  name        text NOT NULL,
  description text,
  address     text,
  district    text,
  status      approval_status NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ===== Workshop và buổi =====
CREATE TABLE workshops (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id     uuid NOT NULL REFERENCES organizers(id),
  title            text NOT NULL,
  description      text NOT NULL,
  category         text NOT NULL,            -- gốm, nến, vẽ, cắm hoa...
  level            text NOT NULL DEFAULT 'beginner'
                   CHECK (level IN ('beginner', 'intermediate', 'all')),
  audience         text[] NOT NULL DEFAULT '{}',   -- ví dụ: {cặp đôi, nhóm bạn, một mình}
  takeaway         text,                     -- sản phẩm mang về, có cần chờ nung/khô không
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  base_price       integer NOT NULL CHECK (base_price >= 0),  -- giá tham khảo, giá thật theo buổi
  requirements     text,                     -- điều kiện tham gia
  policy           text,                     -- chính sách hủy/đổi
  district         text NOT NULL,
  address          text,
  status           approval_status NOT NULL DEFAULT 'pending',
  is_simulated     boolean NOT NULL DEFAULT true,  -- dữ liệu mô phỏng
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_workshops_filter ON workshops (status, district, category);

CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  price       integer NOT NULL CHECK (price >= 0),        -- giá mỗi người, VND
  capacity    integer NOT NULL CHECK (capacity > 0),
  seats_held  integer NOT NULL DEFAULT 0 CHECK (seats_held >= 0),  -- đang giữ chờ thanh toán
  seats_sold  integer NOT NULL DEFAULT 0 CHECK (seats_sold >= 0),  -- đã thanh toán
  status      session_status NOT NULL DEFAULT 'scheduled',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  -- Lưới an toàn cuối cùng: dù code sai, DB vẫn không cho vượt sức chứa
  CONSTRAINT chk_capacity CHECK (seats_held + seats_sold <= capacity)
);
CREATE INDEX idx_sessions_workshop_time ON sessions (workshop_id, starts_at);

-- ===== Đặt chỗ, thanh toán, vé =====
CREATE TABLE bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id),
  session_id      uuid NOT NULL REFERENCES sessions(id),
  quantity        integer NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  unit_price      integer NOT NULL CHECK (unit_price >= 0),  -- chụp giá tại thời điểm đặt
  total_amount    integer NOT NULL CHECK (total_amount >= 0),
  status          booking_status NOT NULL DEFAULT 'pending',
  hold_expires_at timestamptz NOT NULL,
  order_code      bigint NOT NULL UNIQUE,                    -- mã đơn gửi nhà cung cấp thanh toán
  created_at      timestamptz NOT NULL DEFAULT now(),
  paid_at         timestamptz,
  CHECK (total_amount = unit_price * quantity)
);
CREATE INDEX idx_bookings_user ON bookings (user_id, created_at DESC);
CREATE INDEX idx_bookings_hold ON bookings (status, hold_expires_at) WHERE status = 'pending';
CREATE INDEX idx_bookings_session ON bookings (session_id, status);

CREATE TABLE payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid NOT NULL REFERENCES bookings(id),
  provider     text NOT NULL DEFAULT 'payos',
  order_code   bigint NOT NULL,
  provider_ref text,                                         -- mã giao dịch phía nhà cung cấp
  amount       integer NOT NULL CHECK (amount >= 0),
  status       payment_status NOT NULL DEFAULT 'created',
  checkout_url text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  paid_at      timestamptz
);
CREATE UNIQUE INDEX uq_payments_provider_ref ON payments (provider, provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX idx_payments_booking ON payments (booking_id);

-- Mọi webhook nhận được đều lưu lại; unique theo khóa chống trùng để xử lý idempotent
CREATE TABLE webhook_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text NOT NULL,
  dedupe_key      text NOT NULL,              -- ví dụ mã giao dịch/reference do nhà cung cấp gửi
  order_code      bigint,
  payload         jsonb NOT NULL,
  signature_valid boolean NOT NULL,
  outcome         text,                       -- processed | duplicate | rejected | late_payment | ...
  received_at     timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz,
  UNIQUE (provider, dedupe_key)
);

-- Mỗi chỗ một vé
CREATE TABLE tickets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES bookings(id),
  seq           integer NOT NULL CHECK (seq >= 1),
  code          text NOT NULL UNIQUE,         -- mã vé hiển thị; mức 3 mã hóa thành QR
  status        ticket_status NOT NULL DEFAULT 'valid',
  issued_at     timestamptz NOT NULL DEFAULT now(),
  checked_in_at timestamptz,
  UNIQUE (booking_id, seq)                    -- chống cấp vé trùng khi xử lý lặp
);

-- ===== Đánh giá (mức 2) =====
CREATE TABLE reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL UNIQUE REFERENCES bookings(id),  -- mỗi booking một đánh giá
  user_id     uuid NOT NULL REFERENCES users(id),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- Quy tắc nghiệp vụ (kiểm ở API + test): chỉ người có booking 'paid' của buổi đã 'completed'/đã qua giờ.

-- ===== Nhật ký tìm kiếm / xếp hạng (phục vụ đánh giá mô hình) =====
CREATE TABLE search_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES users(id),
  query_text     text NOT NULL,
  filters        jsonb NOT NULL DEFAULT '{}',
  candidate_ids  uuid[] NOT NULL DEFAULT '{}',
  ranked_ids     uuid[] NOT NULL DEFAULT '{}',
  model_version  text,
  fallback_used  boolean NOT NULL DEFAULT false,
  latency_ms     integer,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ===== View doanh thu (mức 2): chỉ tính booking đã thanh toán, loại buổi bị hủy =====
CREATE VIEW v_organizer_revenue AS
SELECT w.organizer_id,
       date_trunc('month', b.paid_at) AS month,
       count(*)                       AS paid_bookings,
       sum(b.quantity)                AS tickets,
       sum(b.total_amount)            AS revenue
FROM bookings b
JOIN sessions s ON s.id = b.session_id
JOIN workshops w ON w.id = s.workshop_id
WHERE b.status = 'paid' AND s.status <> 'cancelled'
GROUP BY w.organizer_id, date_trunc('month', b.paid_at);



-- =============================================================================
-- Migration: 002_rls_lockdown.sql
-- =============================================================================

-- 002_rls_lockdown.sql
-- Mục đích: khi chạy trên Supabase, các bảng trong schema public có thể bị truy cập qua REST API
-- bằng khóa công khai. API Node của dự án kết nối trực tiếp bằng quyền chủ sở hữu (bỏ qua RLS),
-- nên ta bật RLS cho mọi bảng và KHÔNG tạo policy nào => vai anon/authenticated không đọc ghi được gì.
-- Chạy được cả trên PostgreSQL local (không có vai anon/authenticated).

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- View chạy theo quyền người gọi thay vì quyền chủ sở hữu (cần PostgreSQL 15+; Docker dùng postgres:16)
ALTER VIEW public.v_organizer_revenue SET (security_invoker = true);

-- Thu hồi quyền của các vai công khai nếu tồn tại (Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
  END IF;
END $$;

-- LƯU Ý: bảng tạo ở migration sau này (kể cả bảng schema_migrations của trình chạy migration)
-- phải được bật RLS tương tự. Test trong bước 0B kiểm tra điều này cho mọi bảng public.



-- =============================================================================
-- Migration: 003_geography_catalog.sql
-- =============================================================================

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



-- =============================================================================
-- Migration: 004_public_slugs.sql
-- =============================================================================

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



-- =============================================================================
-- Migration: 005_categories.sql
-- =============================================================================

-- Category metadata is seeded from data/categories.json. Future changes use a new migration.
CREATE TABLE categories (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  color text,
  placeholder_image text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending')),
  sort_order integer NOT NULL DEFAULT 999,
  keywords text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  image_position text
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

INSERT INTO categories (id, slug, name, icon, color, placeholder_image, status, sort_order, keywords, description, image_position)
SELECT id, slug, name, icon, color, "placeholderImage", status, "sortOrder", keywords, description, "imagePosition"
FROM json_to_recordset($categories$[
  { "id": "ceramics", "slug": "gom", "name": "Gốm", "icon": "Amphora", "color": "#a86e4b", "placeholderImage": "/images/workshops/craftPhoto.jpg", "status": "active", "sortOrder": 1, "keywords": ["gốm", "đất sét", "nặn", "nung", "ceramics", "pottery"], "description": "Tạo hình, trang trí và nung đồ gốm thủ công." },
  { "id": "candles", "slug": "nen", "name": "Nến", "icon": "Flame", "color": "#a77b30", "placeholderImage": "/images/workshops/candlePhoto.jpg", "status": "active", "sortOrder": 2, "keywords": ["nến", "sáp", "thơm", "candle"], "description": "Đổ nến và phối hương từ các loại sáp." },
  { "id": "painting", "slug": "tranh", "name": "Tranh", "icon": "Paintbrush", "color": "#697b5b", "placeholderImage": "/images/workshops/artPhoto.jpg", "status": "active", "sortOrder": 3, "keywords": ["tranh", "vẽ", "màu", "acrylic", "painting"], "description": "Thử vẽ và phối màu trên giấy hoặc canvas." },
  { "id": "flowers", "slug": "hoa", "name": "Hoa", "icon": "Flower2", "color": "#a46e80", "placeholderImage": "/images/workshops/flowerPhoto.jpg", "status": "active", "sortOrder": 4, "keywords": ["hoa", "cắm", "bó", "floral"], "description": "Cắm và bó hoa, sắp đặt những chất liệu tự nhiên.", "imagePosition": "65% 30%" },
  { "id": "perfume", "slug": "nuoc-hoa", "name": "Nước hoa", "icon": "SprayCan", "color": "#887290", "placeholderImage": "/images/workshops/perfume-neutral.svg", "status": "active", "sortOrder": 5, "keywords": ["nước hoa", "hương", "pha chế", "perfume", "fragrance"], "description": "Khám phá các tầng hương và pha chế mùi hương cá nhân.", "imagePosition": "80% 25%" },
  { "id": "accessories", "slug": "phu-kien", "name": "Phụ kiện", "icon": "Gem", "color": "#8b7355", "placeholderImage": "/images/workshops/jewelryPhoto.jpg", "status": "active", "sortOrder": 6, "keywords": ["phụ kiện", "trang sức", "vòng tay", "jewelry"], "description": "Tự làm trang sức và phụ kiện thủ công." },
  { "id": "stamps", "slug": "khac-dau", "name": "Khắc dấu", "icon": "Stamp", "color": "#9a5a50", "placeholderImage": "/images/workshops/stampPhoto.jpg", "status": "active", "sortOrder": 7, "keywords": ["khắc dấu", "con dấu", "in", "stamp"], "description": "Thiết kế, khắc và in dấu bằng tay." },
  { "id": "soap", "slug": "xa-phong", "name": "Xà phòng", "icon": "Droplets", "color": "#658781", "placeholderImage": "/images/workshops/soapPhoto.jpg", "status": "active", "sortOrder": 8, "keywords": ["xà phòng", "soap", "tắm"], "description": "Làm xà phòng thủ công với màu và mùi hương riêng." },
  { "id": "terrazzo", "slug": "terrazzo", "name": "Terrazzo", "icon": "Shapes", "color": "#8b8173", "placeholderImage": "/images/workshops/terrazzoPhoto.jpg", "status": "active", "sortOrder": 9, "keywords": ["terrazzo", "đá mài", "đổ khuôn"], "description": "Phối mảnh màu và đổ khuôn đồ trang trí terrazzo." }
]$categories$::json) AS c(
  id text, slug text, name text, icon text, color text, "placeholderImage" text,
  status text, "sortOrder" integer, keywords text[], description text, "imagePosition" text
);
INSERT INTO categories (id, slug, name, icon, color, placeholder_image)
VALUES ('other', 'khac', U&'Kh\00E1c', 'Shapes', '#78716c', '/images/workshops/category-default.svg');

-- Preserve every unrecognized legacy subject as a pending category rather than discard it.
INSERT INTO categories (id, slug, name, keywords)
SELECT 'legacy-' || md5(lower(trim(w.category))), 'legacy-' || md5(lower(trim(w.category))), min(trim(w.category)), ARRAY[min(trim(w.category))]
FROM workshops w
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = lower(trim(w.category)) OR lower(c.name) = lower(trim(w.category)) OR c.slug = lower(trim(w.category)))
GROUP BY lower(trim(w.category));

ALTER TABLE workshops ADD COLUMN category_id text REFERENCES categories(id);
UPDATE workshops w SET category_id = c.id FROM categories c
WHERE c.id = lower(trim(w.category)) OR lower(c.name) = lower(trim(w.category)) OR c.slug = lower(trim(w.category));
UPDATE workshops SET category_id = 'legacy-' || md5(lower(trim(category))) WHERE category_id IS NULL;
ALTER TABLE workshops ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE workshops ALTER COLUMN category_id SET DEFAULT 'other';
ALTER TABLE workshops DROP COLUMN category;
CREATE INDEX idx_workshops_category ON workshops(category_id, status);

ALTER TABLE studios ADD COLUMN category_id text NOT NULL DEFAULT 'other' REFERENCES categories(id);
UPDATE studios st SET category_id = ranked.category_id FROM (
  SELECT DISTINCT ON (studio_id) studio_id, category_id
  FROM workshops GROUP BY studio_id, category_id ORDER BY studio_id, count(*) DESC, category_id
) ranked WHERE ranked.studio_id = st.id;
CREATE INDEX idx_studios_category ON studios(category_id);



-- =============================================================================
-- Migration: 006_workshop_review_history.sql
-- =============================================================================

CREATE TABLE workshop_review_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  reviewed_by uuid NOT NULL REFERENCES users(id),
  decision approval_status NOT NULL
    CHECK (decision IN ('approved', 'rejected')),
  reason text,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_workshop_review_reason CHECK (
    (decision = 'rejected' AND nullif(btrim(reason), '') IS NOT NULL)
    OR (decision = 'approved' AND reason IS NULL)
  )
);

CREATE INDEX idx_workshop_review_history_workshop
  ON workshop_review_history (workshop_id, reviewed_at DESC, id);

ALTER TABLE workshop_review_history ENABLE ROW LEVEL SECURITY;



-- =============================================================================
-- Migration: 007_separate_workshop_policies.sql
-- =============================================================================

ALTER TABLE workshops RENAME COLUMN policy TO cancellation_policy;
ALTER TABLE workshops ADD COLUMN payment_policy text;



-- =============================================================================
-- Migration: 008_auth_sessions.sql
-- =============================================================================

CREATE TABLE auth_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL UNIQUE
                     CHECK (refresh_token_hash ~ '^[0-9a-f]{64}$'),
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_used_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX idx_auth_sessions_user_active
  ON auth_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;



-- =============================================================================
-- Migration: 009_workshop_category_proposals.sql
-- =============================================================================

-- Keep suggestions private with the workshop until an admin approves it.
ALTER TABLE workshops ADD COLUMN proposed_category_name text
  CHECK (proposed_category_name IS NULL OR char_length(trim(proposed_category_name)) BETWEEN 2 AND 80);



-- =============================================================================
-- Migration: 010_workshop_category_review.sql
-- =============================================================================

-- Category approval metadata is separate from the rejection-only reason field.
ALTER TABLE workshop_review_history ADD COLUMN category_name text;



-- =============================================================================
-- Migration: 011_studio_categories.sql
-- =============================================================================

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



-- =============================================================================
-- Migration: 012_studio_category_proposals.sql
-- =============================================================================

-- Private proposal submitted with a studio application; never a public category before approval.
ALTER TABLE studios ADD COLUMN proposed_category_name text
  CHECK (proposed_category_name IS NULL OR char_length(trim(proposed_category_name)) BETWEEN 2 AND 80);



-- =============================================================================
-- Migration: 013_studio_trust.sql
-- =============================================================================

-- Approval is tier 1. Only an explicit admin decision grants tier 2.
ALTER TABLE studios
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN verified_by uuid REFERENCES users(id),
  ADD CONSTRAINT studios_verification_consistent CHECK (
    (verified_at IS NULL AND verified_by IS NULL) OR
    (verified_at IS NOT NULL AND verified_by IS NOT NULL AND status = 'approved')
  );

CREATE TABLE studio_verification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id),
  reviewed_by uuid NOT NULL REFERENCES users(id),
  action text NOT NULL CHECK (action IN ('verified', 'revoked')),
  method text CHECK (method IN ('identity_address', 'business_registration')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((action = 'verified' AND method IS NOT NULL AND reason IS NULL) OR
         (action = 'revoked' AND method IS NULL AND length(trim(reason)) BETWEEN 1 AND 500 AND reason IS NOT NULL))
);
CREATE INDEX studio_verification_history_studio_idx ON studio_verification_history(studio_id, created_at DESC);
ALTER TABLE studio_verification_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON studio_verification_history FROM anon, authenticated;



-- =============================================================================
-- Migration: 014_studio_evidence_and_deposits.sql
-- =============================================================================

ALTER TABLE studios
  ADD COLUMN contact_phone text,
  ADD COLUMN contact_email text,
  ADD COLUMN photo_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN facebook_url text,
  ADD COLUMN instagram_url text,
  ADD COLUMN google_maps_url text,
  ADD CONSTRAINT studio_photo_count CHECK (cardinality(photo_ids) <= 8);

ALTER TABLE studios ADD COLUMN is_draft boolean NOT NULL DEFAULT false;
CREATE TABLE images (
  id uuid PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES studios(id),
  workshop_id uuid REFERENCES workshops(id),
  uploaded_by uuid NOT NULL REFERENCES users(id),
  key text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'ready', 'deleting', 'deleted')),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 1048576),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX images_studio_idx ON images(studio_id, state);
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON images FROM anon, authenticated;

ALTER TABLE workshops ADD COLUMN deposit_percent integer NOT NULL DEFAULT 0 CHECK (deposit_percent BETWEEN 0 AND 30);

-- Incomplete legacy profiles remain editable but cannot claim a trust tier or collect deposits.
CREATE FUNCTION studio_profile_complete(st studios) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(length(trim(st.contact_phone)) > 0 AND length(trim(st.contact_email)) > 0
    AND cardinality(st.photo_ids) >= 3
    AND (SELECT count(DISTINCT p.id) FROM images p WHERE p.id = ANY(st.photo_ids) AND p.state = 'ready' AND p.studio_id = st.id AND p.workshop_id IS NULL) = cardinality(st.photo_ids), false)
$$;

-- Keep stored deposit settings inert when eligibility is lost. New financial mutations lock the studio first.
CREATE FUNCTION guard_workshop_deposit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE st studios;
BEGIN
  SELECT * INTO st FROM studios WHERE id = NEW.studio_id FOR UPDATE;
  IF NEW.deposit_percent > 0 AND NOT (st.status = 'approved' AND st.verified_at IS NOT NULL AND studio_profile_complete(st)) THEN
    RAISE EXCEPTION 'Only verified studios with complete profiles may configure deposits' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER workshop_deposit_guard BEFORE INSERT OR UPDATE OF deposit_percent ON workshops
  FOR EACH ROW EXECUTE FUNCTION guard_workshop_deposit();



-- =============================================================================
-- Migration: 015_studio_review_decisions.sql
-- =============================================================================

-- Drafts remain private via studios.is_draft; submitted profiles use approval_status.
ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'needs_changes';

ALTER TABLE studios
  ADD COLUMN reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN rejection_reason text;

ALTER TABLE studios ADD CONSTRAINT studio_review_reason_length
  CHECK (rejection_reason IS NULL OR char_length(btrim(rejection_reason)) BETWEEN 10 AND 1000);



-- =============================================================================
-- Migration: 016_admin_overview.sql
-- =============================================================================

ALTER TABLE studios ADD COLUMN submitted_at timestamptz, ADD COLUMN resubmitted_at timestamptz;
UPDATE studios SET submitted_at = created_at WHERE NOT is_draft;
CREATE INDEX studios_review_queue_idx ON studios(status, submitted_at) WHERE NOT is_draft;
CREATE INDEX bookings_created_idx ON bookings(created_at);
CREATE INDEX users_created_idx ON users(created_at);

CREATE TABLE content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  studio_id uuid REFERENCES studios(id),
  workshop_id uuid REFERENCES workshops(id),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(studio_id, workshop_id) = 1)
);
CREATE INDEX content_reports_queue_idx ON content_reports(status, created_at DESC);

CREATE TABLE admin_activity_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  entity_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_activity_recent_idx ON admin_activity_log(created_at DESC, id DESC);
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON content_reports, admin_activity_log FROM anon, authenticated;
REVOKE ALL ON SEQUENCE admin_activity_log_id_seq FROM anon, authenticated;

-- Preserve existing recorded decisions; new events are appended atomically by triggers.
INSERT INTO admin_activity_log(actor_id,actor_name,action,entity_type,entity_id,entity_name,created_at)
SELECT s.reviewed_by,u.full_name,'studio.'||s.status::text,'studio',s.id,s.name,s.reviewed_at
FROM studios s JOIN users u ON u.id=s.reviewed_by WHERE s.reviewed_at IS NOT NULL
UNION ALL
SELECT h.reviewed_by,u.full_name,'workshop.'||h.decision::text,'workshop',w.id,w.title,h.reviewed_at
FROM workshop_review_history h JOIN users u ON u.id=h.reviewed_by JOIN workshops w ON w.id=h.workshop_id
UNION ALL
SELECT h.reviewed_by,u.full_name,'verification.'||h.action,'studio',s.id,s.name,h.created_at
FROM studio_verification_history h JOIN users u ON u.id=h.reviewed_by JOIN studios s ON s.id=h.studio_id;

CREATE FUNCTION track_studio_submission_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW.is_draft AND NEW.status='pending' THEN
    NEW.submitted_at := now();
    IF OLD.status='needs_changes' THEN NEW.resubmitted_at := now(); END IF;
  ELSIF NEW.status<>'pending' THEN NEW.resubmitted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER studio_submission_time BEFORE UPDATE OF status,is_draft ON studios FOR EACH ROW EXECUTE FUNCTION track_studio_submission_time();

CREATE FUNCTION append_admin_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid; action_name text; entity_kind text; entity uuid; label text;
BEGIN
  IF TG_TABLE_NAME='studios' THEN
    entity := NEW.id; entity_kind := 'studio'; label := NEW.name;
    IF NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at AND NEW.reviewed_by IS NOT NULL THEN
      actor := NEW.reviewed_by; action_name := 'studio.'||NEW.status::text;
    ELSIF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at AND NOT NEW.is_draft THEN
      SELECT user_id INTO actor FROM studio_members WHERE studio_id=NEW.id AND role='owner';
      action_name := CASE WHEN OLD.is_draft THEN 'studio.submitted' ELSE 'studio.resubmitted' END;
    ELSE RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME='workshop_review_history' THEN
    actor := NEW.reviewed_by; entity_kind := 'workshop'; entity := NEW.workshop_id; action_name := 'workshop.'||NEW.decision::text;
    SELECT title INTO label FROM workshops WHERE id=entity;
  ELSE
    actor := NEW.reviewed_by; entity_kind := 'studio'; entity := NEW.studio_id; action_name := 'verification.'||NEW.action;
    SELECT name INTO label FROM studios WHERE id=entity;
  END IF;
  INSERT INTO admin_activity_log(actor_id,actor_name,action,entity_type,entity_id,entity_name)
    SELECT actor,full_name,action_name,entity_kind,entity,label FROM users WHERE id=actor;
  RETURN NEW;
END;
$$;
CREATE TRIGGER studio_activity AFTER UPDATE ON studios FOR EACH ROW EXECUTE FUNCTION append_admin_activity();
CREATE TRIGGER workshop_review_activity AFTER INSERT ON workshop_review_history FOR EACH ROW EXECUTE FUNCTION append_admin_activity();
CREATE TRIGGER studio_verification_activity AFTER INSERT ON studio_verification_history FOR EACH ROW EXECUTE FUNCTION append_admin_activity();



-- =============================================================================
-- Migration: 017_studio_suspension_history.sql
-- =============================================================================

ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'suspended';
ALTER TABLE admin_activity_log ADD COLUMN reason text, ADD COLUMN previous_status text, ADD COLUMN new_status text;

CREATE TABLE studio_status_history (
  id bigserial PRIMARY KEY,
  studio_id uuid NOT NULL REFERENCES studios(id),
  from_status text,
  to_status text NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX studio_status_history_timeline_idx ON studio_status_history(studio_id,created_at,id);
ALTER TABLE studio_status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON studio_status_history FROM anon,authenticated;
REVOKE ALL ON SEQUENCE studio_status_history_id_seq FROM anon,authenticated;

-- Only recover reasons and transitions actually present in stored audit data.
UPDATE admin_activity_log a SET reason=st.rejection_reason
FROM studios st WHERE a.entity_type='studio' AND a.entity_id=st.id
  AND a.created_at=st.reviewed_at AND a.action='studio.'||st.status::text
  AND a.action IN ('studio.approved','studio.needs_changes','studio.rejected');
WITH events AS (
  SELECT a.*,CASE WHEN action IN ('studio.submitted','studio.resubmitted') THEN 'pending' ELSE split_part(action,'.',2) END AS target
  FROM admin_activity_log a WHERE entity_type='studio'
  AND action IN ('studio.submitted','studio.resubmitted','studio.pending','studio.approved','studio.needs_changes','studio.rejected')
), timeline AS (
  SELECT *,lag(target) OVER(PARTITION BY entity_id ORDER BY created_at,id) AS previous FROM events
)
INSERT INTO studio_status_history(studio_id,from_status,to_status,actor_id,actor_name,reason,created_at)
SELECT entity_id,previous,target,actor_id,actor_name,reason,created_at FROM timeline;

CREATE OR REPLACE FUNCTION append_admin_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid; action_name text; entity_kind text; entity uuid; label text;
  event_reason text; previous text; target text;
BEGIN
  IF TG_TABLE_NAME='studios' THEN
    entity:=NEW.id;entity_kind:='studio';label:=NEW.name;
    previous:=CASE WHEN OLD.is_draft THEN 'draft' ELSE OLD.status::text END;target:=NEW.status::text;
    IF NEW.status<>'pending' AND NEW.reviewed_by IS NOT NULL AND NEW.reviewed_at IS NOT NULL
      AND (NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR NEW.status IS DISTINCT FROM OLD.status) THEN
      actor:=NEW.reviewed_by;event_reason:=NEW.rejection_reason;
      action_name:=CASE WHEN OLD.status::text='suspended' AND NEW.status='approved' THEN 'studio.restored' ELSE 'studio.'||NEW.status::text END;
    ELSIF NEW.status='pending' AND NOT NEW.is_draft AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      SELECT user_id INTO actor FROM studio_members WHERE studio_id=NEW.id AND role='owner';
      action_name:=CASE WHEN OLD.is_draft THEN 'studio.submitted' ELSE 'studio.resubmitted' END;
    ELSE RETURN NEW;
    END IF;
    INSERT INTO studio_status_history(studio_id,from_status,to_status,actor_id,actor_name,reason)
      SELECT entity,previous,target,actor,full_name,event_reason FROM users WHERE id=actor;
  ELSIF TG_TABLE_NAME='workshop_review_history' THEN
    actor:=NEW.reviewed_by;entity_kind:='workshop';entity:=NEW.workshop_id;
    action_name:='workshop.'||NEW.decision::text;event_reason:=NEW.reason;previous:='pending';target:=NEW.decision::text;
    SELECT title INTO label FROM workshops WHERE id=entity;
  ELSE
    actor:=NEW.reviewed_by;entity_kind:='studio';entity:=NEW.studio_id;
    action_name:='verification.'||NEW.action;event_reason:=NEW.reason;
    SELECT name INTO label FROM studios WHERE id=entity;
  END IF;
  INSERT INTO admin_activity_log(actor_id,actor_name,action,entity_type,entity_id,entity_name,reason,previous_status,new_status)
    SELECT actor,full_name,action_name,entity_kind,entity,label,event_reason,previous,target FROM users WHERE id=actor;
  RETURN NEW;
END;
$$;



-- =============================================================================
-- Migration: 018_workshop_moderation.sql
-- =============================================================================

-- Review status remains independent of public visibility.
ALTER TABLE workshops ADD COLUMN visibility_status text NOT NULL DEFAULT 'active'
  CHECK (visibility_status IN ('active','hidden','removed')),
  ADD COLUMN hidden_reason text,
  ADD COLUMN moderated_by uuid REFERENCES users(id),
  ADD COLUMN moderated_at timestamptz;
CREATE INDEX workshops_visibility_idx ON workshops(visibility_status,created_at DESC);
CREATE TABLE studio_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  studio_id uuid NOT NULL REFERENCES studios(id),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  title text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX studio_notifications_user_idx ON studio_notifications(user_id,created_at DESC);
ALTER TABLE studio_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON studio_notifications FROM anon,authenticated;



-- =============================================================================
-- Migration: 019_admin_bookings.sql
-- =============================================================================

ALTER TABLE users ADD COLUMN phone text;
ALTER TABLE bookings ADD COLUMN reservation_status text NOT NULL DEFAULT 'pending'
 CHECK (reservation_status IN ('pending','confirmed','cancelled','completed'));
UPDATE bookings SET reservation_status=CASE WHEN status='paid' THEN 'confirmed' WHEN status IN ('expired','cancelled','refund_needed') THEN 'cancelled' ELSE 'pending' END;
CREATE INDEX bookings_reservation_status_idx ON bookings(reservation_status,created_at DESC);
CREATE TABLE booking_status_history (
 id bigserial PRIMARY KEY,
 booking_id uuid NOT NULL REFERENCES bookings(id),
 from_status text,
 to_status text NOT NULL,
 previous_payment_status text,
 payment_status text NOT NULL,
 actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 actor_name text NOT NULL,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_status_history_booking_idx ON booking_status_history(booking_id,created_at,id);
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_status_history FROM anon,authenticated;
REVOKE ALL ON SEQUENCE booking_status_history_id_seq FROM anon,authenticated;
-- Current state only: earlier transitions were not recorded.
INSERT INTO booking_status_history(booking_id,to_status,payment_status,actor_name,reason)
 SELECT id,reservation_status,status::text,'Hệ thống','Trạng thái tại thời điểm bắt đầu lưu lịch sử' FROM bookings;

CREATE FUNCTION sync_booking_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
  IF NEW.status IN ('expired','cancelled','refund_needed') THEN NEW.reservation_status:='cancelled';
  ELSIF NEW.status='paid' AND NEW.reservation_status IN ('pending','confirmed') THEN NEW.reservation_status:='confirmed';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER booking_reservation_sync BEFORE INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION sync_booking_reservation();

CREATE FUNCTION append_booking_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid; actor_label text; event_reason text; previous text; old_payment text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.reservation_status IS NOT DISTINCT FROM OLD.reservation_status AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 actor:=nullif(current_setting('app.booking_actor',true),'')::uuid;
 SELECT full_name INTO actor_label FROM users WHERE id=actor;
 actor_label:=coalesce(actor_label,'Hệ thống');
 event_reason:=coalesce(nullif(current_setting('app.booking_reason',true),''),'Cập nhật trạng thái từ hệ thống');
 IF TG_OP='UPDATE' THEN previous:=OLD.reservation_status;old_payment:=OLD.status::text; END IF;
 INSERT INTO booking_status_history(booking_id,from_status,to_status,previous_payment_status,payment_status,actor_id,actor_name,reason)
 VALUES(NEW.id,previous,NEW.reservation_status,old_payment,NEW.status::text,actor,actor_label,event_reason);
 INSERT INTO admin_activity_log(actor_id,actor_name,action,entity_type,entity_id,entity_name,reason,previous_status,new_status)
 VALUES(actor,actor_label,'booking.'||NEW.reservation_status,'booking',NEW.id,NEW.order_code::text,event_reason,previous,NEW.reservation_status);
 RETURN NEW;
END;
$$;
CREATE TRIGGER booking_activity AFTER INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION append_booking_activity();



-- =============================================================================
-- Migration: 020_studio_owner_role.sql
-- =============================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'studio_owner';



-- =============================================================================
-- Migration: 021_user_moderation.sql
-- =============================================================================

ALTER TABLE users ADD COLUMN is_blocked boolean NOT NULL DEFAULT false,
 ADD COLUMN blocked_reason text,
 ADD COLUMN blocked_by uuid REFERENCES users(id),
 ADD COLUMN blocked_at timestamptz,
 ADD COLUMN avatar_url text;
CREATE INDEX users_admin_list_idx ON users(is_blocked,role,created_at DESC);
UPDATE users u SET role='studio_owner' WHERE role='customer'
 AND EXISTS(SELECT 1 FROM studio_members sm WHERE sm.user_id=u.id AND sm.role='owner');

-- New owners are promoted on first ownership; administrators keep their role.
CREATE FUNCTION promote_studio_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.role='owner' THEN UPDATE users SET role='studio_owner' WHERE id=NEW.user_id AND role='customer'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER studio_owner_account_role AFTER INSERT OR UPDATE OF role ON studio_members FOR EACH ROW EXECUTE FUNCTION promote_studio_owner();

-- Serialize session issuance with account moderation, including concurrent login.
CREATE FUNCTION guard_account_session() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE blocked boolean;
BEGIN
 SELECT is_blocked INTO blocked FROM users WHERE id=NEW.user_id FOR SHARE;
 IF blocked THEN RAISE EXCEPTION 'ACCOUNT_BLOCKED' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER account_session_guard BEFORE INSERT OR UPDATE OF refresh_token_hash ON auth_sessions FOR EACH ROW EXECUTE FUNCTION guard_account_session();



-- =============================================================================
-- Migration: 022_category_management.sql
-- =============================================================================

ALTER TABLE categories ADD COLUMN is_visible boolean NOT NULL DEFAULT true,
 ADD CONSTRAINT category_other_visible CHECK (id <> 'other' OR is_visible);
-- Preserve configured order and place the special choice after every ordinary category.
UPDATE categories SET sort_order=(SELECT coalesce(max(sort_order),0)+1 FROM categories WHERE id<>'other') WHERE id='other';
CREATE INDEX categories_visible_order_idx ON categories(is_visible,sort_order,id);



-- =============================================================================
-- Migration: 023_content_reports.sql
-- =============================================================================

ALTER TABLE studios ADD COLUMN is_hidden boolean NOT NULL DEFAULT false, ADD COLUMN hidden_reason text;
ALTER TABLE reviews ADD COLUMN is_hidden boolean NOT NULL DEFAULT false, ADD COLUMN hidden_reason text;
ALTER TABLE studio_notifications ALTER COLUMN workshop_id DROP NOT NULL;
ALTER TABLE content_reports RENAME TO reports;
ALTER TABLE reports RENAME COLUMN reported_by TO reporter_id;
ALTER TABLE reports RENAME COLUMN reviewed_by TO handled_by;
ALTER TABLE reports RENAME COLUMN reviewed_at TO handled_at;
ALTER TABLE reports DROP CONSTRAINT content_reports_status_check;
ALTER TABLE reports ADD COLUMN target_type text, ADD COLUMN target_id uuid, ADD COLUMN detail text NOT NULL DEFAULT '';
UPDATE reports SET target_type=CASE WHEN studio_id IS NOT NULL THEN 'studio' ELSE 'workshop' END,target_id=coalesce(studio_id,workshop_id),status=CASE WHEN status='pending' THEN 'new' ELSE status END;
ALTER TABLE reports ALTER COLUMN target_type SET NOT NULL, ALTER COLUMN target_id SET NOT NULL;
ALTER TABLE reports ALTER COLUMN status SET DEFAULT 'new';
ALTER TABLE reports ADD CONSTRAINT reports_status_check CHECK(status IN ('new','in_progress','resolved','dismissed')),
 ADD CONSTRAINT reports_target_type_check CHECK(target_type IN ('studio','workshop','review')),
 ADD CONSTRAINT reports_reporter_target_unique UNIQUE(reporter_id,target_type,target_id);
ALTER TABLE reports DROP COLUMN studio_id, DROP COLUMN workshop_id;
CREATE INDEX reports_target_idx ON reports(target_type,target_id);
CREATE TABLE report_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),report_id uuid NOT NULL REFERENCES reports(id),author_id uuid REFERENCES users(id) ON DELETE SET NULL,author_name text NOT NULL,body text NOT NULL CHECK(length(trim(body)) BETWEEN 2 AND 3000),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE report_attachments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reporter_id uuid NOT NULL REFERENCES users(id),report_id uuid REFERENCES reports(id),key text NOT NULL UNIQUE,byte_size integer NOT NULL CHECK(byte_size BETWEEN 30 AND 1048576),state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready')),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX report_attachments_report_idx ON report_attachments(report_id);
CREATE INDEX report_attachments_cleanup_idx ON report_attachments(created_at) WHERE report_id IS NULL;
ALTER TABLE report_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reports,report_notes,report_attachments FROM anon,authenticated;
-- Read compatibility for older internal reporting screens.
CREATE VIEW content_reports AS SELECT id,reporter_id AS reported_by,
 CASE WHEN target_type='studio' THEN target_id END AS studio_id,
 CASE WHEN target_type='workshop' THEN target_id END AS workshop_id,
 reason,CASE WHEN status IN ('new','in_progress') THEN 'pending' ELSE status END AS status,
 handled_by AS reviewed_by,handled_at AS reviewed_at,created_at FROM reports;
REVOKE ALL ON content_reports FROM anon,authenticated;



-- =============================================================================
-- Migration: 024_featured_items.sql
-- =============================================================================

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



-- =============================================================================
-- Migration: 025_message_templates.sql
-- =============================================================================

CREATE TABLE message_templates (
 key text PRIMARY KEY CHECK(key IN ('studio_approved','studio_needs_changes','studio_rejected','studio_suspended','booking_success','booking_cancelled')),
 subject text NOT NULL CHECK(length(trim(subject)) BETWEEN 1 AND 200),
 body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 5000),
 updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON message_templates FROM anon,authenticated;

CREATE FUNCTION default_message_template(template_key text) RETURNS TABLE(subject text,body text) LANGUAGE sql IMMUTABLE AS $$
 SELECT v.subject,v.body FROM (VALUES
 ('studio_approved','Studio {{studioName}} đã được duyệt','Studio {{studioName}} đã được Open Slot duyệt. Bạn có thể quản lý workshop, lịch và đặt chỗ trong trang quản lý studio.'),
 ('studio_needs_changes','Studio {{studioName}} cần bổ sung thông tin','Hồ sơ studio {{studioName}} cần bổ sung trước khi được duyệt.
Lý do: {{reason}}
Vui lòng chỉnh sửa hồ sơ và gửi lại để Open Slot kiểm tra.'),
 ('studio_rejected','Hồ sơ studio {{studioName}} bị từ chối','Open Slot chưa thể duyệt hồ sơ studio {{studioName}}.
Lý do: {{reason}}
Bạn có thể cập nhật hồ sơ và gửi lại để được xem xét.'),
 ('studio_suspended','Studio {{studioName}} đã bị tạm ngưng','Studio {{studioName}} đã bị tạm ngưng trên Open Slot.
Lý do: {{reason}}
Vui lòng liên hệ Open Slot để được hỗ trợ.'),
 ('booking_success','Đặt chỗ {{bookingCode}} thành công','Chào {{customerName}}, Open Slot đã ghi nhận đặt chỗ {{bookingCode}}.
Workshop: {{workshopName}} tại {{studioName}}
Thời gian: {{slotTime}}
Số người: {{quantity}}
Trạng thái đặt chỗ: {{bookingStatus}}
Trạng thái thanh toán: {{paymentStatus}}'),
 ('booking_cancelled','Đặt chỗ {{bookingCode}} đã bị hủy','Chào {{customerName}}, đặt chỗ {{bookingCode}} cho workshop {{workshopName}} tại {{studioName}} đã bị hủy.
Thời gian: {{slotTime}}
Lý do: {{reason}}
Trạng thái thanh toán: {{paymentStatus}}')
 ) AS v(key,subject,body) WHERE v.key=template_key;
$$;
INSERT INTO message_templates(key,subject,body)
 SELECT k.key,d.subject,d.body FROM unnest(ARRAY['studio_approved','studio_needs_changes','studio_rejected','studio_suspended','booking_success','booking_cancelled']) AS k(key)
 CROSS JOIN LATERAL default_message_template(k.key) d;

CREATE FUNCTION message_template_variables(template_key text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE
 WHEN template_key='studio_approved' THEN ARRAY['studioName']
 WHEN template_key IN ('studio_needs_changes','studio_rejected','studio_suspended') THEN ARRAY['studioName','reason']
 WHEN template_key='booking_success' THEN ARRAY['customerName','studioName','workshopName','bookingCode','slotTime','quantity','bookingStatus','paymentStatus']
 WHEN template_key='booking_cancelled' THEN ARRAY['customerName','studioName','workshopName','bookingCode','slotTime','quantity','bookingStatus','paymentStatus','reason']
 ELSE ARRAY[]::text[] END;
$$;
CREATE FUNCTION render_message_text(template_key text,source text,variables jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE rest text:=coalesce(source,''); result text:=''; match text[]; token text; variable text; offset_at integer;
BEGIN
 LOOP
  match:=regexp_match(rest,'\{\{([^}]*)\}\}');
  EXIT WHEN match IS NULL;
  token:='{{'||match[1]||'}}';variable:=regexp_replace(match[1],'^\s+|\s+$','','g');offset_at:=strpos(rest,token);
  result:=result||left(rest,offset_at-1);
  IF variable=ANY(message_template_variables(template_key)) THEN result:=result||coalesce(variables->>variable,''); END IF;
  rest:=substring(rest FROM offset_at+length(token));
 END LOOP;
 RETURN result||rest;
END;
$$;
CREATE FUNCTION render_message_template(template_key text,variables jsonb) RETURNS TABLE(subject text,body text) LANGUAGE sql STABLE AS $$
 SELECT trim(regexp_replace(render_message_text(template_key,t.subject,variables),E'[\r\n]+',' ','g')),render_message_text(template_key,t.body,variables)
 FROM message_templates t WHERE t.key=template_key;
$$;
REVOKE ALL ON FUNCTION default_message_template(text),message_template_variables(text),render_message_text(text,text,jsonb),render_message_template(text,jsonb) FROM PUBLIC,anon,authenticated;

ALTER TABLE studio_notifications ADD COLUMN body text, ADD COLUMN template_key text REFERENCES message_templates(key), ADD COLUMN booking_id uuid REFERENCES bookings(id);
CREATE INDEX studio_notifications_booking_idx ON studio_notifications(booking_id) WHERE booking_id IS NOT NULL;

CREATE FUNCTION notify_studio_template() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE template_key text;
BEGIN
 IF NEW.is_draft OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 template_key:=CASE NEW.status::text WHEN 'approved' THEN 'studio_approved' WHEN 'needs_changes' THEN 'studio_needs_changes' WHEN 'rejected' THEN 'studio_rejected' WHEN 'suspended' THEN 'studio_suspended' END;
 IF template_key IS NULL THEN RETURN NEW; END IF;
 INSERT INTO studio_notifications(user_id,studio_id,title,body,reason,template_key)
 SELECT sm.user_id,NEW.id,m.subject,m.body,NEW.rejection_reason,template_key FROM studio_members sm
 CROSS JOIN render_message_template(template_key,jsonb_build_object('studioName',NEW.name,'reason',coalesce(NEW.rejection_reason,''))) m
 WHERE sm.studio_id=NEW.id AND sm.role='owner';
 RETURN NEW;
END;
$$;
CREATE TRIGGER studio_template_notification AFTER UPDATE OF status ON studios FOR EACH ROW EXECUTE FUNCTION notify_studio_template();

CREATE FUNCTION notify_booking_template() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE template_key text; event_reason text; variables jsonb; studio uuid; workshop uuid;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.reservation_status IN ('pending','confirmed') THEN template_key:='booking_success'; END IF;
 ELSIF NEW.reservation_status='cancelled' AND OLD.reservation_status IS DISTINCT FROM NEW.reservation_status THEN template_key:='booking_cancelled';
 ELSIF NEW.reservation_status='confirmed' AND (OLD.reservation_status IS DISTINCT FROM NEW.reservation_status OR (NEW.status='paid' AND OLD.status IS DISTINCT FROM NEW.status)) THEN template_key:='booking_success';
 END IF;
 IF template_key IS NULL THEN RETURN NEW; END IF;
 event_reason:=coalesce(nullif(current_setting('app.booking_reason',true),''),CASE WHEN NEW.status='expired' THEN 'Đã hết thời gian giữ chỗ.' ELSE 'Buổi workshop hoặc đặt chỗ đã bị hủy.' END);
 SELECT st.id,w.id,jsonb_build_object('customerName',u.full_name,'studioName',st.name,'workshopName',w.title,'bookingCode',NEW.order_code::text,'slotTime',to_char(s.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh','DD/MM/YYYY HH24:MI'),'quantity',NEW.quantity::text,'reason',event_reason,
 'bookingStatus',CASE NEW.reservation_status WHEN 'pending' THEN 'Chờ xác nhận' WHEN 'confirmed' THEN 'Đã xác nhận' WHEN 'cancelled' THEN 'Đã hủy' ELSE 'Hoàn tất' END,
 'paymentStatus',CASE NEW.status::text WHEN 'pending' THEN 'Chưa thanh toán' WHEN 'paid' THEN 'Đã thanh toán' WHEN 'refund_needed' THEN 'Cần hoàn tiền' WHEN 'expired' THEN 'Hết hạn giữ chỗ' ELSE 'Đã hủy' END)
 INTO studio,workshop,variables FROM users u JOIN sessions s ON s.id=NEW.session_id JOIN workshops w ON w.id=s.workshop_id JOIN studios st ON st.id=w.studio_id WHERE u.id=NEW.user_id;
 INSERT INTO studio_notifications(user_id,studio_id,workshop_id,booking_id,title,body,reason,template_key)
 SELECT NEW.user_id,studio,workshop,NEW.id,m.subject,m.body,CASE WHEN template_key='booking_cancelled' THEN event_reason END,template_key FROM render_message_template(template_key,variables) m;
 RETURN NEW;
END;
$$;
CREATE TRIGGER booking_template_notification AFTER INSERT OR UPDATE OF reservation_status,status ON bookings FOR EACH ROW EXECUTE FUNCTION notify_booking_template();



-- =============================================================================
-- Migration: 026_audit_logs.sql
-- =============================================================================

CREATE TABLE audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid,
 actor_name text NOT NULL,
 action text NOT NULL,
 target_type text NOT NULL,
 target_id text NOT NULL,
 target_name text NOT NULL,
 reason text,
 "before" jsonb,
 "after" jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX audit_logs_recent_idx ON audit_logs(created_at DESC,id DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs(actor_id,created_at DESC);
CREATE INDEX audit_logs_action_idx ON audit_logs(action,created_at DESC);
CREATE INDEX audit_logs_target_idx ON audit_logs(target_type,target_id,created_at DESC);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON audit_logs FROM PUBLIC,anon,authenticated;

-- Historical rows retain only recorded facts; unavailable snapshots remain NULL.
INSERT INTO audit_logs(actor_id,actor_name,action,target_type,target_id,target_name,reason,"before","after",created_at)
 SELECT actor_id,actor_name,action,entity_type,entity_id::text,entity_name,reason,
 CASE WHEN previous_status IS NOT NULL THEN jsonb_build_object('status',previous_status) END,
 CASE WHEN new_status IS NOT NULL THEN jsonb_build_object('status',new_status) END,created_at
 FROM admin_activity_log ORDER BY id;

-- Transaction-local snapshots: never a second persistent copy of credentials.
CREATE FUNCTION capture_audit_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind text:=TG_ARGV[0]; identifier text; prior jsonb; next jsonb; state jsonb; setting text;
BEGIN
 IF TG_OP<>'INSERT' THEN prior:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN next:=to_jsonb(NEW); END IF;
 identifier:=coalesce(next->>'id',prior->>'id',next->>'key',prior->>'key');
 IF kind='user' THEN
  IF prior IS NOT NULL THEN prior:=jsonb_build_object('id',prior->'id','full_name',prior->'full_name','email',prior->'email','role',prior->'role','is_blocked',prior->'is_blocked','blocked_reason',prior->'blocked_reason','blocked_by',prior->'blocked_by','blocked_at',prior->'blocked_at'); END IF;
  IF next IS NOT NULL THEN next:=jsonb_build_object('id',next->'id','full_name',next->'full_name','email',next->'email','role',next->'role','is_blocked',next->'is_blocked','blocked_reason',next->'blocked_reason','blocked_by',next->'blocked_by','blocked_at',next->'blocked_at'); END IF;
 END IF;
 setting:='app.audit_'||kind||'_'||md5(identifier);
 state:=nullif(current_setting(setting,true),'')::jsonb;
 IF state IS NOT NULL THEN prior:=state->'before'; END IF;
 PERFORM set_config(setting,jsonb_build_object('targetId',identifier,'before',prior,'after',next)::text,true);
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON studios FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('studio');
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON workshops FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('workshop');
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON bookings FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('booking');
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('user');
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON categories FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('category');
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON reports FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('report');
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('review');
CREATE TRIGGER zz_audit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON message_templates FOR EACH ROW EXECUTE FUNCTION capture_audit_snapshot('message_template');

CREATE FUNCTION write_audit_log(actor uuid,actor_label text,event_action text,kind text,identifier text,label text,event_reason text,prior jsonb,next jsonb,event_time timestamptz DEFAULT clock_timestamp()) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE result uuid;
BEGIN
 INSERT INTO audit_logs(actor_id,actor_name,action,target_type,target_id,target_name,reason,"before","after",created_at)
 VALUES(actor,actor_label,event_action,kind,identifier,label,event_reason,prior,next,event_time) RETURNING id INTO result;
 RETURN result;
END;
$$;

-- Existing DB-driven studio/booking/review actions and the shared API helper use one writer.
CREATE FUNCTION mirror_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state jsonb; identifier text:=NEW.entity_id::text; setting text;
BEGIN
 setting:='app.audit_'||NEW.entity_type||'_'||replace(NEW.entity_id::text,'-','');
 IF NEW.entity_type NOT IN ('category','message_template') THEN setting:='app.audit_'||NEW.entity_type||'_'||md5(identifier); END IF;
 state:=nullif(current_setting(setting,true),'')::jsonb;
 IF state IS NOT NULL THEN identifier:=state->>'targetId'; END IF;
 PERFORM write_audit_log(NEW.actor_id,NEW.actor_name,NEW.action,NEW.entity_type,identifier,NEW.entity_name,NEW.reason,
  CASE WHEN state IS NOT NULL THEN state->'before' WHEN NEW.previous_status IS NOT NULL THEN jsonb_build_object('status',NEW.previous_status) END,
  CASE WHEN state IS NOT NULL THEN state->'after' WHEN NEW.new_status IS NOT NULL THEN jsonb_build_object('status',NEW.new_status) END,NEW.created_at);
 PERFORM set_config(setting,'',true);
 RETURN NEW;
END;
$$;
CREATE TRIGGER admin_audit_mirror AFTER INSERT ON admin_activity_log FOR EACH ROW EXECUTE FUNCTION mirror_admin_audit();

CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit logs are append-only' USING ERRCODE='42501'; END;
$$;
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_logs FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
REVOKE ALL ON FUNCTION capture_audit_snapshot(),write_audit_log(uuid,text,text,text,text,text,text,jsonb,jsonb,timestamptz),mirror_admin_audit(),reject_audit_mutation() FROM PUBLIC,anon,authenticated;



-- =============================================================================
-- Migration: 027_site_settings.sql
-- =============================================================================

CREATE TABLE settings (
 key text PRIMARY KEY CHECK(key='site'), value jsonb NOT NULL CHECK(jsonb_typeof(value)='object'),
 updated_by uuid REFERENCES users(id) ON DELETE SET NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO settings(key,value) VALUES('site','{"studio":{"minPhotos":3,"maxPhotos":8,"maxImageMb":10},"support":{"hotline":"1900 8889","workingHours":"8:30–21:00","email":"hotro@openslot.vn"},"booking":{"cancellationHours":24,"maxActiveSlots":5}}');
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON settings FROM PUBLIC,anon,authenticated;
CREATE FUNCTION site_settings() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT value FROM settings WHERE key='site' $$;
REVOKE ALL ON FUNCTION site_settings() FROM PUBLIC,anon,authenticated;
ALTER TABLE studios DROP CONSTRAINT studio_photo_count;
ALTER TABLE studios ADD CONSTRAINT studio_photo_count CHECK(cardinality(photo_ids)<=20);
ALTER TABLE images DROP CONSTRAINT images_byte_size_check;
ALTER TABLE images ADD CONSTRAINT images_byte_size_check CHECK(byte_size BETWEEN 1 AND 20971520);
CREATE OR REPLACE FUNCTION studio_profile_complete(st studios) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce(st.contact_phone ~ '^(0[1-9][0-9]{8,9}|\+84[1-9][0-9]{8,9})$' AND st.contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 AND cardinality(st.photo_ids) BETWEEN (site_settings()->'studio'->>'minPhotos')::int AND (site_settings()->'studio'->>'maxPhotos')::int
 AND (SELECT count(DISTINCT p.id) FROM images p WHERE p.id=ANY(st.photo_ids) AND p.state='ready' AND p.studio_id=st.id AND p.workshop_id IS NULL)=cardinality(st.photo_ids),false)
$$;
CREATE FUNCTION guard_booking_slot_limit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE maximum int; active_count int;
BEGIN
 IF NEW.reservation_status NOT IN ('pending','confirmed') OR NEW.status NOT IN ('pending','paid') OR (NEW.status='pending' AND NEW.reservation_status='pending' AND NEW.hold_expires_at<=now()) THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM sessions WHERE id=NEW.session_id AND starts_at>now() AND status='scheduled') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.user_id=NEW.user_id AND OLD.session_id=NEW.session_id AND OLD.reservation_status IN ('pending','confirmed') AND OLD.status IN ('pending','paid') AND NOT(OLD.status='pending' AND OLD.reservation_status='pending' AND OLD.hold_expires_at<=now()) THEN RETURN NEW; END IF;
 PERFORM id FROM users WHERE id=NEW.user_id FOR UPDATE;
 maximum:=(site_settings()->'booking'->>'maxActiveSlots')::int;
 IF EXISTS(SELECT 1 FROM bookings b JOIN sessions s ON s.id=b.session_id WHERE b.user_id=NEW.user_id AND b.id<>NEW.id AND b.session_id=NEW.session_id AND b.reservation_status IN ('pending','confirmed') AND b.status IN ('pending','paid') AND s.starts_at>now() AND s.status='scheduled' AND NOT(b.status='pending' AND b.reservation_status='pending' AND b.hold_expires_at<=now())) THEN RETURN NEW; END IF;
 SELECT count(DISTINCT b.session_id) INTO active_count FROM bookings b JOIN sessions s ON s.id=b.session_id
 WHERE b.user_id=NEW.user_id AND b.id<>NEW.id AND b.reservation_status IN ('pending','confirmed') AND b.status IN ('pending','paid') AND s.starts_at>now() AND s.status='scheduled' AND NOT(b.status='pending' AND b.reservation_status='pending' AND b.hold_expires_at<=now());
 IF active_count>=maximum THEN RAISE EXCEPTION 'BOOKING_SLOT_LIMIT: maximum % upcoming slots',maximum USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER policy_booking_slots BEFORE INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION guard_booking_slot_limit();
REVOKE ALL ON FUNCTION guard_booking_slot_limit() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION mirror_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state jsonb; identifier text:=NEW.entity_id::text; setting text;
BEGIN
 setting:='app.audit_'||NEW.entity_type||'_'||replace(NEW.entity_id::text,'-','');
 IF NEW.entity_type NOT IN ('category','message_template','settings') THEN setting:='app.audit_'||NEW.entity_type||'_'||md5(identifier); END IF;
 state:=nullif(current_setting(setting,true),'')::jsonb;
 IF state IS NOT NULL THEN identifier:=state->>'targetId'; END IF;
 PERFORM write_audit_log(NEW.actor_id,NEW.actor_name,NEW.action,NEW.entity_type,identifier,NEW.entity_name,NEW.reason,
 CASE WHEN state IS NOT NULL THEN state->'before' WHEN NEW.previous_status IS NOT NULL THEN jsonb_build_object('status',NEW.previous_status) END,
 CASE WHEN state IS NOT NULL THEN state->'after' WHEN NEW.new_status IS NOT NULL THEN jsonb_build_object('status',NEW.new_status) END,NEW.created_at);
 PERFORM set_config(setting,'',true); RETURN NEW;
END;
$$;



-- =============================================================================
-- Migration: 028_admin_soft_selections.sql
-- =============================================================================

-- Keep selection history instead of physically deleting administrative relationships.
ALTER TABLE featured_items ADD COLUMN deleted_at timestamptz;
ALTER TABLE featured_items DROP CONSTRAINT featured_items_type_sort_order_key;
CREATE UNIQUE INDEX featured_items_active_order_idx ON featured_items(type,sort_order) WHERE deleted_at IS NULL;
ALTER TABLE studio_categories ADD COLUMN deleted_at timestamptz;
CREATE INDEX studio_categories_active_idx ON studio_categories(studio_id,category_id) WHERE deleted_at IS NULL;



-- =============================================================================
-- Migration: 029_image_thumbnails.sql
-- =============================================================================

-- Optional for existing images/older clients; ready confirms both uploads.
ALTER TABLE images
  ADD COLUMN thumbnail_key text,
  ADD COLUMN thumbnail_byte_size integer,
  ADD CONSTRAINT image_thumbnail_pair CHECK (
    (thumbnail_key IS NULL AND thumbnail_byte_size IS NULL) OR
    (thumbnail_key IS NOT NULL AND thumbnail_byte_size BETWEEN 1 AND 204800)
  );
CREATE UNIQUE INDEX images_thumbnail_key_idx ON images(thumbnail_key) WHERE thumbnail_key IS NOT NULL;



-- =============================================================================
-- Migration: 030_image_medium_variants.sql
-- =============================================================================

ALTER TABLE images
  ADD COLUMN medium_key text,
  ADD COLUMN medium_byte_size integer,
  ADD CONSTRAINT image_medium_pair CHECK (
    (medium_key IS NULL AND medium_byte_size IS NULL) OR
    (medium_key IS NOT NULL AND medium_byte_size IS NOT NULL AND medium_byte_size BETWEEN 1 AND 614400)
  );
CREATE UNIQUE INDEX images_medium_key_idx ON images(medium_key) WHERE medium_key IS NOT NULL;



-- =============================================================================
-- Migration: 031_workshop_self_publication.sql
-- =============================================================================

-- Publication and moderation are independent: owners cannot undo an admin hide.
ALTER TABLE workshops ADD COLUMN publication_status text NOT NULL DEFAULT 'published'
  CHECK (publication_status IN ('draft', 'published'));
-- Preserve existing review decisions. Existing pending records still require review.
CREATE INDEX workshops_publication_idx ON workshops(publication_status, status, visibility_status);
ALTER TABLE studios ADD COLUMN payment_qr_image_id uuid REFERENCES images(id);



-- =============================================================================
-- Migration: 032_remove_workshop_preapproval.sql
-- =============================================================================

-- Studios are approved once. Workshop publication is controlled by the author;
-- admin moderation remains independent and cannot be undone by author edits.
ALTER TABLE workshops ALTER COLUMN status SET DEFAULT 'approved'::approval_status;

-- Preserve historical rejections as explicit moderation hides before removing
-- the old approval gate. Existing drafts, hides and removals retain their state.
WITH prior AS MATERIALIZED (
  SELECT id,title,status,visibility_status,publication_status,hidden_reason
  FROM workshops WHERE status <> 'approved' FOR UPDATE
), migrated AS (
  UPDATE workshops w SET status='approved'::approval_status,
    visibility_status=CASE WHEN prior.status='rejected' AND prior.visibility_status='active' THEN 'hidden' ELSE prior.visibility_status END,
    hidden_reason=CASE WHEN prior.status='rejected' AND prior.visibility_status='active'
      THEN coalesce(prior.hidden_reason,'Workshop bị từ chối theo quy trình cũ; admin có thể khôi phục sau hậu kiểm.') ELSE prior.hidden_reason END
  FROM prior WHERE w.id=prior.id RETURNING w.id,w.status,w.visibility_status,w.publication_status
)
SELECT write_audit_log(NULL,'Hệ thống','workshop.publication_migrated','workshop',prior.id::text,prior.title,
  'Bỏ bước duyệt workshop; giữ quyết định ẩn/gỡ và bản nháp.',
  jsonb_build_object('status',prior.status,'visibility_status',prior.visibility_status,'publication_status',prior.publication_status),
  jsonb_build_object('status',migrated.status,'visibility_status',migrated.visibility_status,'publication_status',migrated.publication_status))
FROM prior JOIN migrated USING(id);



-- =============================================================================
-- Migration: 033_real_workshop_default.sql
-- =============================================================================

-- The original schema default marked API-created workshops as simulated.
-- New user content must be real even when inserted outside the API.
ALTER TABLE workshops ALTER COLUMN is_simulated SET DEFAULT false;

-- The retired sample seeder used a dedicated owner account and explicitly set
-- is_simulated=true. Preserve those records as simulated; fix owner-created
-- content that inherited the old default. Do not change publication/moderation.
WITH corrected AS (
  UPDATE workshops w SET is_simulated=false
  WHERE w.is_simulated
    AND EXISTS (
      SELECT 1 FROM studio_members sm JOIN users u ON u.id=sm.user_id
      WHERE sm.studio_id=w.studio_id AND sm.role='owner'
        AND u.email <> 'sample-studio@workshop.local'
    )
    AND NOT EXISTS (
      SELECT 1 FROM studio_members sm JOIN users u ON u.id=sm.user_id
      WHERE sm.studio_id=w.studio_id AND sm.role='owner'
        AND u.email = 'sample-studio@workshop.local'
    )
  RETURNING w.id,w.title
)
SELECT write_audit_log(NULL,'Hệ thống','workshop.real_content_corrected','workshop',id::text,title,
  'Sửa cờ mô phỏng kế thừa từ mặc định cũ cho workshop do chủ studio tạo.',
  jsonb_build_object('is_simulated',true),jsonb_build_object('is_simulated',false))
FROM corrected;



-- =============================================================================
-- Migration: 034_customer_booking_payments.sql
-- =============================================================================

ALTER TABLE bookings
  ADD COLUMN contact_name text,
  ADD COLUMN contact_phone text,
  ADD COLUMN deposit_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN paid_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN payment_mode text NOT NULL DEFAULT 'legacy';

UPDATE bookings b
SET paid_amount = CASE
  WHEN b.status = 'paid' THEN b.total_amount
  ELSE LEAST(
    b.total_amount,
    COALESCE((
      SELECT sum(p.amount)
      FROM payments p
      WHERE p.booking_id = b.id AND p.status = 'paid'
    ), 0)
  )::integer
END;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_contact_name_check
    CHECK (contact_name IS NULL OR length(trim(contact_name)) BETWEEN 1 AND 120),
  ADD CONSTRAINT bookings_contact_phone_check
    CHECK (contact_phone IS NULL OR length(trim(contact_phone)) BETWEEN 8 AND 30),
  ADD CONSTRAINT bookings_deposit_amount_check
    CHECK (deposit_amount BETWEEN 0 AND total_amount),
  ADD CONSTRAINT bookings_paid_amount_check
    CHECK (paid_amount BETWEEN 0 AND total_amount),
  ADD CONSTRAINT bookings_payment_mode_check
    CHECK (payment_mode IN ('payos_deposit', 'in_studio', 'free', 'legacy'));

ALTER TABLE payments
  ADD COLUMN kind text NOT NULL DEFAULT 'legacy',
  ADD CONSTRAINT payments_kind_check
    CHECK (kind IN ('deposit', 'balance', 'in_studio', 'legacy'));

CREATE SEQUENCE booking_order_code_seq
  AS integer
  MINVALUE 1
  MAXVALUE 999999999
  START WITH 100000000;
REVOKE ALL ON SEQUENCE booking_order_code_seq FROM PUBLIC, anon, authenticated;

CREATE TABLE user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  booking_id uuid REFERENCES bookings(id),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  href text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CHECK (length(trim(type)) BETWEEN 1 AND 80),
  CHECK (length(trim(title)) BETWEEN 1 AND 200),
  CHECK (length(trim(href)) BETWEEN 1 AND 500)
);
CREATE INDEX user_notifications_user_idx
  ON user_notifications(user_id, created_at DESC);
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_notifications FROM anon, authenticated;



-- =============================================================================
-- Migration: 035_payment_qr_code.sql
-- =============================================================================

ALTER TABLE payments
  ADD COLUMN qr_code text;

ALTER TABLE payments
  ADD CONSTRAINT payments_qr_code_check
  CHECK (qr_code IS NULL OR length(qr_code) <= 4096);



-- =============================================================================
-- Migration: 035_session_registration_deadline.sql
-- =============================================================================

ALTER TABLE sessions ADD COLUMN registration_deadline timestamptz;
ALTER TABLE workshops ADD COLUMN is_discontinued boolean NOT NULL DEFAULT false;
ALTER TABLE sessions ADD CONSTRAINT sessions_registration_deadline_before_start
  CHECK (registration_deadline IS NULL OR registration_deadline <= starts_at);

CREATE TABLE workshop_schedule_subscriptions (
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workshop_id, user_id)
);
ALTER TABLE workshop_schedule_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON workshop_schedule_subscriptions FROM anon, authenticated;

CREATE FUNCTION notify_workshop_schedule_subscribers() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'scheduled' AND NEW.starts_at > now() THEN
    INSERT INTO user_notifications (user_id,type,title,body,href)
    SELECT sub.user_id,'workshop_schedule','Workshop đã có lịch mới',
      w.title || ' đã có buổi mới. Xem lịch và chọn chỗ phù hợp.',
      '/workshop/' || w.slug
    FROM workshop_schedule_subscriptions sub
    JOIN workshops w ON w.id = sub.workshop_id
    WHERE sub.workshop_id = NEW.workshop_id
      AND w.status = 'approved' AND w.publication_status = 'published'
      AND w.visibility_status = 'active' AND NOT w.is_discontinued;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER workshop_schedule_subscriber_notification
  AFTER INSERT ON sessions FOR EACH ROW
  EXECUTE FUNCTION notify_workshop_schedule_subscribers();



-- =============================================================================
-- Migration: 036_studio_deposit_and_attendance.sql
-- =============================================================================

ALTER TABLE studios ADD COLUMN deposit_mode text NOT NULL DEFAULT 'none' CHECK(deposit_mode IN ('none','optional','required')),
  ADD COLUMN deposit_percent integer,
  ADD COLUMN release_if_unconfirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN release_before_minutes integer NOT NULL DEFAULT 120 CHECK(release_before_minutes BETWEEN 15 AND 1440),
  ADD CONSTRAINT studio_deposit_policy CHECK((deposit_mode='none' AND deposit_percent IS NULL) OR (deposit_mode IN ('optional','required') AND deposit_percent IS NOT NULL AND deposit_percent BETWEEN 1 AND 50));
ALTER TABLE workshops DROP CONSTRAINT IF EXISTS workshops_deposit_percent_check;
ALTER TABLE workshops ALTER COLUMN deposit_percent DROP NOT NULL, ALTER COLUMN deposit_percent DROP DEFAULT;
ALTER TABLE workshops ADD COLUMN deposit_mode_override text CHECK(deposit_mode_override IN ('none','optional','required')),
  ADD COLUMN included text[] NOT NULL DEFAULT '{}';
DROP TRIGGER IF EXISTS workshop_deposit_guard ON workshops;
-- Preserve an existing uniform studio rate; no percentage is invented for new studios.
UPDATE studios st SET deposit_mode='required',deposit_percent=r.rate FROM (
 SELECT studio_id,min(deposit_percent) AS rate FROM workshops GROUP BY studio_id
 HAVING min(deposit_percent)>0 AND count(DISTINCT deposit_percent)=1
) r WHERE st.id=r.studio_id AND st.status='approved' AND st.verified_at IS NOT NULL AND studio_profile_complete(st);
UPDATE workshops w SET
 deposit_mode_override=CASE WHEN st.deposit_mode='required' AND st.deposit_percent=w.deposit_percent THEN NULL WHEN w.deposit_percent>0 THEN 'required' END,
 deposit_percent=CASE WHEN st.deposit_mode='required' AND st.deposit_percent=w.deposit_percent THEN NULL ELSE NULLIF(w.deposit_percent,0) END
FROM studios st WHERE st.id=w.studio_id;
ALTER TABLE workshops ADD CONSTRAINT workshop_deposit_policy CHECK(
  (deposit_mode_override IS NULL AND deposit_percent IS NULL) OR
  (deposit_mode_override='none' AND deposit_percent IS NULL) OR
  (deposit_mode_override IS NOT NULL AND deposit_mode_override IN ('optional','required') AND deposit_percent IS NOT NULL AND deposit_percent BETWEEN 1 AND 50));
CREATE OR REPLACE FUNCTION guard_workshop_deposit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE st studios;
BEGIN
  SELECT * INTO st FROM studios WHERE id=NEW.studio_id FOR UPDATE;
  IF NEW.deposit_mode_override IN ('optional','required') AND NOT (st.status='approved' AND st.verified_at IS NOT NULL AND studio_profile_complete(st)) THEN
    RAISE EXCEPTION 'Studio chưa được xác minh để bật đặt cọc' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS workshop_deposit_guard ON workshops;
CREATE TRIGGER workshop_deposit_guard BEFORE INSERT OR UPDATE OF deposit_percent,deposit_mode_override ON workshops FOR EACH ROW EXECUTE FUNCTION guard_workshop_deposit();
CREATE FUNCTION effective_deposit_mode(st studios,w workshops) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN (st).status='approved' AND (st).verified_at IS NOT NULL AND studio_profile_complete(st) THEN COALESCE((w).deposit_mode_override,(st).deposit_mode) ELSE 'none' END
$$;
CREATE FUNCTION effective_deposit_percent(st studios,w workshops) RETURNS integer LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN effective_deposit_mode(st,w)='none' THEN 0 ELSE COALESCE((w).deposit_percent,(st).deposit_percent,0) END
$$;
ALTER TABLE bookings ADD COLUMN deposit_percent integer CHECK(deposit_percent BETWEEN 1 AND 50),
  ADD COLUMN deposit_mode text CHECK(deposit_mode IN ('none','optional','required')),
  ADD COLUMN refund_due_amount integer NOT NULL DEFAULT 0 CHECK(refund_due_amount>=0),
  ADD COLUMN refund_status text NOT NULL DEFAULT 'not_applicable' CHECK(refund_status IN ('not_applicable','pending','forfeited','refunded')),
  ADD COLUMN refund_reference text, ADD COLUMN refunded_at timestamptz,
  ADD COLUMN attendance_status text NOT NULL DEFAULT 'unmarked' CHECK(attendance_status IN ('unmarked','attended','absent')),
  ADD COLUMN attendance_marked_by uuid REFERENCES users(id), ADD COLUMN attendance_marked_at timestamptz,
  ADD COLUMN attendance_confirmed_at timestamptz,
  ADD COLUMN release_if_unconfirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN release_before_minutes integer,
  ADD COLUMN reschedule_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN original_starts_at timestamptz, ADD COLUMN original_ends_at timestamptz;
ALTER TABLE payments ADD COLUMN transfer_description text;
CREATE TABLE studio_deposit_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,actor_id uuid REFERENCES users(id) ON DELETE SET NULL,actor_name text,before_state jsonb NOT NULL,after_state jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO studio_deposit_history(studio_id,before_state,after_state) SELECT id,'{"depositMode":"none","depositPercent":null}'::jsonb,jsonb_build_object('depositMode',deposit_mode,'depositPercent',deposit_percent) FROM studios WHERE deposit_mode<>'none';
ALTER TABLE studio_deposit_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON studio_deposit_history FROM anon,authenticated;
CREATE TABLE booking_reminders(booking_id uuid NOT NULL REFERENCES bookings(id),kind text NOT NULL CHECK(kind IN ('24h','2h')),starts_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(booking_id,kind,starts_at));
CREATE TABLE email_outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid REFERENCES bookings(id),recipient text NOT NULL,subject text NOT NULL,body text NOT NULL,idempotency_key text NOT NULL UNIQUE,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed')),attempts integer NOT NULL DEFAULT 0,locked_at timestamptz,sent_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE booking_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_reminders,email_outbox FROM anon,authenticated;
CREATE TABLE session_schedule_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES sessions(id),actor_id uuid NOT NULL REFERENCES users(id),previous_starts_at timestamptz NOT NULL,previous_ends_at timestamptz NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE session_schedule_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON session_schedule_history FROM anon,authenticated;
UPDATE settings SET value=jsonb_set(value::jsonb,'{booking,cancellationHours}','24'::jsonb) WHERE key='site';
CREATE FUNCTION guard_studio_payment_settings() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status<>'approved' OR NEW.verified_at IS NULL OR NOT studio_profile_complete(NEW) THEN
   IF OLD.deposit_mode<>'none' THEN
     INSERT INTO studio_deposit_history(studio_id,actor_id,before_state,after_state)
     VALUES(NEW.id,NEW.reviewed_by,jsonb_build_object('depositMode',OLD.deposit_mode,'depositPercent',OLD.deposit_percent),jsonb_build_object('depositMode','none','depositPercent',NULL));
   END IF;
   NEW.deposit_mode:='none'; NEW.deposit_percent:=NULL;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER studio_payment_settings_guard BEFORE UPDATE OF deposit_mode,deposit_percent,verified_at,status ON studios FOR EACH ROW EXECUTE FUNCTION guard_studio_payment_settings();



-- =============================================================================
-- Migration: 037_repair_missing_refund_metadata.sql
-- =============================================================================

-- Repair only refund-needed records with received money and no refund decision.
-- Keep receipts and every existing pending, forfeited or refunded decision.
WITH repaired AS (
  UPDATE bookings
  SET refund_due_amount = paid_amount,
      refund_status = 'pending'
  WHERE status = 'refund_needed'
    AND paid_amount > 0
    AND refund_status = 'not_applicable'
    AND refund_due_amount = 0
  RETURNING id, order_code
)
INSERT INTO admin_activity_log (
  actor_id, actor_name, action, entity_type, entity_id, entity_name, reason
)
SELECT NULL, 'Hệ thống', 'booking.refund_metadata.repaired', 'booking', id,
       COALESCE(order_code::text, id::text),
       'Bổ sung khoản cần hoàn từ số tiền đã nhận; chưa thực hiện chuyển hoàn.'
FROM repaired;



-- =============================================================================
-- Migration: 038_booking_request_idempotency.sql
-- =============================================================================

CREATE TABLE booking_requests (
  user_id uuid NOT NULL REFERENCES users(id),
  request_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK(length(payload_hash)=64),
  booking_id uuid UNIQUE REFERENCES bookings(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,request_id)
);
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_requests FROM PUBLIC,anon,authenticated;



-- =============================================================================
-- Migration: 039_versioned_schedule_changes.sql
-- =============================================================================

ALTER TABLE sessions ADD COLUMN schedule_version integer NOT NULL DEFAULT 1 CHECK (schedule_version > 0);
ALTER TABLE bookings
  ADD COLUMN schedule_version integer NOT NULL DEFAULT 1 CHECK (schedule_version > 0),
  ADD COLUMN proposed_schedule_version integer CHECK (proposed_schedule_version > 0),
  ADD COLUMN booked_starts_at timestamptz,
  ADD COLUMN booked_ends_at timestamptz,
  ADD COLUMN reschedule_notified_at timestamptz,
  ADD COLUMN reschedule_deadline timestamptz,
  ADD COLUMN schedule_accepted_at timestamptz,
  ADD COLUMN cancelled_at timestamptz;

-- Existing pending changes have no reliable notification/acceptance version.
-- Establish a baseline without extending the new start minus 12-hour cutoff.
UPDATE bookings b SET
  booked_starts_at = CASE WHEN b.reschedule_pending THEN COALESCE(b.original_starts_at,s.starts_at) ELSE s.starts_at END,
  booked_ends_at = CASE WHEN b.reschedule_pending THEN COALESCE(b.original_ends_at,s.ends_at) ELSE s.ends_at END,
  proposed_schedule_version = CASE WHEN b.reschedule_pending THEN s.schedule_version END,
  reschedule_notified_at = CASE WHEN b.reschedule_pending THEN now() END,
  reschedule_deadline = CASE WHEN b.reschedule_pending THEN LEAST(now()+interval '48 hours',s.starts_at-interval '12 hours') END
FROM sessions s WHERE s.id=b.session_id;
ALTER TABLE bookings ALTER COLUMN booked_starts_at SET NOT NULL, ALTER COLUMN booked_ends_at SET NOT NULL;

CREATE FUNCTION snapshot_booking_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT starts_at,ends_at,schedule_version INTO NEW.booked_starts_at,NEW.booked_ends_at,NEW.schedule_version FROM sessions WHERE id=NEW.session_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER booking_schedule_snapshot BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION snapshot_booking_schedule();
CREATE FUNCTION record_booking_cancellation_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reservation_status='cancelled' AND OLD.reservation_status<>'cancelled' THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at,clock_timestamp());
    NEW.reschedule_pending := false;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER booking_cancellation_time BEFORE UPDATE OF reservation_status ON bookings FOR EACH ROW EXECUTE FUNCTION record_booking_cancellation_time();

ALTER TABLE session_schedule_history ADD COLUMN schedule_version integer CHECK (schedule_version > 0), ADD COLUMN response_deadline timestamptz;
CREATE UNIQUE INDEX session_schedule_version_unique ON session_schedule_history(session_id,schedule_version) WHERE schedule_version IS NOT NULL;
CREATE INDEX booking_reschedule_due ON bookings(session_id,reschedule_deadline) WHERE reschedule_pending AND reservation_status='confirmed';
CREATE TABLE booking_schedule_acceptances (
  booking_id uuid NOT NULL REFERENCES bookings(id),
  schedule_version integer NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (booking_id,schedule_version)
);
ALTER TABLE booking_schedule_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_schedule_acceptances FROM PUBLIC,anon,authenticated;

ALTER TABLE email_outbox
  ADD COLUMN delivery_type text NOT NULL DEFAULT 'reminder' CHECK (delivery_type IN ('reminder','schedule_change')),
  ADD COLUMN schedule_version integer;
ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_status_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_status_check CHECK (status IN ('pending','processing','sent','failed','cancelled'));

INSERT INTO user_notifications(user_id,booking_id,type,title,body,href)
SELECT user_id,id,'session_rescheduled','Vui lòng phản hồi giờ học mới',
  'Vui lòng chọn giữ chỗ hoặc hủy trước '||to_char(reschedule_deadline AT TIME ZONE 'Asia/Ho_Chi_Minh','HH24:MI, DD/MM/YYYY')||'. Nếu không phản hồi đúng hạn, đặt chỗ sẽ tự hủy và số tiền đã trả được hoàn toàn bộ.',
  '/me/bookings/'||id::text FROM bookings WHERE reschedule_pending AND reservation_status='confirmed' AND reschedule_deadline>now();



-- =============================================================================
-- Migration: 040_ticket_attendance_and_refund_receipts.sql
-- =============================================================================

ALTER TABLE bookings ADD COLUMN refunded_amount integer NOT NULL DEFAULT 0 CHECK(refunded_amount>=0);
UPDATE bookings SET refunded_amount=refund_due_amount WHERE refund_status='refunded';
CREATE TABLE booking_refund_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id),
  amount integer NOT NULL CHECK(amount>0),
  reference text,
  actor_id uuid REFERENCES users(id),
  refunded_at timestamptz,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO booking_refund_receipts(booking_id,amount,reference,refunded_at)
SELECT id,refunded_amount,refund_reference,refunded_at FROM bookings WHERE refunded_amount>0;
ALTER TABLE booking_refund_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_refund_receipts FROM PUBLIC,anon,authenticated;

ALTER TABLE tickets
  ADD COLUMN attendance_status text NOT NULL DEFAULT 'unmarked' CHECK(attendance_status IN ('unmarked','attended','absent')),
  ADD COLUMN attendance_marked_by uuid REFERENCES users(id),
  ADD COLUMN attendance_marked_at timestamptz,
  ADD COLUMN total_amount integer NOT NULL DEFAULT 0 CHECK(total_amount>=0),
  ADD COLUMN deposit_amount integer NOT NULL DEFAULT 0 CHECK(deposit_amount>=0),
  ADD COLUMN paid_amount integer NOT NULL DEFAULT 0 CHECK(paid_amount>=0),
  ADD COLUMN refund_due_amount integer NOT NULL DEFAULT 0 CHECK(refund_due_amount>=0),
  ADD COLUMN refunded_amount integer NOT NULL DEFAULT 0 CHECK(refunded_amount>=0),
  ADD COLUMN refund_started_at timestamptz,
  ADD COLUMN refund_history_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);

CREATE FUNCTION original_seat_share(amount integer,quantity integer,seq integer) RETURNS integer LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT CASE WHEN seq=quantity THEN amount-(amount/quantity)*(quantity-1) ELSE amount/quantity END
$$;
UPDATE tickets t SET
  total_amount=original_seat_share(b.total_amount,b.quantity,t.seq),
  deposit_amount=original_seat_share(b.deposit_amount,b.quantity,t.seq),
  paid_amount=original_seat_share(b.paid_amount,b.quantity,t.seq),
  refund_due_amount=original_seat_share(b.refund_due_amount,b.quantity,t.seq),
  refunded_amount=original_seat_share(b.refunded_amount,b.quantity,t.seq),
  refund_started_at=CASE WHEN b.refund_due_amount>0 THEN COALESCE(b.refunded_at,b.cancelled_at) END,
  refund_history_locked=b.refund_due_amount>0,
  attendance_status=b.attendance_status,attendance_marked_by=b.attendance_marked_by,attendance_marked_at=b.attendance_marked_at
FROM bookings b WHERE b.id=t.booking_id;

CREATE FUNCTION initialize_ticket_amounts() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b bookings;
BEGIN
 SELECT * INTO b FROM bookings WHERE id=NEW.booking_id;
 NEW.total_amount:=original_seat_share(b.total_amount,b.quantity,NEW.seq);
 NEW.deposit_amount:=original_seat_share(b.deposit_amount,b.quantity,NEW.seq);
 NEW.paid_amount:=original_seat_share(b.paid_amount,b.quantity,NEW.seq);
 RETURN NEW;
END; $$;
CREATE TRIGGER ticket_amount_snapshot BEFORE INSERT ON tickets FOR EACH ROW EXECUTE FUNCTION initialize_ticket_amounts();
CREATE FUNCTION increment_ticket_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW IS DISTINCT FROM OLD THEN NEW.version:=OLD.version+1; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER ticket_version BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION increment_ticket_version();

-- Existing whole-booking cancellation APIs remain compatible. A refund is cumulative;
-- outstanding money is refund_due_amount minus refunded_amount.
CREATE FUNCTION synchronize_ticket_finances() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE due integer;
BEGIN
 IF NEW.paid_amount<>OLD.paid_amount THEN
   UPDATE tickets SET paid_amount=original_seat_share(NEW.paid_amount,NEW.quantity,seq) WHERE booking_id=NEW.id;
 END IF;
 IF NEW.reservation_status='cancelled' THEN
   UPDATE tickets SET refund_due_amount=GREATEST(refunded_amount,
     CASE WHEN NEW.refund_due_amount>=NEW.paid_amount THEN paid_amount
       WHEN NEW.refund_due_amount=GREATEST(0,NEW.paid_amount-NEW.deposit_amount) THEN GREATEST(0,paid_amount-deposit_amount)
       ELSE original_seat_share(NEW.refund_due_amount,NEW.quantity,seq) END),
     refund_started_at=CASE WHEN NEW.refund_due_amount>0 THEN COALESCE(refund_started_at,clock_timestamp()) ELSE refund_started_at END
     ,refund_history_locked=refund_history_locked OR NEW.refund_due_amount>0
   WHERE booking_id=NEW.id;
 ELSIF NEW.paid_amount<>OLD.paid_amount THEN
   UPDATE tickets SET refund_due_amount=GREATEST(refunded_amount,paid_amount-deposit_amount),
     refund_started_at=CASE WHEN paid_amount>deposit_amount THEN COALESCE(refund_started_at,clock_timestamp()) ELSE refund_started_at END,
     refund_history_locked=refund_history_locked OR paid_amount>deposit_amount
   WHERE booking_id=NEW.id AND attendance_status='absent';
   SELECT COALESCE(sum(refund_due_amount),0)::integer INTO due FROM tickets WHERE booking_id=NEW.id;
   IF due>NEW.refund_due_amount THEN
     UPDATE bookings SET refund_due_amount=due,refund_status=CASE WHEN due>refunded_amount THEN 'pending' ELSE 'refunded' END WHERE id=NEW.id;
   END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER ticket_financial_sync AFTER UPDATE OF paid_amount,reservation_status,refund_due_amount ON bookings FOR EACH ROW EXECUTE FUNCTION synchronize_ticket_finances();



-- =============================================================================
-- Migration: 041_partial_seats_and_checkout_revisions.sql
-- =============================================================================

ALTER TABLE bookings
 ADD COLUMN original_quantity integer,
 ADD COLUMN original_total_amount integer,
 ADD COLUMN original_deposit_amount integer,
 ADD COLUMN seat_revision integer NOT NULL DEFAULT 0,
 ADD COLUMN checkout_revision integer NOT NULL DEFAULT 0,
 ADD COLUMN extra_received_amount bigint NOT NULL DEFAULT 0 CHECK(extra_received_amount>=0),
 ADD COLUMN extra_refund_due_amount bigint NOT NULL DEFAULT 0 CHECK(extra_refund_due_amount>=0),
 ADD COLUMN extra_refunded_amount bigint NOT NULL DEFAULT 0 CHECK(extra_refunded_amount>=0);
UPDATE bookings SET original_quantity=quantity,original_total_amount=total_amount,original_deposit_amount=deposit_amount;
ALTER TABLE bookings ALTER COLUMN original_quantity SET NOT NULL, ALTER COLUMN original_total_amount SET NOT NULL, ALTER COLUMN original_deposit_amount SET NOT NULL;
CREATE FUNCTION snapshot_original_booking_amounts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.original_quantity:=NEW.quantity;NEW.original_total_amount:=NEW.total_amount;NEW.original_deposit_amount:=NEW.deposit_amount;RETURN NEW;
END;$$;
CREATE TRIGGER booking_original_amounts BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION snapshot_original_booking_amounts();

CREATE TABLE booking_seats(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES bookings(id),
 seq integer NOT NULL CHECK(seq BETWEEN 1 AND 10),
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','cancelled')),
 total_amount integer NOT NULL CHECK(total_amount>=0),
 deposit_amount integer NOT NULL CHECK(deposit_amount>=0),
 paid_amount integer NOT NULL DEFAULT 0 CHECK(paid_amount>=0),
 refund_due_amount integer NOT NULL DEFAULT 0 CHECK(refund_due_amount>=0),
 refunded_amount integer NOT NULL DEFAULT 0 CHECK(refunded_amount>=0),
 cancelled_at timestamptz,
 UNIQUE(booking_id,seq)
);
INSERT INTO booking_seats(booking_id,seq,state,total_amount,deposit_amount,paid_amount,refund_due_amount,refunded_amount,cancelled_at)
SELECT b.id,n,CASE WHEN b.reservation_status='cancelled' OR t.status='void' THEN 'cancelled' ELSE 'active' END,
 original_seat_share(b.total_amount,b.quantity,n),original_seat_share(b.deposit_amount,b.quantity,n),
 COALESCE(t.paid_amount,original_seat_share(b.paid_amount,b.quantity,n)),
 COALESCE(t.refund_due_amount,original_seat_share(b.refund_due_amount,b.quantity,n)),
 COALESCE(t.refunded_amount,original_seat_share(b.refunded_amount,b.quantity,n)),b.cancelled_at
FROM bookings b CROSS JOIN LATERAL generate_series(1,b.quantity)n LEFT JOIN tickets t ON t.booking_id=b.id AND t.seq=n;
ALTER TABLE booking_seats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_seats FROM PUBLIC,anon,authenticated;
CREATE FUNCTION initialize_booking_seats() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO booking_seats(booking_id,seq,total_amount,deposit_amount)
 SELECT NEW.id,n,original_seat_share(NEW.total_amount,NEW.quantity,n),original_seat_share(NEW.deposit_amount,NEW.quantity,n) FROM generate_series(1,NEW.quantity)n;
 RETURN NEW;
END;$$;
CREATE TRIGGER booking_seats_initial AFTER INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION initialize_booking_seats();

ALTER TABLE payments ADD COLUMN checkout_revision integer NOT NULL DEFAULT 0,
 ADD COLUMN checkout_claimed_at timestamptz,
 ADD COLUMN checkout_setup text NOT NULL DEFAULT 'ready' CHECK(checkout_setup IN ('pending','creating','ready','unknown','superseded'));
CREATE UNIQUE INDEX payment_deposit_revision ON payments(booking_id,checkout_revision) WHERE kind='deposit';
CREATE TABLE booking_extra_refunds(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payment_id uuid NOT NULL REFERENCES payments(id),booking_id uuid NOT NULL REFERENCES bookings(id),
 source_event_id uuid NOT NULL UNIQUE REFERENCES webhook_events(id),provider_ref text,
 amount integer NOT NULL CHECK(amount>0),refunded_amount integer NOT NULL DEFAULT 0 CHECK(refunded_amount>=0),
 reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE booking_extra_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_extra_refunds FROM PUBLIC,anon,authenticated;
ALTER TABLE booking_refund_receipts ALTER COLUMN amount TYPE bigint;

CREATE OR REPLACE FUNCTION initialize_ticket_amounts() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE seat booking_seats;
BEGIN
 SELECT * INTO seat FROM booking_seats WHERE booking_id=NEW.booking_id AND seq=NEW.seq;
 IF NOT FOUND OR seat.state<>'active' THEN RAISE EXCEPTION 'Seat is not active';END IF;
 NEW.total_amount:=seat.total_amount;NEW.deposit_amount:=seat.deposit_amount;NEW.paid_amount:=seat.paid_amount;
 RETURN NEW;
END;$$;
CREATE FUNCTION mirror_ticket_to_booking_seat() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE booking_seats SET paid_amount=NEW.paid_amount,refund_due_amount=NEW.refund_due_amount,refunded_amount=NEW.refunded_amount,
 state=CASE WHEN NEW.status='void' THEN 'cancelled' ELSE state END,
 cancelled_at=CASE WHEN NEW.status='void' THEN COALESCE(cancelled_at,clock_timestamp()) ELSE cancelled_at END
 WHERE booking_id=NEW.booking_id AND seq=NEW.seq;
 RETURN NEW;
END;$$;
CREATE TRIGGER ticket_seat_mirror AFTER UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION mirror_ticket_to_booking_seat();

CREATE FUNCTION synchronize_booking_seat_receipts() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE due integer;
BEGIN
 IF NEW.seat_revision=0 THEN
  IF NEW.paid_amount<>OLD.paid_amount THEN
   UPDATE booking_seats SET paid_amount=original_seat_share(NEW.paid_amount,NEW.original_quantity,seq) WHERE booking_id=NEW.id;
  END IF;
  IF NEW.reservation_status='cancelled' THEN
   UPDATE booking_seats SET state='cancelled',cancelled_at=COALESCE(cancelled_at,NEW.cancelled_at,clock_timestamp()),
    refund_due_amount=GREATEST(refunded_amount,CASE WHEN NEW.refund_due_amount>=NEW.paid_amount THEN paid_amount
     WHEN NEW.refund_due_amount=GREATEST(0,NEW.paid_amount-NEW.deposit_amount) THEN GREATEST(0,paid_amount-deposit_amount)
     ELSE original_seat_share(NEW.refund_due_amount,NEW.original_quantity,seq) END) WHERE booking_id=NEW.id;
  END IF;
 ELSIF current_setting('app.partial_seat_operation',true) IS DISTINCT FROM 'true' AND NEW.paid_amount<>OLD.paid_amount AND NEW.reservation_status<>'cancelled' THEN
  IF NEW.paid_amount<>NEW.total_amount THEN RAISE EXCEPTION 'Partial receipt requires seat allocation';END IF;
  UPDATE booking_seats SET paid_amount=total_amount WHERE booking_id=NEW.id AND state='active';
  UPDATE tickets t SET paid_amount=s.paid_amount,
   refund_due_amount=CASE WHEN t.attendance_status='absent' THEN GREATEST(t.refunded_amount,s.paid_amount-s.deposit_amount) ELSE t.refund_due_amount END,
   refund_history_locked=t.refund_history_locked OR (t.attendance_status='absent' AND s.paid_amount>s.deposit_amount),
   refund_started_at=CASE WHEN t.attendance_status='absent' AND s.paid_amount>s.deposit_amount THEN COALESCE(t.refund_started_at,clock_timestamp()) ELSE t.refund_started_at END
   FROM booking_seats s WHERE s.booking_id=NEW.id AND s.state='active' AND t.booking_id=s.booking_id AND t.seq=s.seq;
  SELECT COALESCE(sum(refund_due_amount),0)::integer INTO due FROM booking_seats WHERE booking_id=NEW.id;
  UPDATE bookings SET refund_due_amount=due,refund_status=CASE WHEN due+extra_refund_due_amount>refunded_amount+extra_refunded_amount THEN 'pending' WHEN due+extra_refund_due_amount>0 THEN 'refunded' ELSE 'not_applicable' END WHERE id=NEW.id;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER aa_booking_seat_receipts AFTER UPDATE OF paid_amount,reservation_status ON bookings FOR EACH ROW EXECUTE FUNCTION synchronize_booking_seat_receipts();

CREATE FUNCTION preserve_partial_seat_cancellation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE seqs integer[];due integer;returned integer;
BEGIN
 IF OLD.seat_revision>0 AND OLD.reservation_status<>'cancelled' AND NEW.reservation_status='cancelled'
    AND current_setting('app.partial_seat_operation',true) IS DISTINCT FROM 'true' THEN
  SELECT array_agg(seq) INTO seqs FROM booking_seats WHERE booking_id=OLD.id AND state='active';
  UPDATE booking_seats SET state='cancelled',cancelled_at=clock_timestamp(),refund_due_amount=paid_amount WHERE booking_id=OLD.id AND seq=ANY(seqs);
  UPDATE tickets t SET status='void',refund_due_amount=s.refund_due_amount,refund_history_locked=t.refund_history_locked OR s.refund_due_amount>0,
    refund_started_at=CASE WHEN s.refund_due_amount>0 THEN COALESCE(t.refund_started_at,clock_timestamp()) ELSE t.refund_started_at END
    FROM booking_seats s WHERE s.booking_id=OLD.id AND t.booking_id=s.booking_id AND t.seq=s.seq AND s.seq=ANY(seqs);
  SELECT COALESCE(sum(refund_due_amount),0)::integer,COALESCE(sum(refunded_amount),0)::integer INTO due,returned FROM booking_seats WHERE booking_id=OLD.id;
  NEW.refund_due_amount:=due;NEW.refunded_amount:=returned;
  NEW.refund_status:=CASE WHEN due+NEW.extra_refund_due_amount>returned+NEW.extra_refunded_amount THEN 'pending' WHEN due+NEW.extra_refund_due_amount>0 THEN 'refunded' ELSE 'not_applicable' END;
  NEW.status:=CASE WHEN NEW.refund_status='pending' THEN 'refund_needed'::booking_status ELSE 'cancelled'::booking_status END;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER booking_partial_cancel_guard BEFORE UPDATE OF reservation_status ON bookings FOR EACH ROW EXECUTE FUNCTION preserve_partial_seat_cancellation();

-- Keep the pre-existing whole-group synchronizer for untouched bookings only.
DO $$DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('synchronize_ticket_finances()'::regprocedure) INTO definition;
 definition:=regexp_replace(definition,'BEGIN[[:space:]]+',E'BEGIN\n IF NEW.seat_revision>0 THEN RETURN NEW; END IF;\n');
 EXECUTE definition;
END;$$;



-- =============================================================================
-- Migration: 042_repair_legacy_expired_seat_baseline.sql
-- =============================================================================

-- Expiration in migration 019 sets reservation_status=cancelled. That does not
-- mean the customer cancelled these seats: a verified late payment may reclaim
-- capacity. Repair only untouched expired holds without any issued ticket.
-- No reservation, payment, refund or session seat counter is changed here.
WITH repaired AS (
 UPDATE booking_seats bs SET state='active',cancelled_at=NULL
 FROM bookings b WHERE b.id=bs.booking_id AND b.seat_revision=0 AND b.status='expired'
  AND bs.state='cancelled' AND NOT EXISTS(SELECT 1 FROM tickets t WHERE t.booking_id=b.id)
 RETURNING b.id,b.order_code
), bookings_repaired AS (SELECT DISTINCT id,order_code FROM repaired)
INSERT INTO admin_activity_log(actor_id,actor_name,action,entity_type,entity_id,entity_name,reason)
SELECT NULL,'Hệ thống','booking.expired_seats_baseline_repaired','booking',id,order_code::text,
 'Sửa danh sách chỗ của lượt giữ đã hết hạn để đối soát tiền về muộn. Không giữ hoặc bán lại chỗ.' FROM bookings_repaired;



-- =============================================================================
-- Migration: 043_delivered_attendance_confirmation.sql
-- =============================================================================

-- A queued or in-app notice is not evidence that a confirmation email was sent.
-- Legacy emails are deliberately not backfilled as confirmation requests.
ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_delivery_type_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_delivery_type_check
 CHECK(delivery_type IN ('reminder','schedule_change','attendance_confirmation'));
ALTER TABLE email_outbox ADD COLUMN reminder_starts_at timestamptz;
CREATE UNIQUE INDEX email_attendance_confirmation_version
 ON email_outbox(booking_id,schedule_version) WHERE delivery_type='attendance_confirmation';
ALTER TABLE email_outbox ADD CONSTRAINT email_attendance_confirmation_terms CHECK(
 delivery_type<>'attendance_confirmation' OR
 (booking_id IS NOT NULL AND schedule_version IS NOT NULL AND schedule_version>0 AND reminder_starts_at IS NOT NULL));

-- Caller serializes on the session before acting on this deadline.
CREATE FUNCTION attendance_confirmation_deadline(target_booking uuid) RETURNS timestamptz
 LANGUAGE sql STABLE AS $$
 WITH terms AS (
  SELECT s.starts_at,GREATEST(s.starts_at-make_interval(mins=>b.release_before_minutes),min(e.sent_at)+interval '2 hours') AS deadline
  FROM bookings b JOIN sessions s ON s.id=b.session_id
  JOIN email_outbox e ON e.booking_id=b.id AND e.delivery_type='attendance_confirmation'
   AND e.status='sent' AND e.sent_at IS NOT NULL AND e.schedule_version=s.schedule_version
   AND e.reminder_starts_at=s.starts_at
  WHERE b.id=target_booking AND b.reservation_status='confirmed' AND NOT b.reschedule_pending
   AND b.schedule_version=s.schedule_version AND b.payment_mode<>'payos_deposit' AND b.paid_amount=0
   AND b.release_if_unconfirmed AND b.release_before_minutes IS NOT NULL AND b.attendance_confirmed_at IS NULL
   AND s.status='scheduled'
   AND NOT EXISTS(SELECT 1 FROM tickets t WHERE t.booking_id=b.id AND t.status='valid' AND t.attendance_status<>'unmarked')
  GROUP BY s.starts_at,b.release_before_minutes
 ) SELECT deadline FROM terms WHERE deadline<starts_at
$$;
REVOKE ALL ON FUNCTION attendance_confirmation_deadline(uuid) FROM PUBLIC,anon,authenticated;



-- =============================================================================
-- Migration: 044_financial_obligations_and_transfers.sql
-- =============================================================================

-- Stage 5 financial workflow foundation. Deadlines remain nullable until the
-- working-day calendar is selected and configured; this migration does not
-- initiate or record any real-world transfer.
CREATE TABLE financial_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id),
  studio_id uuid NOT NULL REFERENCES studios(id),
  ticket_id uuid REFERENCES tickets(id),
  kind text NOT NULL CHECK (kind IN ('customer_refund','studio_payout','studio_recovery')),
  source_key text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'awaiting_funds'
    CHECK (status IN ('awaiting_funds','awaiting_approval','approved','processing','partially_paid','paid','failed','manual_review','cancelled')),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (kind, source_key)
);
CREATE INDEX financial_obligations_queue_idx
  ON financial_obligations (due_at NULLS LAST, created_at)
  WHERE status NOT IN ('paid','cancelled');
CREATE INDEX financial_obligations_booking_idx ON financial_obligations (booking_id, created_at);

CREATE TABLE financial_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id uuid NOT NULL REFERENCES financial_obligations(id),
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  purpose text NOT NULL CHECK (purpose IN ('studio_repayment','customer_refund','studio_payout','platform_advance')),
  amount bigint NOT NULL CHECK (amount > 0),
  provider_fee bigint CHECK (provider_fee IS NULL OR provider_fee >= 0),
  provider text,
  reference text,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'recorded'
    CHECK (status IN ('recorded','pending_approval','approved','processing','succeeded','failed','manual_review')),
  created_by uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  settled_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((status <> 'succeeded') OR settled_at IS NOT NULL),
  CHECK ((status <> 'approved') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE UNIQUE INDEX financial_transfer_reference_unique
  ON financial_transfers (provider, reference) WHERE reference IS NOT NULL;
CREATE INDEX financial_transfers_obligation_idx ON financial_transfers (obligation_id, created_at);

CREATE TABLE financial_transfer_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transfer_id uuid NOT NULL REFERENCES financial_transfers(id),
  actor_id uuid REFERENCES users(id),
  event text NOT NULL CHECK (event IN ('created','approved','submitted','succeeded','failed','manual_review','corrected')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX financial_transfer_events_transfer_idx ON financial_transfer_events (transfer_id, created_at);

ALTER TABLE financial_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transfer_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON financial_obligations, financial_transfers, financial_transfer_events FROM PUBLIC, anon, authenticated;

-- Every transfer requires an approving admin before it can be submitted or
-- recorded as settled. This includes reconciled incoming studio repayments.
CREATE FUNCTION guard_financial_transfer_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.obligation_id IS DISTINCT FROM OLD.obligation_id
     OR NEW.direction IS DISTINCT FROM OLD.direction
     OR NEW.purpose IS DISTINCT FROM OLD.purpose
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Financial transfer details are immutable';
  END IF;
  IF OLD.provider_fee IS NOT NULL AND NEW.provider_fee IS DISTINCT FROM OLD.provider_fee THEN
    RAISE EXCEPTION 'Recorded provider fee cannot be overwritten';
  END IF;
  IF OLD.status IN ('succeeded','failed') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Terminal financial transfer status cannot be overwritten';
  END IF;
  IF NEW.status IN ('approved','processing','succeeded')
     AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL) THEN
    RAISE EXCEPTION 'Financial transfer requires admin approval';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER financial_transfer_update_guard BEFORE UPDATE ON financial_transfers
  FOR EACH ROW EXECUTE FUNCTION guard_financial_transfer_update();

CREATE FUNCTION prevent_financial_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Financial transfer events are append-only';
END;
$$;
CREATE TRIGGER financial_transfer_events_immutable
  BEFORE UPDATE OR DELETE ON financial_transfer_events
  FOR EACH ROW EXECUTE FUNCTION prevent_financial_event_mutation();



-- =============================================================================
-- Migration: 045_vietnam_business_calendar.sql
-- =============================================================================

-- Government-published Vietnam calendar. Explicit make-up working dates can
-- override the normal Monday-Friday rule, so weekend swaps are represented.
CREATE TABLE business_calendar_overrides (
  calendar_date date PRIMARY KEY,
  day_type text NOT NULL CHECK (day_type IN ('non_working','working')),
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 2 AND 160),
  official_reference text NOT NULL CHECK (length(trim(official_reference)) BETWEEN 4 AND 500),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX business_calendar_active_year_idx
  ON business_calendar_overrides ((extract(year FROM calendar_date)), calendar_date)
  WHERE active;

-- Official Government News Portal: 24 November is Vietnam Culture Day and
-- employees have the day off; this date is upcoming in the current 2026 cycle.
INSERT INTO business_calendar_overrides(calendar_date,day_type,label,official_reference)
VALUES (
  DATE '2026-11-24',
  'non_working',
  'Ngày Văn hóa Việt Nam',
  'https://xaydungchinhsach.chinhphu.vn/ngay-24-11-hang-nam-la-ngay-van-hoa-viet-nam-nguoi-lao-dong-duoc-nghi-huong-nguyen-luong-119260113152642414.htm'
);

CREATE TABLE business_calendar_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  calendar_date date NOT NULL,
  actor_id uuid REFERENCES users(id),
  action text NOT NULL CHECK (action IN ('created','updated','disabled','enabled')),
  previous jsonb,
  current jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX business_calendar_events_date_idx ON business_calendar_events (calendar_date, created_at);
ALTER TABLE business_calendar_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_calendar_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON business_calendar_overrides, business_calendar_events FROM PUBLIC, anon, authenticated;

CREATE FUNCTION is_open_slot_working_day(day_to_check date) RETURNS boolean
LANGUAGE sql STABLE STRICT AS $$
  SELECT COALESCE(
    (SELECT c.day_type='working' FROM business_calendar_overrides c WHERE c.calendar_date=day_to_check AND c.active),
    extract(isodow FROM day_to_check) BETWEEN 1 AND 5
  )
$$;

-- Count full working dates after the local date of the triggering event and
-- preserve its local clock time. Weekend/holiday event dates are not counted.
CREATE FUNCTION add_open_slot_business_days(event_at timestamptz, days_to_add integer)
RETURNS timestamptz LANGUAGE plpgsql STABLE STRICT AS $$
DECLARE
  local_event timestamp := event_at AT TIME ZONE 'Asia/Ho_Chi_Minh';
  due_date date := (event_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  counted integer := 0;
BEGIN
  IF days_to_add < 0 THEN RAISE EXCEPTION 'days_to_add must be non-negative'; END IF;
  WHILE counted < days_to_add LOOP
    due_date := due_date + 1;
    IF is_open_slot_working_day(due_date) THEN counted := counted + 1; END IF;
  END LOOP;
  RETURN (due_date + local_event::time) AT TIME ZONE 'Asia/Ho_Chi_Minh';
END;
$$;

CREATE FUNCTION financial_obligation_deadline(kind text, event_at timestamptz)
RETURNS timestamptz LANGUAGE sql STABLE STRICT AS $$
  SELECT CASE kind
    WHEN 'customer_refund' THEN add_open_slot_business_days(event_at, 7)
    WHEN 'studio_payout' THEN add_open_slot_business_days(event_at, 3)
    ELSE NULL
  END
$$;



-- =============================================================================
-- Migration: 046_financial_refund_obligation_links.sql
-- =============================================================================

ALTER TABLE financial_obligations
  ADD COLUMN related_obligation_id uuid REFERENCES financial_obligations(id);
CREATE INDEX financial_obligations_related_idx ON financial_obligations (related_obligation_id)
  WHERE related_obligation_id IS NOT NULL;

-- Each new refund liability has a matching studio-funding obligation.



-- =============================================================================
-- Migration: 047_payment_collection_fee_reconciliation.sql
-- =============================================================================

CREATE TABLE payment_fee_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL UNIQUE REFERENCES payments(id),
  amount bigint NOT NULL CHECK (amount >= 0),
  provider text NOT NULL,
  provider_reference text NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE payment_fee_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_fee_reconciliations FROM PUBLIC,anon,authenticated;



-- =============================================================================
-- Migration: 048_studio_payout_snapshots.sql
-- =============================================================================

ALTER TABLE financial_obligations
  ADD COLUMN payout_snapshot_at timestamptz,
  ADD COLUMN payout_snapshot jsonb;

ALTER TABLE financial_obligations
  ADD CONSTRAINT studio_payout_snapshot_pair CHECK (
    (payout_snapshot_at IS NULL) = (payout_snapshot IS NULL)
  );



-- =============================================================================
-- Migration: 049_studio_settlement_snapshots.sql
-- =============================================================================

CREATE TABLE studio_settlement_snapshots (
  booking_id uuid PRIMARY KEY REFERENCES bookings(id),
  session_id uuid NOT NULL REFERENCES sessions(id),
  due_at timestamptz NOT NULL,
  net_amount bigint NOT NULL,
  breakdown jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO studio_settlement_snapshots(booking_id,session_id,due_at,net_amount,breakdown,created_at)
SELECT o.booking_id,b.session_id,o.due_at,o.amount,
  COALESCE(o.payout_snapshot,jsonb_build_object('legacyPayout',o.amount)),
  COALESCE(o.payout_snapshot_at,o.created_at)
FROM financial_obligations o JOIN bookings b ON b.id=o.booking_id
WHERE o.kind='studio_payout' AND o.due_at IS NOT NULL
ON CONFLICT(booking_id) DO NOTHING;

ALTER TABLE studio_settlement_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON studio_settlement_snapshots FROM PUBLIC,anon,authenticated;



-- =============================================================================
-- Migration: 050_financial_due_alerts.sql
-- =============================================================================

CREATE TABLE financial_due_alerts (
  obligation_id uuid NOT NULL REFERENCES financial_obligations(id),
  stage text NOT NULL CHECK (stage IN ('due_soon','overdue')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(obligation_id,stage)
);
ALTER TABLE financial_due_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON financial_due_alerts FROM PUBLIC,anon,authenticated;



-- =============================================================================
-- Migration: 051_studio_payout_accounts.sql
-- =============================================================================

CREATE TABLE studio_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id),
  bank_name text NOT NULL CHECK(length(trim(bank_name)) BETWEEN 2 AND 120),
  account_holder text NOT NULL CHECK(length(trim(account_holder)) BETWEEN 2 AND 160),
  account_last4 text NOT NULL CHECK(account_last4 ~ '^[0-9]{4}$'),
  encrypted_number bytea NOT NULL,
  encryption_iv bytea NOT NULL,
  encryption_tag bytea NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected')),
  is_current boolean NOT NULL DEFAULT true,
  changed_by uuid NOT NULL REFERENCES users(id),
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  verification_reference text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((status='verified')=(verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  CHECK (status<>'verified' OR verification_reference IS NOT NULL)
);
CREATE UNIQUE INDEX studio_payout_account_current_idx ON studio_payout_accounts(studio_id) WHERE is_current;
CREATE INDEX studio_payout_account_history_idx ON studio_payout_accounts(studio_id,created_at DESC);
ALTER TABLE studio_payout_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON studio_payout_accounts FROM PUBLIC,anon,authenticated;

ALTER TABLE financial_transfers
  ADD COLUMN destination_studio_account_id uuid REFERENCES studio_payout_accounts(id);

CREATE FUNCTION guard_financial_destination_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.destination_studio_account_id IS NOT NULL
     AND NEW.destination_studio_account_id IS DISTINCT FROM OLD.destination_studio_account_id THEN
    RAISE EXCEPTION 'Approved transfer destination is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER financial_destination_update_guard BEFORE UPDATE ON financial_transfers
  FOR EACH ROW EXECUTE FUNCTION guard_financial_destination_update();



-- =============================================================================
-- Migration: 052_customer_refund_accounts.sql
-- =============================================================================

CREATE TABLE customer_refund_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id),
  user_id uuid NOT NULL REFERENCES users(id),
  bank_name text NOT NULL CHECK(length(trim(bank_name)) BETWEEN 2 AND 120),
  account_holder text NOT NULL CHECK(length(trim(account_holder)) BETWEEN 2 AND 160),
  account_last4 text NOT NULL CHECK(account_last4 ~ '^[0-9]{4}$'),
  encrypted_number bytea NOT NULL,
  encryption_iv bytea NOT NULL,
  encryption_tag bytea NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected')),
  is_current boolean NOT NULL DEFAULT true,
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  verification_reference text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((status='verified')=(verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  CHECK (status<>'verified' OR verification_reference IS NOT NULL)
);
CREATE UNIQUE INDEX customer_refund_account_current_idx ON customer_refund_accounts(booking_id) WHERE is_current;
CREATE INDEX customer_refund_account_history_idx ON customer_refund_accounts(booking_id,created_at DESC);
ALTER TABLE customer_refund_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON customer_refund_accounts FROM PUBLIC,anon,authenticated;

ALTER TABLE financial_transfers
  ADD COLUMN destination_customer_account_id uuid REFERENCES customer_refund_accounts(id);

CREATE FUNCTION guard_customer_financial_destination_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.destination_customer_account_id IS NOT NULL
     AND NEW.destination_customer_account_id IS DISTINCT FROM OLD.destination_customer_account_id THEN
    RAISE EXCEPTION 'Approved customer refund destination is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER customer_financial_destination_update_guard BEFORE UPDATE ON financial_transfers
  FOR EACH ROW EXECUTE FUNCTION guard_customer_financial_destination_update();



-- =============================================================================
-- Migration: 053_refund_scoped_destinations_and_retention.sql
-- =============================================================================

ALTER TABLE customer_refund_accounts
  ADD COLUMN refund_id uuid REFERENCES financial_obligations(id),
  ADD COLUMN bank_bin text,
  ADD COLUMN source text NOT NULL DEFAULT 'legacy_booking'
    CHECK (source IN ('legacy_booking','customer_input','payment_source')),
  ADD COLUMN purged_at timestamptz;

ALTER TABLE customer_refund_accounts
  ALTER COLUMN bank_name DROP NOT NULL,
  ALTER COLUMN account_holder DROP NOT NULL,
  ALTER COLUMN encrypted_number DROP NOT NULL,
  ALTER COLUMN encryption_iv DROP NOT NULL,
  ALTER COLUMN encryption_tag DROP NOT NULL;

ALTER TABLE customer_refund_accounts
  ADD CONSTRAINT refund_destination_minimal_data CHECK (
    (source='legacy_booking' OR (refund_id IS NOT NULL AND (purged_at IS NOT NULL OR bank_bin ~ '^[0-9]{6}$')))
    AND ((purged_at IS NULL AND encrypted_number IS NOT NULL AND encryption_iv IS NOT NULL AND encryption_tag IS NOT NULL)
      OR (purged_at IS NOT NULL AND encrypted_number IS NULL AND encryption_iv IS NULL AND encryption_tag IS NULL))
  );

-- Booking-scoped rows predate refund-specific destinations. Preserve their
-- audit/transfer references, but require a new refund-scoped destination.
UPDATE customer_refund_accounts SET is_current=false WHERE refund_id IS NULL;
DROP INDEX customer_refund_account_current_idx;
CREATE UNIQUE INDEX customer_refund_account_current_refund_idx
  ON customer_refund_accounts(refund_id) WHERE is_current AND refund_id IS NOT NULL;
CREATE INDEX customer_refund_account_purge_idx
  ON customer_refund_accounts(refund_id,created_at) WHERE purged_at IS NULL;

CREATE FUNCTION guard_refund_destination_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.refund_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM financial_obligations o
    WHERE o.id=NEW.refund_id AND o.kind='customer_refund' AND o.booking_id=NEW.booking_id
  ) THEN
    RAISE EXCEPTION 'Refund destination must match a customer refund obligation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER refund_destination_scope_guard BEFORE INSERT OR UPDATE OF refund_id,booking_id
  ON customer_refund_accounts FOR EACH ROW EXECUTE FUNCTION guard_refund_destination_scope();



-- =============================================================================
-- Migration: 054_saved_customer_refund_accounts.sql
-- =============================================================================

CREATE TABLE customer_saved_refund_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  bank_bin text CHECK (bank_bin IS NULL OR bank_bin ~ '^[0-9]{6}$'),
  account_holder text CHECK (account_holder IS NULL OR length(trim(account_holder)) BETWEEN 2 AND 160),
  account_last4 text NOT NULL CHECK (account_last4 ~ '^[0-9]{4}$'),
  encrypted_number bytea,
  encryption_iv bytea,
  encryption_tag bytea,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  CHECK ((deleted_at IS NULL AND bank_bin IS NOT NULL AND account_holder IS NOT NULL
    AND encrypted_number IS NOT NULL AND encryption_iv IS NOT NULL AND encryption_tag IS NOT NULL)
    OR (deleted_at IS NOT NULL AND bank_bin IS NULL AND account_holder IS NULL
    AND encrypted_number IS NULL AND encryption_iv IS NULL AND encryption_tag IS NULL))
);
CREATE INDEX customer_saved_refund_accounts_user_idx
  ON customer_saved_refund_accounts(user_id,created_at DESC) WHERE deleted_at IS NULL;
ALTER TABLE customer_saved_refund_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON customer_saved_refund_accounts FROM PUBLIC,anon,authenticated;

ALTER TABLE customer_refund_accounts
  ADD COLUMN saved_account_id uuid REFERENCES customer_saved_refund_accounts(id);
ALTER TABLE customer_refund_accounts DROP CONSTRAINT customer_refund_accounts_source_check;
ALTER TABLE customer_refund_accounts ADD CONSTRAINT customer_refund_accounts_source_check
  CHECK (source IN ('legacy_booking','customer_input','payment_source','saved_account'));
ALTER TABLE customer_refund_accounts ADD CONSTRAINT saved_refund_source_link
  CHECK ((source='saved_account')=(saved_account_id IS NOT NULL));



-- =============================================================================
-- Migration: 055_ticket_manual_checkin_code.sql
-- =============================================================================

ALTER TABLE tickets
  ADD COLUMN manual_code text NOT NULL
  DEFAULT upper(
    translate(
      substr(encode(uuid_send(gen_random_uuid()), 'base64'), 1, 8),
      '+/',
      '-_'
    )
  );

ALTER TABLE tickets
  ADD CONSTRAINT tickets_manual_code_format
  CHECK (manual_code ~ '^[A-Za-z0-9_-]{8}$');

CREATE UNIQUE INDEX tickets_manual_code_unique
  ON tickets(manual_code);



-- =============================================================================
-- Migration: 056_ticket_attendance_method.sql
-- =============================================================================

ALTER TABLE tickets
  ADD COLUMN attendance_method text
  CHECK (attendance_method IN ('check_in', 'manual_confirmation'));



-- =============================================================================
-- Migration: 057_email_and_password_reset.sql
-- =============================================================================

CREATE TABLE password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_created ON password_resets(user_id, created_at DESC);
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON password_resets FROM anon, authenticated;

ALTER TABLE bookings ADD COLUMN reminder24h_sent_at timestamptz;
ALTER TABLE bookings ADD COLUMN reminder24h_lock_at timestamptz;
CREATE TABLE workshop_schedule_unsubscribe_tokens (
  workshop_id uuid NOT NULL,
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workshop_id, user_id, token_hash),
  FOREIGN KEY (workshop_id, user_id)
    REFERENCES workshop_schedule_subscriptions(workshop_id, user_id) ON DELETE CASCADE
);
ALTER TABLE workshop_schedule_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON workshop_schedule_unsubscribe_tokens FROM anon, authenticated;

CREATE TABLE email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'complaint')),
  resend_id text,
  idempotency_key text UNIQUE,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX email_logs_retry ON email_logs(status, created_at)
  WHERE status = 'failed';
CREATE INDEX email_logs_recipient ON email_logs(recipient, created_at DESC);
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_logs FROM anon, authenticated;

CREATE TABLE email_suppressions (
  email text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('bounce', 'complaint')),
  source_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_suppressions FROM anon, authenticated;



-- =============================================================================
-- Migration: 058_studio_payout_account_bin.sql
-- =============================================================================

ALTER TABLE studio_payout_accounts
  ADD COLUMN bank_bin varchar(6) CHECK (bank_bin IS NULL OR bank_bin ~ '^[0-9]{6}$');



-- =============================================================================
-- Migration: 059_studio_invitations.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('staff')),
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  accepted_by uuid REFERENCES users(id),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_invitations_studio ON studio_invitations(studio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_invitations_token ON studio_invitations(token_hash) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_studio_invitations_email ON studio_invitations(email, status);



-- =============================================================================
-- Migration: 060_review_replies.sql
-- =============================================================================

-- 060_review_replies.sql
-- Thêm phản hồi của studio cho đánh giá khách hàng (FR-25)

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS reply_comment text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz;



-- =============================================================================
-- Migration: 061_studio_invitation_optional_email.sql
-- =============================================================================

-- Cho phép tạo lời mời nhân viên qua liên kết chia sẻ không cần nhập trước email
ALTER TABLE studio_invitations ALTER COLUMN email DROP NOT NULL;
ALTER TABLE studio_invitations ADD COLUMN IF NOT EXISTS token text;

