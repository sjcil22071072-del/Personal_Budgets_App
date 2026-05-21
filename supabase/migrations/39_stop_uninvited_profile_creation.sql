-- Stop uninvited OAuth sign-ins from creating default participant profiles.
-- The app callback now creates profiles only for invited users, allowed domains, or SUPER_ADMIN_EMAIL.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_invitation RECORD;
  v_role       TEXT;
BEGIN
  SELECT * INTO v_invitation
  FROM public.user_invitations
  WHERE lower(email) = lower(NEW.email)
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_role := CASE
    WHEN v_invitation.role = 'admin' THEN 'admin'
    ELSE 'participant'
  END;

  IF v_invitation.used_at IS NULL THEN
    UPDATE public.user_invitations SET used_at = now() WHERE id = v_invitation.id;
  END IF;

  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DELETE FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_invitations ui
  WHERE lower(ui.email) = lower(p.email)
);
