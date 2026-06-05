-- card_registrations 테이블에 UPDATE RLS 정책 추가
-- 1. 본인의 카드 정보인 경우 업데이트 허용
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'card_registrations' AND policyname = 'card_registrations_participant_update'
  ) THEN
    CREATE POLICY "card_registrations_participant_update" ON public.card_registrations
      FOR UPDATE TO authenticated
      USING (participant_id = auth.uid())
      WITH CHECK (participant_id = auth.uid());
  END IF;
END $$;

-- 2. 관리자(role = 'admin')인 경우 모든 카드 정보 업데이트 허용
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'card_registrations' AND policyname = 'card_registrations_staff_update'
  ) THEN
    CREATE POLICY "card_registrations_staff_update" ON public.card_registrations
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
      );
  END IF;
END $$;
