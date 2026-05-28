-- 45_sync_participant_profiles.sql
-- 당사자 등록/삭제 시 profiles 테이블에 프로필 정보 자동 생성 및 삭제 동기화 트리거 추가

-- 1. participants INSERT 트리거: 등록 시 auth.users에 이미 계정이 존재하면 profiles에 즉시 연동
CREATE OR REPLACE FUNCTION public.handle_participant_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
BEGIN
  -- auth.users에서 이메일이 일치하는 사용자를 찾습니다.
  SELECT id, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
  INTO v_user_id, v_user_name
  FROM auth.users
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  -- 일치하는 사용자가 존재한다면 profiles에 추가하거나 역할을 업데이트합니다.
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, name, email, role)
    VALUES (
      v_user_id,
      COALESCE(NEW.name, v_user_name),
      NEW.email,
      'participant'
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'participant',
        name = COALESCE(NEW.name, public.profiles.name),
        email = NEW.email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_participant_insert_profile_sync ON public.participants;
CREATE TRIGGER trg_participant_insert_profile_sync
AFTER INSERT ON public.participants
FOR EACH ROW
EXECUTE FUNCTION public.handle_participant_insert();


-- 2. participants DELETE 트리거: 당사자 삭제 시 profiles 테이블에서도 해당 프로필 삭제
CREATE OR REPLACE FUNCTION public.handle_participant_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- profiles에서 이메일이 일치하는 프로필을 삭제합니다.
  DELETE FROM public.profiles
  WHERE lower(email) = lower(OLD.email);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_participant_delete_profile_sync ON public.participants;
CREATE TRIGGER trg_participant_delete_profile_sync
AFTER DELETE ON public.participants
FOR EACH ROW
EXECUTE FUNCTION public.handle_participant_delete();


-- 3. 일회성 동기화: 현재 auth.users와 participants에는 존재하지만 profiles에는 누락된 당사자 프로필 일괄 복구
INSERT INTO public.profiles (id, name, email, role)
SELECT
  u.id,
  COALESCE(pt.name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
  u.email,
  'participant'
FROM auth.users u
JOIN public.participants pt ON lower(pt.email) = lower(u.email)
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO UPDATE
SET role = 'participant';
