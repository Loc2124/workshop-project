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
