-- 47_add_funding_source_dates.sql
-- funding_sources 테이블에 start_date 및 end_date 컬럼 추가

ALTER TABLE public.funding_sources
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;
