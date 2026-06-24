-- Multi-tenant RLS policies for aura-stay-erp
-- Requires current_tenant_id() and is_admin() helper functions defined in the database.
--
-- Pattern: each protected table gets:
--   1. RLS enabled
--   2. A SELECT policy scoped to the authenticated user's tenant
--   3. INSERT / UPDATE / DELETE policies restricted to admin roles
--
-- ─── Helper functions (run once per database) ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT tenant_id FROM public.app_users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT role IN ('ADMIN', 'SUPERUSER')
  FROM public.app_users
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.app_users WHERE id = auth.uid() LIMIT 1;
$$;

-- ─── reservations ─────────────────────────────────────────────────────────────

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reservations_tenant_select ON public.reservations;
CREATE POLICY reservations_tenant_select
  ON public.reservations FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS reservations_tenant_insert ON public.reservations;
CREATE POLICY reservations_tenant_insert
  ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS reservations_tenant_update ON public.reservations;
CREATE POLICY reservations_tenant_update
  ON public.reservations FOR UPDATE TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS reservations_tenant_delete ON public.reservations;
CREATE POLICY reservations_tenant_delete
  ON public.reservations FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_admin());

-- ─── rooms ────────────────────────────────────────────────────────────────────

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rooms_tenant_select ON public.rooms;
CREATE POLICY rooms_tenant_select
  ON public.rooms FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS rooms_tenant_insert ON public.rooms;
CREATE POLICY rooms_tenant_insert
  ON public.rooms FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_admin());

DROP POLICY IF EXISTS rooms_tenant_update ON public.rooms;
CREATE POLICY rooms_tenant_update
  ON public.rooms FOR UPDATE TO authenticated
  USING  (tenant_id = public.current_tenant_id() AND public.is_admin())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS rooms_tenant_delete ON public.rooms;
CREATE POLICY rooms_tenant_delete
  ON public.rooms FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_admin());

-- ─── guests ───────────────────────────────────────────────────────────────────

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guests_tenant_select ON public.guests;
CREATE POLICY guests_tenant_select
  ON public.guests FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS guests_tenant_insert ON public.guests;
CREATE POLICY guests_tenant_insert
  ON public.guests FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS guests_tenant_update ON public.guests;
CREATE POLICY guests_tenant_update
  ON public.guests FOR UPDATE TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- ─── employees ────────────────────────────────────────────────────────────────

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_tenant_select ON public.employees;
CREATE POLICY employees_tenant_select
  ON public.employees FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS employees_tenant_write ON public.employees;
CREATE POLICY employees_tenant_write
  ON public.employees FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id() AND public.is_admin())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- ─── company_settings ─────────────────────────────────────────────────────────

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_settings_tenant_select ON public.company_settings;
CREATE POLICY company_settings_tenant_select
  ON public.company_settings FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS company_settings_tenant_update ON public.company_settings;
CREATE POLICY company_settings_tenant_update
  ON public.company_settings FOR UPDATE TO authenticated
  USING  (tenant_id = public.current_tenant_id() AND public.is_admin())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- ─── FK indexes (improves join performance on tenant_id columns) ──────────────

CREATE INDEX IF NOT EXISTS idx_reservations_tenant_id   ON public.reservations  (tenant_id);
CREATE INDEX IF NOT EXISTS idx_rooms_tenant_id          ON public.rooms         (tenant_id);
CREATE INDEX IF NOT EXISTS idx_guests_tenant_id         ON public.guests        (tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id      ON public.employees     (tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_settings_tenant  ON public.company_settings (tenant_id);
