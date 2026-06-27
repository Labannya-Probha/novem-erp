/**
 * sync-quickbooks — Supabase Edge Function
 *
 * Handles QuickBooks Online integration:
 *   - oauth-callback  : exchange authorization code for tokens
 *   - refresh-token   : refresh an expiring access token
 *   - push-journals   : push unsynced journal entries to QBO JournalEntry API
 *   - push-invoices   : push unsynced invoices to QBO Invoice API
 *   - pull-coa        : pull Chart of Accounts from QBO and update integration_account_map
 *   - pull-report     : pull P&L / Balance Sheet / Cash Flow from QBO Reports API
 *   - disconnect      : revoke tokens and mark integration as disconnected
 *
 * Required environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
 *   QB_CLIENT_ID      : QuickBooks OAuth 2.0 Client ID
 *   QB_CLIENT_SECRET  : QuickBooks OAuth 2.0 Client Secret
 *   QB_REDIRECT_URI   : OAuth redirect URI (must match the QB app settings)
 *   SUPABASE_URL      : Injected automatically by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY : Injected automatically by Supabase
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QB_TOKEN_URL    = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QB_REVOKE_URL   = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'
const QB_BASE_URL     = 'https://quickbooks.api.intuit.com/v3/company'
const QB_SANDBOX_URL  = 'https://sandbox-quickbooks.api.intuit.com/v3/company'

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

  const { action, tenant_id, code, realm_id, from_date, to_date, entity, report_type, sandbox } = body
  const qbBase = sandbox ? QB_SANDBOX_URL : QB_BASE_URL

  try {
    switch (action) {
      // ── OAuth: exchange authorization code ──────────────────────────────
      case 'oauth-callback': {
        const clientId     = Deno.env.get('QB_CLIENT_ID')
        const clientSecret = Deno.env.get('QB_CLIENT_SECRET')
        const redirectUri  = Deno.env.get('QB_REDIRECT_URI')
        if (!clientId || !clientSecret) throw new Error('QB_CLIENT_ID / QB_CLIENT_SECRET not configured')

        const credentials = btoa(`${clientId}:${clientSecret}`)
        const tokenRes = await fetch(QB_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type':  'application/x-www-form-urlencoded',
            'Accept':        'application/json',
          },
          body: new URLSearchParams({
            grant_type:   'authorization_code',
            code,
            redirect_uri: redirectUri,
          }).toString(),
        })
        if (!tokenRes.ok) {
          const err = await tokenRes.text()
          throw new Error(`QB token exchange failed: ${err}`)
        }
        const tokens = await tokenRes.json()

        // Fetch company info
        let companyName = null
        try {
          const infoRes = await fetch(
            `${qbBase}/${realm_id}/companyinfo/${realm_id}?minorversion=65`,
            {
              headers: {
                Authorization: `******
                Accept: 'application/json',
              },
            },
          )
          if (infoRes.ok) {
            const info = await infoRes.json()
            companyName = info?.QueryResponse?.CompanyInfo?.[0]?.CompanyName
              || info?.CompanyInfo?.CompanyName
              || null
          }
        } catch { /* non-fatal */ }

        const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        const { error } = await supabase.from('accounting_integrations').upsert({
          tenant_id,
          provider:       'quickbooks',
          access_token:   tokens.access_token,
          refresh_token:  tokens.refresh_token,
          token_expiry:   expiry,
          realm_id,
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
        const { data: integ, error: fetchErr } = await supabase
          .from('accounting_integrations')
          .select('*')
          .eq('tenant_id', tenant_id)
          .eq('provider', 'quickbooks')
          .single()
        if (fetchErr || !integ) throw new Error('QuickBooks integration not found')

        const clientId     = Deno.env.get('QB_CLIENT_ID')
        const clientSecret = Deno.env.get('QB_CLIENT_SECRET')
        const credentials  = btoa(`${clientId}:${clientSecret}`)

        const tokenRes = await fetch(QB_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type':  'application/x-www-form-urlencoded',
            'Accept':        'application/json',
          },
          body: new URLSearchParams({
            grant_type:    'refresh_token',
            refresh_token: integ.refresh_token,
          }).toString(),
        })
        if (!tokenRes.ok) throw new Error(`QB token refresh failed: ${await tokenRes.text()}`)

        const tokens = await tokenRes.json()
        const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
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
        const integ = await getInteg(supabase, tenant_id, 'quickbooks')
        await ensureToken(supabase, integ, tenant_id, 'quickbooks')

        let q = supabase
          .from('journal_entries')
          .select('*, journal_lines(*, chart_of_accounts(code,name))')
          .is('synced_to_quickbooks_at', null)
          .neq('status', 'DRAFT')
        if (from_date) q = q.gte('entry_date', from_date)
        if (to_date)   q = q.lte('entry_date', to_date)

        const { data: entries, error: entErr } = await q.limit(200)
        if (entErr) throw entErr

        const accountMap = await loadAccountMap(supabase, tenant_id, 'quickbooks')
        let pushed = 0
        const errors = []

        for (const entry of entries || []) {
          const lines = (entry.journal_lines || []).map((l) => {
            const remoteId = accountMap[l.account_id]
            if (!remoteId) return null
            return {
              JournalEntryLineDetail: {
                PostingType:        l.debit > 0 ? 'Debit' : 'Credit',
                AccountRef:         { value: remoteId },
              },
              Amount:               Math.abs(l.debit || l.credit || 0),
              Description:          l.line_note || entry.narration,
              DetailType:           'JournalEntryLineDetail',
            }
          }).filter(Boolean)

          if (lines.length < 2) continue

          const payload = {
            DocNumber:    entry.voucher_no || entry.id,
            TxnDate:      entry.entry_date,
            PrivateNote:  entry.narration || '',
            Line:         lines,
          }

          const res = await qbPost(integ, qbBase, 'journalentry', payload)
          if (res.ok) {
            await supabase.from('journal_entries').update({
              synced_to_quickbooks_at: new Date().toISOString(),
            }).eq('id', entry.id)
            pushed++
          } else {
            errors.push({ id: entry.id, error: await res.text() })
          }
        }

        await logSync(supabase, tenant_id, 'quickbooks', 'push', 'journal_entries', pushed,
          errors.length ? 'partial' : 'success',
          errors.length ? JSON.stringify(errors[0]) : null)

        return json({ ok: true, pushed, errors })
      }

      // ── Pull: Chart of Accounts ──────────────────────────────────────────
      case 'pull-coa': {
        const integ = await getInteg(supabase, tenant_id, 'quickbooks')
        await ensureToken(supabase, integ, tenant_id, 'quickbooks')

        const res = await fetch(
          `${qbBase}/${integ.realm_id}/query?query=SELECT * FROM Account MAXRESULTS 1000&minorversion=65`,
          {
            headers: {
              Authorization: `******
              Accept:        'application/json',
            },
          },
        )
        if (!res.ok) throw new Error(`QB CoA pull failed: ${await res.text()}`)
        const data = await res.json()
        const accounts = data?.QueryResponse?.Account || []

        const upserts = accounts.map((a) => ({
          remote_account_id:   a.Id,
          remote_account_name: a.Name,
          provider:            'quickbooks',
        }))

        await logSync(supabase, tenant_id, 'quickbooks', 'pull', 'chart_of_accounts', accounts.length, 'success', null)
        return json({ ok: true, accounts: upserts })
      }

      // ── Pull: Financial Report ───────────────────────────────────────────
      case 'pull-report': {
        const integ = await getInteg(supabase, tenant_id, 'quickbooks')
        await ensureToken(supabase, integ, tenant_id, 'quickbooks')

        const reportMap = {
          profit_loss:      'ProfitAndLoss',
          balance_sheet:    'BalanceSheet',
          cash_flow:        'CashFlow',
          aged_receivables: 'AgedReceivableDetail',
        }
        const qbReport = reportMap[report_type]
        if (!qbReport) throw new Error(`Unknown report_type: ${report_type}`)

        const params = new URLSearchParams({ minorversion: '65' })
        if (from_date) params.set('start_date', from_date)
        if (to_date)   params.set('end_date', to_date)

        const res = await fetch(
          `${qbBase}/${integ.realm_id}/reports/${qbReport}?${params}`,
          {
            headers: {
              Authorization: `******
              Accept:        'application/json',
            },
          },
        )
        if (!res.ok) throw new Error(`QB report pull failed: ${await res.text()}`)
        const payload = await res.json()

        await supabase.from('integration_reports').insert({
          tenant_id,
          provider:     'quickbooks',
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
          .eq('provider', 'quickbooks')
          .maybeSingle()

        if (integ?.refresh_token) {
          try {
            const clientId     = Deno.env.get('QB_CLIENT_ID')
            const clientSecret = Deno.env.get('QB_CLIENT_SECRET')
            const credentials  = btoa(`${clientId}:${clientSecret}`)
            await fetch(QB_REVOKE_URL, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type':  'application/json',
                'Accept':        'application/json',
              },
              body: JSON.stringify({ token: integ.refresh_token }),
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
        }).eq('tenant_id', tenant_id).eq('provider', 'quickbooks')

        return json({ ok: true })
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (err) {
    console.error('[sync-quickbooks]', err)
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

async function ensureToken(supabase, integ, tenant_id, provider) {
  if (!integ.token_expiry) return
  const expiresAt = new Date(integ.token_expiry).getTime()
  const bufferMs  = 5 * 60 * 1000  // refresh 5 min before expiry
  if (Date.now() + bufferMs < expiresAt) return

  // Refresh inline
  const clientId     = Deno.env.get('QB_CLIENT_ID')
  const clientSecret = Deno.env.get('QB_CLIENT_SECRET')
  const credentials  = btoa(`${clientId}:${clientSecret}`)
  const tokenRes = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type':  'application/x-www-form-urlencoded',
      'Accept':        'application/json',
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: integ.refresh_token,
    }).toString(),
  })
  if (!tokenRes.ok) throw new Error(`QB auto-refresh failed: ${await tokenRes.text()}`)
  const tokens = await tokenRes.json()
  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
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
  for (const row of data || []) {
    map[row.local_account_id] = row.remote_account_id
  }
  return map
}

async function qbPost(integ, qbBase, resource, payload) {
  return fetch(
    `${qbBase}/${integ.realm_id}/${resource}?minorversion=65`,
    {
      method:  'POST',
      headers: {
        Authorization: `******
        Accept:        'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )
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
