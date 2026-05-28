-- RLS policies and indexes for tables used by the current app.

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select_participant" ON public.transactions;
CREATE POLICY "transactions_select_participant"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    participant_id = auth.uid()
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
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "transactions_update_supporter" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_admin" ON public.transactions;
CREATE POLICY "transactions_update_admin"
  ON public.transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "transactions_delete_admin" ON public.transactions;
CREATE POLICY "transactions_delete_admin"
  ON public.transactions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
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
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "file_links_insert_supporter" ON public.file_links;
DROP POLICY IF EXISTS "file_links_insert_admin" ON public.file_links;
CREATE POLICY "file_links_insert_admin"
  ON public.file_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "file_links_delete_admin" ON public.file_links;
CREATE POLICY "file_links_delete_admin"
  ON public.file_links FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'super_admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_transactions_participant_id
  ON public.transactions (participant_id);

CREATE INDEX IF NOT EXISTS idx_transactions_participant_date
  ON public.transactions (participant_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON public.transactions (status);

CREATE INDEX IF NOT EXISTS idx_funding_sources_participant_id
  ON public.funding_sources (participant_id);

CREATE INDEX IF NOT EXISTS idx_file_links_participant_id
  ON public.file_links (participant_id);
