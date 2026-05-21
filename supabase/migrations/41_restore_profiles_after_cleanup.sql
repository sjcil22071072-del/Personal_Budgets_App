-- Repair profiles removed by the overly broad cleanup in migration 39.
-- Only rebuild accounts that are explicitly registered as admins/participants.

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
  AND (
    ui.id IS NOT NULL
    OR pt.id IS NOT NULL
    OR u.raw_user_meta_data->>'role' IN ('admin', 'superadmin', 'super_admin')
  )
  AND u.email IS NOT NULL
  AND u.email !~* '(dummy|demo|test|sample|example)'
  AND COALESCE(u.raw_user_meta_data->>'full_name', '') !~* '(dummy|demo|test|sample|example)'
  AND COALESCE(u.raw_user_meta_data->>'name', '') !~* '(dummy|demo|test|sample|example)'
ON CONFLICT (id) DO NOTHING;
