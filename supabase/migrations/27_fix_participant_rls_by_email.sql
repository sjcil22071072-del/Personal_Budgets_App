-- Allow participant-owned records to be matched either by auth uid or login email.

DROP POLICY IF EXISTS "transactions_select_participant" ON public.transactions;
CREATE POLICY "transactions_select_participant"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = transactions.participant_id
        AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "transactions_insert_participant" ON public.transactions;
CREATE POLICY "transactions_insert_participant"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = transactions.participant_id
        AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "file_links_select" ON public.file_links;
CREATE POLICY "file_links_select"
  ON public.file_links FOR SELECT
  TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = file_links.participant_id
        AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "participant_select_own" ON public.participants;
CREATE POLICY "participant_select_own"
  ON public.participants FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR lower(email) = lower(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "funding_sources_select_own" ON public.funding_sources;
CREATE POLICY "funding_sources_select_own"
  ON public.funding_sources FOR SELECT
  TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = funding_sources.participant_id
        AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
  );
