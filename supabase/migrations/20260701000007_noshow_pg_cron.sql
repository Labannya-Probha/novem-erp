-- P1.3b pg_cron schedule for the auto-no-show Edge Function
--
-- Assumption: tenants are in UTC+6 (Bangladesh Standard Time). Noon local
-- = 06:05 UTC. Adjust '5 6 * * *' if your deploy region differs.
--
-- Requires pg_cron to be enabled in your Supabase project
-- (Dashboard → Database → Extensions → pg_cron).
--
-- Rollback: SELECT cron.unschedule('aura-auto-no-show-daily');
-- Risk after: deterministic once-daily execution; no race conditions from
-- multiple browser tabs triggering the RPC simultaneously.

-- Remove any existing schedule with this name before re-creating (idempotent).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aura-auto-no-show-daily') THEN
    PERFORM cron.unschedule('aura-auto-no-show-daily');
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_cron not available — schedule this manually or enable the pg_cron extension.';
END $$;

-- Schedule the edge function invocation via pg_cron net.http_post.
-- Requires pg_net extension (enabled by default in Supabase).
DO $$
DECLARE
  v_project_ref text := current_setting('app.settings.supabase_project_ref', true);
  v_function_url text;
BEGIN
  -- Build the URL from the project ref env variable.
  -- Set via: ALTER DATABASE postgres SET app.settings.supabase_project_ref = '<ref>';
  IF v_project_ref IS NOT NULL AND v_project_ref <> '' THEN
    v_function_url := 'https://' || v_project_ref || '.supabase.co/functions/v1/auto-no-show';

    PERFORM cron.schedule(
      'aura-auto-no-show-daily',
      '5 6 * * *',   -- 06:05 UTC = 12:05 Bangladesh Standard Time (UTC+6)
      format(
        $$SELECT net.http_post(
          url     := %L,
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body    := '{}'::jsonb
        )$$,
        v_function_url
      )
    );

    RAISE NOTICE 'pg_cron job "aura-auto-no-show-daily" scheduled at 06:05 UTC daily → %', v_function_url;
  ELSE
    RAISE NOTICE
      'Skipping pg_cron schedule: app.settings.supabase_project_ref is not set. '
      'Run: ALTER DATABASE postgres SET app.settings.supabase_project_ref = ''<your-project-ref>'' '
      'then re-apply this migration.';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_cron not available — no schedule created.';
END $$;
