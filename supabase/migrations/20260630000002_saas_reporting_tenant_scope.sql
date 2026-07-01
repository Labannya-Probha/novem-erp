-- SaaS reporting tenant scope.
-- Report templates remain global/catalog-level; permissions and audit logs can be tenant-specific.

ALTER TABLE public.report_user_access
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

ALTER TABLE public.report_export_logs
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

ALTER TABLE public.report_print_logs
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

CREATE INDEX IF NOT EXISTS idx_report_user_access_tenant_role
  ON public.report_user_access (tenant_id, role);

CREATE INDEX IF NOT EXISTS idx_report_export_logs_tenant_date
  ON public.report_export_logs (tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_print_logs_tenant_date
  ON public.report_print_logs (tenant_id, printed_at DESC);

DROP POLICY IF EXISTS report_user_access_read_own_or_role_defaults ON public.report_user_access;
CREATE POLICY report_user_access_read_own_or_role_defaults
  ON public.report_user_access FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS report_export_logs_insert_own ON public.report_export_logs;
CREATE POLICY report_export_logs_insert_own
  ON public.report_export_logs FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (generated_by = auth.uid() OR generated_by IS NULL)
  );

DROP POLICY IF EXISTS report_print_logs_insert_own ON public.report_print_logs;
CREATE POLICY report_print_logs_insert_own
  ON public.report_print_logs FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (printed_by = auth.uid() OR printed_by IS NULL)
  );
