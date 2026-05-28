-- Participant row-level security for the current admin/participant role model.

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_participants" ON public.participants;
DROP POLICY IF EXISTS "admin_participants_select" ON public.participants;
DROP POLICY IF EXISTS "admin_participants_insert" ON public.participants;
DROP POLICY IF EXISTS "admin_participants_update" ON public.participants;
DROP POLICY IF EXISTS "participant_select_own" ON public.participants;
DROP POLICY IF EXISTS "supporter_all_participants" ON public.participants;
DROP POLICY IF EXISTS "supporter_participants" ON public.participants;
DROP POLICY IF EXISTS "supporter_participants_select" ON public.participants;
DROP POLICY IF EXISTS "supporter_participants_insert" ON public.participants;
DROP POLICY IF EXISTS "supporter_participants_update" ON public.participants;
DROP POLICY IF EXISTS "admin insert" ON public.participants;
DROP POLICY IF EXISTS "admin update" ON public.participants;
DROP POLICY IF EXISTS "admin delete" ON public.participants;

CREATE POLICY "admin_all_participants"
  ON public.participants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

CREATE POLICY "participant_select_own"
  ON public.participants FOR SELECT
  TO authenticated
  USING (id = auth.uid());
