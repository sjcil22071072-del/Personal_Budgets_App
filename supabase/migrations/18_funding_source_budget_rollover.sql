ALTER TABLE public.funding_sources
  ADD COLUMN IF NOT EXISTS last_rollover_month DATE;

UPDATE public.funding_sources fs
SET last_rollover_month = DATE_TRUNC(
  'month',
  COALESCE(p.budget_start_date, NOW())::date
)::date
FROM public.participants p
WHERE p.id = fs.participant_id
  AND fs.last_rollover_month IS NULL;
