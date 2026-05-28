-- Disable check constraint if exists
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check1;

-- Add new check constraint allowing 'rejected'
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check CHECK (status IN ('pending', 'confirmed', 'rejected'));
