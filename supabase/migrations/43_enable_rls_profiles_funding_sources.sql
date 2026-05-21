-- 43_enable_rls_profiles_funding_sources.sql
-- profiles 및 funding_sources 테이블에 RLS 활성화 및 보안 정책 추가
-- 기존에 RLS가 활성화되지 않아 anon key로 전체 데이터 노출 가능 상태였던 문제 해결

-- ============================================================
-- 1. profiles 테이블 RLS 활성화 및 정책 추가
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자: 본인 프로필 조회 가능
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 관리자: 전체 프로필 조회 가능 (당사자 목록, 관리 화면 등)
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 사용자 본인 프로필 수정 가능 (이름, 소개 등)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 2. funding_sources 테이블 RLS 활성화 및 정책 추가
-- ============================================================

ALTER TABLE public.funding_sources ENABLE ROW LEVEL SECURITY;

-- 당사자: 본인 재원 조회 가능
DROP POLICY IF EXISTS "funding_sources_select_own" ON public.funding_sources;
CREATE POLICY "funding_sources_select_own" ON public.funding_sources
  FOR SELECT TO authenticated
  USING (participant_id = auth.uid());

-- 관리자: 전체 재원 조회 가능
DROP POLICY IF EXISTS "funding_sources_select_admin" ON public.funding_sources;
CREATE POLICY "funding_sources_select_admin" ON public.funding_sources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 관리자: 재원 수정 가능
DROP POLICY IF EXISTS "funding_sources_update_admin" ON public.funding_sources;
CREATE POLICY "funding_sources_update_admin" ON public.funding_sources
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 관리자: 재원 삭제 가능
DROP POLICY IF EXISTS "funding_sources_delete_admin" ON public.funding_sources;
CREATE POLICY "funding_sources_delete_admin" ON public.funding_sources
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
