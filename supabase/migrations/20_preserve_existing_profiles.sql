-- Safety follow-up: keep existing profiles intact while preventing new unregistered profile creation.
-- Profiles are allowed only for users registered through admin registration or participant registration.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_role TEXT;
  v_participant_id UUID;
  v_participant_name TEXT;
  v_role TEXT;
  v_name TEXT;
BEGIN
  SELECT role INTO v_admin_role
  FROM public.user_invitations
  WHERE lower(email) = lower(NEW.email)
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id, name INTO v_participant_id, v_participant_name
  FROM public.participants
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

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
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

INSERT INTO public.profiles (id, name, email, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
  u.email,
  CASE WHEN ui.role = 'admin' THEN 'admin' ELSE 'participant' END
FROM auth.users u
JOIN public.user_invitations ui ON lower(ui.email) = lower(u.email)
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

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
ON CONFLICT (id) DO NOTHING;
