-- Ensure restaurant branding columns exist and reload PostgREST schema cache.
-- Migration 20260701000003 added these columns; this migration is idempotent and
-- fires NOTIFY so PostgREST refreshes immediately after being applied, eliminating
-- the "Could not find the 'is_restaurant_available' column in the schema cache" error.

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS is_restaurant_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restaurant_name text;

-- Tell PostgREST to reload its in-memory schema cache.
NOTIFY pgrst, 'reload schema';
