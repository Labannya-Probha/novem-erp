-- P1.1 company_settings integrity
-- Detect duplicate rows per tenant, keep the latest valid row, archive/delete
-- duplicates, then add a UNIQUE constraint so future inserts cannot create dups.
--
-- Rollback: DROP CONSTRAINT company_settings_tenant_id_key;
--           Re-insert archived rows from company_settings_dup_archive if needed.
-- Risk before: multiple rows per tenant → ambiguous maintenance_mode reads.
-- Risk after: guaranteed single row per tenant; reads are deterministic.

-- 1. Archive table for duplicates (idempotent).
CREATE TABLE IF NOT EXISTS public.company_settings_dup_archive (
  archived_at timestamptz NOT NULL DEFAULT now(),
  LIKE public.company_settings
);

-- 2. Move all but the newest row (by updated_at, then id) per tenant into archive.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY tenant_id
           ORDER BY COALESCE(updated_at, created_at, '1970-01-01'::timestamptz) DESC, id DESC
         ) AS rn
  FROM public.company_settings
),
to_archive AS (
  SELECT cs.*
  FROM public.company_settings cs
  JOIN ranked r ON r.id = cs.id
  WHERE r.rn > 1
)
INSERT INTO public.company_settings_dup_archive
SELECT now(), ta.* FROM to_archive ta;

DELETE FROM public.company_settings cs
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY tenant_id
           ORDER BY COALESCE(updated_at, created_at, '1970-01-01'::timestamptz) DESC, id DESC
         ) AS rn
  FROM public.company_settings
) ranked
WHERE ranked.id = cs.id AND ranked.rn > 1;

-- 3. Handle rows where tenant_id IS NULL: if only one such row exists, try to
--    assign it to the first property; otherwise archive them.
UPDATE public.company_settings cs
SET tenant_id = (SELECT id FROM public.properties ORDER BY created_at LIMIT 1)
WHERE cs.tenant_id IS NULL
  AND (SELECT COUNT(*) FROM public.company_settings WHERE tenant_id IS NULL) = 1
  AND (SELECT COUNT(*) FROM public.properties) >= 1;

-- Archive any remaining NULL-tenant rows that cannot be safely assigned.
WITH null_rows AS (
  SELECT cs.*
  FROM public.company_settings cs
  WHERE cs.tenant_id IS NULL
)
INSERT INTO public.company_settings_dup_archive
SELECT now(), nr.* FROM null_rows nr;

DELETE FROM public.company_settings WHERE tenant_id IS NULL;

-- 4. Add UNIQUE constraint (idempotent via DO block).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'company_settings'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'company_settings_tenant_id_key'
  ) THEN
    ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_tenant_id_key UNIQUE (tenant_id);
  END IF;
END $$;

-- 5. Revoke DML on the archive table from application roles.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.company_settings_dup_archive FROM authenticated;
GRANT SELECT ON TABLE public.company_settings_dup_archive TO authenticated;
