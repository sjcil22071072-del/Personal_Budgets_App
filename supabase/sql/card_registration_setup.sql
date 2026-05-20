-- Run this in Supabase SQL Editor to enable card front/back photo registration.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('card-photos', 'card-photos', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'card_photos_insert'
  ) THEN
    CREATE POLICY "card_photos_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'card-photos');
  END IF;
END $$;

DROP POLICY IF EXISTS "card_photos_select" ON storage.objects;

CREATE TABLE IF NOT EXISTS public.card_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  image_urls text[] NOT NULL CHECK (array_length(image_urls, 1) >= 2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS card_registrations_participant_created_idx
  ON public.card_registrations (participant_id, created_at DESC);

ALTER TABLE public.card_registrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'card_registrations' AND policyname = 'card_registrations_participant_select'
  ) THEN
    CREATE POLICY "card_registrations_participant_select" ON public.card_registrations
      FOR SELECT TO authenticated
      USING (participant_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'card_registrations' AND policyname = 'card_registrations_participant_insert'
  ) THEN
    CREATE POLICY "card_registrations_participant_insert" ON public.card_registrations
      FOR INSERT TO authenticated
      WITH CHECK (participant_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'card_registrations' AND policyname = 'card_registrations_staff_select'
  ) THEN
    CREATE POLICY "card_registrations_staff_select" ON public.card_registrations
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          JOIN public.participants participant ON participant.id = card_registrations.participant_id
          WHERE p.id = auth.uid()
            AND p.role = 'supporter'
            AND participant.assigned_supporter_id = auth.uid()
        )
      );
  END IF;
END $$;
