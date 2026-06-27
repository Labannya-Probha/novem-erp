/**
 * sync-tally — Supabase Edge Function
 *
 * Handles Tally ERP 9 / Tally Prime integration via the built-in HTTP XML gateway.
 *
 * Tally must be running on the user's machine with the HTTP server enabled:
 *   Tally → F12: Configure → Advanced Configuration → TDL → Enable ODBC port → 9000
 *   (or specify a different port/host in tally_gateway_url)
 *
 * Actions:
 *   - test-connection : ping the Tally gateway with a simple status request
 *   - save-config     : update the tally_gateway_url in accounting_integrations
 *   - push-journals   : post journal vouchers to Tally via TallyXML
 *   - pull-coa        : pull ledger list (chart of accounts equivalent) from Tally
 *   - pull-report     : pull Profit & Loss / Balance Sheet / Trial Balance from Tally
 *
 * Required environment variables:
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY : auto-injected by Supabase
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  const { action, tenant_id, gateway_url, from_date, to_date, report_type } = body

  try {
    switch (action) {
      // ── Test connectivity to Tally gateway ──────────────────────────────
      case 'test-connection': {
        const url = gateway_url || await getTallyGatewayUrl(supabase, tenant_id)
        const xml = buildEnvelope('<STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>')
        const res = await tallyPost(url, xml, 5000)
        if (res.ok) {
          return json({ ok: true, message: 'Tally gateway is reachable' })
        }
        throw new Error(`Tally gateway responded with HTTP ${res.status}`)
      }

      // ── Save Tally gateway URL ───────────────────────────────────────────
      case 'save-config': {
        if (!gateway_url) throw new Error('gateway_url is required')
        const { error } = await supabase.from('accounting_integrations').upsert({
          tenant_id,
          provider:           'tally',
          tally_gateway_url:  gateway_url,
          is_connected:       true,
          sync_status:        'idle',
          sync_error:         null,
          updated_at:         new Date().toISOString(),
        }, { onConflict: 'tenant_id,provider' })
        if (error) throw error
        return json({ ok: true })
      }

      // ── Push: journal entries as Tally vouchers ──────────────────────────
      case 'push-journals': {
        const url = await getTallyGatewayUrl(supabase, tenant_id)

        let q = supabase
          .from('journal_entries')
          .select('*, journal_lines(*, chart_of_accounts(code,name))')
          .is('synced_to_tally_at', null)
          .neq('status', 'DRAFT')
        if (from_date) q = q.gte('entry_date', from_date)
        if (to_date)   q = q.lte('entry_date', to_date)

        const { data: entries, error: entErr } = await q.limit(200)
        if (entErr) throw entErr

        const accountMap = await loadAccountMap(supabase, tenant_id, 'tally')
        let pushed = 0
        const errors = []

        for (const entry of entries || []) {
          const debitLines  = (entry.journal_lines || []).filter((l) => (l.debit  || 0) > 0)
          const creditLines = (entry.journal_lines || []).filter((l) => (l.credit || 0) > 0)
          if (debitLines.length === 0 || creditLines.length === 0) continue

          const ledgerEntries = [
            ...debitLines.map((l) => ledgerEntry(
              accountMap[l.account_id] || l.chart_of_accounts?.name || 'Unknown',
              Math.abs(l.debit), 'Dr',
            )),
            ...creditLines.map((l) => ledgerEntry(
              accountMap[l.account_id] || l.chart_of_accounts?.name || 'Unknown',
              Math.abs(l.credit), 'Cr',
            )),
          ].join('\n')

          const voucherXml = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create">
            <DATE>${formatTallyDate(entry.entry_date)}</DATE>
            <NARRATION>${escXml(entry.narration || '')}</NARRATION>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escXml(entry.voucher_no || entry.id)}</VOUCHERNUMBER>
            ${ledgerEntries}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`

          const res = await tallyPost(url, voucherXml)
          if (res.ok) {
            const resText = await res.text()
            if (resText.includes('LINEERROR') || resText.includes('error')) {
              errors.push({ id: entry.id, error: resText.slice(0, 300) })
            } else {
              await supabase.from('journal_entries').update({
                synced_to_tally_at: new Date().toISOString(),
              }).eq('id', entry.id)
              pushed++
            }
          } else {
            errors.push({ id: entry.id, error: `HTTP ${res.status}` })
          }
        }

        await logSync(supabase, tenant_id, 'tally', 'push', 'journal_entries', pushed,
          errors.length ? 'partial' : 'success',
          errors.length ? JSON.stringify(errors[0]) : null)

        return json({ ok: true, pushed, errors })
      }

      // ── Pull: Chart of Accounts (Ledgers) ───────────────────────────────
      case 'pull-coa': {
        const url = await getTallyGatewayUrl(supabase, tenant_id)
        const xml = buildReportEnvelope('List of Ledgers',
          `<STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>`,
        )
        const res = await tallyPost(url, xml)
        if (!res.ok) throw new Error(`Tally pull-coa HTTP ${res.status}`)
        const text = await res.text()

        // Parse <LEDGER NAME="..."> from XML
        const accounts = []
        const ledgerRegex = /<LEDGER\s+NAME="([^"]+)"/gi
        let match
        while ((match = ledgerRegex.exec(text)) !== null) {
          accounts.push({ remote_account_id: match[1], remote_account_name: match[1], provider: 'tally' })
        }

        await logSync(supabase, tenant_id, 'tally', 'pull', 'chart_of_accounts', accounts.length, 'success', null)
        return json({ ok: true, accounts })
      }

      // ── Pull: Financial Report ───────────────────────────────────────────
      case 'pull-report': {
        const url = await getTallyGatewayUrl(supabase, tenant_id)

        const reportMap = {
          profit_loss:      'Profit & Loss',
          balance_sheet:    'Balance Sheet',
          cash_flow:        'Cash Flow',
          aged_receivables: 'Bills Receivable',
        }
        const tallyReport = reportMap[report_type]
        if (!tallyReport) throw new Error(`Unknown report_type: ${report_type}`)

        const svars = [
          '<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>',
          from_date ? `<SVFROMDATE>${formatTallyDate(from_date)}</SVFROMDATE>` : '',
          to_date   ? `<SVTODATE>${formatTallyDate(to_date)}</SVTODATE>`       : '',
        ].join('\n')

        const xml = buildReportEnvelope(tallyReport, `<STATICVARIABLES>${svars}</STATICVARIABLES>`)
        const res = await tallyPost(url, xml)
        if (!res.ok) throw new Error(`Tally report pull HTTP ${res.status}`)
        const rawXml = await res.text()

        // Store the raw XML payload as-is; frontend may render it
        const payload = { raw_xml: rawXml.slice(0, 200000) }
        await supabase.from('integration_reports').insert({
          tenant_id,
          provider:     'tally',
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
        await supabase.from('accounting_integrations').update({
          is_connected:     false,
          tally_gateway_url: null,
          sync_status:      'idle',
          updated_at:       new Date().toISOString(),
        }).eq('tenant_id', tenant_id).eq('provider', 'tally')
        return json({ ok: true })
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (err) {
    console.error('[sync-tally]', err)
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

async function getTallyGatewayUrl(supabase, tenant_id) {
  const { data } = await supabase
    .from('accounting_integrations')
    .select('tally_gateway_url')
    .eq('tenant_id', tenant_id)
    .eq('provider', 'tally')
    .maybeSingle()
  const url = data?.tally_gateway_url
  if (!url) throw new Error('Tally gateway URL not configured')
  return url
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

async function tallyPost(url, xml, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'text/xml' },
      body:    xml,
      signal:  controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

function buildEnvelope(body) {
  return `<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA>${body}</EXPORTDATA></BODY></ENVELOPE>`
}

function buildReportEnvelope(reportName, staticVars) {
  return `<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>${reportName}</REPORTNAME>
        ${staticVars}
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`
}

function ledgerEntry(name, amount, drCr) {
  return `<ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>${escXml(name)}</LEDGERNAME>
    <ISDEEMEDPOSITIVE>${drCr === 'Dr' ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>
    <AMOUNT>${drCr === 'Dr' ? '' : '-'}${Math.abs(amount).toFixed(2)}</AMOUNT>
  </ALLLEDGERENTRIES.LIST>`
}

function escXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatTallyDate(isoDate) {
  // Tally uses YYYYMMDD format
  return (isoDate || '').replace(/-/g, '')
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
