-- 46_fix_participant_rls_by_email.sql
-- 당사자의 auth.users.id와 participants.id가 불일치하는 구조적 문제를 해결하기 위해,
-- RLS 정책에서 당사자 본인 여부 확인 시 'auth.uid() = participant_id' 뿐만 아니라
-- '로그인 이메일 = 당사자 이메일' 매칭 검사를 수행하도록 RLS 정책들을 전면 보완합니다.

-- ────────────────────────────────────────────────────────────
-- 1. transactions 테이블 RLS 정책 보강
-- ────────────────────────────────────────────────────────────

-- 1-1. SELECT 정책 수정
DROP POLICY IF EXISTS "transactions_select_participant" ON public.transactions;
CREATE POLICY "transactions_select_participant"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = transactions.participant_id
        AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

-- 1-2. INSERT 정책 수정
DROP POLICY IF EXISTS "transactions_insert_participant" ON public.transactions;
CREATE POLICY "transactions_insert_participant"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = transactions.participant_id
        AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );



-- ────────────────────────────────────────────────────────────
-- 3. evaluations 테이블 RLS 정책 보강
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "evaluations_select" ON public.evaluations;
CREATE POLICY "evaluations_select"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (
    (participant_id = auth.uid() AND published_at IS NOT NULL)
    OR (
      EXISTS (
        SELECT 1 FROM public.participants p
        WHERE p.id = evaluations.participant_id
          AND lower(p.email) = lower(auth.jwt() ->> 'email')
      )
      AND published_at IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );


-- ────────────────────────────────────────────────────────────
-- 4. file_links 테이블 RLS 정책 보강
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "file_links_select" ON public.file_links;
CREATE POLICY "file_links_select"
  ON public.file_links FOR SELECT
  TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = file_links.participant_id
        AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );


-- ────────────────────────────────────────────────────────────
-- 5. participants 테이블 RLS 정책 보강
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "participant_select_own" ON public.participants;
CREATE POLICY "participant_select_own" ON public.participants
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR lower(email) = lower(auth.jwt() ->> 'email')
  );


-- ────────────────────────────────────────────────────────────
-- 6. funding_sources 테이블 RLS 정책 보강
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "funding_sources_select_own" ON public.funding_sources;
CREATE POLICY "funding_sources_select_own" ON public.funding_sources
  FOR SELECT TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = funding_sources.participant_id
        AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
  );
