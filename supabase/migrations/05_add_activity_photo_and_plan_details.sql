-- Add an activity photo URL to transactions.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS activity_image_url TEXT;
