-- Repair profiles removed by the overly broad cleanup in migration 39.
-- Source of truth:
-- auth.users still contains the real signed-in accounts; rebuild missing public profiles from it.

INSERT INTO public.profiles (id, name, email, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ui.note, pt.name, u.email),
  u.email,
  CASE
    WHEN ui.role = 'admin' THEN 'admin'
    WHEN u.raw_user_meta_data->>'role' IN ('admin', 'superadmin', 'super_admin') THEN 'admin'
    ELSE 'participant'
  END
FROM auth.users u
LEFT JOIN public.user_invitations ui ON lower(ui.email) = lower(u.email)
LEFT JOIN public.participants pt ON lower(pt.email) = lower(u.email)
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
