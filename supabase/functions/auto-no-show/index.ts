// Edge Function: auto-no-show
// Runs the auto_mark_reservation_no_shows() database function for every active
// tenant so that confirmed reservations that passed the 12:05 local cutoff are
// automatically transitioned to NO_SHOW.
//
// Invocation: called by pg_cron or Supabase Scheduled Functions once per day,
// or ad-hoc via a Supabase CLI invocation for testing:
//   supabase functions invoke auto-no-show --no-verify-jwt
//
// Required environment variables (auto-injected by Supabase):
//   SUPABASE_URL              — project URL
//   SUPABASE_SERVICE_ROLE_KEY — service-role secret (bypasses RLS)
//
// Assumptions:
//   • All tenant reservations are stored in UTC; the cutoff SQL function
//     compares p_now::time >= time '12:05', so the caller should pass a
//     property-local noon timestamp.  Until per-tenant timezone is stored in
//     properties, we run at UTC 06:05 (noon Bangladesh Standard Time, UTC+6).
//     Adjust CRON_SCHEDULE_UTC in 20260701000007_noshow_pg_cron.sql as needed.
//   • The database function auto_mark_reservation_no_shows() is defined in
//     migrations/011_auto_no_show_cutoff.sql.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const runAt = new Date().toISOString()

  try {
    const { data, error } = await adminClient.rpc('auto_mark_reservation_no_shows', {
      p_now: runAt,
    })

    if (error) {
      console.error('[auto-no-show] RPC error', { error: error.message, runAt })
      return new Response(
        JSON.stringify({ ok: false, error: error.message, runAt }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const affected = Number(data ?? 0)
    console.log('[auto-no-show] sweep complete', { affected, runAt })

    return new Response(
      JSON.stringify({ ok: true, affected, runAt }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[auto-no-show] unexpected error', { message, runAt })
    return new Response(
      JSON.stringify({ ok: false, error: 'Internal server error', runAt }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
