-- Remove the supporter role from active account flows.
UPDATE public.profiles
SET role = 'admin'
WHERE role = 'supporter';

UPDATE public.user_invitations
SET role = 'admin'
WHERE role = 'supporter';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_admin_participant_only;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_admin_participant_only
  CHECK (role IN ('admin', 'participant', 'superadmin', 'super_admin'));

ALTER TABLE public.user_invitations
  DROP CONSTRAINT IF EXISTS user_invitations_role_admin_participant_only;

ALTER TABLE public.user_invitations
  ADD CONSTRAINT user_invitations_role_admin_participant_only
  CHECK (role IN ('admin', 'participant'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_invitation RECORD;
  v_role       TEXT;
BEGIN
  SELECT * INTO v_invitation
  FROM public.user_invitations
  WHERE email = NEW.email AND used_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    v_role := CASE
      WHEN v_invitation.role = 'admin' THEN 'admin'
      ELSE 'participant'
    END;
    UPDATE public.user_invitations SET used_at = now() WHERE id = v_invitation.id;
  ELSIF NEW.email LIKE '%@nowondaycare.org' THEN
    v_role := 'admin';
  ELSE
    v_role := 'participant';
  END IF;

  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
