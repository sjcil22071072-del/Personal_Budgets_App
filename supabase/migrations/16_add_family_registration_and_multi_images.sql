-- 1. transactions 테이블에 다중 이미지 컬럼 추가 및 기존 데이터 마이그레이션
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS receipt_image_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS activity_image_urls TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.transactions 
SET receipt_image_urls = ARRAY[receipt_image_url] 
WHERE receipt_image_url IS NOT NULL AND receipt_image_url <> '' AND (receipt_image_urls IS NULL OR cardinality(receipt_image_urls) = 0);

UPDATE public.transactions 
SET activity_image_urls = ARRAY[activity_image_url] 
WHERE activity_image_url IS NOT NULL AND activity_image_url <> '' AND (activity_image_urls IS NULL OR cardinality(activity_image_urls) = 0);

-- 2. 가족관계증명서 등록 테이블 생성
CREATE TABLE IF NOT EXISTS public.family_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS family_registrations_participant_idx ON public.family_registrations(participant_id);

-- RLS 활성화
ALTER TABLE public.family_registrations ENABLE ROW LEVEL SECURITY;

-- 정책 생성
DROP POLICY IF EXISTS family_registrations_select ON public.family_registrations;
DROP POLICY IF EXISTS family_registrations_insert ON public.family_registrations;
DROP POLICY IF EXISTS family_registrations_update ON public.family_registrations;
DROP POLICY IF EXISTS family_registrations_delete ON public.family_registrations;

CREATE POLICY family_registrations_select ON public.family_registrations FOR SELECT TO authenticated USING (true);
CREATE POLICY family_registrations_insert ON public.family_registrations FOR INSERT TO authenticated WITH CHECK (participant_id = auth.uid());
CREATE POLICY family_registrations_update ON public.family_registrations FOR UPDATE TO authenticated USING (participant_id = auth.uid()) WITH CHECK (participant_id = auth.uid());
CREATE POLICY family_registrations_delete ON public.family_registrations FOR DELETE TO authenticated USING (participant_id = auth.uid());

-- 3. 가족관계증명서 스토리지 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('family-relation-photos', 'family-relation-photos', false, 20971520, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']) 
ON CONFLICT (id) DO NOTHING;

-- 스토리지 정책 생성
DROP POLICY IF EXISTS family_photos_insert ON storage.objects;
DROP POLICY IF EXISTS family_photos_select ON storage.objects;
DROP POLICY IF EXISTS family_photos_update ON storage.objects;
DROP POLICY IF EXISTS family_photos_delete ON storage.objects;

CREATE POLICY family_photos_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'family-relation-photos');
CREATE POLICY family_photos_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'family-relation-photos');
CREATE POLICY family_photos_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'family-relation-photos') WITH CHECK (bucket_id = 'family-relation-photos');
CREATE POLICY family_photos_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'family-relation-photos');
