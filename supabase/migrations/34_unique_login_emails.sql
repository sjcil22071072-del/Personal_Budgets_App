-- Prevent duplicate login IDs within each registration table.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_lower
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS participants_email_unique_lower
  ON public.participants (lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_invitations_active_email_unique_lower
  ON public.user_invitations (lower(email))
  WHERE email IS NOT NULL AND used_at IS NULL;
