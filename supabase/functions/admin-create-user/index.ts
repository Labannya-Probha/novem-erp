// Edge Function: admin-create-user
// Creates a new auth user using the service-role key so that the call
// succeeds even when "Enable Signups" is turned off in the Supabase
// Authentication dashboard (the recommended setting for internal ERP systems).
//
// Required environment variables (set in Supabase Dashboard → Edge Functions):
//   SUPABASE_URL          — your project URL (auto-injected by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY — service-role secret (auto-injected by Supabase)
//
// Caller must supply a valid authenticated JWT (****** in the
// Authorization header. The caller's role in app_users must be ADMIN or SUPERUSER.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Supabase auto-injects these for Edge Functions
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify the calling user is authenticated and authorised (ADMIN or SUPERUSER)
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check the caller's role via app_users
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const { data: callerRow, error: roleErr } = await adminClient
      .from('app_users')
      .select('role, tenant_id')
      .or(`id.eq.${caller.id},auth_id.eq.${caller.id}`)
      .single()

    if (roleErr || !callerRow) {
      return new Response(JSON.stringify({ error: 'Could not verify caller role' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!['ADMIN', 'SUPERUSER'].includes(callerRow.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: ADMIN or SUPERUSER role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const { email, password, user_metadata } = await req.json() as {
      email: string
      password: string
      user_metadata: { username: string; full_name: string; tenant_id: string }
    }

    if (!email || !password || !user_metadata?.username || !user_metadata?.tenant_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email, password, user_metadata.username, user_metadata.tenant_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Non-SUPERUSER admins may only create users in their own tenant
    if (callerRow.role !== 'SUPERUSER' && user_metadata.tenant_id !== callerRow.tenant_id) {
      return new Response(JSON.stringify({ error: 'Forbidden: cannot create users outside your tenant' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create the auth user with the service-role client — bypasses signup restriction
    const { data, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,   // skip the confirmation email for internal staff accounts
      user_metadata,
    })

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ user: data.user }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
