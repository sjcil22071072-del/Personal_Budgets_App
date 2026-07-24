-- ============================================================================
-- 중랑구청 개인예산 관리 앱 (Personal Budgets App) - 통합 데이터베이스 스키마
-- ============================================================================
-- 본 스키마는 포크(Fork) 및 신규 Supabase 프로젝트 구축을 위한 단일 통합 DDL입니다.
-- Supabase SQL Editor에서 이 파일의 전체 내용을 실행하면 모든 테이블, 인덱스, 
-- RLS 보안 정책, 트리거, 스토리지 버킷 및 권한 설정이 완벽하게 초기화됩니다.
-- ============================================================================

-- 1. 확장 기능 활성화 (Extensions)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 2. 테이블 생성 (Tables)
-- ----------------------------------------------------------------------------

-- [프로필 테이블]
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('admin', 'participant', 'superadmin', 'super_admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- [개인예산 대상 당사자 테이블]
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  birth_date DATE,
  address TEXT,
  budget_start_date DATE,
  budget_end_date DATE,
  ui_preferences JSONB NOT NULL DEFAULT '{"font_size":"medium","theme":"light","voice_guidance":false,"high_contrast":false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- [지원금/재원 테이블]
CREATE TABLE IF NOT EXISTS public.funding_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  monthly_budget NUMERIC NOT NULL DEFAULT 0,
  balance NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  start_date DATE,
  end_date DATE,
  last_rollover_month TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- [지출/수입 거래 내역 테이블]
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  funding_source_id UUID REFERENCES public.funding_sources(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  activity_name TEXT,
  category TEXT,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  receipt_image_url TEXT,
  receipt_image_urls TEXT[] NOT NULL DEFAULT '{}',
  activity_image_url TEXT,
  activity_image_urls TEXT[] NOT NULL DEFAULT '{}',
  evidence_image_urls TEXT[] NOT NULL DEFAULT '{}',
  payment_method TEXT DEFAULT '카드',
  place_name TEXT,
  place_lat NUMERIC,
  place_lng NUMERIC,
  receipt_reviewed BOOLEAN DEFAULT false,
  show_memo_to_participant BOOLEAN DEFAULT true,
  image_rotations JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- [첨부 서류 파일 링크 테이블]
CREATE TABLE IF NOT EXISTS public.file_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- [사용자 사전 초대 및 역할 배정 테이블]
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('admin', 'participant')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- [카드 실물 사진 등록 테이블]
CREATE TABLE IF NOT EXISTS public.card_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  card_front_url TEXT NOT NULL,
  card_back_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- [가족관계증명서 등 증빙서류 등록 테이블]
CREATE TABLE IF NOT EXISTS public.family_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  document_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. 인덱스 생성 (Indexes for Performance)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(lower(email));
CREATE INDEX IF NOT EXISTS idx_participants_email ON public.participants(lower(email));
CREATE INDEX IF NOT EXISTS idx_funding_sources_participant_id ON public.funding_sources(participant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_participant_id ON public.transactions(participant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_funding_source_id ON public.transactions(funding_source_id);
CREATE INDEX IF NOT EXISTS idx_file_links_participant_id ON public.file_links(participant_id);
CREATE INDEX IF NOT EXISTS idx_card_registrations_participant_id ON public.card_registrations(participant_id);
CREATE UNIQUE INDEX IF NOT EXISTS family_registrations_participant_idx ON public.family_registrations(participant_id);

-- ----------------------------------------------------------------------------
-- 4. 자동화 데이터베이스 함수 & 트리거 (Functions & Triggers)
-- ----------------------------------------------------------------------------

-- [신규 회원 가입 시 프로필 자동 생성 함수]
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_role TEXT;
  v_participant_id UUID;
  v_participant_name TEXT;
  v_role TEXT;
  v_name TEXT;
BEGIN
  -- 초대 목록 확인
  SELECT role INTO v_admin_role
  FROM public.user_invitations
  WHERE lower(email) = lower(NEW.email)
  ORDER BY created_at DESC
  LIMIT 1;

  -- 당사자 등록 목록 확인
  SELECT id, name INTO v_participant_id, v_participant_name
  FROM public.participants
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  -- 사전 등록 대상자가 아니면 무시
  IF v_admin_role IS NULL AND v_participant_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_admin_role IS NOT NULL THEN
    v_role := CASE WHEN v_admin_role = 'admin' THEN 'admin' ELSE 'participant' END;
    v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email);
  ELSE
    v_role := 'participant';
    v_name := COALESCE(v_participant_name, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email);
  END IF;

  INSERT INTO public.profiles (id, name, email, role)
  VALUES (NEW.id, v_name, NEW.email, v_role)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users 회원가입 트리거 연결
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- [최초 가입자 Admin 부여 헬퍼 함수]
CREATE OR REPLACE FUNCTION public.assign_first_admin(user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role IN ('admin', 'superadmin', 'super_admin')) THEN
    UPDATE public.profiles
    SET role = 'admin'
    WHERE id = user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.assign_first_admin(UUID) TO authenticated;

-- [프로필 역할 변경 방지 트리거 함수]
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS NOT NULL AND OLD.role <> NEW.role THEN
    IF current_setting('role', true) <> 'service_role' THEN
      RAISE EXCEPTION '프로필 역할(Role)은 직접 변경할 수 없습니다.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_prevent_profile_role_change ON public.profiles;
CREATE TRIGGER tr_prevent_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_change();

-- ----------------------------------------------------------------------------
-- 5. Row Level Security (RLS) 보안 정책
-- ----------------------------------------------------------------------------

-- 1) RLS 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_registrations ENABLE ROW LEVEL SECURITY;

-- 2) PROFILES 테이블 정책
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

-- 3) PARTICIPANTS 테이블 정책
CREATE POLICY "participants_admin_all" ON public.participants
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

CREATE POLICY "participants_select_own" ON public.participants
  FOR SELECT TO authenticated
  USING (
    lower(email) = lower(auth.jwt()->>'email')
  );

-- 4) FUNDING_SOURCES 테이블 정책
CREATE POLICY "funding_sources_admin_all" ON public.funding_sources
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

CREATE POLICY "funding_sources_select_own" ON public.funding_sources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participants pt
      WHERE pt.id = funding_sources.participant_id AND lower(pt.email) = lower(auth.jwt()->>'email')
    )
  );

-- 5) TRANSACTIONS 테이블 정책
CREATE POLICY "transactions_admin_all" ON public.transactions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

CREATE POLICY "transactions_participant_select" ON public.transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participants pt
      WHERE pt.id = transactions.participant_id AND lower(pt.email) = lower(auth.jwt()->>'email')
    )
  );

CREATE POLICY "transactions_participant_insert" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.participants pt
      WHERE pt.id = transactions.participant_id AND lower(pt.email) = lower(auth.jwt()->>'email')
    )
  );

CREATE POLICY "transactions_participant_update" ON public.transactions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participants pt
      WHERE pt.id = transactions.participant_id AND lower(pt.email) = lower(auth.jwt()->>'email')
    )
  );

CREATE POLICY "transactions_participant_delete" ON public.transactions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participants pt
      WHERE pt.id = transactions.participant_id AND lower(pt.email) = lower(auth.jwt()->>'email')
    )
    AND status = 'pending'
  );

-- 6) FILE_LINKS 테이블 정책
CREATE POLICY "file_links_admin_all" ON public.file_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

CREATE POLICY "file_links_participant_select" ON public.file_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participants pt
      WHERE pt.id = file_links.participant_id AND lower(pt.email) = lower(auth.jwt()->>'email')
    )
  );

-- 7) USER_INVITATIONS 테이블 정책
CREATE POLICY "user_invitations_admin_all" ON public.user_invitations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

-- 8) CARD_REGISTRATIONS 테이블 정책
CREATE POLICY "card_registrations_admin_all" ON public.card_registrations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

CREATE POLICY "card_registrations_participant_select" ON public.card_registrations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participants pt
      WHERE pt.id = card_registrations.participant_id AND lower(pt.email) = lower(auth.jwt()->>'email')
    )
  );

CREATE POLICY "card_registrations_participant_insert" ON public.card_registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.participants pt
      WHERE pt.id = card_registrations.participant_id AND lower(pt.email) = lower(auth.jwt()->>'email')
    )
  );

-- 9) FAMILY_REGISTRATIONS 테이블 정책
CREATE POLICY "family_registrations_admin_all" ON public.family_registrations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

CREATE POLICY "family_registrations_participant_select" ON public.family_registrations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participants pt
      WHERE pt.id = family_registrations.participant_id AND lower(pt.email) = lower(auth.jwt()->>'email')
    )
  );

CREATE POLICY "family_registrations_participant_insert" ON public.family_registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.participants pt
      WHERE pt.id = family_registrations.participant_id AND lower(pt.email) = lower(auth.jwt()->>'email')
    )
  );

-- ----------------------------------------------------------------------------
-- 6. 스토리지 버킷 및 스토리지 RLS (Storage Buckets Setup)
-- ----------------------------------------------------------------------------

-- 버킷 생성 (없을 경우 생성)
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('receipts', 'receipts', false),
  ('activity-photos', 'activity-photos', false),
  ('card-photos', 'card-photos', false),
  ('family-documents', 'family-documents', false),
  ('evidence-documents', 'evidence-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 스토리지 개별 보안 정책 (Objects Security)
CREATE POLICY "storage_authenticated_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('receipts', 'activity-photos', 'card-photos', 'family-documents', 'evidence-documents'));

CREATE POLICY "storage_authenticated_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('receipts', 'activity-photos', 'card-photos', 'family-documents', 'evidence-documents'));

CREATE POLICY "storage_authenticated_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('receipts', 'activity-photos', 'card-photos', 'family-documents', 'evidence-documents'));

CREATE POLICY "storage_authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('receipts', 'activity-photos', 'card-photos', 'family-documents', 'evidence-documents'));
