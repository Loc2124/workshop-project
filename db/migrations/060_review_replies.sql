-- 060_review_replies.sql
-- Thêm phản hồi của studio cho đánh giá khách hàng (FR-25)

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS reply_comment text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz;
