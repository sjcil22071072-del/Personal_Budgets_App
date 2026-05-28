-- Pre-register users and assign a role on first login.

CREATE TABLE public.user_invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('admin', 'participant')),
  invited_by UUID REFERENCES public.profiles(id),
  note       TEXT,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitations_admin_read_write" ON public.user_invitations;
CREATE POLICY "invitations_admin_read_write"
  ON public.user_invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role IN ('admin', 'superadmin', 'super_admin') OR is_super_admin = true)
    )
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_invitation RECORD;
  v_role       TEXT;
BEGIN
  SELECT * INTO v_invitation
  FROM public.user_invitations
  WHERE lower(email) = lower(NEW.email) AND used_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    v_role := v_invitation.role;
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

CREATE INDEX IF NOT EXISTS idx_user_invitations_email
  ON public.user_invitations(email);
