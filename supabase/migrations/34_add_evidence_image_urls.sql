-- 34_add_evidence_image_urls.sql
-- transactions 테이블에 증빙서류 URL 배열 컬럼 추가 (최대 5장)

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS evidence_image_urls TEXT[] NOT NULL DEFAULT '{}';

-- ── evidence-documents 버킷 생성 ──────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('evidence-documents', 'evidence-documents', true, 20971520,
   ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── RLS 정책 ─────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'evidence_documents_insert'
  ) THEN
    CREATE POLICY "evidence_documents_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'evidence-documents');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'evidence_documents_select'
  ) THEN
    CREATE POLICY "evidence_documents_select" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'evidence-documents');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'evidence_documents_delete'
  ) THEN
    CREATE POLICY "evidence_documents_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'evidence-documents');
  END IF;
END $$;
