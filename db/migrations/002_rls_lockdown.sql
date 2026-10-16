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
