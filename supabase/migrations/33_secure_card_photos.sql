-- Make card photos private. Staff views use short-lived signed URLs.

UPDATE storage.buckets
SET public = false
WHERE id = 'card-photos';

DROP POLICY IF EXISTS "card_photos_select" ON storage.objects;

ALTER TABLE public.card_registrations ENABLE ROW LEVEL SECURITY;
