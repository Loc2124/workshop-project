-- Cho phép tạo lời mời nhân viên qua liên kết chia sẻ không cần nhập trước email
ALTER TABLE studio_invitations ALTER COLUMN email DROP NOT NULL;
ALTER TABLE studio_invitations ADD COLUMN IF NOT EXISTS token text;
