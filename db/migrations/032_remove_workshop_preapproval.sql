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
