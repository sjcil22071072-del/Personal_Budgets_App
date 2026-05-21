-- Lock role changes after the first assignment.
-- App-level exception: service-role admin registration can still promote an
-- already joined participant to admin.

CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role
     AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'profile role is locked after initial assignment';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profiles_lock_role_update ON public.profiles;

CREATE TRIGGER profiles_lock_role_update
BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_change();

CREATE OR REPLACE FUNCTION public.prevent_invitation_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'invitation role is locked after initial assignment';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS user_invitations_lock_role_update ON public.user_invitations;

CREATE TRIGGER user_invitations_lock_role_update
BEFORE UPDATE OF role ON public.user_invitations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_invitation_role_change();
