-- 이미지 회전 정보 컬럼 추가 마이그레이션
ALTER TABLE public.transactions ADD COLUMN image_rotations JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.card_registrations ADD COLUMN image_rotations JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.family_registrations ADD COLUMN image_rotation INTEGER DEFAULT 0;
