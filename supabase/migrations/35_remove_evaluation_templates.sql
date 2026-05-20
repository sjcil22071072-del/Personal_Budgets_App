-- 평가 양식 기능 제거 마이그레이션
DROP TABLE IF EXISTS public.system_settings;
ALTER TABLE public.evaluations DROP COLUMN IF EXISTS evaluation_template;
ALTER TABLE public.evaluations DROP COLUMN IF EXISTS template_data;
