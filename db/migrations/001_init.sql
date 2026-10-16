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
