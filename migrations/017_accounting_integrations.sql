-- ─────────────────────────────────────────────────────────────────────────────
-- 017 · Accounting Integrations (QuickBooks / Xero / Tally)
-- 1. accounting_integrations  — provider connection credentials & status
-- 2. integration_sync_log     — append-only audit trail of every sync event
-- 3. integration_account_map  — maps local CoA → remote account per provider
-- 4. integration_reports      — cached financial report snapshots from providers
-- ─────────────────────────────────────────────────────────────────────────────

-- ============================================================
-- 1. accounting_integrations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.accounting_integrations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID,
  provider          TEXT        NOT NULL CHECK (provider IN ('quickbooks', 'xero', 'tally')),
  -- OAuth fields (QB & Xero) — stored as text; rotate via edge function
  access_token      TEXT,
  refresh_token     TEXT,
  token_expiry      TIMESTAMPTZ,
  -- Provider-specific identifiers
  realm_id          TEXT,       -- QuickBooks company/realm ID
  company_name      TEXT,       -- Display name pulled from provider
  -- Tally-specific fields
  tally_gateway_url TEXT,       -- e.g. http://localhost:9000
  -- Status
  is_connected      BOOLEAN     NOT NULL DEFAULT false,
  last_synced_at    TIMESTAMPTZ,
  sync_status       TEXT        CHECK (sync_status IN ('idle', 'syncing', 'error')),
  sync_error        TEXT,
  -- Metadata
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One active connection per provider per tenant
  UNIQUE (tenant_id, provider)
);

COMMENT ON TABLE public.accounting_integrations
  IS 'Stores one connection record per accounting provider (QuickBooks, Xero, Tally) per tenant. OAuth tokens are stored here; rotate them only via the server-side edge functions to avoid token exposure in browser requests.';

CREATE INDEX IF NOT EXISTS idx_accounting_integrations_tenant_id
  ON public.accounting_integrations (tenant_id);

ALTER TABLE public.accounting_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON public.accounting_integrations;
CREATE POLICY "tenant_isolation" ON public.accounting_integrations
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

-- ============================================================
-- 2. integration_sync_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.integration_sync_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID,
  provider     TEXT        NOT NULL CHECK (provider IN ('quickbooks', 'xero', 'tally')),
  direction    TEXT        NOT NULL CHECK (direction IN ('push', 'pull')),
  entity_type  TEXT        NOT NULL,  -- e.g. 'journal_entries', 'chart_of_accounts', 'invoices'
  record_count INTEGER     NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  error_msg    TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ
);

COMMENT ON TABLE public.integration_sync_log
  IS 'Append-only audit trail for every push/pull sync event. Never update rows — always insert new ones.';

CREATE INDEX IF NOT EXISTS idx_integration_sync_log_tenant_provider
  ON public.integration_sync_log (tenant_id, provider, started_at DESC);

ALTER TABLE public.integration_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON public.integration_sync_log;
CREATE POLICY "tenant_isolation" ON public.integration_sync_log
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

-- ============================================================
-- 3. integration_account_map
-- ============================================================
CREATE TABLE IF NOT EXISTS public.integration_account_map (
  id                     UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID,
  local_account_id       UUID  NOT NULL REFERENCES public.chart_of_accounts (id) ON DELETE CASCADE,
  provider               TEXT  NOT NULL CHECK (provider IN ('quickbooks', 'xero', 'tally')),
  remote_account_id      TEXT  NOT NULL,  -- Provider's account ID
  remote_account_name    TEXT,            -- Cached display name for UI
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (local_account_id, provider)
);

COMMENT ON TABLE public.integration_account_map
  IS 'Maps a local chart_of_accounts row to the equivalent account in a remote provider. Used to ensure idempotent journal sync — the same local entry is never pushed twice.';

CREATE INDEX IF NOT EXISTS idx_integration_account_map_tenant
  ON public.integration_account_map (tenant_id);

ALTER TABLE public.integration_account_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON public.integration_account_map;
CREATE POLICY "tenant_isolation" ON public.integration_account_map
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

-- ============================================================
-- 4. integration_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.integration_reports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID,
  provider      TEXT        NOT NULL CHECK (provider IN ('quickbooks', 'xero', 'tally', 'internal')),
  report_type   TEXT        NOT NULL CHECK (report_type IN ('profit_loss', 'balance_sheet', 'cash_flow', 'aged_receivables')),
  from_date     DATE        NOT NULL,
  to_date       DATE        NOT NULL,
  payload       JSONB       NOT NULL DEFAULT '{}',  -- Raw report data from provider
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.integration_reports
  IS 'Cached financial report snapshots pulled from external providers. The frontend checks if a snapshot is < 1 hour old before calling the edge function again.';

CREATE INDEX IF NOT EXISTS idx_integration_reports_tenant_provider
  ON public.integration_reports (tenant_id, provider, report_type, generated_at DESC);

ALTER TABLE public.integration_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON public.integration_reports;
CREATE POLICY "tenant_isolation" ON public.integration_reports
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

-- ============================================================
-- 5. journal_entries — track per-provider sync state
--    Adds nullable columns if they do not yet exist.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'journal_entries'
       AND column_name  = 'synced_to_quickbooks_at'
  ) THEN
    ALTER TABLE public.journal_entries
      ADD COLUMN synced_to_quickbooks_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'journal_entries'
       AND column_name  = 'synced_to_xero_at'
  ) THEN
    ALTER TABLE public.journal_entries
      ADD COLUMN synced_to_xero_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'journal_entries'
       AND column_name  = 'synced_to_tally_at'
  ) THEN
    ALTER TABLE public.journal_entries
      ADD COLUMN synced_to_tally_at TIMESTAMPTZ;
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
