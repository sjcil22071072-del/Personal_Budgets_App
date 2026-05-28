-- Restore real manager accounts without turning seed/demo accounts into admins.
-- Participants are auth users whose email exists in participants.
-- Admins are existing auth users outside participants, excluding obvious seed/demo/test accounts.

DELETE FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_invitations ui
    WHERE lower(ui.email) = lower(p.email)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.participants pt
    WHERE lower(pt.email) = lower(p.email)
  )
  AND (
    p.email IS NULL
    OR p.email ~* '(dummy|demo|test|sample|example)'
    OR COALESCE(p.name, '') ~* '(dummy|demo|test|sample|example)'
  );

INSERT INTO public.profiles (id, name, email, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
  u.email,
  'admin'
FROM auth.users u
LEFT JOIN public.participants pt ON lower(pt.email) = lower(u.email)
LEFT JOIN public.profiles p ON p.id = u.id
WHERE pt.id IS NULL
  AND p.id IS NULL
  AND u.email IS NOT NULL
  AND u.email !~* '(dummy|demo|test|sample|example)'
  AND COALESCE(u.raw_user_meta_data->>'full_name', '') !~* '(dummy|demo|test|sample|example)'
  AND COALESCE(u.raw_user_meta_data->>'name', '') !~* '(dummy|demo|test|sample|example)'
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles p
SET role = 'admin'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.participants pt
    WHERE lower(pt.email) = lower(p.email)
  )
  AND p.email IS NOT NULL
  AND p.email !~* '(dummy|demo|test|sample|example)'
  AND COALESCE(p.name, '') !~* '(dummy|demo|test|sample|example)';
