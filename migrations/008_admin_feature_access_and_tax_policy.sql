-- Migration: Admin Feature Access table + Tax Policy column
-- Date: 2026-06-23
-- Description:
--   1. Creates admin_feature_access table: lets Superusers restrict which
--      modules individual Admin users can view. If a row exists with
--      can_access = false the module is hidden from that admin at runtime
--      (App.jsx applies these restrictions after loading role_privileges).
--   2. Adds tax_policy_text column to company_settings so the Tax Policy
--      settings card can store a rich-text policy statement.

-- ============================================================
-- 1. admin_feature_access
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_feature_access (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  module     TEXT        NOT NULL,
  can_access BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, module)
);

COMMENT ON TABLE  public.admin_feature_access IS 'Per-admin module access overrides. A row with can_access=false hides that module for the named admin user.';
COMMENT ON COLUMN public.admin_feature_access.user_id    IS 'References app_users.id — must be a user with role=ADMIN.';
COMMENT ON COLUMN public.admin_feature_access.module     IS 'Module identifier matching role_privileges.module (e.g. accounting, hr, reports).';
COMMENT ON COLUMN public.admin_feature_access.can_access IS 'false = module is hidden/locked for this admin; rows are deleted when access is restored.';

CREATE INDEX IF NOT EXISTS idx_admin_feature_access_user_id ON public.admin_feature_access (user_id);

-- ============================================================
-- 2. tax_policy_text column in company_settings
-- ============================================================

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS tax_policy_text TEXT;

COMMENT ON COLUMN public.company_settings.tax_policy_text IS 'Rich-text (HTML) tax policy statement, editable in Settings → Tax Policy.';
