/**
 * sync-xero — Supabase Edge Function
 *
 * Handles Xero integration:
 *   - oauth-callback  : exchange authorization code for tokens
 *   - refresh-token   : refresh an expiring access token (Xero tokens expire in 30 min)
 *   - push-journals   : push unsynced journal entries to Xero Manual Journals API
 *   - push-invoices   : push unsynced invoices to Xero Invoices API
 *   - pull-coa        : pull Chart of Accounts from Xero Accounts API
 *   - pull-report     : pull P&L / Balance Sheet / Cash Flow from Xero Reports API
 *   - disconnect      : revoke tokens and mark integration as disconnected
 *
 * Required environment variables:
 *   XERO_CLIENT_ID      : Xero OAuth 2.0 Client ID
 *   XERO_CLIENT_SECRET  : Xero OAuth 2.0 Client Secret
 *   XERO_REDIRECT_URI   : OAuth redirect URI
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY : auto-injected by Supabase
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const XERO_TOKEN_URL  = 'https://identity.xero.com/connect/token'
const XERO_REVOKE_URL = 'https://identity.xero.com/connect/revocation'
const XERO_BASE_URL   = 'https://api.xero.com/api.xro/2.0'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  )

  let body = {}
  try { body = await req.json() } catch { /* no body */ }

  const { action, tenant_id, code, realm_id, from_date, to_date, report_type } = body

  try {
    switch (action) {
      // ── OAuth: exchange authorization code ──────────────────────────────
      case 'oauth-callback': {
        const clientId     = Deno.env.get('XERO_CLIENT_ID')
        const clientSecret = Deno.env.get('XERO_CLIENT_SECRET')
        const redirectUri  = Deno.env.get('XERO_REDIRECT_URI')
        if (!clientId || !clientSecret) throw new Error('XERO_CLIENT_ID / XERO_CLIENT_SECRET not configured')

        const credentials = btoa(`${clientId}:${clientSecret}`)
        const tokenRes = await fetch(XERO_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type':  'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type:   'authorization_code',
            code,
            redirect_uri: redirectUri,
          }).toString(),
        })
        if (!tokenRes.ok) throw new Error(`Xero token exchange failed: ${await tokenRes.text()}`)
        const tokens = await tokenRes.json()

        // Fetch the active tenant (organisation) from Xero connections
        let xeroTenantId  = realm_id || null
        let companyName   = null
        try {
          const connRes = await fetch('https://api.xero.com/connections', {
            headers: { Authorization: `****** Accept: 'application/json' },
          })
          if (connRes.ok) {
            const conns = await connRes.json()
            const conn  = Array.isArray(conns) ? conns[0] : null
            if (conn) {
              xeroTenantId = conn.tenantId
              companyName  = conn.tenantName
            }
          }
        } catch { /* non-fatal */ }

        const expiry = new Date(Date.now() + (tokens.expires_in || 1800) * 1000).toISOString()
        const { error } = await supabase.from('accounting_integrations').upsert({
          tenant_id,
          provider:       'xero',
          access_token:   tokens.access_token,
          refresh_token:  tokens.refresh_token,
          token_expiry:   expiry,
          realm_id:       xeroTenantId,
          company_name:   companyName,
          is_connected:   true,
          sync_status:    'idle',
          sync_error:     null,
          updated_at:     new Date().toISOString(),
        }, { onConflict: 'tenant_id,provider' })
        if (error) throw error

        return json({ ok: true, company_name: companyName })
      }

      // ── OAuth: refresh access token ──────────────────────────────────────
      case 'refresh-token': {
        const integ = await getInteg(supabase, tenant_id, 'xero')
        const clientId     = Deno.env.get('XERO_CLIENT_ID')
        const clientSecret = Deno.env.get('XERO_CLIENT_SECRET')
        const credentials  = btoa(`${clientId}:${clientSecret}`)

        const tokenRes = await fetch(XERO_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type':  'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type:    'refresh_token',
            refresh_token: integ.refresh_token,
          }).toString(),
        })
        if (!tokenRes.ok) throw new Error(`Xero token refresh failed: ${await tokenRes.text()}`)
        const tokens = await tokenRes.json()
        const expiry = new Date(Date.now() + (tokens.expires_in || 1800) * 1000).toISOString()
        await supabase.from('accounting_integrations').update({
          access_token:  tokens.access_token,
          refresh_token: tokens.refresh_token || integ.refresh_token,
          token_expiry:  expiry,
          updated_at:    new Date().toISOString(),
        }).eq('id', integ.id)

        return json({ ok: true })
      }

      // ── Push: journal entries ────────────────────────────────────────────
      case 'push-journals': {
        const integ = await getInteg(supabase, tenant_id, 'xero')
        await ensureXeroToken(supabase, integ, tenant_id)

        let q = supabase
          .from('journal_entries')
          .select('*, journal_lines(*, chart_of_accounts(code,name))')
          .is('synced_to_xero_at', null)
          .neq('status', 'DRAFT')
        if (from_date) q = q.gte('entry_date', from_date)
        if (to_date)   q = q.lte('entry_date', to_date)

        const { data: entries, error: entErr } = await q.limit(200)
        if (entErr) throw entErr

        const accountMap = await loadAccountMap(supabase, tenant_id, 'xero')
        let pushed = 0
        const errors = []

        for (const entry of entries || []) {
          const lines = (entry.journal_lines || []).map((l) => {
            const remoteId = accountMap[l.account_id]
            if (!remoteId) return null
            return {
              AccountCode:      remoteId,
              Description:      l.line_note || entry.narration,
              LineAmount:       l.debit > 0 ? Math.abs(l.debit) : -Math.abs(l.credit),
            }
          }).filter(Boolean)

          if (lines.length < 2) continue

          const payload = {
            Date:        entry.entry_date,
            Narration:   entry.narration || '',
            Status:      'POSTED',
            JournalLines: lines,
          }

          const res = await xeroPost(integ, 'ManualJournals', payload)
          if (res.ok) {
            await supabase.from('journal_entries').update({
              synced_to_xero_at: new Date().toISOString(),
            }).eq('id', entry.id)
            pushed++
          } else {
            errors.push({ id: entry.id, error: await res.text() })
          }
        }

        await logSync(supabase, tenant_id, 'xero', 'push', 'journal_entries', pushed,
          errors.length ? 'partial' : 'success',
          errors.length ? JSON.stringify(errors[0]) : null)

        return json({ ok: true, pushed, errors })
      }

      // ── Pull: Chart of Accounts ──────────────────────────────────────────
      case 'pull-coa': {
        const integ = await getInteg(supabase, tenant_id, 'xero')
        await ensureXeroToken(supabase, integ, tenant_id)

        const res = await fetch(`${XERO_BASE_URL}/Accounts`, {
          headers: {
            Authorization:  `******
            'Xero-Tenant-Id': integ.realm_id,
            Accept:           'application/json',
          },
        })
        if (!res.ok) throw new Error(`Xero CoA pull failed: ${await res.text()}`)
        const data     = await res.json()
        const accounts = data?.Accounts || []

        const upserts = accounts.map((a) => ({
          remote_account_id:   a.AccountID,
          remote_account_name: a.Name,
          provider:            'xero',
        }))

        await logSync(supabase, tenant_id, 'xero', 'pull', 'chart_of_accounts', accounts.length, 'success', null)
        return json({ ok: true, accounts: upserts })
      }

      // ── Pull: Financial Report ───────────────────────────────────────────
      case 'pull-report': {
        const integ = await getInteg(supabase, tenant_id, 'xero')
        await ensureXeroToken(supabase, integ, tenant_id)

        const reportMap = {
          profit_loss:      'ProfitAndLoss',
          balance_sheet:    'BalanceSheet',
          cash_flow:        'BankSummary',
          aged_receivables: 'AgedReceivablesByContact',
        }
        const xeroReport = reportMap[report_type]
        if (!xeroReport) throw new Error(`Unknown report_type: ${report_type}`)

        const params = new URLSearchParams()
        if (from_date) params.set('fromDate', from_date)
        if (to_date)   params.set('toDate', to_date)

        const res = await fetch(`${XERO_BASE_URL}/Reports/${xeroReport}?${params}`, {
          headers: {
            Authorization:    `******
            'Xero-Tenant-Id': integ.realm_id,
            Accept:           'application/json',
          },
        })
        if (!res.ok) throw new Error(`Xero report pull failed: ${await res.text()}`)
        const payload = await res.json()

        await supabase.from('integration_reports').insert({
          tenant_id,
          provider:     'xero',
          report_type,
          from_date:    from_date || new Date().toISOString().slice(0, 10),
          to_date:      to_date   || new Date().toISOString().slice(0, 10),
          payload,
          generated_at: new Date().toISOString(),
        })

        return json({ ok: true, payload })
      }

      // ── Disconnect ───────────────────────────────────────────────────────
      case 'disconnect': {
        const { data: integ } = await supabase
          .from('accounting_integrations')
          .select('*')
          .eq('tenant_id', tenant_id)
          .eq('provider', 'xero')
          .maybeSingle()

        if (integ?.refresh_token) {
          try {
            const clientId     = Deno.env.get('XERO_CLIENT_ID')
            const clientSecret = Deno.env.get('XERO_CLIENT_SECRET')
            const credentials  = btoa(`${clientId}:${clientSecret}`)
            await fetch(XERO_REVOKE_URL, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type':  'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({ token: integ.refresh_token }).toString(),
            })
          } catch { /* non-fatal */ }
        }

        await supabase.from('accounting_integrations').update({
          is_connected:  false,
          access_token:  null,
          refresh_token: null,
          token_expiry:  null,
          sync_status:   'idle',
          updated_at:    new Date().toISOString(),
        }).eq('tenant_id', tenant_id).eq('provider', 'xero')

        return json({ ok: true })
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (err) {
    console.error('[sync-xero]', err)
    return json({ error: err.message }, 500)
  }
})

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function getInteg(supabase, tenant_id, provider) {
  const { data, error } = await supabase
    .from('accounting_integrations')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('provider', provider)
    .single()
  if (error || !data) throw new Error(`${provider} integration not found`)
  return data
}

async function ensureXeroToken(supabase, integ, tenant_id) {
  if (!integ.token_expiry) return
  const expiresAt = new Date(integ.token_expiry).getTime()
  const bufferMs  = 5 * 60 * 1000
  if (Date.now() + bufferMs < expiresAt) return

  const clientId     = Deno.env.get('XERO_CLIENT_ID')
  const clientSecret = Deno.env.get('XERO_CLIENT_SECRET')
  const credentials  = btoa(`${clientId}:${clientSecret}`)
  const tokenRes = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: integ.refresh_token,
    }).toString(),
  })
  if (!tokenRes.ok) throw new Error(`Xero auto-refresh failed: ${await tokenRes.text()}`)
  const tokens = await tokenRes.json()
  const expiry = new Date(Date.now() + (tokens.expires_in || 1800) * 1000).toISOString()
  await supabase.from('accounting_integrations').update({
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token || integ.refresh_token,
    token_expiry:  expiry,
    updated_at:    new Date().toISOString(),
  }).eq('id', integ.id)
  integ.access_token = tokens.access_token
}

async function loadAccountMap(supabase, tenant_id, provider) {
  const { data } = await supabase
    .from('integration_account_map')
    .select('local_account_id, remote_account_id')
    .eq('tenant_id', tenant_id)
    .eq('provider', provider)
  const map = {}
  for (const row of data || []) map[row.local_account_id] = row.remote_account_id
  return map
}

async function xeroPost(integ, resource, payload) {
  return fetch(`${XERO_BASE_URL}/${resource}`, {
    method:  'POST',
    headers: {
      Authorization:    `******
      'Xero-Tenant-Id': integ.realm_id,
      'Content-Type':   'application/json',
      Accept:           'application/json',
    },
    body: JSON.stringify(payload),
  })
}

async function logSync(supabase, tenant_id, provider, direction, entity_type, record_count, status, error_msg) {
  await supabase.from('integration_sync_log').insert({
    tenant_id,
    provider,
    direction,
    entity_type,
    record_count,
    status,
    error_msg,
    finished_at: new Date().toISOString(),
  })
}
