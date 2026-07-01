-- ─────────────────────────────────────────────────────────────────────────────
-- 016 · Fix Constraints & Add Store Locations
-- 1. Ensure admin_feature_access UNIQUE constraint exists (fixes ON CONFLICT error)
-- 2. Fix purchase_orders status CHECK constraint to match statuses used by the UI
-- 3. Create store_locations table for inventory location management
-- 4. Fix pos_orders status CHECK constraint to allow Accept/Ready/Served workflow
-- ─────────────────────────────────────────────────────────────────────────────

-- ============================================================
-- 1. admin_feature_access — ensure unique constraint exists
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'admin_feature_access_user_id_module_key'
       AND conrelid = 'public.admin_feature_access'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'uq_admin_feature_access_user_module'
       AND conrelid = 'public.admin_feature_access'::regclass
  ) THEN
    ALTER TABLE public.admin_feature_access
      ADD CONSTRAINT uq_admin_feature_access_user_module UNIQUE (user_id, module);
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- ============================================================
-- 2. purchase_orders status CHECK constraint
-- ============================================================
DO $$
BEGIN
  ALTER TABLE public.purchase_orders
    DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.purchase_orders
    ADD CONSTRAINT purchase_orders_status_check
      CHECK (status IN (
        'DRAFT',
        'PENDING_APPROVAL',
        'OPEN',
        'PARTIAL',
        'RECEIVED',
        'CANCELLED'
      ));
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. store_locations table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.store_locations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  code       TEXT,
  notes      TEXT,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  tenant_id  UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.store_locations IS 'Physical inventory storage locations (Kitchen, Bar, Housekeeping, etc.)';

CREATE INDEX IF NOT EXISTS idx_store_locations_tenant_id ON public.store_locations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_store_locations_sort_order ON public.store_locations (sort_order, name);

ALTER TABLE public.store_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON public.store_locations;
CREATE POLICY "tenant_isolation" ON public.store_locations
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

-- ============================================================
-- 4. pos_orders status CHECK constraint
--    Extend to allow Accept / Ready / Served workflow stages.
-- ============================================================
DO $$
BEGIN
  ALTER TABLE public.pos_orders
    DROP CONSTRAINT IF EXISTS pos_orders_status_check;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.pos_orders
    ADD CONSTRAINT pos_orders_status_check
      CHECK (status IN (
        'OPEN',
        'ACCEPTED',
        'READY',
        'SERVED',
        'SETTLED',
        'CHARGED_TO_ROOM',
        'DUE',
        'CANCELLED'
      ));
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
