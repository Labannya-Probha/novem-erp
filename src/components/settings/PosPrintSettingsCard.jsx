import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { Save, Activity, Printer, FileText, Database } from 'lucide-react'
import { MetricCard, InputField, SelectField } from './settingsHelpers'

const POS_PRINT_DEFAULTS = {
  receipt_template_code: 'THERMAL_RECEIPT_V1',
  kot_template_code: 'THERMAL_KOT_V1',
  bot_template_code: 'THERMAL_BOT_V1',
  print_width: '80mm',
  customer_copy_enabled: true,
  merchant_copy_enabled: true,
  resort_copy_enabled: true,
  kot_auto_print: true,
  bot_auto_print: true,
  delivery_copy_auto_print: false,
  show_logo: true,
  show_qr: true,
  show_vat: true,
  show_service_charge: true,
  show_discount: true,
  show_round_off: true,
  loyalty_section_enabled: false,
  header_text: '',
  footer_text: '',
  default_language: 'en',
}

export default function PosPrintSettingsCard({ tenantId }) {
  const [rowId, setRowId] = useState(null)
  const [form, setForm] = useState(POS_PRINT_DEFAULTS)
  const [stats, setStats] = useState({ profiles: 0, printers: 0, routes: 0, logs: 0 })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const load = async () => {
    if (!tenantId) return
    setBusy(true)
    const [settingsRes, profilesRes, printersRes, routesRes, logsRes] = await Promise.all([
      supabase.from('print_settings').select('*').eq('tenant_id', tenantId).limit(1).maybeSingle(),
      supabase.from('print_profiles').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('printer_devices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('printer_routes').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('print_logs').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ])
    setBusy(false)
    const error = settingsRes.error || profilesRes.error || printersRes.error || routesRes.error || logsRes.error
    if (error) { flash(error.message); return }
    if (settingsRes.data) {
      setRowId(settingsRes.data.id)
      setForm({ ...POS_PRINT_DEFAULTS, ...settingsRes.data })
    } else {
      setRowId(null)
      setForm(POS_PRINT_DEFAULTS)
    }
    setStats({ profiles: profilesRes.count || 0, printers: printersRes.count || 0, routes: routesRes.count || 0, logs: logsRes.count || 0 })
  }

  useEffect(() => { load() }, [tenantId])

  const save = async () => {
    if (!tenantId) { flash('Tenant not detected. Please sign out and sign back in.'); return }
    setBusy(true)
    const payload = { ...form, tenant_id: tenantId, property_id: form.property_id || null, outlet_id: form.outlet_id || null, updated_at: new Date().toISOString() }
    const request = rowId
      ? supabase.from('print_settings').update(payload).eq('id', rowId)
      : supabase.from('print_settings').insert(payload).select('id').single()
    const { data, error } = await request
    setBusy(false)
    if (error) { flash(error.message); return }
    if (data?.id) setRowId(data.id)
    flash('POS print settings saved.')
    load()
  }

  const toggles = [
    ['customer_copy_enabled', 'Customer copy'],
    ['merchant_copy_enabled', 'Merchant copy'],
    ['resort_copy_enabled', 'Resort copy'],
    ['kot_auto_print', 'KOT auto print'],
    ['bot_auto_print', 'BOT auto print'],
    ['delivery_copy_auto_print', 'Delivery copy auto print'],
    ['show_logo', 'Logo on receipt'],
    ['show_qr', 'QR verification'],
    ['show_vat', 'VAT'],
    ['show_service_charge', 'Service charge'],
    ['show_discount', 'Discount'],
    ['show_round_off', 'Round off'],
    ['loyalty_section_enabled', 'Loyalty section'],
  ]

  return (
    <div className="card p-5 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-display font-semibold text-pine flex items-center gap-2">
            <Printer size={18} className="text-forest" /> POS print engine
          </h2>
          <p className="text-xs text-pine/50 mt-1">Thermal receipt, KOT/BOT, copy profiles, routing and audit settings for this tenant.</p>
        </div>
        <button className="btn-ghost" onClick={load} disabled={busy}><Activity size={15} /> Refresh</button>
      </div>
      {msg && <div className="px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}
      <div className="grid md:grid-cols-4 gap-3">
        <MetricCard icon={FileText} label="Print profiles" value={stats.profiles} />
        <MetricCard icon={Printer} label="Printer devices" value={stats.printers} />
        <MetricCard icon={Activity} label="Routes" value={stats.routes} />
        <MetricCard icon={Database} label="Print logs" value={stats.logs} />
      </div>
      <div className="grid lg:grid-cols-4 gap-3">
        <InputField label="Receipt template" value={form.receipt_template_code} onChange={(v) => setValue('receipt_template_code', v)} />
        <InputField label="KOT template" value={form.kot_template_code} onChange={(v) => setValue('kot_template_code', v)} />
        <InputField label="BOT template" value={form.bot_template_code} onChange={(v) => setValue('bot_template_code', v)} />
        <SelectField label="Print width" value={form.print_width} onChange={(v) => setValue('print_width', v)} options={['80mm', '58mm']} />
        <div className="lg:col-span-2"><InputField label="Header text" value={form.header_text} onChange={(v) => setValue('header_text', v)} /></div>
        <div className="lg:col-span-2"><InputField label="Footer text" value={form.footer_text} onChange={(v) => setValue('footer_text', v)} /></div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {toggles.map(([key, label]) => (
          <label key={key} className="rounded-lg border border-leaf px-3 py-2 flex items-center justify-between gap-3 text-sm text-pine">
            <span>{label}</span>
            <input type="checkbox" className="accent-forest" checked={!!form[key]} onChange={(e) => setValue(key, e.target.checked)} />
          </label>
        ))}
      </div>
      <div className="rounded-xl border border-leaf bg-paper p-3 text-xs text-pine/55">
        Loyalty remains hidden on receipts unless the tenant explicitly enables it here. Receipt/KOT/BOT logos print in black and white for thermal printers.
      </div>
      <button className="btn-primary" onClick={save} disabled={busy}><Save size={15} /> Save print settings</button>
    </div>
  )
}
