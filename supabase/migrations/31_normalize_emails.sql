UPDATE participants SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL;
UPDATE profiles SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL;
UPDATE user_invitations SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL;
