import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Activity, ChefHat, FileText, Printer, Receipt, Route, Save, Search,
  Settings2, SlidersHorizontal, TestTube2,
} from 'lucide-react'
import { supabase } from '../supabase'
import PrintPortal from '../components/PrintPortal.jsx'
import { BarOrderTicket, KitchenTicket, PosReceipt } from '../components/print/PosDocs.jsx'
import { getTenantId } from '../lib/tenant'
import { getCompanySettingsQuery } from '../lib/companySettings'
import { formatMoney } from '../lib/posPrintEngine'
import { fmtDate } from '../lib/helpers'

const TABS = [
  { id: 'receipt-preview', label: 'Receipt Preview', icon: Receipt },
  { id: 'kot-bot-preview', label: 'KOT/BOT Preview', icon: ChefHat },
  { id: 'profiles', label: 'Print Profiles', icon: FileText },
  { id: 'routing', label: 'Printer Routing', icon: Route },
  { id: 'designer', label: 'Receipt Designer', icon: SlidersHorizontal },
  { id: 'thermal-test', label: 'Thermal Test', icon: TestTube2 },
  { id: 'logs', label: 'Print Logs', icon: Activity },
]

const withTenant = (query) => {
  const tenantId = getTenantId()
  return tenantId ? query.eq('tenant_id', tenantId) : query
}

const safeArray = (value) => Array.isArray(value) ? value : []

function tabFromLocation(search) {
  const requested = new URLSearchParams(search).get('tab')
  return TABS.some((tab) => tab.id === requested) ? requested : 'receipt-preview'
}

export default function PosPrintCenter({ company: shellCompany, userName }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(tabFromLocation(location.search))
  const [company, setCompany] = useState(shellCompany || null)
  const [settings, setSettings] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [devices, setDevices] = useState([])
  const [routes, setRoutes] = useState([])
  const [logs, setLogs] = useState([])
  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [orderItems, setOrderItems] = useState([])
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const tenantId = getTenantId()
  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || orders[0] || null,
    [orders, selectedOrderId],
  )

  const flash = (text) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 4000)
  }

  const openTab = (tabId) => {
    setActiveTab(tabId)
    navigate(`/pos/print-center?tab=${tabId}`, { replace: true })
  }

  const load = async () => {
    setBusy(true)
    const [
      companyRes,
      settingsRes,
      profilesRes,
      devicesRes,
      routesRes,
      logsRes,
      ordersRes,
    ] = await Promise.all([
      getCompanySettingsQuery('*', tenantId).limit(1).maybeSingle(),
      withTenant(supabase.from('print_settings').select('*')).limit(1).maybeSingle(),
      withTenant(supabase.from('print_profiles').select('*')).order('profile_code'),
      withTenant(supabase.from('printer_devices').select('*')).order('device_name'),
      withTenant(supabase.from('printer_routes').select('*')).order('priority'),
      withTenant(supabase.from('print_logs').select('*')).order('printed_at', { ascending: false }).limit(50),
      withTenant(supabase.from('pos_orders').select('*')).order('created_at', { ascending: false }).limit(25),
    ])
    setBusy(false)
    const error = companyRes.error || settingsRes.error || profilesRes.error || devicesRes.error || routesRes.error || logsRes.error || ordersRes.error
    if (error) {
      flash(error.message)
      return
    }
    setCompany(companyRes.data || shellCompany || null)
    setSettings(settingsRes.data || null)
    setProfiles(safeArray(profilesRes.data))
    setDevices(safeArray(devicesRes.data))
    setRoutes(safeArray(routesRes.data))
    setLogs(safeArray(logsRes.data))
    setOrders(safeArray(ordersRes.data))
    if (!selectedOrderId && ordersRes.data?.[0]?.id) setSelectedOrderId(ordersRes.data[0].id)
  }

  const loadItems = async (orderId) => {
    if (!orderId) {
      setOrderItems([])
      return
    }
    const { data, error } = await withTenant(supabase.from('pos_order_items').select('*').eq('order_id', orderId))
    if (error) flash(error.message)
    else setOrderItems(data || [])
  }

  useEffect(() => { setActiveTab(tabFromLocation(location.search)) }, [location.search])
  useEffect(() => { load() }, [])
  useEffect(() => { loadItems(selectedOrder?.id) }, [selectedOrder?.id])

  const saveSettings = async (next) => {
    if (!tenantId) {
      flash('Tenant not detected. Please sign in again.')
      return
    }
    const payload = {
      ...settings,
      ...next,
      tenant_id: tenantId,
      property_id: settings?.property_id || null,
      outlet_id: settings?.outlet_id || null,
      updated_at: new Date().toISOString(),
    }
    const request = settings?.id
      ? withTenant(supabase.from('print_settings').update(payload).eq('id', settings.id))
      : supabase.from('print_settings').insert(payload).select('*').single()
    const { data, error } = await request
    if (error) flash(error.message)
    else {
      if (data) setSettings(data)
      else setSettings(payload)
      flash('Print settings saved.')
      load()
    }
  }

  const saveProfile = async (profile) => {
    const { error } = await withTenant(supabase.from('print_profiles').update({
      copies: Number(profile.copies) || 1,
      active: !!profile.active,
      auto_print_enabled: !!profile.auto_print_enabled,
      ask_before_print_enabled: !!profile.ask_before_print_enabled,
      show_qr: !!profile.show_qr,
      show_logo: !!profile.show_logo,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id))
    if (error) flash(error.message)
    else { flash('Print profile saved.'); load() }
  }

  const saveDevice = async (device) => {
    if (!tenantId) {
      flash('Tenant not detected. Please sign in again.')
      return
    }
    const payload = {
      tenant_id: tenantId,
      device_name: device.device_name || 'Counter Printer',
      device_type: device.device_type || 'THERMAL',
      connection_type: device.connection_type || 'BROWSER',
      paper_size: device.paper_size || '80mm',
      ip_address: device.ip_address || null,
      port: device.port ? Number(device.port) : null,
      escpos_enabled: device.escpos_enabled ?? true,
      auto_cut_enabled: device.auto_cut_enabled ?? true,
      cash_drawer_enabled: device.cash_drawer_enabled ?? false,
      silent_print_enabled: device.silent_print_enabled ?? false,
      active: device.active ?? true,
      updated_at: new Date().toISOString(),
    }
    const { error } = device.id
      ? await withTenant(supabase.from('printer_devices').update(payload).eq('id', device.id))
      : await supabase.from('printer_devices').insert(payload)
    if (error) flash(error.message)
    else { flash('Printer device saved.'); load() }
  }

  const saveRoute = async (route) => {
    if (!tenantId) {
      flash('Tenant not detected. Please sign in again.')
      return
    }
    const payload = {
      tenant_id: tenantId,
      profile_code: route.profile_code || 'CUSTOMER_COPY',
      printer_device_id: route.printer_device_id || null,
      item_category: route.item_category || null,
      terminal_code: route.terminal_code || null,
      shift_code: route.shift_code || null,
      priority: Number(route.priority) || 100,
      active: route.active ?? true,
    }
    const { error } = route.id
      ? await withTenant(supabase.from('printer_routes').update(payload).eq('id', route.id))
      : await supabase.from('printer_routes').insert(payload)
    if (error) flash(error.message)
    else { flash('Printer route saved.'); load() }
  }

  const logPrint = async (copyType, documentHash = null) => {
    if (!tenantId) return
    await supabase.from('print_logs').insert({
      tenant_id: tenantId,
      order_id: selectedOrder?.id || null,
      copy_type: copyType,
      printed_by: null,
      terminal: window.navigator.userAgent.slice(0, 80),
      printer_device: 'Browser print preview',
      reprint_count: Number(selectedOrder?.reprint_count || 0),
      void_status: selectedOrder?.status === 'VOID' ? 'VOID' : null,
      document_hash: documentHash,
      filter_context: { userName, source: 'pos_print_center' },
    })
    load()
  }

  const openReceiptPreview = () => {
    if (!selectedOrder) {
      flash('No live POS order found for this tenant.')
      return
    }
    setPreview({ type: 'receipt' })
    logPrint('CUSTOMER_COPY')
  }

  const openKitchenPreview = (type) => {
    if (!selectedOrder) {
      flash('No live POS order found for this tenant.')
      return
    }
    setPreview({ type })
    logPrint(type === 'bot' ? 'BAR_COPY' : 'KITCHEN_COPY')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine">POS Print Center</h1>
          <p className="text-sm text-pine/60">Receipt, KOT/BOT, printer routing, templates, test print and audit logs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={load} disabled={busy}><Activity size={15} /> Refresh</button>
          <button className="btn-primary" onClick={openReceiptPreview}><Printer size={15} /> Preview receipt</button>
        </div>
      </div>

      {message && <div className="rounded-xl border border-forest/20 bg-forest/10 px-4 py-2 text-sm text-forest">{message}</div>}

      <div className="grid md:grid-cols-4 gap-3">
        <MetricCard icon={FileText} label="Profiles" value={profiles.length} />
        <MetricCard icon={Printer} label="Devices" value={devices.length} />
        <MetricCard icon={Route} label="Routes" value={routes.length} />
        <MetricCard icon={Activity} label="Logs" value={logs.length} />
      </div>

      <div className="flex gap-1 border-b border-leaf overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => openTab(tab.id)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'
            }`}
          >
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'receipt-preview' && (
        <ReceiptPreviewPanel
          orders={orders}
          selectedOrderId={selectedOrder?.id || ''}
          setSelectedOrderId={setSelectedOrderId}
          selectedOrder={selectedOrder}
          items={orderItems}
          settings={settings}
          company={company}
          openReceiptPreview={openReceiptPreview}
        />
      )}
      {activeTab === 'kot-bot-preview' && (
        <KitchenPreviewPanel
          selectedOrder={selectedOrder}
          items={orderItems}
          openKitchenPreview={openKitchenPreview}
        />
      )}
      {activeTab === 'profiles' && <ProfilesPanel profiles={profiles} saveProfile={saveProfile} />}
      {activeTab === 'routing' && (
        <RoutingPanel
          devices={devices}
          routes={routes}
          profiles={profiles}
          saveDevice={saveDevice}
          saveRoute={saveRoute}
        />
      )}
      {activeTab === 'designer' && (
        <DesignerPanel settings={settings} saveSettings={saveSettings} company={company} />
      )}
      {activeTab === 'thermal-test' && (
        <ThermalTestPanel selectedOrder={selectedOrder} items={orderItems} company={company} openReceiptPreview={openReceiptPreview} />
      )}
      {activeTab === 'logs' && <LogsPanel logs={logs} />}

      {preview?.type === 'receipt' && (
        <PrintPortal
          type={settings?.print_width === '58mm' ? 'thermal-58' : 'thermal-80'}
          title={`POS Receipt - ${selectedOrder?.order_no || 'Preview'}`}
          onClose={() => setPreview(null)}
          primaryColor={company?.primary_color || company?.brand_primary}
          accentColor={company?.accent_color || company?.brand_accent}
        >
          <PosReceipt order={selectedOrder} items={orderItems} company={company} />
        </PrintPortal>
      )}
      {preview?.type === 'kot' && (
        <PrintPortal
          type={settings?.print_width === '58mm' ? 'thermal-58' : 'thermal-80'}
          title={`KOT - ${selectedOrder?.order_no || 'Preview'}`}
          onClose={() => setPreview(null)}
          primaryColor={company?.primary_color || company?.brand_primary}
          accentColor={company?.accent_color || company?.brand_accent}
        >
          <KitchenTicket order={selectedOrder} items={orderItems} company={company} />
        </PrintPortal>
      )}
      {preview?.type === 'bot' && (
        <PrintPortal
          type={settings?.print_width === '58mm' ? 'thermal-58' : 'thermal-80'}
          title={`BOT - ${selectedOrder?.order_no || 'Preview'}`}
          onClose={() => setPreview(null)}
          primaryColor={company?.primary_color || company?.brand_primary}
          accentColor={company?.accent_color || company?.brand_accent}
        >
          <BarOrderTicket order={selectedOrder} items={orderItems} company={company} />
        </PrintPortal>
      )}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-leaf bg-white p-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-pine/45 font-bold">{label}</p>
        <strong className="text-xl text-pine">{value}</strong>
      </div>
      <span className="h-10 w-10 rounded-lg bg-forest/10 text-forest grid place-items-center"><Icon size={18} /></span>
    </div>
  )
}

function ReceiptPreviewPanel({ orders, selectedOrderId, setSelectedOrderId, selectedOrder, items, settings, company, openReceiptPreview }) {
  return (
    <div className="grid xl:grid-cols-[360px_minmax(0,1fr)] gap-4">
      <div className="card p-4 space-y-3">
        <h2 className="font-display font-semibold text-pine flex items-center gap-2"><Search size={17} /> Live POS orders</h2>
        <select className="input" value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)}>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>{order.order_no || order.id} - {order.status} - {formatMoney(order.total, company?.currency || 'BDT')}</option>
          ))}
        </select>
        {!orders.length && <p className="text-sm text-pine/50">No live POS order found for this tenant. Create a real POS order to preview and print.</p>}
        <button className="btn-primary w-full" onClick={openReceiptPreview} disabled={!selectedOrder}><Printer size={15} /> Open thermal preview</button>
      </div>
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display font-semibold text-pine">Receipt document status</h2>
            <p className="text-xs text-pine/50">Uses live tenant order data and tenant branding.</p>
          </div>
          <span className="status-chip">{settings?.print_width || '80mm'}</span>
        </div>
        {selectedOrder ? (
          <table className="w-full">
            <tbody>
              <InfoRow label="Order" value={selectedOrder.order_no || selectedOrder.id} />
              <InfoRow label="Status" value={selectedOrder.status || 'OPEN'} />
              <InfoRow label="Order type" value={selectedOrder.order_type || 'DINE_IN'} />
              <InfoRow label="Total" value={formatMoney(selectedOrder.total, company?.currency || 'BDT')} />
              <InfoRow label="Items loaded" value={items.length} />
              <InfoRow label="Tenant" value={company?.name || 'Tenant'} />
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-pine/50">No order selected.</p>
        )}
      </div>
    </div>
  )
}

function KitchenPreviewPanel({ selectedOrder, items, openKitchenPreview }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <TicketCard title="Kitchen Order Ticket" copy="No price, tax, discount or payment details are shown to kitchen staff." button="Preview KOT" onClick={() => openKitchenPreview('kot')} disabled={!selectedOrder} />
      <TicketCard title="Bar Order Ticket" copy="Beverage/bar routed items print as BOT; if no bar item exists, the preview uses the selected order items." button="Preview BOT" onClick={() => openKitchenPreview('bot')} disabled={!selectedOrder} />
      <div className="card p-4 lg:col-span-2">
        <h2 className="font-display font-semibold text-pine mb-3">Selected ticket items</h2>
        <table className="w-full">
          <thead><tr><th className="th">Item</th><th className="th text-right">Qty</th><th className="th">Notes</th></tr></thead>
          <tbody>
            {items.map((item) => <tr key={item.id || item.item_name}><td className="td">{item.item_name}</td><td className="td text-right">{Number(item.qty || 0)}</td><td className="td">{item.notes || item.note || '-'}</td></tr>)}
            {!items.length && <tr><td className="td text-pine/50" colSpan={3}>No ticket items loaded.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TicketCard({ title, copy, button, onClick, disabled }) {
  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine mb-2">{title}</h2>
      <p className="text-sm text-pine/55 mb-4">{copy}</p>
      <button className="btn-primary" onClick={onClick} disabled={disabled}><Printer size={15} /> {button}</button>
    </div>
  )
}

function ProfilesPanel({ profiles, saveProfile }) {
  const [drafts, setDrafts] = useState({})
  const draftFor = (profile) => drafts[profile.id] || profile
  const updateDraft = (profile, key, value) => setDrafts((prev) => ({ ...prev, [profile.id]: { ...draftFor(profile), [key]: value } }))

  return (
    <div className="card p-4">
      <h2 className="font-display font-semibold text-pine mb-3">Configurable print profiles</h2>
      <div className="table-scroll">
        <table className="w-full">
          <thead><tr><th className="th">Code</th><th className="th">Copy title</th><th className="th">Template</th><th className="th text-right">Copies</th><th className="th">Options</th><th className="th"></th></tr></thead>
          <tbody>
            {profiles.map((profile) => {
              const draft = draftFor(profile)
              return (
                <tr key={profile.id}>
                  <td className="td font-semibold">{profile.profile_code}</td>
                  <td className="td">{profile.copy_title}</td>
                  <td className="td">{profile.template_code}</td>
                  <td className="td text-right"><input className="input !w-20 !py-1 text-right" type="number" min="1" max="5" value={draft.copies || 1} onChange={(event) => updateDraft(profile, 'copies', event.target.value)} /></td>
                  <td className="td">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Toggle label="Active" checked={!!draft.active} onChange={(value) => updateDraft(profile, 'active', value)} />
                      <Toggle label="Auto" checked={!!draft.auto_print_enabled} onChange={(value) => updateDraft(profile, 'auto_print_enabled', value)} />
                      <Toggle label="Ask" checked={!!draft.ask_before_print_enabled} onChange={(value) => updateDraft(profile, 'ask_before_print_enabled', value)} />
                      <Toggle label="Logo" checked={!!draft.show_logo} onChange={(value) => updateDraft(profile, 'show_logo', value)} />
                      <Toggle label="QR" checked={!!draft.show_qr} onChange={(value) => updateDraft(profile, 'show_qr', value)} />
                    </div>
                  </td>
                  <td className="td text-right"><button className="btn-ghost !py-1" onClick={() => saveProfile(draft)}><Save size={13} /> Save</button></td>
                </tr>
              )
            })}
            {!profiles.length && <tr><td className="td text-pine/50" colSpan={6}>No profiles found. Run the POS print engine migration.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RoutingPanel({ devices, routes, profiles, saveDevice, saveRoute }) {
  const [device, setDevice] = useState({ device_name: '', device_type: 'THERMAL', connection_type: 'BROWSER', paper_size: '80mm' })
  const [route, setRoute] = useState({ profile_code: 'CUSTOMER_COPY', priority: 100 })

  return (
    <div className="grid xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
      <div className="space-y-4">
        <div className="card p-4 space-y-3">
          <h2 className="font-display font-semibold text-pine">Printer device</h2>
          <input className="input" placeholder="Device name" value={device.device_name} onChange={(event) => setDevice({ ...device, device_name: event.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={device.device_type} onChange={(event) => setDevice({ ...device, device_type: event.target.value })}><option>THERMAL</option><option>A4</option><option>PDF</option></select>
            <select className="input" value={device.paper_size} onChange={(event) => setDevice({ ...device, paper_size: event.target.value })}><option>80mm</option><option>58mm</option><option>A4</option></select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="IP address" value={device.ip_address || ''} onChange={(event) => setDevice({ ...device, ip_address: event.target.value })} />
            <input className="input" placeholder="Port" value={device.port || ''} onChange={(event) => setDevice({ ...device, port: event.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Toggle label="ESC/POS" checked={device.escpos_enabled ?? true} onChange={(value) => setDevice({ ...device, escpos_enabled: value })} />
            <Toggle label="Auto cut" checked={device.auto_cut_enabled ?? true} onChange={(value) => setDevice({ ...device, auto_cut_enabled: value })} />
            <Toggle label="Cash drawer" checked={device.cash_drawer_enabled ?? false} onChange={(value) => setDevice({ ...device, cash_drawer_enabled: value })} />
            <Toggle label="Silent print" checked={device.silent_print_enabled ?? false} onChange={(value) => setDevice({ ...device, silent_print_enabled: value })} />
          </div>
          <button className="btn-primary" onClick={() => saveDevice(device)}><Save size={15} /> Save device</button>
        </div>

        <div className="card p-4 space-y-3">
          <h2 className="font-display font-semibold text-pine">Printer route</h2>
          <select className="input" value={route.profile_code} onChange={(event) => setRoute({ ...route, profile_code: event.target.value })}>
            {profiles.map((profile) => <option key={profile.profile_code} value={profile.profile_code}>{profile.profile_code}</option>)}
          </select>
          <select className="input" value={route.printer_device_id || ''} onChange={(event) => setRoute({ ...route, printer_device_id: event.target.value })}>
            <option value="">Browser default</option>
            {devices.map((deviceRow) => <option key={deviceRow.id} value={deviceRow.id}>{deviceRow.device_name}</option>)}
          </select>
          <input className="input" placeholder="Item category / station rule" value={route.item_category || ''} onChange={(event) => setRoute({ ...route, item_category: event.target.value })} />
          <input className="input" placeholder="Priority" type="number" value={route.priority || 100} onChange={(event) => setRoute({ ...route, priority: event.target.value })} />
          <button className="btn-primary" onClick={() => saveRoute(route)}><Save size={15} /> Save route</button>
        </div>
      </div>

      <div className="space-y-4">
        <RouteTable title="Printer devices" rows={devices} columns={['device_name', 'device_type', 'connection_type', 'paper_size', 'active']} />
        <RouteTable title="Routing rules" rows={routes} columns={['profile_code', 'item_category', 'terminal_code', 'priority', 'active']} />
      </div>
    </div>
  )
}

function RouteTable({ title, rows, columns }) {
  return (
    <div className="card p-4">
      <h2 className="font-display font-semibold text-pine mb-3">{title}</h2>
      <div className="table-scroll">
        <table className="w-full">
          <thead><tr>{columns.map((column) => <th key={column} className="th">{column.replaceAll('_', ' ')}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column} className="td">{String(row[column] ?? '-')}</td>)}</tr>)}
            {!rows.length && <tr><td className="td text-pine/50" colSpan={columns.length}>No records yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DesignerPanel({ settings, saveSettings, company }) {
  const [draft, setDraft] = useState(settings || {})
  useEffect(() => { setDraft(settings || {}) }, [settings?.id])

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
      <div className="card p-4 space-y-3">
        <h2 className="font-display font-semibold text-pine flex items-center gap-2"><Settings2 size={17} /> Receipt designer</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <Input label="Receipt template" value={draft.receipt_template_code || 'THERMAL_RECEIPT_V1'} onChange={(value) => setDraft({ ...draft, receipt_template_code: value })} />
          <Input label="KOT template" value={draft.kot_template_code || 'THERMAL_KOT_V1'} onChange={(value) => setDraft({ ...draft, kot_template_code: value })} />
          <Input label="BOT template" value={draft.bot_template_code || 'THERMAL_BOT_V1'} onChange={(value) => setDraft({ ...draft, bot_template_code: value })} />
          <div><label className="label">Width</label><select className="input" value={draft.print_width || '80mm'} onChange={(event) => setDraft({ ...draft, print_width: event.target.value })}><option>80mm</option><option>58mm</option></select></div>
          <Input label="Header text" value={draft.header_text || ''} onChange={(value) => setDraft({ ...draft, header_text: value })} />
          <Input label="Footer text" value={draft.footer_text || ''} onChange={(value) => setDraft({ ...draft, footer_text: value })} />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {['show_logo', 'show_qr', 'show_vat', 'show_service_charge', 'show_discount', 'show_round_off', 'loyalty_section_enabled'].map((key) => (
            <Toggle key={key} label={key.replaceAll('_', ' ')} checked={!!draft[key]} onChange={(value) => setDraft({ ...draft, [key]: value })} />
          ))}
        </div>
        <button className="btn-primary" onClick={() => saveSettings(draft)}><Save size={15} /> Save designer settings</button>
      </div>
      <div className="card p-4">
        <h2 className="font-display font-semibold text-pine mb-3">Tenant branding</h2>
        <div className="rounded-xl border border-leaf p-4">
          <div className="h-12 w-12 rounded-lg border border-leaf bg-white grid place-items-center overflow-hidden mb-3">
            {company?.logo_url ? <img src={company.logo_url} alt="" className="h-full w-full object-contain grayscale contrast-150" /> : <Printer size={20} className="text-pine/40" />}
          </div>
          <div className="font-semibold text-pine">{company?.name || 'Tenant'}</div>
          <div className="text-xs text-pine/50">{company?.address || 'No address configured'}</div>
          <div className="mt-3 text-xs text-pine/50">Thermal logo preview is black and white.</div>
        </div>
      </div>
    </div>
  )
}

function ThermalTestPanel({ selectedOrder, items, company, openReceiptPreview }) {
  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine mb-2">Thermal print test</h2>
      <p className="text-sm text-pine/55 mb-4">Runs a browser print preview using the selected live order. Hardware ESC/POS device routing is configured in Printer Routing.</p>
      {selectedOrder ? (
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={openReceiptPreview}><Printer size={15} /> Test receipt preview</button>
          <span className="status-chip">{selectedOrder.order_no}</span>
          <span className="status-chip">{items.length} items</span>
          <span className="status-chip">{company?.name || 'Tenant'}</span>
        </div>
      ) : (
        <p className="text-sm text-pine/50">No live order available for test print.</p>
      )}
    </div>
  )
}

function LogsPanel({ logs }) {
  return (
    <div className="card p-4">
      <h2 className="font-display font-semibold text-pine mb-3">Print audit logs</h2>
      <div className="table-scroll">
        <table className="w-full">
          <thead><tr><th className="th">Printed at</th><th className="th">Copy</th><th className="th">Device</th><th className="th">Terminal</th><th className="th">Hash</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="td">{fmtDate(log.printed_at)} {new Date(log.printed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                <td className="td font-semibold">{log.copy_type}</td>
                <td className="td">{log.printer_device || '-'}</td>
                <td className="td">{log.terminal || '-'}</td>
                <td className="td">{log.document_hash || '-'}</td>
              </tr>
            ))}
            {!logs.length && <tr><td className="td text-pine/50" colSpan={5}>No print logs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return <tr><td className="td text-pine/50">{label}</td><td className="td font-semibold">{value}</td></tr>
}

function Input({ label, value, onChange }) {
  return <div><label className="label">{label}</label><input className="input" value={value || ''} onChange={(event) => onChange(event.target.value)} /></div>
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="rounded-lg border border-leaf px-3 py-2 flex items-center justify-between gap-2 text-sm text-pine bg-white">
      <span className="capitalize">{label}</span>
      <input type="checkbox" className="accent-forest" checked={!!checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}
