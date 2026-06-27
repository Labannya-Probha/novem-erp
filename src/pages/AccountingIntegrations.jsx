import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { getTenantId, withTenantInsert } from '../lib/tenant'
import { exportXLSX, fmtDate, todayISO } from '../lib/helpers'
import {
  Link2, Link2Off, RefreshCw, CheckCircle2, AlertCircle, ArrowUpDown,
  Download, Play, Plug, Settings2, BarChart3, ArrowRight, Loader2,
  BookMarked, CloudUpload, CloudDownload, Wand2,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'

/* ─── Provider metadata ─────────────────────────────────────────────────── */
const PROVIDERS = [
  {
    id:       'quickbooks',
    label:    'QuickBooks Online',
    logoText: 'QB',
    color:    'bg-green-600',
    authType: 'oauth',
    scopes:   'com.intuit.quickbooks.accounting',
    authUrl:  'https://appcenter.intuit.com/connect/oauth2',
    docsUrl:  'https://developer.intuit.com/app/developer/qbo/docs/get-started',
  },
  {
    id:       'xero',
    label:    'Xero',
    logoText: 'XE',
    color:    'bg-sky-600',
    authType: 'oauth',
    scopes:   'openid profile email accounting.transactions accounting.reports.read accounting.settings offline_access',
    authUrl:  'https://login.xero.com/identity/connect/authorize',
    docsUrl:  'https://developer.xero.com/documentation/guides/oauth2/overview/',
  },
  {
    id:       'tally',
    label:    'Tally Prime / ERP 9',
    logoText: 'TL',
    color:    'bg-orange-600',
    authType: 'gateway',
    docsUrl:  'https://tallysolutions.com/technology/tally-developer/tdl-documentation/',
  },
]

const SYNC_ENTITIES = ['All', 'Chart of Accounts', 'Journal Entries', 'Invoices']

const REPORT_TYPES = [
  { id: 'profit_loss',      label: 'Profit & Loss' },
  { id: 'balance_sheet',    label: 'Balance Sheet' },
  { id: 'cash_flow',        label: 'Cash Flow Statement' },
  { id: 'aged_receivables', label: 'Aged Receivables' },
]

/* ─── Root ──────────────────────────────────────────────────────────────── */
export default function AccountingIntegrations({ isAdmin }) {
  const location = useLocation()
  const urlTab   = new URLSearchParams(location.search).get('tab')

  const TABS = ['Connections', 'Sync Center', 'Account Mapping', 'Integrated Reports']
  const [tab, setTab]           = useState(TABS.includes(urlTab) ? urlTab : 'Connections')
  const [integrations, setIntegrations] = useState([])
  const [accounts, setAccounts] = useState([])
  const [msg, setMsg]           = useState({ text: '', type: 'success' })
  const flash = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: 'success' }), 6000) }

  const loadIntegrations = useCallback(async () => {
    const tid = getTenantId()
    let q = supabase.from('accounting_integrations').select('*')
    if (tid) q = q.eq('tenant_id', tid)
    const { data } = await q
    setIntegrations(data || [])
  }, [])

  const loadAccounts = useCallback(async () => {
    const tid = getTenantId()
    let q = supabase.from('chart_of_accounts').select('id,code,name').eq('is_active', true)
    if (tid) q = q.eq('tenant_id', tid)
    const { data } = await q.order('code')
    setAccounts(data || [])
  }, [])

  useEffect(() => {
    loadIntegrations()
    loadAccounts()
  }, [loadIntegrations, loadAccounts])

  // Sync tab with URL param
  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab')
    if (t && TABS.includes(t)) setTab(t)
  }, [location.search]) // eslint-disable-line react-hooks/exhaustive-deps

  const integMap = {}
  for (const i of integrations) integMap[i.provider] = i

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2">
          <Plug className="text-forest" /> Accounting Integrations
        </h1>
        <p className="text-sm text-pine/60">
          Connect QuickBooks, Xero or Tally to sync journals, invoices and pull financial reports.
        </p>
      </div>

      {msg.text && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
          msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-forest/10 text-forest'
        }`}>
          {msg.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-leaf flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${
              tab === t
                ? 'bg-white border border-leaf border-b-white text-forest -mb-px'
                : 'text-pine/60 hover:text-pine'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Connections' && (
        <ConnectionsTab
          integMap={integMap}
          reload={loadIntegrations}
          flash={flash}
          isAdmin={isAdmin}
        />
      )}
      {tab === 'Sync Center' && (
        <SyncCenterTab integMap={integMap} reload={loadIntegrations} flash={flash} />
      )}
      {tab === 'Account Mapping' && (
        <AccountMappingTab accounts={accounts} integMap={integMap} flash={flash} />
      )}
      {tab === 'Integrated Reports' && (
        <IntegratedReportsTab integMap={integMap} flash={flash} />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  TAB 1 — CONNECTIONS
 * ═══════════════════════════════════════════════════════════════════════════ */
function ConnectionsTab({ integMap, reload, flash, isAdmin }) {
  const [tallyUrl,  setTallyUrl]  = useState('')
  const [testing,   setTesting]   = useState({})
  const [saving,    setSaving]    = useState({})

  const tenantId = getTenantId()

  // Initialise tally URL from existing integration
  useEffect(() => {
    if (integMap.tally?.tally_gateway_url) setTallyUrl(integMap.tally.tally_gateway_url)
  }, [integMap.tally])

  const startOAuth = (provider) => {
    const p = PROVIDERS.find((x) => x.id === provider)
    if (!p || p.authType !== 'oauth') return
    const clientIdVar = provider === 'quickbooks' ? 'QB' : 'XERO'
    // Redirect to provider auth; state encodes tenantId for the callback
    const state    = btoa(JSON.stringify({ provider, tenant_id: tenantId }))
    const qb_params = new URLSearchParams({
      client_id:     `[${clientIdVar}_CLIENT_ID — set in Supabase Secrets]`,
      response_type: 'code',
      scope:         p.scopes,
      redirect_uri:  `${window.location.origin}/accounting/integrations/callback`,
      state,
    })
    window.location.href = `${p.authUrl}?${qb_params}`
  }

  const disconnect = async (provider) => {
    setSaving((s) => ({ ...s, [provider]: true }))
    try {
      const fnName = provider === 'quickbooks' ? 'sync-quickbooks'
                   : provider === 'xero'        ? 'sync-xero'
                   : 'sync-tally'
      const { error } = await supabase.functions.invoke(fnName, {
        body: { action: 'disconnect', tenant_id: tenantId },
      })
      if (error) throw error
      flash(`${provider} disconnected.`)
      reload()
    } catch (err) {
      flash(err.message, 'error')
    } finally {
      setSaving((s) => ({ ...s, [provider]: false }))
    }
  }

  const saveTallyConfig = async () => {
    if (!tallyUrl.trim()) { flash('Please enter the Tally gateway URL', 'error'); return }
    setSaving((s) => ({ ...s, tally: true }))
    try {
      const { error } = await supabase.functions.invoke('sync-tally', {
        body: { action: 'save-config', tenant_id: tenantId, gateway_url: tallyUrl.trim() },
      })
      if (error) throw error
      flash('Tally configuration saved.')
      reload()
    } catch (err) {
      flash(err.message, 'error')
    } finally {
      setSaving((s) => ({ ...s, tally: false }))
    }
  }

  const testTally = async () => {
    if (!tallyUrl.trim()) { flash('Please enter the Tally gateway URL first.', 'error'); return }
    setTesting((s) => ({ ...s, tally: true }))
    try {
      const { data, error } = await supabase.functions.invoke('sync-tally', {
        body: { action: 'test-connection', tenant_id: tenantId, gateway_url: tallyUrl.trim() },
      })
      if (error) throw error
      flash(data?.message || 'Tally is reachable!')
    } catch (err) {
      flash(`Tally connection failed: ${err.message}`, 'error')
    } finally {
      setTesting((s) => ({ ...s, tally: false }))
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {PROVIDERS.map((p) => {
        const integ    = integMap[p.id]
        const connected = integ?.is_connected === true
        return (
          <Card key={p.id} className={`border ${connected ? 'border-forest/35' : 'border-[--border-color]'} shadow-sm`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${p.color} flex items-center justify-center font-bold text-white text-sm shadow-sm`}>
                  {p.logoText}
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">{p.label}</CardTitle>
                  <CardDescription className="text-xs">
                    {connected ? (integ.company_name || 'Connected') : 'Not connected'}
                  </CardDescription>
                </div>
                <Badge variant={connected ? 'success' : 'outline'} className="shrink-0">
                  {connected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {connected && (
                <div className="rounded-lg border border-[--border-color] bg-leaf/10 px-3 py-2 text-xs text-pine/70 space-y-0.5">
                  {integ.company_name && <div><span className="font-medium">Company:</span> {integ.company_name}</div>}
                  {integ.last_synced_at && <div><span className="font-medium">Last sync:</span> {fmtDate(integ.last_synced_at)}</div>}
                  {integ.sync_error && (
                    <div className="text-red-600 flex items-start gap-1">
                      <AlertCircle size={12} className="mt-0.5 shrink-0" />
                      {integ.sync_error.slice(0, 100)}
                    </div>
                  )}
                </div>
              )}

              {/* Tally gateway form */}
              {p.authType === 'gateway' && (
                <div className="space-y-2">
                  <label className="label text-xs">Gateway URL (e.g. http://localhost:9000)</label>
                  <Input
                    placeholder="http://localhost:9000"
                    value={tallyUrl}
                    onChange={(e) => setTallyUrl(e.target.value)}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={testTally} disabled={testing.tally} className="flex-1">
                      {testing.tally ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                      Test
                    </Button>
                    <Button size="sm" onClick={saveTallyConfig} disabled={saving.tally} className="flex-1">
                      {saving.tally ? <Loader2 size={13} className="animate-spin" /> : <Settings2 size={13} />}
                      Save
                    </Button>
                  </div>
                </div>
              )}

              {/* OAuth providers */}
              {p.authType === 'oauth' && !connected && (
                <Button className="w-full" onClick={() => startOAuth(p.id)}>
                  <Link2 size={14} /> Connect {p.label}
                </Button>
              )}

              {connected && p.authType !== 'gateway' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => disconnect(p.id)}
                  disabled={saving[p.id]}
                >
                  {saving[p.id] ? <Loader2 size={13} className="animate-spin" /> : <Link2Off size={13} />}
                  Disconnect
                </Button>
              )}

              {connected && p.authType === 'gateway' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => disconnect(p.id)}
                  disabled={saving.tally}
                >
                  {saving.tally ? <Loader2 size={13} className="animate-spin" /> : <Link2Off size={13} />}
                  Disconnect Tally
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  TAB 2 — SYNC CENTER
 * ═══════════════════════════════════════════════════════════════════════════ */
function SyncCenterTab({ integMap, reload, flash }) {
  const tenantId = getTenantId()
  const today    = todayISO()
  const [fromDate, setFromDate] = useState(today.slice(0, 8) + '01')
  const [toDate,   setToDate]   = useState(today)
  const [entity,   setEntity]   = useState('All')
  const [syncing,  setSyncing]  = useState({})
  const [logs,     setLogs]     = useState([])
  const [logsLoading, setLogsLoading] = useState(false)

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    const tid = getTenantId()
    let q = supabase.from('integration_sync_log').select('*').order('started_at', { ascending: false }).limit(50)
    if (tid) q = q.eq('tenant_id', tid)
    const { data } = await q
    setLogs(data || [])
    setLogsLoading(false)
  }, [])

  useEffect(() => {
    loadLogs()
    // Realtime updates on sync_log
    const tid = getTenantId()
    const channel = supabase
      .channel('sync_log_changes')
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'integration_sync_log',
        filter: tid ? `tenant_id=eq.${tid}` : undefined,
      }, () => loadLogs())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadLogs])

  const syncNow = async (provider) => {
    const integ = integMap[provider]
    if (!integ?.is_connected) {
      flash(`${provider} is not connected.`, 'error')
      return
    }
    setSyncing((s) => ({ ...s, [provider]: true }))
    try {
      const fnName  = provider === 'quickbooks' ? 'sync-quickbooks'
                    : provider === 'xero'        ? 'sync-xero'
                    : 'sync-tally'
      const actions = entity === 'All'
        ? ['pull-coa', 'push-journals']
        : entity === 'Chart of Accounts' ? ['pull-coa']
        : entity === 'Journal Entries'   ? ['push-journals']
        : ['push-journals']

      for (const action of actions) {
        await supabase.functions.invoke(fnName, {
          body: { action, tenant_id: tenantId, from_date: fromDate, to_date: toDate },
        })
      }

      await supabase.from('accounting_integrations').update({
        last_synced_at: new Date().toISOString(),
      }).eq('tenant_id', tenantId).eq('provider', provider)

      flash(`${provider} sync completed.`)
      reload()
      loadLogs()
    } catch (err) {
      flash(err.message, 'error')
    } finally {
      setSyncing((s) => ({ ...s, [provider]: false }))
    }
  }

  const connectedProviders = PROVIDERS.filter((p) => integMap[p.id]?.is_connected)

  return (
    <div className="space-y-5">
      {/* Controls */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpDown size={16} className="text-forest" /> Sync Controls
          </CardTitle>
          <CardDescription>Choose what to sync and for which date range.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="label">From</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} max={toDate} />
            </div>
            <div>
              <label className="label">To</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate} max={today} />
            </div>
            <div>
              <label className="label">Entity</label>
              <select className="input" value={entity} onChange={(e) => setEntity(e.target.value)}>
                {SYNC_ENTITIES.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
          </div>

          {connectedProviders.length === 0 && (
            <p className="text-sm text-pine/50 italic">No providers connected. Go to Connections tab to connect.</p>
          )}
          <div className="flex flex-wrap gap-3">
            {connectedProviders.map((p) => (
              <Button
                key={p.id}
                onClick={() => syncNow(p.id)}
                disabled={!!syncing[p.id]}
                className="gap-2"
              >
                {syncing[p.id]
                  ? <Loader2 size={15} className="animate-spin" />
                  : <CloudUpload size={15} />
                }
                Sync {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sync Log */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Sync Log (last 50)</CardTitle>
            <Button variant="outline" size="sm" onClick={loadLogs} disabled={logsLoading}>
              <RefreshCw size={13} className={logsLoading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-leaf/20">
                  <th className="th text-left">Time</th>
                  <th className="th text-left">Provider</th>
                  <th className="th text-left">Direction</th>
                  <th className="th text-left">Entity</th>
                  <th className="th text-right">Records</th>
                  <th className="th text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="td text-pine/40 text-center py-4">No sync activity yet.</td></tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-leaf/5">
                    <td className="td whitespace-nowrap text-xs text-pine/60">
                      {new Date(log.started_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="td font-medium capitalize">{log.provider}</td>
                    <td className="td">
                      <span className="flex items-center gap-1 text-xs">
                        {log.direction === 'push'
                          ? <CloudUpload size={12} className="text-forest" />
                          : <CloudDownload size={12} className="text-sky-600" />}
                        {log.direction}
                      </span>
                    </td>
                    <td className="td text-xs">{log.entity_type}</td>
                    <td className="td text-right">{log.record_count}</td>
                    <td className="td text-center">
                      <Badge
                        variant={log.status === 'success' ? 'success' : log.status === 'partial' ? 'warning' : 'destructive'}
                        title={log.error_msg || ''}
                      >
                        {log.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  TAB 3 — ACCOUNT MAPPING
 * ═══════════════════════════════════════════════════════════════════════════ */
function AccountMappingTab({ accounts, integMap, flash }) {
  const tenantId    = getTenantId()
  const [mappings,  setMappings]  = useState([])
  const [remoteQB,  setRemoteQB]  = useState([])
  const [remoteXero, setRemoteXero] = useState([])
  const [saving,    setSaving]    = useState(false)
  const [autoMapping, setAutoMapping] = useState(false)

  const loadMappings = useCallback(async () => {
    const tid = getTenantId()
    let q = supabase.from('integration_account_map').select('*')
    if (tid) q = q.eq('tenant_id', tid)
    const { data } = await q
    setMappings(data || [])
  }, [])

  useEffect(() => { loadMappings() }, [loadMappings])

  const getMappingFor = (localId, provider) => {
    const m = mappings.find((x) => x.local_account_id === localId && x.provider === provider)
    return m ? { id: m.remote_account_id, name: m.remote_account_name } : { id: '', name: '' }
  }

  const [draft, setDraft] = useState({})
  useEffect(() => {
    const d = {}
    for (const acc of accounts) {
      d[acc.id] = {
        qb:   getMappingFor(acc.id, 'quickbooks').id,
        xero: getMappingFor(acc.id, 'xero').id,
      }
    }
    setDraft(d)
  }, [accounts, mappings]) // eslint-disable-line react-hooks/exhaustive-deps

  const pullRemoteCoa = async (provider) => {
    const fnName = provider === 'quickbooks' ? 'sync-quickbooks' : 'sync-xero'
    const { data, error } = await supabase.functions.invoke(fnName, {
      body: { action: 'pull-coa', tenant_id: tenantId },
    })
    if (error) { flash(error.message, 'error'); return }
    const accounts = data?.accounts || []
    if (provider === 'quickbooks') setRemoteQB(accounts)
    else setRemoteXero(accounts)
  }

  const autoMap = () => {
    setAutoMapping(true)
    const newDraft = { ...draft }
    for (const acc of accounts) {
      const name = acc.name.toLowerCase()
      const qbMatch   = remoteQB.find((r)   => r.remote_account_name?.toLowerCase() === name)
      const xeroMatch = remoteXero.find((r)  => r.remote_account_name?.toLowerCase() === name)
      if (!newDraft[acc.id]) newDraft[acc.id] = { qb: '', xero: '' }
      if (qbMatch   && !newDraft[acc.id].qb)   newDraft[acc.id].qb   = qbMatch.remote_account_id
      if (xeroMatch && !newDraft[acc.id].xero)  newDraft[acc.id].xero = xeroMatch.remote_account_id
    }
    setDraft(newDraft)
    setAutoMapping(false)
    flash('Auto-mapping applied. Review and save.')
  }

  const saveMapping = async () => {
    setSaving(true)
    try {
      const rows = []
      for (const acc of accounts) {
        const d = draft[acc.id] || {}
        if (d.qb) rows.push(withTenantInsert({
          local_account_id:    acc.id,
          provider:            'quickbooks',
          remote_account_id:   d.qb,
          remote_account_name: remoteQB.find((r) => r.remote_account_id === d.qb)?.remote_account_name || '',
          updated_at:          new Date().toISOString(),
        }))
        if (d.xero) rows.push(withTenantInsert({
          local_account_id:    acc.id,
          provider:            'xero',
          remote_account_id:   d.xero,
          remote_account_name: remoteXero.find((r) => r.remote_account_id === d.xero)?.remote_account_name || '',
          updated_at:          new Date().toISOString(),
        }))
      }
      if (rows.length > 0) {
        const { error } = await supabase
          .from('integration_account_map')
          .upsert(rows, { onConflict: 'local_account_id,provider' })
        if (error) throw error
      }
      flash('Account mapping saved.')
      loadMappings()
    } catch (err) {
      flash(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-pine flex items-center gap-2">
            <BookMarked size={16} className="text-forest" /> Chart of Accounts Mapping
          </h2>
          <p className="text-xs text-pine/60">Map each local account to its equivalent in QuickBooks or Xero.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => pullRemoteCoa('quickbooks')} disabled={!integMap.quickbooks?.is_connected}>
            <CloudDownload size={13} /> Load QB Accounts
          </Button>
          <Button variant="outline" size="sm" onClick={() => pullRemoteCoa('xero')} disabled={!integMap.xero?.is_connected}>
            <CloudDownload size={13} /> Load Xero Accounts
          </Button>
          <Button variant="outline" size="sm" onClick={autoMap} disabled={autoMapping || (remoteQB.length === 0 && remoteXero.length === 0)}>
            <Wand2 size={13} /> Auto-map by Name
          </Button>
          <Button size="sm" onClick={saveMapping} disabled={saving}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            Save Mapping
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-[--border-color] overflow-hidden">
        <div className="grid grid-cols-[minmax(80px,1fr)_minmax(140px,2fr)_minmax(140px,2fr)_minmax(140px,2fr)] bg-leaf/25 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-pine/60">
          <span>Code</span>
          <span>Account Name</span>
          <span>QuickBooks</span>
          <span>Xero</span>
        </div>
        <div className="divide-y divide-[--border-color] bg-white max-h-[55vh] overflow-y-auto">
          {accounts.length === 0 && (
            <div className="px-3 py-4 text-sm text-pine/40">No accounts found.</div>
          )}
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="grid grid-cols-[minmax(80px,1fr)_minmax(140px,2fr)_minmax(140px,2fr)_minmax(140px,2fr)] px-3 py-1.5 gap-2 items-center"
            >
              <span className="text-xs font-mono text-pine/70">{acc.code}</span>
              <span className="text-sm text-pine">{acc.name}</span>
              <select
                className="input text-xs !py-1"
                value={draft[acc.id]?.qb || ''}
                onChange={(e) => setDraft((d) => ({ ...d, [acc.id]: { ...d[acc.id], qb: e.target.value } }))}
              >
                <option value="">— not mapped —</option>
                {remoteQB.map((r) => (
                  <option key={r.remote_account_id} value={r.remote_account_id}>
                    {r.remote_account_name}
                  </option>
                ))}
              </select>
              <select
                className="input text-xs !py-1"
                value={draft[acc.id]?.xero || ''}
                onChange={(e) => setDraft((d) => ({ ...d, [acc.id]: { ...d[acc.id], xero: e.target.value } }))}
              >
                <option value="">— not mapped —</option>
                {remoteXero.map((r) => (
                  <option key={r.remote_account_id} value={r.remote_account_id}>
                    {r.remote_account_name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  TAB 4 — INTEGRATED REPORTS
 * ═══════════════════════════════════════════════════════════════════════════ */
function IntegratedReportsTab({ integMap, flash }) {
  const tenantId = getTenantId()
  const today    = todayISO()
  const [reportType, setReportType] = useState('profit_loss')
  const [provider,   setProvider]   = useState('internal')
  const [fromDate,   setFromDate]   = useState(today.slice(0, 8) + '01')
  const [toDate,     setToDate]     = useState(today)
  const [loading,    setLoading]    = useState(false)
  const [reportData, setReportData] = useState(null)
  const [compare,    setCompare]    = useState(false)
  const [internalData, setInternalData] = useState(null)

  const PROVIDER_OPTIONS = [
    { id: 'internal', label: 'Internal (ERP)' },
    ...PROVIDERS.filter((p) => integMap[p.id]?.is_connected).map((p) => ({ id: p.id, label: p.label })),
  ]

  const generateReport = async () => {
    if (provider === 'internal') {
      await generateInternal()
      return
    }
    setLoading(true)
    try {
      // Check for cached snapshot < 1 hour old
      const tid = getTenantId()
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
      let q = supabase
        .from('integration_reports')
        .select('*')
        .eq('provider', provider)
        .eq('report_type', reportType)
        .eq('from_date', fromDate)
        .eq('to_date', toDate)
        .gte('generated_at', oneHourAgo)
        .order('generated_at', { ascending: false })
        .limit(1)
      if (tid) q = q.eq('tenant_id', tid)

      const { data: cached } = await q
      if (cached?.length > 0) {
        setReportData(cached[0].payload)
        setLoading(false)
        return
      }

      const fnName = provider === 'quickbooks' ? 'sync-quickbooks'
                   : provider === 'xero'        ? 'sync-xero'
                   : 'sync-tally'
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { action: 'pull-report', tenant_id: tenantId, report_type: reportType, from_date: fromDate, to_date: toDate },
      })
      if (error) throw error
      setReportData(data?.payload || {})
    } catch (err) {
      flash(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const generateInternal = async () => {
    setLoading(true)
    try {
      const tid = getTenantId()

      // Simpler: pull trial balance from the existing accounting module
      let tbq = supabase.from('journal_lines').select(`
        debit, credit,
        account:chart_of_accounts(id, code, name, account_type)
      `)
      if (tid) tbq = tbq.eq('account.tenant_id', tid)

      const { data: lines } = await tbq.limit(2000)
      const rollup = {}
      for (const l of lines || []) {
        const acc = l.account
        if (!acc) continue
        if (!rollup[acc.id]) rollup[acc.id] = { code: acc.code, name: acc.name, type: acc.account_type, debit: 0, credit: 0 }
        rollup[acc.id].debit  += l.debit  || 0
        rollup[acc.id].credit += l.credit || 0
      }
      const rows = Object.values(rollup).sort((a, b) => a.code?.localeCompare(b.code))
      setInternalData(rows)
      setReportData({ rows })
    } catch (err) {
      flash(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const exportReport = () => {
    if (!reportData) return
    const rows = [
      ['Account Code', 'Account Name', 'Type', 'Debit', 'Credit', 'Net'],
      ...(reportData.rows || []).map((r) => [
        r.code || '', r.name || '', r.type || '',
        r.debit || 0, r.credit || 0, (r.debit || 0) - (r.credit || 0),
      ]),
    ]
    exportXLSX(`${provider}_${reportType}_${fromDate}_${toDate}.xlsx`, [
      { name: REPORT_TYPES.find((r) => r.id === reportType)?.label || reportType, rows },
    ])
  }

  const reportLabel = REPORT_TYPES.find((r) => r.id === reportType)?.label || reportType

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 size={16} className="text-forest" /> Generate Integrated Report
          </CardTitle>
          <CardDescription>Pull live financial reports from connected providers or your internal ERP data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="label">Report Type</label>
              <select className="input" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                {REPORT_TYPES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Provider</label>
              <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)}>
                {PROVIDER_OPTIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">From</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} max={toDate} />
            </div>
            <div>
              <label className="label">To</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate} max={today} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={generateReport} disabled={loading}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              Generate Report
            </Button>
            {reportData && (
              <Button variant="outline" onClick={exportReport}>
                <Download size={14} /> Export XLSX
              </Button>
            )}
            <label className="flex items-center gap-2 text-sm text-pine/70 cursor-pointer ml-1">
              <input
                type="checkbox"
                className="rounded"
                checked={compare}
                onChange={(e) => setCompare(e.target.checked)}
              />
              Side-by-side with Internal
            </label>
          </div>
        </CardContent>
      </Card>

      {reportData && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{reportLabel}</CardTitle>
            <CardDescription>
              {PROVIDER_OPTIONS.find((p) => p.id === provider)?.label} · {fromDate} to {toDate}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Internal trial-balance style report */}
            {reportData.rows && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-leaf/20">
                      <th className="th text-left">Code</th>
                      <th className="th text-left">Account</th>
                      {compare && <th className="th text-left">Type</th>}
                      <th className="th text-right">Debit</th>
                      <th className="th text-right">Credit</th>
                      <th className="th text-right">Net</th>
                      {compare && internalData && <th className="th text-right">Internal Net</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.map((row, i) => {
                      const net = (row.debit || 0) - (row.credit || 0)
                      const internalRow = compare && internalData
                        ? internalData.find((r) => r.code === row.code)
                        : null
                      const internalNet = internalRow ? internalRow.debit - internalRow.credit : null
                      return (
                        <tr key={i} className="hover:bg-leaf/5">
                          <td className="td font-mono text-xs">{row.code}</td>
                          <td className="td">{row.name}</td>
                          {compare && <td className="td text-xs text-pine/60">{row.type}</td>}
                          <td className="td money text-right">{(row.debit || 0).toLocaleString('en-BD', { minimumFractionDigits: 2 })}</td>
                          <td className="td money text-right">{(row.credit || 0).toLocaleString('en-BD', { minimumFractionDigits: 2 })}</td>
                          <td className={`td money text-right font-medium ${net < 0 ? 'text-red-600' : ''}`}>
                            {net.toLocaleString('en-BD', { minimumFractionDigits: 2 })}
                          </td>
                          {compare && internalData && (
                            <td className={`td money text-right ${internalNet !== null && Math.abs(internalNet - net) > 0.01 ? 'text-amber-700 font-medium' : 'text-pine/60'}`}>
                              {internalNet !== null ? internalNet.toLocaleString('en-BD', { minimumFractionDigits: 2 }) : '—'}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                    {reportData.rows.length === 0 && (
                      <tr><td colSpan={compare ? 7 : 5} className="td text-center text-pine/40 py-4">No data in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tally raw XML or other provider JSON */}
            {!reportData.rows && (
              <div className="p-4">
                <p className="text-sm text-pine/60 mb-2">Raw provider response (provider-specific format):</p>
                <pre className="bg-leaf/10 rounded-lg p-3 text-xs text-pine overflow-auto max-h-80">
                  {typeof reportData === 'string'
                    ? reportData
                    : JSON.stringify(reportData, null, 2).slice(0, 8000)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
