-- P1.4 Server-side module access enforcement via tenant_module_settings
--
-- Adds a helper RPC that returns whether a module is enabled for the calling
-- user's tenant, then adds an additional SELECT guard on key per-module tables
-- so that direct PostgREST requests cannot read disabled-module data.
--
-- Design:
--   • is_module_enabled_for_tenant(module_code) defaults to TRUE if no row
--     exists in tenant_module_settings (fail-open during bootstrap / no config).
--   • One extra policy per table on top of the existing tenant isolation policy.
--     Naming convention: <table>_module_guard.
--
-- Rollback:
--   DROP POLICY <table>_module_guard ON public.<table>;
--   DROP FUNCTION public.is_module_enabled_for_tenant(text);
-- Risk before: disabled modules could still be read via direct REST calls.
-- Risk after: DB-level gate; disabling a module in tenant_module_settings
--             immediately blocks PostgREST SELECT for that tenant.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Helper function
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_module_enabled_for_tenant(p_module_code text)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT enabled
      FROM public.tenant_module_settings
      WHERE tenant_id   = public.current_tenant_id()
        AND module_code = p_module_code
      LIMIT 1
    ),
    true   -- fail-open: no row = module not explicitly disabled
  );
$$;

COMMENT ON FUNCTION public.is_module_enabled_for_tenant(text) IS
  'Returns true if the calling user''s tenant has the given module enabled '
  '(or if no setting row exists — fail-open). Used in RLS policies.';

REVOKE EXECUTE ON FUNCTION public.is_module_enabled_for_tenant(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_module_enabled_for_tenant(text) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Module guard policies on key tables
-- ────────────────────────────────────────────────────────────────────────────

-- reservations → 'reservations' module
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reservations_module_guard ON public.reservations;
CREATE POLICY reservations_module_guard
  ON public.reservations FOR SELECT TO authenticated
  USING (public.is_module_enabled_for_tenant('reservations'));

-- pos_orders → 'pos' module
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pos_orders') THEN
    EXECUTE 'ALTER TABLE public.pos_orders ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS pos_orders_module_guard ON public.pos_orders';
    EXECUTE '
      CREATE POLICY pos_orders_module_guard
        ON public.pos_orders FOR SELECT TO authenticated
        USING (public.is_module_enabled_for_tenant(''pos''))
    ';
  END IF;
END $$;

-- journal_entries → 'accounting' module
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='journal_entries') THEN
    EXECUTE 'ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS journal_entries_module_guard ON public.journal_entries';
    EXECUTE '
      CREATE POLICY journal_entries_module_guard
        ON public.journal_entries FOR SELECT TO authenticated
        USING (public.is_module_enabled_for_tenant(''accounting''))
    ';
  END IF;
END $$;

-- inventory_items → 'inventory' module
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inventory_items') THEN
    EXECUTE 'ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS inventory_items_module_guard ON public.inventory_items';
    EXECUTE '
      CREATE POLICY inventory_items_module_guard
        ON public.inventory_items FOR SELECT TO authenticated
        USING (public.is_module_enabled_for_tenant(''inventory''))
    ';
  END IF;
END $$;

-- employees / payroll_records → 'hr' module
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='employees') THEN
    EXECUTE 'ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS employees_module_guard ON public.employees';
    EXECUTE '
      CREATE POLICY employees_module_guard
        ON public.employees FOR SELECT TO authenticated
        USING (public.is_module_enabled_for_tenant(''hr''))
    ';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payroll_records') THEN
    EXECUTE 'ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS payroll_records_module_guard ON public.payroll_records';
    EXECUTE '
      CREATE POLICY payroll_records_module_guard
        ON public.payroll_records FOR SELECT TO authenticated
        USING (public.is_module_enabled_for_tenant(''hr''))
    ';
  END IF;
END $$;

-- housekeeping_tasks → 'housekeeping' module
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='housekeeping_tasks') THEN
    EXECUTE 'ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS housekeeping_tasks_module_guard ON public.housekeeping_tasks';
    EXECUTE '
      CREATE POLICY housekeeping_tasks_module_guard
        ON public.housekeeping_tasks FOR SELECT TO authenticated
        USING (public.is_module_enabled_for_tenant(''housekeeping''))
    ';
  END IF;
END $$;
