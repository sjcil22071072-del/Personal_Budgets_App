-- 42_make_buckets_private.sql
-- 1. 스토리지 버킷의 public 속성을 false(private)로 변경
UPDATE storage.buckets
SET public = false
WHERE id IN ('receipts', 'activity-photos', 'documents', 'evidence-documents');

-- 2. 기존의 public 대상 SELECT 정책을 drop하고 authenticated 대상으로 재생성
DROP POLICY IF EXISTS "receipts_select" ON storage.objects;
CREATE POLICY "receipts_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "activity_photos_select" ON storage.objects;
CREATE POLICY "activity_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'activity-photos');

DROP POLICY IF EXISTS "evidence_documents_select" ON storage.objects;
CREATE POLICY "evidence_documents_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'evidence-documents');

-- 3. documents 버킷 SELECT 정책도 확실하게 authenticated로 보장 (기존 정책 존재 시 덮어쓰기)
DROP POLICY IF EXISTS "documents_select" ON storage.objects;
CREATE POLICY "documents_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');
