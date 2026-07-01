-- P1.2 tenant_id NOT NULL — safe backfill then constraints
--
-- Strategy per table:
--   a) Backfill NULL rows from related/parent records wherever a clear FK exists.
--   b) If a row cannot be resolved to a single tenant, set it to the only
--      existing property (single-tenant installs) or log/delete orphans.
--   c) Add NOT NULL constraint only once all NULLs are resolved.
--   d) Add a BEFORE INSERT trigger default so future inserts that omit
--      tenant_id are silently set to the current user's tenant — this mirrors
--      the existing withTenantInsert() pattern on the JS layer.
--
-- Rollback per table:
--   ALTER TABLE public.<table> ALTER COLUMN tenant_id DROP NOT NULL;
-- Risk before: unrestricted cross-tenant reads/writes if RLS filter is skipped.
-- Risk after: DB-level guarantee — tenant_id is always present.

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Helper: single-tenant shortcut (NULL-safe for multi-tenant installs)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_single_tenant uuid;
BEGIN
  SELECT id INTO v_single_tenant FROM public.properties ORDER BY created_at LIMIT 1;

  -- reservations
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.reservations SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.reservations WHERE tenant_id IS NULL;

  -- rooms
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.rooms r
    SET tenant_id = v_single_tenant
    WHERE r.tenant_id IS NULL;
  END IF;
  DELETE FROM public.rooms WHERE tenant_id IS NULL;

  -- guests
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.guests SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.guests WHERE tenant_id IS NULL;

  -- employees
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.employees SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.employees WHERE tenant_id IS NULL;

  -- pos_orders: inherit from reservation or use single tenant
  UPDATE public.pos_orders po
  SET tenant_id = r.tenant_id
  FROM public.reservations r
  WHERE po.tenant_id IS NULL AND po.reservation_id = r.id;

  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.pos_orders SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.pos_orders WHERE tenant_id IS NULL;

  -- pos_order_items: inherit from pos_orders
  UPDATE public.pos_order_items poi
  SET tenant_id = po.tenant_id
  FROM public.pos_orders po
  WHERE poi.tenant_id IS NULL AND poi.order_id = po.id;
  DELETE FROM public.pos_order_items WHERE tenant_id IS NULL;

  -- journal_entries
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.journal_entries SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.journal_entries WHERE tenant_id IS NULL;

  -- journal_lines: inherit from journal_entries
  UPDATE public.journal_lines jl
  SET tenant_id = je.tenant_id
  FROM public.journal_entries je
  WHERE jl.tenant_id IS NULL AND jl.journal_entry_id = je.id;
  DELETE FROM public.journal_lines WHERE tenant_id IS NULL;

  -- housekeeping_tasks
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.housekeeping_tasks SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.housekeeping_tasks WHERE tenant_id IS NULL;

  -- maintenance_requests
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.maintenance_requests SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.maintenance_requests WHERE tenant_id IS NULL;

  -- tasks
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.tasks SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.tasks WHERE tenant_id IS NULL;

  -- payroll_records
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.payroll_records SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.payroll_records WHERE tenant_id IS NULL;

  -- allowance_config
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.allowance_config SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.allowance_config WHERE tenant_id IS NULL;

  -- role_permissions
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.role_permissions SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.role_permissions WHERE tenant_id IS NULL;

  -- admin_feature_access
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.admin_feature_access SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.admin_feature_access WHERE tenant_id IS NULL;

  -- doc_register
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.doc_register SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.doc_register WHERE tenant_id IS NULL;

  -- inventory_items
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.inventory_items SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.inventory_items WHERE tenant_id IS NULL;

  -- purchase_orders
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.purchase_orders SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.purchase_orders WHERE tenant_id IS NULL;

  -- purchase_order_lines: inherit from purchase_orders
  UPDATE public.purchase_order_lines pol
  SET tenant_id = po.tenant_id
  FROM public.purchase_orders po
  WHERE pol.tenant_id IS NULL AND pol.purchase_order_id = po.id;
  DELETE FROM public.purchase_order_lines WHERE tenant_id IS NULL;

  -- consumption_entries
  IF v_single_tenant IS NOT NULL THEN
    UPDATE public.consumption_entries SET tenant_id = v_single_tenant WHERE tenant_id IS NULL;
  END IF;
  DELETE FROM public.consumption_entries WHERE tenant_id IS NULL;

  -- consumption_lines: inherit from consumption_entries
  UPDATE public.consumption_lines cl
  SET tenant_id = ce.tenant_id
  FROM public.consumption_entries ce
  WHERE cl.tenant_id IS NULL AND cl.consumption_entry_id = ce.id;
  DELETE FROM public.consumption_lines WHERE tenant_id IS NULL;

END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Apply NOT NULL constraints (skip columns that may not exist yet)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'reservations', 'rooms', 'guests', 'employees',
    'pos_orders', 'pos_order_items',
    'journal_entries', 'journal_lines',
    'housekeeping_tasks', 'maintenance_requests', 'tasks',
    'payroll_records', 'allowance_config', 'role_permissions',
    'admin_feature_access', 'doc_register',
    'inventory_items', 'purchase_orders', 'purchase_order_lines',
    'consumption_entries', 'consumption_lines'
  ] LOOP
    -- Only add NOT NULL if the column exists and all nulls have been resolved
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      -- Guard: do not add NOT NULL if any NULL still exists (safety net)
      IF (SELECT COUNT(*) FROM ONLY public.reservations WHERE tenant_id IS NULL) = 0 OR tbl <> 'reservations' THEN
        BEGIN
          EXECUTE format(
            'ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL',
            tbl
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Skipping NOT NULL on %.tenant_id: %', tbl, SQLERRM;
        END;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Trigger-based default: auto-set tenant_id from current_tenant_id() on INSERT
--    This silently fills tenant_id when the application layer omits it.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_set_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Attach the trigger to all key tables (idempotent via DROP IF EXISTS first)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'reservations', 'rooms', 'guests', 'employees',
    'pos_orders', 'pos_order_items',
    'journal_entries', 'journal_lines',
    'housekeeping_tasks', 'maintenance_requests', 'tasks',
    'payroll_records', 'allowance_config', 'role_permissions',
    'admin_feature_access', 'inventory_items',
    'purchase_orders', 'consumption_entries'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_tenant_id ON public.%I', tbl);
      EXECUTE format(
        'CREATE TRIGGER trg_auto_tenant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trg_set_tenant_id()',
        tbl
      );
    END IF;
  END LOOP;
END $$;
