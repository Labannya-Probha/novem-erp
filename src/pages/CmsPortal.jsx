import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT } from '../lib/helpers'
import {
  Plus, Pencil, Trash2, Save, ShieldCheck,
  Building2, Truck, Package, FolderTree, UtensilsCrossed, Sparkles, Calculator, Handshake, Users,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  ENTITY CONFIG — single source of truth for every CMS-managed table  */
/*  Add a new entity here and the manager UI (add/edit/delete/list)     */
/*  is generated automatically — no new component needed.               */
/* ------------------------------------------------------------------ */
const CMS_ENTITIES = [
  {
    id: 'companies', table: 'companies', label: 'Companies', icon: Building2, orderBy: 'name', hasIsActive: true,
    fields: [
      { key: 'name', label: 'Company name', type: 'text', required: true },
      { key: 'contact_person', label: 'Contact person', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'address', label: 'Address', type: 'text' },
    ],
  },
  {
    id: 'agencies', table: 'agencies', label: 'Agencies', icon: Handshake, orderBy: 'name', hasIsActive: false,
    fields: [
      { key: 'name', label: 'Agency name', type: 'text', required: true },
      { key: 'commission_rate', label: 'Commission %', type: 'number', default: 0, format: 'percent' },
      { key: 'due_balance', label: 'Due balance', type: 'number', default: 0, format: 'money' },
    ],
  },
  {
    id: 'shareholders', table: 'shareholders', label: 'Shareholders', icon: Users, orderBy: 'name', hasIsActive: false,
    fields: [
      { key: 'name', label: 'Shareholder name', type: 'text', required: true },
      { key: 'commission_rate', label: 'Commission %', type: 'number', default: 0, format: 'percent' },
      { key: 'free_stay_balance', label: 'Free stay balance', type: 'number', default: 0 },
    ],
  },
  {
    id: 'vendors', table: 'vendors', label: 'Vendors', icon: Truck, orderBy: 'name', hasIsActive: true,
    fields: [
      { key: 'name', label: 'Vendor name', type: 'text', required: true },
      { key: 'bin', label: 'BIN', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'address', label: 'Address', type: 'text' },
    ],
  },
  {
    id: 'inv_items', table: 'inv_items', label: 'Inventory Items', icon: Package, orderBy: 'name', hasIsActive: true,
    fields: [
      { key: 'code', label: 'Code', type: 'text' },
      { key: 'name', label: 'Item name', type: 'text', required: true },
      { key: 'unit', label: 'Unit', type: 'text', default: 'pc' },
      { key: 'category', label: 'Category', type: 'text', default: 'GENERAL' },
      { key: 'reorder_level', label: 'Reorder level', type: 'number', default: 0 },
    ],
  },
  {
    id: 'menu_categories', table: 'menu_categories', label: 'Menu Categories', icon: FolderTree, orderBy: 'sort_order', hasIsActive: true,
    fields: [
      { key: 'name', label: 'Category name', type: 'text', required: true },
      { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
    ],
  },
  {
    id: 'menu_items', table: 'menu_items', label: 'Menu Items', icon: UtensilsCrossed, orderBy: 'sort_order', hasIsActive: true,
    fields: [
      { key: 'category_id', label: 'Category', type: 'select', required: true, fkTable: 'menu_categories', fkLabel: 'name' },
      { key: 'name', label: 'Item name', type: 'text', required: true },
      { key: 'price', label: 'Price', type: 'number', required: true, default: 0, format: 'money' },
      { key: 'measuring_units', label: 'Unit', type: 'text' },
      { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 },
    ],
  },
  {
    id: 'facility_items', table: 'facility_items', label: 'Facility Items', icon: Sparkles, orderBy: 'name', hasIsActive: true,
    fields: [
      { key: 'category', label: 'Category', type: 'select', required: true, options: ['TEA', 'PICKLE', 'SPORTS'] },
      { key: 'name', label: 'Item name', type: 'text', required: true },
      { key: 'unit', label: 'Unit', type: 'text', default: 'pc' },
      { key: 'default_price', label: 'Default price', type: 'number', default: 0, format: 'money' },
      { key: 'charge_type', label: 'Charge type', type: 'text', default: 'OTHER' },
      { key: 'pricing_mode', label: 'Pricing mode', type: 'text', default: 'PER_UNIT' },
      { key: 'is_rental', label: 'Rental item', type: 'checkbox' },
    ],
  },
  {
    id: 'chart_of_accounts', table: 'chart_of_accounts', label: 'Chart of Accounts', icon: Calculator, orderBy: 'code', hasIsActive: true,
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'name', label: 'Account name', type: 'text', required: true },
      { key: 'type', label: 'Type', type: 'select', required: true, options: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] },
      { key: 'normal_side', label: 'Normal side', type: 'select', required: true, options: ['DEBIT', 'CREDIT'] },
      { key: 'subtype', label: 'Subtype', type: 'text' },
    ],
  },
]

function emptyForm(entity) {
  const obj = {}
  for (const fld of entity.fields) {
    obj[fld.key] = fld.default !== undefined ? fld.default : (fld.type === 'number' ? '' : fld.type === 'checkbox' ? false : '')
  }
  return obj
}

/* ------------------------------------------------------------------ */
/*  ENTITY MANAGER — generic add / inline-edit / delete table, driven   */
/*  entirely by one entity's field config from CMS_ENTITIES above       */
/* ------------------------------------------------------------------ */
function EntityManager({ entity }) {
  const [rows, setRows]         = useState([])
  const [msg, setMsg]           = useState('')
  const [editId, setEditId]     = useState(null)
  const [editF, setEditF]       = useState({})
  const [f, setF]               = useState(() => emptyForm(entity))
  const [fkOptions, setFkOptions] = useState({})
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const load = async () => {
    const { data } = await supabase.from(entity.table).select('*').order(entity.orderBy || 'name', { ascending: true })
    setRows(data || [])
  }
  const loadFkOptions = async () => {
    const next = {}
    for (const fld of entity.fields) {
      if (fld.fkTable) {
        const { data } = await supabase.from(fld.fkTable).select(`id, ${fld.fkLabel || 'name'}`).order(fld.fkLabel || 'name')
        next[fld.key] = data || []
      }
    }
    setFkOptions(next)
  }
  useEffect(() => { load(); loadFkOptions() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const buildPayload = (state) => {
    const payload = {}
    for (const fld of entity.fields) {
      let v = state[fld.key]
      if (fld.type === 'number') v = (v === '' || v === undefined || v === null) ? (fld.default ?? 0) : +v
      else if (fld.type === 'checkbox') v = !!v
      else v = (v ?? '').toString().trim() || (fld.default !== undefined ? fld.default : null)
      payload[fld.key] = v
    }
    return payload
  }

  const add = async () => {
    const missing = entity.fields.filter((fld) => fld.required && !String(f[fld.key] ?? '').trim())
    if (missing.length) { flash(`Required: ${missing.map((m) => m.label).join(', ')}`); return }
    const { error } = await supabase.from(entity.table).insert(buildPayload(f))
    if (error) flash(error.message)
    else { setF(emptyForm(entity)); load(); flash('Added.') }
  }

  const startEdit = (r) => {
    setEditId(r.id)
    const obj = {}
    for (const fld of entity.fields) obj[fld.key] = r[fld.key]
    setEditF(obj)
  }
  const saveEdit = async () => {
    const missing = entity.fields.filter((fld) => fld.required && !String(editF[fld.key] ?? '').trim())
    if (missing.length) { flash(`Required: ${missing.map((m) => m.label).join(', ')}`); return }
    const { error } = await supabase.from(entity.table).update(buildPayload(editF)).eq('id', editId)
    if (error) flash(error.message); else { setEditId(null); load(); flash('Updated.') }
  }
  const del = async (id) => {
    const { error } = await supabase.from(entity.table).delete().eq('id', id)
    if (error) flash('This record is linked elsewhere and cannot be deleted.')
    else load()
  }
  const toggleActive = async (r) => { await supabase.from(entity.table).update({ is_active: !r.is_active }).eq('id', r.id); load() }

  const fkLabelFor = (fld, id) => {
    const match = (fkOptions[fld.key] || []).find((o) => o.id === id)
    return match ? match[fld.fkLabel || 'name'] : '—'
  }
  const displayValue = (fld, val) => {
    if (fld.type === 'select' && fld.fkTable) return fkLabelFor(fld, val)
    if (fld.type === 'checkbox') return val ? 'Yes' : 'No'
    if (fld.format === 'money') return fmtBDT(val || 0)
    if (fld.format === 'percent') return `${val || 0}%`
    return (val || val === 0) ? val : '—'
  }
  const renderInput = (fld, state, onChange) => {
    if (fld.type === 'select') {
      const opts = fld.fkTable ? (fkOptions[fld.key] || []) : (fld.options || [])
      return (
        <select className="input" value={state[fld.key] ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {fld.fkTable
            ? opts.map((o) => <option key={o.id} value={o.id}>{o[fld.fkLabel || 'name']}</option>)
            : opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    if (fld.type === 'checkbox') {
      return (
        <label className="flex items-center gap-2 text-sm text-pine h-[38px] whitespace-nowrap">
          <input type="checkbox" className="accent-forest w-4 h-4" checked={!!state[fld.key]} onChange={(e) => onChange(e.target.checked)} />
          {fld.label}
        </label>
      )
    }
    if (fld.type === 'number') {
      return <input type="number" className="input money" value={state[fld.key] ?? ''} onChange={(e) => onChange(e.target.value)} />
    }
    return <input className="input" value={state[fld.key] ?? ''} onChange={(e) => onChange(e.target.value)} />
  }

  const colSpan = entity.fields.length + (entity.hasIsActive ? 2 : 1)

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-1">
        <entity.icon size={18} className="text-forest" /> {entity.label}
      </h2>
      <p className="text-xs text-pine/50 mb-4">{rows.length} record{rows.length !== 1 ? 's' : ''}</p>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}

      <div className="flex flex-wrap gap-2 mb-4 items-end p-3 bg-leaf/20 rounded-xl">
        {entity.fields.map((fld) => (
          <div key={fld.key} className="flex-1 min-w-[140px]">
            {fld.type !== 'checkbox' && (
              <label className="label !mb-1 !text-[11px]">{fld.label}{fld.required && <span className="text-red-500"> *</span>}</label>
            )}
            {renderInput(fld, f, (v) => setF((p) => ({ ...p, [fld.key]: v })))}
          </div>
        ))}
        <button className="btn-primary justify-center shrink-0" onClick={add}><Plus size={15} /> Add</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {entity.fields.map((fld) => <th key={fld.key} className="th">{fld.label}</th>)}
              {entity.hasIsActive && <th className="th">Status</th>}
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => editId === r.id ? (
              <tr key={r.id} className="bg-leaf/20">
                {entity.fields.map((fld) => (
                  <td key={fld.key} className="td !py-1.5">{renderInput(fld, editF, (v) => setEditF((p) => ({ ...p, [fld.key]: v })))}</td>
                ))}
                {entity.hasIsActive && <td className="td"><span className="text-xs text-pine/40">—</span></td>}
                <td className="td">
                  <div className="flex gap-1">
                    <button onClick={saveEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-forest/15 hover:bg-forest/30 text-forest" title="Save"><Save size={13} /></button>
                    <button onClick={() => setEditId(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40" title="Cancel">✕</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={r.id} className={entity.hasIsActive && !r.is_active ? 'opacity-50' : ''}>
                {entity.fields.map((fld) => (
                  <td key={fld.key} className="td text-sm">{displayValue(fld, r[fld.key])}</td>
                ))}
                {entity.hasIsActive && (
                  <td className="td">
                    <button onClick={() => toggleActive(r)} className={`status-chip ${r.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-600'}`}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                )}
                <td className="td">
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(r)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest" title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => del(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-300 hover:text-red-600" title="Delete"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="td text-center text-pine/40 text-sm py-6" colSpan={colSpan}>No records yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ROOT — Admin & Superuser only                                       */
/* ------------------------------------------------------------------ */
export default function CmsPortal({ role, isAdmin }) {
  const isSuperuser = role === 'SUPERUSER'
  const isAdminPlus = isSuperuser || isAdmin
  const [selectedId, setSelectedId] = useState(CMS_ENTITIES[0].id)

  if (!isAdminPlus) {
    return (
      <div className="card p-8 max-w-xl">
        <h1 className="font-display text-xl font-bold text-pine mb-2 flex items-center gap-2">
          <ShieldCheck size={20} /> Access restricted
        </h1>
        <p className="text-sm text-pine/60">Client Management can only be accessed by administrators.</p>
      </div>
    )
  }

  const entity = CMS_ENTITIES.find((e) => e.id === selectedId)

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-pine mb-1">Client Management</h1>
      <p className="text-sm text-pine/60 mb-6">Create and edit master records used across Reservations, POS, Inventory and Accounting.</p>
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5 items-start">
        <div className="card p-3 space-y-1 lg:sticky lg:top-6">
          {CMS_ENTITIES.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedId(e.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors ${
                selectedId === e.id ? 'bg-forest/15 text-forest' : 'text-pine/70 hover:bg-leaf/40'
              }`}
            >
              <e.icon size={16} /> {e.label}
            </button>
          ))}
        </div>
        <EntityManager key={entity.id} entity={entity} />
      </div>
    </div>
  )
}
