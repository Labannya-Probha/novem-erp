import { useEffect, useState, useRef } from 'react'
import { supabase, SUPABASE_CONFIG } from '../supabase'
import { fmtBDT, todayISO, setCurrency } from '../lib/helpers'
import { ROLES, ROLE_LABELS } from '../lib/roles'
import {
  Save, Plus, Percent, Building2, Trash2, Users, ShieldCheck,
  Upload, Image, KeyRound, AlertTriangle,
  Eye, EyeOff, ChevronDown, ChevronUp, Pencil,
  Globe, FileText, ToggleLeft, ToggleRight,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  ROOT — role-gated entry point                                       */
/* ------------------------------------------------------------------ */
export default function Settings({ userName, role, isAdmin, reloadCompany }) {
  const isSuperuser = role === 'SUPERUSER'
  const isAdminPlus = isSuperuser || isAdmin
  const canManage   = isAdminPlus || role === 'MANAGER'

  if (!canManage) {
    return (
      <div className="card p-8 max-w-xl">
        <h1 className="font-display text-xl font-bold text-pine mb-2 flex items-center gap-2">
          <ShieldCheck size={20} /> Access restricted
        </h1>
        <p className="text-sm text-pine/60">Settings can only be accessed by managers or administrators.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-pine mb-1">Settings</h1>
      <p className="text-sm text-pine/60 mb-6">Branding, tax rates, staff and system configuration.</p>
      <div className="space-y-8">
        <MyAccountCard userName={userName} />
        {isAdminPlus && <BrandingCard reloadCompany={reloadCompany} />}
        <TaxCard />
        <TaxPolicyCard isAdminPlus={isAdminPlus} />
        {isSuperuser && <AllowanceCard />}
        {isSuperuser && <RolePrivilegesCard />}
        {isSuperuser && <AdminFeatureAccessCard />}
        <StaffCard isAdminPlus={isAdminPlus} isSuperuser={isSuperuser} currentUserName={userName} />
        {isSuperuser && <DataWipeCard />}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  TAX POLICY CARD — Country-wise auto tax rates                      */
/* ------------------------------------------------------------------ */
function TaxPolicyCard({ isAdminPlus }) {
  const [countries, setCountries]     = useState([])
  const [policies, setPolicies]       = useState([])
  const [company, setCompany]         = useState(null)
  const [selectedCountry, setSelectedCountry] = useState('BD')
  const [msg, setMsg]                 = useState('')
  const [applying, setApplying]       = useState(false)
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  useEffect(() => {
    supabase.from('tax_policies')
      .select('country_code, country_name')
      .order('country_name')
      .then(({ data }) => {
        const unique = []
        const seen   = new Set()
        for (const r of (data || [])) {
          if (!seen.has(r.country_code)) {
            seen.add(r.country_code)
            unique.push(r)
          }
        }
        setCountries(unique)
      })
    supabase.from('company_settings').select('*').limit(1).single()
      .then(({ data }) => {
        if (data) { setCompany(data); setSelectedCountry(data.country_code || 'BD') }
      })
  }, [])

  useEffect(() => {
    if (!selectedCountry) return
    supabase.from('tax_policies')
      .select('*')
      .eq('country_code', selectedCountry)
      .order('charge_type')
      .then(({ data }) => setPolicies(data || []))
  }, [selectedCountry])

  const applyPolicy = async () => {
    if (!isAdminPlus) { flash('Admin access required.'); return }
    setApplying(true)
    try {
      await supabase.from('company_settings')
        .update({ country_code: selectedCountry, auto_apply_tax_policy: true })
        .eq('id', company.id)

      const mainTypes = ['ROOM', 'RESTAURANT', 'FOOD', 'OTHER', 'LAUNDRY']
      for (const pol of policies.filter(p => mainTypes.includes(p.charge_type))) {
        const { data: existing } = await supabase.from('tax_config')
          .select('id')
          .eq('charge_type', pol.charge_type)
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existing) {
          await supabase.from('tax_config')
            .update({
              vat_pct:            pol.tax_pct,
              service_charge_pct: pol.service_charge_pct,
              effective_from:     pol.effective_from,
            })
            .eq('id', existing.id)
        } else {
          await supabase.from('tax_config').insert({
            charge_type:        pol.charge_type,
            vat_pct:            pol.tax_pct,
            service_charge_pct: pol.service_charge_pct,
            effective_from:     pol.effective_from,
          })
        }
      }
      flash(`✓ Tax policy for ${countries.find(c => c.country_code === selectedCountry)?.country_name || selectedCountry} applied.`)
    } catch (e) { flash(e.message) }
    setApplying(false)
  }

  const CHARGE_LABELS = {
    ROOM: 'Room / Accommodation', RESTAURANT: 'Restaurant', FOOD: 'Food / F&B',
    OTHER: 'Other Services', LAUNDRY: 'Laundry', ROOM_CORPORATE: 'Room (Corporate)',
  }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-1">
        <Globe size={18} className="text-forest" /> VAT &amp; Tax Policy
      </h2>
      <p className="text-xs text-pine/50 mb-4">
        Select your country to auto-apply VAT, GST, and service charge rates.
        Current: <span className="font-semibold text-pine/70">{company?.country_code || 'BD'}</span>
      </p>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}

      {/* Country selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {countries.map((c) => (
          <button key={c.country_code}
            onClick={() => setSelectedCountry(c.country_code)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              selectedCountry === c.country_code
                ? 'bg-forest text-white border-forest'
                : 'border-leaf text-pine/60 hover:border-forest/40 hover:text-pine'
            }`}>
            {c.country_name}
          </button>
        ))}
      </div>

      {/* Policy table */}
      {policies.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-leaf/30">
                <th className="th">Charge Type</th>
                <th className="th">Tax Name</th>
                <th className="th text-right">Tax %</th>
                <th className="th text-right">SC %</th>
                <th className="th text-right">TDS %</th>
                <th className="th text-right">VDS %</th>
                <th className="th text-right">SD %</th>
                <th className="th">Mode</th>
                <th className="th">Effective</th>
                <th className="th text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id} className="border-b border-leaf/40 hover:bg-leaf/10">
                  <td className="td font-medium text-sm">{CHARGE_LABELS[p.charge_type] || p.charge_type}</td>
                  <td className="td">
                    <span className="status-chip bg-forest/10 text-forest text-xs">{p.tax_name}</span>
                  </td>
                  <td className="td text-right money font-semibold text-forest">{p.tax_pct}%</td>
                  <td className="td text-right money">{p.service_charge_pct > 0 ? `${p.service_charge_pct}%` : '—'}</td>
                  <td className="td text-right money">{p.tds_pct > 0 ? `${p.tds_pct}%` : '—'}</td>
                  <td className="td text-right money">{p.vds_pct > 0 ? `${p.vds_pct}%` : '—'}</td>
                  <td className="td text-right money">{p.sd_pct > 0 ? `${p.sd_pct}%` : '—'}</td>
                  <td className="td">
                    <span className={`status-chip text-xs ${p.is_tax_inclusive ? 'bg-amber/15 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>
                      {p.is_tax_inclusive ? 'Inclusive' : 'Exclusive'}
                    </span>
                  </td>
                  <td className="td text-xs money text-pine/50">{p.effective_from}</td>
                  <td className="td text-xs text-pine/40 max-w-[160px] truncate">{p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {policies.length === 0 && selectedCountry && (
        <p className="text-sm text-pine/40 py-4">No policies found for this country.</p>
      )}

      {isAdminPlus && (
        <div className="flex items-center gap-3 pt-2 border-t border-leaf">
          <button
            className="btn-primary"
            onClick={applyPolicy}
            disabled={applying || !selectedCountry}
          >
            <FileText size={15} />
            {applying ? 'Applying…' : `Apply ${countries.find(c => c.country_code === selectedCountry)?.country_name || ''} Tax Policy`}
          </button>
          <p className="text-xs text-pine/40">Updates your NBR Tax Rates table for all charge types.</p>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ADMIN FEATURE ACCESS — Superuser only                              */
/* ------------------------------------------------------------------ */
const FEATURE_MODULES = [
  { id: 'dashboard',       label: 'Dashboard' },
  { id: 'reservations',    label: 'Reservations' },
  { id: 'calendar',        label: 'Booking Calendar' },
  { id: 'crm',             label: 'Guest CRM' },
  { id: 'nightaudit',      label: 'Night Audit' },
  { id: 'housekeeping',    label: 'Housekeeping' },
  { id: 'pos',             label: 'Restaurant POS' },
  { id: 'menu-management', label: 'Menu Management' },
  { id: 'facilities',      label: 'Facilities' },
  { id: 'inventory',       label: 'Inventory' },
  { id: 'consumption',     label: 'Consumption Entry' },
  { id: 'accounting',      label: 'Accounting' },
  { id: 'vat',             label: 'VAT Center' },
  { id: 'hr',              label: 'HR & Office' },
  { id: 'reports',         label: 'Reports' },
  { id: 'tasks',           label: 'Task Management' },
  { id: 'cms',             label: 'Configuration' },
  { id: 'settings',        label: 'Settings' },
]

function AdminFeatureAccessCard() {
  const [admins, setAdmins]               = useState([])
  const [access, setAccess]               = useState({})
  const [selectedAdmin, setSelectedAdmin] = useState(null)
  const [busy, setBusy]                   = useState(false)
  const [msg, setMsg]                     = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const loadAdmins = async () => {
    const { data } = await supabase
      .from('app_users')
      .select('id, full_name, username, is_active')
      .eq('role', 'ADMIN')
      .order('full_name')
    setAdmins(data || [])
    if (data?.length && !selectedAdmin) setSelectedAdmin(data[0].id)
  }

  const loadAccess = async (userId) => {
    const { data } = await supabase
      .from('admin_feature_access')
      .select('module, can_access')
      .eq('user_id', userId)
    const map = {}
    for (const mod of FEATURE_MODULES) map[mod.id] = true
    for (const row of (data || [])) map[row.module] = row.can_access
    setAccess(prev => ({ ...prev, [userId]: map }))
  }

  useEffect(() => { loadAdmins() }, [])
  useEffect(() => { if (selectedAdmin) loadAccess(selectedAdmin) }, [selectedAdmin])

  const toggleModule = async (userId, moduleId, current) => {
    setBusy(true)
    const next = !current
    setAccess(prev => ({ ...prev, [userId]: { ...prev[userId], [moduleId]: next } }))
    const { error } = await supabase
      .from('admin_feature_access')
      .upsert({
        user_id:    userId,
        module:     moduleId,
        can_access: next,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,user_id,module' })
    if (error) {
      flash(error.message)
      setAccess(prev => ({ ...prev, [userId]: { ...prev[userId], [moduleId]: current } }))
    }
    setBusy(false)
  }

  const grantAll = async (userId) => {
    setBusy(true)
    await supabase.from('admin_feature_access').delete().eq('user_id', userId)
    await loadAccess(userId)
    setBusy(false)
    flash('All modules enabled.')
  }

  const revokeAll = async (userId) => {
    setBusy(true)
    const rows = FEATURE_MODULES.map(m => ({ user_id: userId, module: m.id, can_access: false }))
    await supabase.from('admin_feature_access').delete().eq('user_id', userId)
    await supabase.from('admin_feature_access').insert(rows)
    await loadAccess(userId)
    setBusy(false)
    flash('All modules disabled.')
  }

  const currentAccess     = selectedAdmin ? (access[selectedAdmin] || {}) : {}
  const selectedAdminObj  = admins.find(a => a.id === selectedAdmin)
  const enabledCount      = Object.values(currentAccess).filter(Boolean).length

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-1">
        <ShieldCheck size={18} className="text-forest" /> Admin Feature Access
      </h2>
      <p className="text-xs text-pine/50 mb-4">
        Control which modules each Admin can access per property. Superuser is never restricted.
        Disabled modules are hidden from that Admin's sidebar.
      </p>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}

      {admins.length === 0 && (
        <p className="text-sm text-pine/40">No Admin users found in this property.</p>
      )}

      {admins.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">

          {/* Admin selector */}
          <div className="space-y-1">
            <div className="text-xs font-bold text-pine/40 uppercase tracking-wide mb-2">Select Admin</div>
            {admins.map(admin => (
              <button key={admin.id}
                onClick={() => setSelectedAdmin(admin.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${
                  selectedAdmin === admin.id
                    ? 'bg-forest/15 text-forest border border-forest/20'
                    : 'text-pine/70 hover:bg-leaf/40 border border-transparent'
                } ${!admin.is_active ? 'opacity-50' : ''}`}
              >
                <div className="w-7 h-7 rounded-full bg-forest/15 text-forest flex items-center justify-center text-xs font-bold shrink-0">
                  {admin.full_name?.[0] || admin.username?.[0] || 'A'}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{admin.full_name || admin.username}</div>
                  <div className="text-[10px] text-pine/40 truncate">@{admin.username}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Module toggles */}
          {selectedAdmin && (
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="text-xs font-bold text-pine/40 uppercase tracking-wide">
                  {selectedAdminObj?.full_name} — {enabledCount}/{FEATURE_MODULES.length} modules enabled
                </div>
                <div className="flex gap-2">
                  <button onClick={() => grantAll(selectedAdmin)} disabled={busy}
                    className="text-xs text-forest hover:underline font-semibold">Enable all</button>
                  <span className="text-pine/20">·</span>
                  <button onClick={() => revokeAll(selectedAdmin)} disabled={busy}
                    className="text-xs text-red-400 hover:text-red-600 hover:underline font-semibold">Disable all</button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FEATURE_MODULES.map(mod => {
                  const enabled = currentAccess[mod.id] !== false
                  return (
                    <button key={mod.id}
                      onClick={() => toggleModule(selectedAdmin, mod.id, enabled)}
                      disabled={busy}
                      className={`flex items-center justify-between px-4 py-2.5 rounded-xl border transition-colors text-sm font-medium ${
                        enabled
                          ? 'border-forest/20 bg-forest/5 text-pine hover:bg-forest/10'
                          : 'border-red-200 bg-red-50/50 text-pine/40 hover:bg-red-50'
                      }`}
                    >
                      <span>{mod.label}</span>
                      {enabled
                        ? <ToggleRight size={20} className="text-forest shrink-0" />
                        : <ToggleLeft  size={20} className="text-red-300 shrink-0" />
                      }
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-pine/40 mt-3">
                Changes apply on next page load for that Admin. Green = accessible · Red = hidden.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ALLOWANCE CONFIG                                                    */
/* ------------------------------------------------------------------ */
function AllowanceCard() {
  const [rows, setRows]     = useState([])
  const [msg, setMsg]       = useState('')
  const [editId, setEditId] = useState(null)
  const [editF, setEditF]   = useState({})
  const [f, setF] = useState({ designation: '', allowance_name: 'Internet/Telephone Allowance', amount: '' })
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const load  = async () => { const { data } = await supabase.from('allowance_config').select('*').order('designation'); setRows(data || []) }
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!f.designation.trim()) { flash('Enter a designation (or DEFAULT for the fallback amount).'); return }
    const { error } = await supabase.from('allowance_config').insert({
      designation: f.designation.trim(), allowance_name: f.allowance_name.trim() || 'Internet/Telephone Allowance', amount: +f.amount || 0,
    })
    if (error) flash(error.message.includes('duplicate') ? 'This designation + allowance already has a row — edit it instead.' : error.message)
    else { setF({ designation: '', allowance_name: 'Internet/Telephone Allowance', amount: '' }); load(); flash('Added.') }
  }
  const startEdit = (r) => { setEditId(r.id); setEditF({ designation: r.designation, allowance_name: r.allowance_name, amount: r.amount }) }
  const saveEdit  = async () => {
    const { error } = await supabase.from('allowance_config').update({
      designation: editF.designation, allowance_name: editF.allowance_name, amount: +editF.amount || 0, updated_at: new Date().toISOString(),
    }).eq('id', editId)
    if (error) flash(error.message); else { setEditId(null); load(); flash('Updated.') }
  }
  const toggleActive = async (r) => { await supabase.from('allowance_config').update({ is_active: !r.is_active, updated_at: new Date().toISOString() }).eq('id', r.id); load() }
  const del = async (id) => { await supabase.from('allowance_config').delete().eq('id', id); load() }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-1"><Percent size={18} className="text-forest" /> Allowance configuration</h2>
      <p className="text-xs text-pine/50 mb-4">Designation-wise fixed allowance amounts used when generating monthly payroll. Add a <span className="font-mono">DEFAULT</span> row as a fallback.</p>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <input className="input" placeholder="Designation (e.g. Manager, DEFAULT)" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} />
        <input className="input col-span-2" placeholder="Allowance name" value={f.allowance_name} onChange={(e) => setF({ ...f, allowance_name: e.target.value })} />
        <input type="number" className="input money" placeholder="Amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Add</button>
      </div>
      <table className="w-full">
        <thead><tr><th className="th">Designation</th><th className="th">Allowance</th><th className="th text-right">Amount</th><th className="th">Status</th><th className="th"></th></tr></thead>
        <tbody>
          {rows.map((r) => editId === r.id ? (
            <tr key={r.id} className="bg-leaf/20">
              <td className="td"><input className="input !py-1" value={editF.designation} onChange={(e) => setEditF({ ...editF, designation: e.target.value })} /></td>
              <td className="td"><input className="input !py-1" value={editF.allowance_name} onChange={(e) => setEditF({ ...editF, allowance_name: e.target.value })} /></td>
              <td className="td"><input type="number" className="input money !py-1 !w-24 text-right" value={editF.amount} onChange={(e) => setEditF({ ...editF, amount: e.target.value })} /></td>
              <td className="td"><span className="text-xs text-pine/40">—</span></td>
              <td className="td">
                <div className="flex gap-1">
                  <button onClick={saveEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-forest/15 hover:bg-forest/30 text-forest"><Save size={13} /></button>
                  <button onClick={() => setEditId(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40">✕</button>
                </div>
              </td>
            </tr>
          ) : (
            <tr key={r.id} className={!r.is_active ? 'opacity-50' : ''}>
              <td className="td text-sm font-medium">{r.designation}</td>
              <td className="td text-sm">{r.allowance_name}</td>
              <td className="td money text-right">{fmtBDT(r.amount)}</td>
              <td className="td"><button onClick={() => toggleActive(r)} className={`status-chip ${r.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-500'}`}>{r.is_active ? 'Active' : 'Disabled'}</button></td>
              <td className="td">
                <div className="flex gap-1">
                  <button onClick={() => startEdit(r)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest"><Pencil size={13} /></button>
                  <button onClick={() => del(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-300 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={5}>No allowance rows yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ROLE PERMISSIONS MATRIX                                             */
/* ------------------------------------------------------------------ */
const PRIV_ROLES = ['SUPERUSER', 'ADMIN', 'MANAGER', 'FRONT_OFFICE', 'RESTAURANT', 'STORE', 'ACCOUNTS', 'HR', 'HOUSEKEEPING']
const PRIV_MODULES = [
  'dashboard', 'reservations', 'calendar', 'crm', 'nightaudit', 'housekeeping', 'pos',
  'menu-management', 'facilities', 'inventory', 'consumption', 'vat', 'accounting',
  'hr', 'reports', 'tasks', 'settings', 'cms',
]
const MODULE_LABELS = {
  dashboard: 'Dashboard', reservations: 'Reservations', calendar: 'Booking Calendar',
  crm: 'Guest CRM', nightaudit: 'Night Audit', housekeeping: 'Housekeeping',
  pos: 'Restaurant POS', 'menu-management': 'Menu Management', facilities: 'Facilities',
  inventory: 'Inventory', consumption: 'Consumption Entry', vat: 'VAT Center',
  accounting: 'Accounting', hr: 'HR & Office', reports: 'Reports',
  tasks: 'Task Management', settings: 'Settings', cms: 'Configuration',
}

function RolePrivilegesCard() {
  const [rows, setRows]             = useState([])
  const [activeRole, setActiveRole] = useState('MANAGER')
  const [msg, setMsg]               = useState('')
  const [busy, setBusy]             = useState(false)
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const load = async () => {
    const { data } = await supabase.from('role_privileges').select('*').order('role').order('module')
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const editableRoles = PRIV_ROLES.filter((r) => r !== 'SUPERUSER' && r !== 'ADMIN')
  const rowFor = (role, module) => rows.find((r) => r.role === role && r.module === module)

  const toggle = async (role, module, field, current) => {
    const r = rowFor(role, module)
    if (!r) { flash(`No row found for ${role} / ${module}.`); return }
    setBusy(true)
    const next = !current
    setRows((prev) => prev.map((row) => row.id === r.id ? { ...row, [field]: next } : row))
    const { error } = await supabase.from('role_privileges').update({ [field]: next, updated_at: new Date().toISOString() }).eq('id', r.id)
    setBusy(false)
    if (error) { flash(error.message); load() }
  }

  const Check = ({ on, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}
      className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${
        on ? 'bg-forest border-forest text-white' : 'bg-white border-leaf text-transparent hover:border-forest/40'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>✓</button>
  )

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-1"><ShieldCheck size={18} className="text-forest" /> Role permissions</h2>
      <p className="text-xs text-pine/50 mb-4">Controls which modules each role can view/create/edit/delete. Superuser and Admin always have full access.</p>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}
      <div className="flex gap-1 border-b border-leaf flex-wrap mb-4">
        {editableRoles.map((r) => (
          <button key={r} onClick={() => setActiveRole(r)} className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg ${activeRole === r ? 'bg-forest/10 border border-leaf border-b-white text-forest -mb-px' : 'text-pine/50 hover:text-pine'}`}>
            {ROLE_LABELS[r] || r}
          </button>
        ))}
      </div>
      <table className="w-full">
        <thead><tr>
          <th className="th">Module</th>
          <th className="th text-center">View</th>
          <th className="th text-center">Create</th>
          <th className="th text-center">Edit</th>
          <th className="th text-center">Delete</th>
        </tr></thead>
        <tbody>
          {PRIV_MODULES.map((m) => {
            const r = rowFor(activeRole, m)
            if (!r) return (
              <tr key={m}><td className="td text-sm text-pine/40" colSpan={5}>{MODULE_LABELS[m] || m} — no row.</td></tr>
            )
            return (
              <tr key={m}>
                <td className="td text-sm font-medium">{MODULE_LABELS[m] || m}</td>
                <td className="td text-center"><Check on={r.can_view}   disabled={busy} onClick={() => toggle(activeRole, m, 'can_view',   r.can_view)} /></td>
                <td className="td text-center"><Check on={r.can_create} disabled={busy} onClick={() => toggle(activeRole, m, 'can_create', r.can_create)} /></td>
                <td className="td text-center"><Check on={r.can_edit}   disabled={busy} onClick={() => toggle(activeRole, m, 'can_edit',   r.can_edit)} /></td>
                <td className="td text-center"><Check on={r.can_delete} disabled={busy} onClick={() => toggle(activeRole, m, 'can_delete', r.can_delete)} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  MY ACCOUNT                                                          */
/* ------------------------------------------------------------------ */
function MyAccountCard({ userName }) {
  const [current, setCurrent] = useState('')
  const [next, setNext]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [busy, setBusy]       = useState(false)
  const [msg, setMsg]         = useState(null)
  const flash = (text, ok = false) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000) }

  const changePassword = async () => {
    if (!current) { flash('Enter your current password.'); return }
    if (next.length < 6) { flash('New password must be at least 6 characters.'); return }
    if (next !== confirm) { flash('New passwords do not match.'); return }
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email
    if (!email) { flash('Could not retrieve your account.'); setBusy(false); return }
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: current })
    if (signInErr) { flash('Current password is incorrect.'); setBusy(false); return }
    const { error: updErr } = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (updErr) flash(updErr.message)
    else { flash('Password changed successfully.', true); setCurrent(''); setNext(''); setConfirm('') }
  }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-4">
        <KeyRound size={18} className="text-forest" /> My account
      </h2>
      <p className="text-xs text-pine/50 mb-4">Signed in as <span className="font-medium">{userName}</span>.</p>
      {msg && (
        <div className={`mb-4 px-3 py-2 rounded-lg text-sm ${msg.ok ? 'bg-forest/10 text-forest' : 'bg-red-50 text-red-600'}`}>{msg.text}</div>
      )}
      <div className="grid grid-cols-1 gap-3 max-w-sm">
        <div>
          <label className="label">Current password</label>
          <div className="relative">
            <input type={showCur ? 'text' : 'password'} className="input pr-9" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" />
            <button type="button" onClick={() => setShowCur((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine">
              {showCur ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div>
          <label className="label">New password</label>
          <div className="relative">
            <input type={showNew ? 'text' : 'password'} className="input pr-9" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Min 6 characters" />
            <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine">
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" />
        </div>
      </div>
      <button className="btn-primary mt-4" onClick={changePassword} disabled={busy}>
        <Save size={15} /> {busy ? 'Saving…' : 'Change password'}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  RICH TEXT EDITOR                                                    */
/* ------------------------------------------------------------------ */
function RichTextEditor({ initialHtml, onSave }) {
  const editorRef = useRef(null)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [preview, setPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialHtml || ''
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cmd = (command, value = null) => (e) => {
    e.preventDefault(); e.stopPropagation()
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }

  const handleSave = async () => {
    const html = editorRef.current?.innerHTML || ''
    setSaving(true); await onSave(html); setSaving(false)
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const Btn = ({ command, value, title, children }) => (
    <button type="button" title={title} onMouseDown={cmd(command, value)}
      className="w-8 h-8 flex items-center justify-center rounded text-pine/50 hover:bg-leaf hover:text-forest transition-colors select-none">
      {children}
    </button>
  )
  const Sep = () => <div className="w-px h-5 bg-pine/15 mx-0.5 shrink-0" />

  return (
    <div className="border border-leaf rounded-xl overflow-hidden shadow-sm">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-stone-50 border-b border-leaf">
        <Btn command="bold"      title="Bold"><strong>B</strong></Btn>
        <Btn command="italic"    title="Italic"><em>I</em></Btn>
        <Btn command="underline" title="Underline"><span className="underline">U</span></Btn>
        <Btn command="strikeThrough" title="Strikethrough"><span className="line-through">S</span></Btn>
        <Sep />
        <Btn command="formatBlock" value="h2" title="Heading 1"><span className="text-xs font-bold">H1</span></Btn>
        <Btn command="formatBlock" value="h3" title="Heading 2"><span className="text-xs font-bold">H2</span></Btn>
        <Btn command="formatBlock" value="p"  title="Paragraph"><span className="text-xs">¶</span></Btn>
        <Sep />
        <Btn command="insertUnorderedList" title="Bullet list"><span className="text-sm">•≡</span></Btn>
        <Btn command="insertOrderedList"   title="Numbered list"><span className="text-sm">1≡</span></Btn>
        <Btn command="outdent"  title="Outdent"><span className="text-sm">←</span></Btn>
        <Btn command="indent"   title="Indent"><span className="text-sm">→</span></Btn>
        <Sep />
        <Btn command="justifyLeft"   title="Left"><span className="text-xs">◀═</span></Btn>
        <Btn command="justifyCenter" title="Center"><span className="text-xs">═◼═</span></Btn>
        <Btn command="justifyRight"  title="Right"><span className="text-xs">═▶</span></Btn>
        <Btn command="removeFormat"  title="Clear"><span className="text-xs line-through opacity-60">A</span></Btn>
        <div className="flex-1" />
        <button type="button" onClick={() => { setPreviewHtml(editorRef.current?.innerHTML || ''); setPreview(v => !v) }}
          className={`px-2.5 py-1 rounded text-xs font-medium mr-1 transition-colors ${preview ? 'bg-forest/15 text-forest' : 'bg-white border border-leaf text-pine/60 hover:text-pine'}`}>
          {preview ? '✏ Edit' : '👁 Preview'}
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${saved ? 'bg-forest/15 text-forest' : 'bg-forest text-white hover:bg-forest/90'}`}>
          <Save size={12} /> {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save T&C'}
        </button>
      </div>
      {preview ? (
        <div className="min-h-[220px] max-h-[420px] overflow-y-auto p-4 bg-white text-sm text-pine leading-relaxed"
          dangerouslySetInnerHTML={{ __html: previewHtml }} />
      ) : (
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          className="min-h-[220px] max-h-[420px] overflow-y-auto p-4 bg-white text-sm text-pine leading-relaxed focus:outline-none"
          style={{ caretColor: '#1B4D2E' }} />
      )}
      <div className="px-4 py-2 bg-stone-50 border-t border-leaf flex items-center justify-between text-xs text-pine/40">
        <span>Ctrl+B Bold · Ctrl+I Italic · Ctrl+U Underline</span>
        <span>Saves separately from profile</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  BRANDING                                                            */
/* ------------------------------------------------------------------ */
function BrandingCard({ reloadCompany }) {
  const [c, setC]       = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg]   = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const load  = async () => { const { data } = await supabase.from('company_settings').select('*').single(); setC(data) }
  useEffect(() => { load() }, [])
  if (!c) return <div className="card p-5 text-pine/50">Loading…</div>
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }))

  const uploadLogo = async (file) => {
    if (!file) return
    setBusy(true)
    const ext  = file.name.split('.').pop()
    const path = `logo_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: true, contentType: file.type })
    if (error) { flash(error.message); setBusy(false); return }
    const { data: pub } = supabase.storage.from('branding').getPublicUrl(path)
    set('logo_url', pub.publicUrl)
    await supabase.from('company_settings').update({ logo_url: pub.publicUrl }).eq('id', c.id)
    setBusy(false); flash('Logo uploaded.'); reloadCompany?.()
  }

  const save = async () => {
    setBusy(true)
    const { error } = await supabase.from('company_settings').update({
      name: c.name, legal_name: c.legal_name, address: c.address, phone: c.phone, email: c.email,
      bin: c.bin, vat_circle: c.vat_circle, invoice_footer: c.invoice_footer,
      short_code: c.short_code, software_name: c.software_name, currency: c.currency,
      mushak610_threshold: +c.mushak610_threshold || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', c.id)
    setBusy(false)
    if (error) flash(error.message)
    else { setCurrency(c.currency || '৳'); flash('Saved.'); reloadCompany?.() }
  }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-4">
        <Building2 size={18} className="text-forest" /> Branding &amp; company profile
      </h2>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-20 h-20 rounded-xl border border-leaf bg-paper flex items-center justify-center overflow-hidden">
          {c.logo_url ? <img src={c.logo_url} alt="logo" className="w-full h-full object-contain" /> : <Image size={26} className="text-pine/30" />}
        </div>
        <label className="btn-ghost cursor-pointer">
          <Upload size={15} /> {busy ? 'Uploading…' : 'Upload logo'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Software name</label><input className="input" value={c.software_name || ''} onChange={(e) => set('software_name', e.target.value)} /></div>
        <div><label className="label">Currency symbol</label><input className="input" value={c.currency || ''} onChange={(e) => set('currency', e.target.value)} /></div>
        <div><label className="label">Property name</label><input className="input" value={c.name || ''} onChange={(e) => set('name', e.target.value)} /></div>
        <div><label className="label">Legal name</label><input className="input" value={c.legal_name || ''} onChange={(e) => set('legal_name', e.target.value)} /></div>
        <div className="col-span-2"><label className="label">Address</label><input className="input" value={c.address || ''} onChange={(e) => set('address', e.target.value)} /></div>
        <div><label className="label">Phone</label><input className="input" value={c.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
        <div><label className="label">Email</label><input className="input" value={c.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
        <div><label className="label">BIN</label><input className="input money" value={c.bin || ''} onChange={(e) => set('bin', e.target.value)} /></div>
        <div><label className="label">Short code</label><input className="input money" value={c.short_code || ''} onChange={(e) => set('short_code', e.target.value)} /></div>
        <div className="col-span-2"><label className="label">VAT circle / division</label><input className="input" value={c.vat_circle || ''} onChange={(e) => set('vat_circle', e.target.value)} /></div>
        <div><label className="label">Mushak-6.10 threshold</label><input type="number" className="input money" value={c.mushak610_threshold || 0} onChange={(e) => set('mushak610_threshold', e.target.value)} /></div>
        <div><label className="label">Invoice footer</label><input className="input" value={c.invoice_footer || ''} onChange={(e) => set('invoice_footer', e.target.value)} /></div>
      </div>
      <div className="mt-5">
        <label className="label">Default Terms &amp; Conditions</label>
        <RichTextEditor
          initialHtml={c.terms_conditions || ''}
          onSave={async (html) => {
            const { error } = await supabase.from('company_settings').update({
              terms_conditions: html, updated_at: new Date().toISOString(),
            }).eq('id', c.id)
            if (error) flash(error.message)
            else { flash('Terms & Conditions saved.'); reloadCompany?.() }
          }}
        />
      </div>
      <button className="btn-primary mt-4" disabled={busy} onClick={save}><Save size={15} /> Save profile</button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  TAX CONFIG                                                          */
/* ------------------------------------------------------------------ */
function TaxCard() {
  const [rows, setRows]     = useState([])
  const [msg, setMsg]       = useState('')
  const [editId, setEditId] = useState(null)
  const [editF, setEditF]   = useState({})
  const [f, setF] = useState({ charge_type: 'ROOM', vat_pct: 15, service_charge_pct: 0, effective_from: todayISO() })
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const load  = async () => { const { data } = await supabase.from('tax_config').select('*').order('effective_from', { ascending: false }); setRows(data || []) }
  useEffect(() => { load() }, [])

  const add = async () => {
    const { error } = await supabase.from('tax_config').insert({
      charge_type: f.charge_type, vat_pct: +f.vat_pct || 0,
      service_charge_pct: +f.service_charge_pct || 0, effective_from: f.effective_from,
    })
    if (error) flash(error.message); else { load(); flash('Added.') }
  }
  const startEdit = (r) => { setEditId(r.id); setEditF({ charge_type: r.charge_type, vat_pct: r.vat_pct, service_charge_pct: r.service_charge_pct, effective_from: r.effective_from }) }
  const saveEdit  = async () => {
    const { error } = await supabase.from('tax_config').update({
      charge_type: editF.charge_type, vat_pct: +editF.vat_pct || 0,
      service_charge_pct: +editF.service_charge_pct || 0, effective_from: editF.effective_from,
    }).eq('id', editId)
    if (error) flash(error.message); else { setEditId(null); load(); flash('Updated.') }
  }
  const del = async (id) => { await supabase.from('tax_config').delete().eq('id', id); load() }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-4"><Percent size={18} className="text-forest" /> NBR tax rates</h2>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <select className="input" value={f.charge_type} onChange={(e) => setF({ ...f, charge_type: e.target.value })}>
          {['ROOM','RESTAURANT','FOOD','LAUNDRY','OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="number" className="input money" placeholder="VAT %" value={f.vat_pct} onChange={(e) => setF({ ...f, vat_pct: e.target.value })} />
        <input type="number" className="input money" placeholder="SC %" value={f.service_charge_pct} onChange={(e) => setF({ ...f, service_charge_pct: e.target.value })} />
        <input type="date" className="input" value={f.effective_from} onChange={(e) => setF({ ...f, effective_from: e.target.value })} />
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Add</button>
      </div>
      <table className="w-full">
        <thead><tr><th className="th">Type</th><th className="th text-right">VAT %</th><th className="th text-right">SC %</th><th className="th">From</th><th className="th"></th></tr></thead>
        <tbody>
          {rows.map((r) => editId === r.id ? (
            <tr key={r.id} className="bg-leaf/20">
              <td className="td">
                <select className="input !py-1 !w-32" value={editF.charge_type} onChange={(e) => setEditF({ ...editF, charge_type: e.target.value })}>
                  {['ROOM','RESTAURANT','FOOD','LAUNDRY','OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td className="td"><input type="number" className="input money !py-1 !w-20 text-right" value={editF.vat_pct} onChange={(e) => setEditF({ ...editF, vat_pct: e.target.value })} /></td>
              <td className="td"><input type="number" className="input money !py-1 !w-20 text-right" value={editF.service_charge_pct} onChange={(e) => setEditF({ ...editF, service_charge_pct: e.target.value })} /></td>
              <td className="td"><input type="date" className="input !py-1" value={editF.effective_from} onChange={(e) => setEditF({ ...editF, effective_from: e.target.value })} /></td>
              <td className="td">
                <div className="flex gap-1">
                  <button onClick={saveEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-forest/15 hover:bg-forest/30 text-forest"><Save size={13} /></button>
                  <button onClick={() => setEditId(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40">✕</button>
                </div>
              </td>
            </tr>
          ) : (
            <tr key={r.id}>
              <td className="td">{r.charge_type}</td>
              <td className="td money text-right">{r.vat_pct}%</td>
              <td className="td money text-right">{r.service_charge_pct}%</td>
              <td className="td text-sm">{r.effective_from}</td>
              <td className="td">
                <div className="flex gap-1">
                  <button onClick={() => startEdit(r)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest"><Pencil size={13} /></button>
                  <button onClick={() => del(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-300 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  STAFF                                                               */
/* ------------------------------------------------------------------ */
function StaffCard({ isAdminPlus, isSuperuser, currentUserName }) {
  const [rows, setRows]           = useState([])
  const [msg, setMsg]             = useState('')
  const [busy, setBusy]           = useState(false)
  const [nu, setNu]               = useState({ full_name: '', username: '', password: '', role: 'FRONT_OFFICE' })
  const [editId, setEditId]       = useState(null)
  const [editF, setEditF]         = useState({})
  const [resetTarget, setResetTarget] = useState(null)
  const [newPwd, setNewPwd]       = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 6000) }

  const load = async () => {
    const { data } = await supabase
      .from('app_users')
      .select('id, email, full_name, username, role, is_active, created_at')
      .order('created_at')
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const LOGIN_DOMAIN  = 'aura-stay.local'
  const availableRoles = isSuperuser ? ROLES : ROLES.filter((r) => r !== 'SUPERUSER')

  const addStaff = async () => {
    const uname = nu.username.trim().toLowerCase()
    if (!nu.full_name.trim() || !uname || nu.password.length < 6) { flash('Enter name, username and a password of at least 6 characters.'); return }
    if (/[^a-z0-9._-]/.test(uname)) { flash('Username may only use letters, numbers, dot, dash and underscore.'); return }
    setBusy(true)
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const { data: myRow, error: myRowErr } = await supabase
        .from('app_users').select('tenant_id').eq('id', currentUser?.id).single()
      if (myRowErr || !myRow?.tenant_id) { flash('Could not determine your company — please sign out and back in.'); setBusy(false); return }
      const { createClient } = await import('@supabase/supabase-js')
      const tmp = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
      const email = `${uname}@${LOGIN_DOMAIN}`
      const { data, error } = await tmp.auth.signUp({
        email, password: nu.password,
        options: { data: { username: uname, full_name: nu.full_name.trim(), tenant_id: myRow.tenant_id } },
      })
      if (error) throw error
      const newId = data?.user?.id
      if (newId) await supabase.from('app_users').update({ role: nu.role, full_name: nu.full_name.trim(), username: uname }).eq('id', newId)
      await tmp.auth.signOut()
      setNu({ full_name: '', username: '', password: '', role: 'FRONT_OFFICE' })
      await load()
      flash(`Staff "${uname}" created successfully.`)
    } catch (e) { flash(e.message?.includes('already registered') ? 'Username already taken.' : e.message) }
    setBusy(false)
  }

  const startEdit = (u) => { setEditId(u.id); setEditF({ full_name: u.full_name || '', username: u.username || '', role: u.role }) }
  const saveEdit  = async () => {
    const { error } = await supabase.from('app_users').update({ full_name: editF.full_name, username: editF.username, role: editF.role }).eq('id', editId)
    if (error) flash(error.message); else { setEditId(null); load(); flash('Staff updated.') }
  }
  const toggle = async (u) => { await supabase.from('app_users').update({ is_active: !u.is_active }).eq('id', u.id); load() }

  const resetPassword = async () => {
    if (!resetTarget || newPwd.length < 6) { flash('New password must be at least 6 characters.'); return }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/admin-reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ user_id: resetTarget.id, new_password: newPwd }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.message || 'Reset failed.')
      flash(`Password reset for ${resetTarget.name}.`)
      setResetTarget(null); setNewPwd('')
    } catch (e) { flash(`Password reset failed: ${e.message}`) }
    setBusy(false)
  }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-2"><Users size={18} className="text-forest" /> Staff</h2>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}
      {isAdminPlus && (
        <div className="grid grid-cols-5 gap-2 mb-4">
          <input className="input" placeholder="Full name" value={nu.full_name} onChange={(e) => setNu({ ...nu, full_name: e.target.value })} />
          <input className="input" placeholder="Username" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} />
          <input type="password" className="input" placeholder="Password (min 6)" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
          <select className="input" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
            {availableRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button className="btn-primary justify-center" disabled={busy} onClick={addStaff}><Plus size={15} /> Add</button>
        </div>
      )}
      {resetTarget && (
        <div className="mb-4 p-4 rounded-xl border border-amber/30 bg-amber/5">
          <p className="text-sm font-semibold text-pine mb-2 flex items-center gap-2">
            <KeyRound size={15} className="text-amber-600" /> Reset password for <span className="font-bold">{resetTarget.name}</span>
          </p>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <input type={showPwd ? 'text' : 'password'} className="input pr-9" value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)} placeholder="New password (min 6 characters)" />
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-pine/40 hover:text-pine">
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button className="btn-primary" onClick={resetPassword} disabled={busy || newPwd.length < 6}>
              <KeyRound size={14} /> {busy ? 'Saving…' : 'Set new password'}
            </button>
            <button className="btn-ghost" onClick={() => { setResetTarget(null); setNewPwd('') }}>Cancel</button>
          </div>
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">Full name</th><th className="th">Username</th>
            <th className="th">Role</th><th className="th">Status</th>
            {isAdminPlus && <th className="th text-center">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => editId === u.id ? (
            <tr key={u.id} className="bg-leaf/20">
              <td className="td"><input className="input !py-1" value={editF.full_name} onChange={(e) => setEditF({ ...editF, full_name: e.target.value })} /></td>
              <td className="td"><input className="input !py-1 money" value={editF.username} onChange={(e) => setEditF({ ...editF, username: e.target.value })} /></td>
              <td className="td">
                <select className="input !py-1 !w-44" value={editF.role} onChange={(e) => setEditF({ ...editF, role: e.target.value })}>
                  {availableRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </td>
              <td className="td"><span className="text-xs text-pine/40">—</span></td>
              <td className="td">
                <div className="flex gap-1 justify-center">
                  <button onClick={saveEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-forest/15 hover:bg-forest/30 text-forest"><Save size={13} /></button>
                  <button onClick={() => setEditId(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40">✕</button>
                </div>
              </td>
            </tr>
          ) : (
            <tr key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
              <td className="td text-sm font-medium">{u.full_name || '—'}</td>
              <td className="td text-sm money">{u.username || '—'}</td>
              <td className="td">
                <span className={`status-chip text-xs ${u.role === 'SUPERUSER' ? 'bg-purple-100 text-purple-700' : u.role === 'ADMIN' ? 'bg-forest/15 text-forest' : 'bg-leaf/50 text-pine'}`}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
              </td>
              <td className="td">
                <button onClick={() => toggle(u)} disabled={!isAdminPlus}
                  className={`status-chip ${u.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-500'} ${!isAdminPlus ? 'cursor-default opacity-60' : ''}`}>
                  {u.is_active ? 'Active' : 'Disabled'}
                </button>
              </td>
              {isAdminPlus && (
                <td className="td">
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => startEdit(u)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest"><Pencil size={13} /></button>
                    <button onClick={() => { setResetTarget({ id: u.id, name: u.full_name || u.username }); setNewPwd(''); setShowPwd(false) }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber/10 text-pine/40 hover:text-amber-600"><KeyRound size={13} /></button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  DATA WIPE — Superuser only                                          */
/* ------------------------------------------------------------------ */
const WIPE_MODULES = [
  {
    id: 'reservations', label: 'Reservations & Billing',
    description: 'Reservations, guests, folio charges, payments, invoices, quotations, VAT sales register, night audits, guest IDs, loyalty ledger, companies',
    tables: ['folio_charges', 'payments', 'invoices', 'quotations', 'reservation_addons', 'reservation_guests', 'reservation_rooms', 'reservations', 'guests', 'vat_sales_register', 'night_audits', 'guest_ids', 'loyalty_ledger', 'companies'],
    sequences: [
      { id: 'res_no_seq',        dependsOn: ['reservations'] },
      { id: 'quote_no_seq',      dependsOn: ['quotations'] },
      { id: 'guest_bill_seq',    dependsOn: ['invoices'] },
      { id: 'mushak_serial_seq', dependsOn: ['vat_sales_register'] },
      { id: 'cust_id_seq',       dependsOn: ['guests'] },
    ],
  },
  {
    id: 'pos', label: 'Restaurant POS',
    description: 'POS orders and order items',
    tables: ['pos_order_items', 'pos_orders'],
    sequences: [{ id: 'pos_no_seq', dependsOn: ['pos_orders'] }],
  },
  {
    id: 'facilities', label: 'Facilities',
    description: 'Facility sales (tea, pickle, sports, etc.)',
    tables: ['facility_sales'],
    sequences: [{ id: 'fac_no_seq', dependsOn: ['facility_sales'] }],
  },
  {
    id: 'hr', label: 'HR & Attendance',
    description: 'Employees, attendance records, leave applications, compensatory leave register, incident register',
    tables: ['comp_leave_register', 'leave_applications', 'attendance_records', 'employees', 'incident_register'],
    sequences: [{ id: 'emp_no_seq', dependsOn: ['employees'] }],
  },
  {
    id: 'inventory', label: 'Inventory & Procurement',
    description: 'Requisitions, purchase orders, goods receipts, stock transfers, stock returns, VAT purchase register, vendors, inventory stock items',
    tables: ['return_items', 'stock_returns', 'transfer_items', 'stock_transfers', 'grn_items', 'goods_receipts', 'po_items', 'purchase_orders', 'requisition_items', 'requisitions', 'vat_purchase_register', 'vendors', 'inv_items'],
    sequences: [
      { id: 'req_no_seq', dependsOn: ['requisitions'] },
      { id: 'po_no_seq',  dependsOn: ['purchase_orders'] },
      { id: 'grn_no_seq', dependsOn: ['goods_receipts'] },
      { id: 'trf_no_seq', dependsOn: ['stock_transfers'] },
      { id: 'rtn_no_seq', dependsOn: ['stock_returns'] },
    ],
  },
  {
    id: 'accounting', label: 'Accounting',
    description: 'Journal entries, journal lines, VAT registers, document register, fixed assets, depreciation, VDS certificates',
    tables: ['journal_lines', 'journal_entries', 'vat_sales_register', 'vat_purchase_register', 'doc_register', 'fixed_assets', 'asset_depreciation', 'vds_certificates'],
    sequences: [
      { id: 'jv_no_seq',  dependsOn: ['journal_entries'] },
      { id: 'doc_no_seq', dependsOn: ['doc_register'] },
      { id: 'fa_no_seq',  dependsOn: ['fixed_assets'] },
      { id: 'vds_certificates_id_seq', dependsOn: ['vds_certificates'] },
    ],
  },
]

const STEP_IDLE = 'idle', STEP_RUNNING = 'running', STEP_DONE = 'done', STEP_ERROR = 'error'

function DataWipeCard() {
  const [selected, setSelected]           = useState(null)
  const [checkedTables, setCheckedTables] = useState(new Set())
  const [confirm, setConfirm]             = useState('')
  const [expanded, setExpanded]           = useState(false)
  const [phase, setPhase]                 = useState('idle')
  const [steps, setSteps]                 = useState([])
  const [result, setResult]               = useState(null)
  const [errMsg, setErrMsg]               = useState('')

  const module = WIPE_MODULES.find((m) => m.id === selected)

  const selectModule = (id) => {
    if (phase === 'wiping') return
    if (selected === id) { setSelected(null); setCheckedTables(new Set()) }
    else { const m = WIPE_MODULES.find((mm) => mm.id === id); setSelected(id); setCheckedTables(new Set(m.tables)) }
    setConfirm(''); setPhase('idle'); setSteps([]); setResult(null); setErrMsg('')
  }
  const toggleTable       = (t) => { if (phase === 'wiping') return; setCheckedTables((prev) => { const next = new Set(prev); next.has(t) ? next.delete(t) : next.add(t); return next }) }
  const selectAllTables   = () => module && setCheckedTables(new Set(module.tables))
  const deselectAllTables = () => setCheckedTables(new Set())

  const tablesToWipe      = module ? module.tables.filter((t) => checkedTables.has(t)) : []
  const eligibleSequences = module ? module.sequences.filter((s) => s.dependsOn.every((t) => checkedTables.has(t))) : []
  const skippedSequences  = module ? module.sequences.filter((s) => !s.dependsOn.every((t) => checkedTables.has(t))) : []

  const startWipe = () => {
    if (!module || confirm.trim().toUpperCase() !== 'WIPE' || tablesToWipe.length === 0) return
    const allSteps = [
      ...tablesToWipe.map((t) => ({ id: t, label: t, type: 'table', state: STEP_IDLE, detail: '' })),
      ...eligibleSequences.map((s) => ({ id: s.id, label: s.id, type: 'sequence', state: STEP_IDLE, detail: '' })),
    ]
    setSteps(allSteps); setPhase('wiping')
    runWipe(allSteps, tablesToWipe, eligibleSequences.map((s) => s.id))
  }

  const runWipe = async (initialSteps, tables, sequences) => {
    const animated = [...initialSteps]
    for (let i = 0; i < animated.length; i++) {
      animated[i] = { ...animated[i], state: STEP_RUNNING }
      setSteps([...animated])
      await new Promise((r) => setTimeout(r, 120 + Math.random() * 80))
    }
    try {
      const { data, error } = await supabase.rpc('wipe_module', { tables, sequences })
      if (error) throw new Error(error.message)
      const rpcResult = data
      const errMap = {}; for (const e of rpcResult.errors || []) errMap[e.table || e.sequence] = e.error
      const clearedMap = {}; for (const c of rpcResult.tables_cleared || []) clearedMap[c.table] = c.rows_deleted
      const finalSteps = animated.map((s) => {
        if (s.type === 'table') {
          if (errMap[s.id]) return { ...s, state: STEP_ERROR, detail: errMap[s.id] }
          const rows = clearedMap[s.id]
          return { ...s, state: STEP_DONE, detail: rows !== undefined ? `${rows} rows deleted` : 'cleared' }
        } else {
          if (errMap[s.id]) return { ...s, state: STEP_ERROR, detail: errMap[s.id] }
          return { ...s, state: STEP_DONE, detail: 'reset to 1' }
        }
      })
      setSteps(finalSteps); setResult(rpcResult)
      setPhase(rpcResult.success ? 'done' : 'error')
      if (!rpcResult.success) setErrMsg(`${rpcResult.errors.length} step(s) failed.`)
    } catch (e) {
      setSteps(animated.map((s) => ({ ...s, state: STEP_ERROR, detail: e.message })))
      setPhase('error'); setErrMsg(e.message)
    }
  }

  const reset = () => { setSelected(null); setCheckedTables(new Set()); setConfirm(''); setPhase('idle'); setSteps([]); setResult(null); setErrMsg('') }

  return (
    <div className="card p-5 border border-red-200">
      <button className="w-full flex items-center justify-between text-left" onClick={() => setExpanded((v) => !v)}>
        <h2 className="font-display font-semibold text-red-600 flex items-center gap-2">
          <AlertTriangle size={18} /> Superuser: Data wipe
        </h2>
        {expanded ? <ChevronUp size={18} className="text-red-400" /> : <ChevronDown size={18} className="text-red-400" />}
      </button>
      {expanded && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-pine/70">Permanently delete selected data and reset sequences. <span className="font-semibold text-red-600">Cannot be undone.</span></p>
          <div className="grid grid-cols-1 gap-2">
            {WIPE_MODULES.map((m) => (
              <button key={m.id} onClick={() => selectModule(m.id)} disabled={phase === 'wiping'}
                className={`text-left p-3 rounded-xl border transition-colors ${selected === m.id ? 'border-red-400 bg-red-50' : 'border-leaf hover:border-red-300 hover:bg-red-50/30'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                <div className="font-medium text-sm text-pine">{m.label}</div>
                <div className="text-xs text-pine/50 mt-0.5">{m.description}</div>
              </button>
            ))}
          </div>
          {selected && module && phase === 'idle' && (
            <div className="p-4 rounded-xl border border-red-300 bg-red-50 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-semibold text-red-700">Wipe: <span className="underline">{module.label}</span></p>
                <div className="flex gap-2 text-xs">
                  <button onClick={selectAllTables} className="text-red-600 underline">Select all</button>
                  <span className="text-red-300">·</span>
                  <button onClick={deselectAllTables} className="text-red-600 underline">Deselect all</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-56 overflow-y-auto pr-1">
                {module.tables.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-xs text-pine cursor-pointer">
                    <input type="checkbox" className="accent-red-600 w-3.5 h-3.5" checked={checkedTables.has(t)} onChange={() => toggleTable(t)} />
                    <span className="font-mono">{t}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-red-500">{tablesToWipe.length} of {module.tables.length} tables · {eligibleSequences.length} sequences will reset</p>
              {skippedSequences.length > 0 && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  Not resetting: {skippedSequences.map((s) => `${s.id} (needs ${s.dependsOn.join(', ')} checked)`).join(' · ')}
                </p>
              )}
              <div>
                <label className="label text-red-700 !text-xs">Type <span className="font-mono font-bold">WIPE</span> to confirm</label>
                <input className="input border-red-300 focus:ring-red-400 max-w-xs" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="WIPE" autoComplete="off" spellCheck={false} />
              </div>
              <button className="btn-primary !bg-red-600 hover:!bg-red-700" onClick={startWipe} disabled={confirm.trim().toUpperCase() !== 'WIPE' || tablesToWipe.length === 0}>
                <AlertTriangle size={15} /> Start Wipe{tablesToWipe.length < module.tables.length ? ' (partial)' : ''}
              </button>
            </div>
          )}
          {steps.length > 0 && (
            <div className="rounded-xl border border-red-200 overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
                <div className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  {phase === 'wiping' && <span className="inline-block w-3 h-3 rounded-full bg-red-500 animate-ping" />}
                  {phase === 'done' && <span className="text-forest">✓</span>}
                  {phase === 'error' && <span className="text-red-600">✗</span>}
                  {phase === 'wiping' ? `Wiping ${module.label}…` : phase === 'done' ? 'Wipe complete' : 'Finished with errors'}
                </div>
                {(phase === 'done' || phase === 'error') && <button onClick={reset} className="text-xs text-pine/50 hover:text-pine underline">Reset</button>}
              </div>
              <div className="grid grid-cols-2 divide-x divide-red-100">
                <div className="p-3">
                  <div className="text-[10px] font-bold text-pine/40 uppercase tracking-wider mb-2">Tables</div>
                  <div className="space-y-1.5">
                    {steps.filter((s) => s.type === 'table').map((s) => (
                      <div key={s.id} className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0">
                          {s.state === STEP_IDLE    && <span className="inline-block w-3 h-3 rounded-full border-2 border-pine/20" />}
                          {s.state === STEP_RUNNING && <span className="inline-block w-3 h-3 rounded-full bg-red-400 animate-pulse" />}
                          {s.state === STEP_DONE    && <span className="inline-block w-3 h-3 rounded-full bg-forest" />}
                          {s.state === STEP_ERROR   && <span className="inline-block w-3 h-3 rounded-full bg-red-600" />}
                        </span>
                        <div>
                          <div className={`text-xs font-mono leading-tight ${s.state === STEP_DONE ? 'text-forest line-through opacity-60' : s.state === STEP_ERROR ? 'text-red-600' : s.state === STEP_RUNNING ? 'text-red-500 font-semibold' : 'text-pine/50'}`}>{s.label}</div>
                          {s.detail && s.state !== STEP_IDLE && <div className="text-[10px] text-pine/40 leading-tight">{s.detail}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-[10px] font-bold text-pine/40 uppercase tracking-wider mb-2">Sequences → reset to 1</div>
                  <div className="space-y-1.5">
                    {steps.filter((s) => s.type === 'sequence').map((s) => (
                      <div key={s.id} className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0">
                          {s.state === STEP_IDLE    && <span className="inline-block w-3 h-3 rounded-full border-2 border-pine/20" />}
                          {s.state === STEP_RUNNING && <span className="inline-block w-3 h-3 rounded-full bg-amber-400 animate-pulse" />}
                          {s.state === STEP_DONE    && <span className="inline-block w-3 h-3 rounded-full bg-forest" />}
                          {s.state === STEP_ERROR   && <span className="inline-block w-3 h-3 rounded-full bg-red-600" />}
                        </span>
                        <div>
                          <div className={`text-xs font-mono leading-tight ${s.state === STEP_DONE ? 'text-forest line-through opacity-60' : s.state === STEP_ERROR ? 'text-red-600' : s.state === STEP_RUNNING ? 'text-amber-600 font-semibold' : 'text-pine/50'}`}>{s.label}</div>
                          {s.detail && s.state !== STEP_IDLE && <div className="text-[10px] text-pine/40 leading-tight">{s.detail}</div>}
                        </div>
                      </div>
                    ))}
                    {steps.filter((s) => s.type === 'sequence').length === 0 && <div className="text-xs text-pine/40 italic">None eligible this run.</div>}
                  </div>
                </div>
              </div>
              {phase === 'done' && result && (
                <div className="px-4 py-3 bg-forest/10 border-t border-forest/20 flex flex-wrap gap-4 text-xs">
                  <span className="font-semibold text-forest">✓ Wipe successful</span>
                  <span className="text-pine/60">{result.tables_cleared?.length || 0} tables cleared</span>
                  <span className="text-pine/60">{result.sequences_reset?.length || 0} sequences reset</span>
                  <span className="text-pine/60">{result.tables_cleared?.reduce((sum, t) => sum + (t.rows_deleted || 0), 0)} rows deleted</span>
                </div>
              )}
              {phase === 'error' && <div className="px-4 py-3 bg-red-50 border-t border-red-200 text-xs text-red-600">✗ {errMsg}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
