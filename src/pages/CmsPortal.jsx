import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { loadReservationConfig, saveReservationConfig } from '../lib/reservationConfig'
import { fmtBDT } from '../lib/helpers'
import SearchableSelect from '../components/SearchableSelect.jsx'
import { Combobox } from '../components/ui/combobox'
import {
  Plus, Pencil, Trash2, Save, ShieldCheck, Search, X,
  Building2, Truck, Package, FolderTree, UtensilsCrossed, Calculator, Handshake, Users, BedDouble, CalendarRange,
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
    id: 'chart_of_accounts', table: 'chart_of_accounts', label: 'Chart of Accounts', icon: Calculator, orderBy: 'code', hasIsActive: true,
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'name', label: 'Account name', type: 'text', required: true },
      { key: 'type', label: 'Type', type: 'select', required: true, options: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] },
      { key: 'normal_side', label: 'Normal side', type: 'select', required: true, options: ['DEBIT', 'CREDIT'] },
      { key: 'subtype', label: 'Subtype', type: 'text' },
    ],
  },
  {
    id: 'rooms', table: 'rooms', label: 'Rooms', icon: BedDouble, orderBy: 'room_no', hasIsActive: true,
    fields: [
      { key: 'room_no', label: 'Room no', type: 'text', required: true },
      { key: 'room_name', label: 'Room name', type: 'text' },
      { key: 'room_type', label: 'Type', type: 'searchable', allowCreate: true, default: 'Standard' },
      { key: 'base_rate', label: 'Base rate', type: 'number', default: 0, format: 'money' },
    ],
  },
]

export const CMS_ENTITY_TABS = CMS_ENTITIES.map((e) => ({ id: e.id, label: e.label }))
const CMS_EXTRA_TABS = [{ id: 'reservation_policies', label: 'Reservation Policies', icon: CalendarRange }]
const CMS_TABS = [...CMS_ENTITY_TABS, ...CMS_EXTRA_TABS.map(({ id, label }) => ({ id, label }))]

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
  const [recordQuery, setRecordQuery] = useState('') // record-level search within this entity's table
  // Distinct values already used in any "searchable" (non-FK) text field — e.g. room_type —
  // so SearchableSelect can offer them as suggestions, same as a free-text autocomplete.
  const [searchOptions, setSearchOptions] = useState({})
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const load = async () => {
    const { data } = await supabase.from(entity.table).select('*').order(entity.orderBy || 'name', { ascending: true })
    setRows(data || [])
    // Build distinct-value suggestion lists for any 'searchable' field from the loaded rows
    const nextSearch = {}
    for (const fld of entity.fields) {
      if (fld.type === 'searchable') {
        const vals = Array.from(new Set((data || []).map((r) => r[fld.key]).filter(Boolean)))
        nextSearch[fld.key] = vals.sort().map((v) => ({ value: v, label: v }))
      }
    }
    setSearchOptions(nextSearch)
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
  useEffect(() => { load(); loadFkOptions(); setRecordQuery('') }, [entity.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (fld.type === 'searchable') {
      // Local addition (e.g. a brand-new room_type) is added on the fly to this field's
      // suggestion list so it immediately appears as selectable everywhere, without a reload.
      const opts = searchOptions[fld.key] || []
      return (
        <SearchableSelect
          options={opts}
          value={state[fld.key] ?? ''}
          onChange={(v) => onChange(v)}
          placeholder={fld.label}
          allowCreate={!!fld.allowCreate}
          onCreate={async (q) => {
            setSearchOptions((p) => ({
              ...p,
              [fld.key]: [...(p[fld.key] || []), { value: q, label: q }],
            }))
            return q
          }}
          clearable={!fld.required}
        />
      )
    }
    if (fld.type === 'select') {
      const opts = fld.fkTable ? (fkOptions[fld.key] || []) : (fld.options || [])
      return (
        <Combobox
          items={[
            { value: '', label: 'Select…' },
            ...(fld.fkTable
              ? opts.map((o) => ({ value: o.id, label: o[fld.fkLabel || 'name'] }))
              : opts.map((o) => ({ value: o, label: o }))),
          ]}
          value={state[fld.key] ?? ''}
          onChange={(v) => onChange(v)}
          placeholder="Select…"
        />
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

  // Record-level search — matches the query against every non-FK, non-checkbox
  // field's displayed value (case-insensitive substring). FK select fields are
  // matched against their resolved label (e.g. menu_items.category_id -> category name)
  // so searching "Beverages" finds menu items in that category too.
  const filteredRows = useMemo(() => {
    const q = recordQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      entity.fields.some((fld) => {
        if (fld.type === 'checkbox') return false
        const display = fld.type === 'select' && fld.fkTable ? fkLabelFor(fld, r[fld.key]) : r[fld.key]
        return String(display ?? '').toLowerCase().includes(q)
      })
    )
  }, [rows, recordQuery, entity.fields, fkOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="font-display font-semibold text-pine flex items-center gap-2">
          <entity.icon size={18} className="text-forest" /> {entity.label}
        </h2>
        <div className="relative w-56">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pine/30" />
          <input
            className="input !pl-8 !pr-7 !py-1.5 !text-sm"
            placeholder={`Search ${entity.label.toLowerCase()}…`}
            value={recordQuery}
            onChange={(e) => setRecordQuery(e.target.value)}
          />
          {recordQuery && (
            <button onClick={() => setRecordQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-pine/30 hover:text-pine">
              <X size={13} />
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-pine/50 mb-4">
        {recordQuery ? `${filteredRows.length} of ${rows.length} record${rows.length !== 1 ? 's' : ''} match` : `${rows.length} record${rows.length !== 1 ? 's' : ''}`}
      </p>
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
            {filteredRows.map((r) => editId === r.id ? (
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
            {rows.length > 0 && filteredRows.length === 0 && (
              <tr><td className="td text-center text-pine/40 text-sm py-6" colSpan={colSpan}>No records match "{recordQuery}".</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReservationPoliciesCard() {
  const [cfg, setCfg] = useState(() => loadReservationConfig())
  const [newBlackout, setNewBlackout] = useState('')
  const [policy, setPolicy] = useState({ name: '', type: 'percentage', value: '', note: '' })
  const [msg, setMsg] = useState('')

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }
  const persist = (nextCfg) => {
    const saved = saveReservationConfig(nextCfg)
    setCfg(saved)
    return saved
  }

  const addBlackout = () => {
    if (!newBlackout) { flash('Select a blackout date first.'); return }
    if (cfg.blackoutDays.includes(newBlackout)) { flash('This blackout date already exists.'); return }
    persist({ ...cfg, blackoutDays: [...cfg.blackoutDays, newBlackout].sort() })
    setNewBlackout('')
    flash('Blackout day added.')
  }

  const removeBlackout = (date) => {
    persist({ ...cfg, blackoutDays: cfg.blackoutDays.filter((d) => d !== date) })
  }

  const addPolicy = () => {
    const name = policy.name.trim()
    const raw = Number(policy.value)
    if (!name) { flash('Policy name is required.'); return }
    if (!Number.isFinite(raw) || raw < 0) { flash('Enter a valid discount value.'); return }
    if (policy.type === 'percentage' && raw > 100) { flash('Percentage policy must be between 0 and 100.'); return }
    persist({
      ...cfg,
      discountPolicies: [
        ...cfg.discountPolicies,
        {
          id: `policy-${Date.now()}`,
          name,
          type: policy.type,
          value: raw,
          note: policy.note.trim(),
          active: true,
        },
      ],
    })
    setPolicy({ name: '', type: 'percentage', value: '', note: '' })
    flash('Discount policy added.')
  }

  const togglePolicy = (id) => {
    persist({
      ...cfg,
      discountPolicies: cfg.discountPolicies.map((item) => item.id === id ? { ...item, active: !item.active } : item),
    })
  }

  const removePolicy = (id) => {
    persist({
      ...cfg,
      discountPolicies: cfg.discountPolicies.filter((item) => item.id !== id),
    })
  }

  return (
    <div className="card p-5 space-y-5">
      <div>
        <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-1">
          <CalendarRange size={18} className="text-forest" /> Reservation Policies
        </h2>
        <p className="text-xs text-pine/50">Set blackout days and reusable discount policies for reservation entry.</p>
      </div>

      {msg && <div className="px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3 rounded-xl border border-leaf bg-leaf/20">
          <div className="text-xs font-bold text-pine/60 uppercase tracking-wide mb-2">Blackout Days</div>
          <div className="flex gap-2">
            <input type="date" className="input flex-1" value={newBlackout} onChange={(e) => setNewBlackout(e.target.value)} />
            <button className="btn-primary !px-3" onClick={addBlackout}><Plus size={14} /> Add</button>
          </div>
          <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
            {cfg.blackoutDays.length === 0 && <p className="text-xs text-pine/50">No blackout day configured.</p>}
            {cfg.blackoutDays.map((date) => (
              <div key={date} className="flex items-center justify-between text-sm px-2 py-1 rounded border border-leaf bg-white">
                <span>{date}</span>
                <button className="text-red-500 hover:text-red-700" onClick={() => removeBlackout(date)} title="Remove blackout day">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-leaf bg-leaf/20">
          <div className="text-xs font-bold text-pine/60 uppercase tracking-wide mb-2">Discount Policies</div>
          <div className="space-y-2">
            <input className="input" placeholder="Policy name (e.g. Corporate 10%)" value={policy.name} onChange={(e) => setPolicy((p) => ({ ...p, name: e.target.value }))} />
            <div className="flex gap-2">
              <select className="input w-36" value={policy.type} onChange={(e) => setPolicy((p) => ({ ...p, type: e.target.value }))}>
                <option value="percentage">Percentage %</option>
                <option value="fixed">Fixed ৳</option>
              </select>
              <input type="number" min="0" max={policy.type === 'percentage' ? 100 : undefined} className="input money flex-1" placeholder={policy.type === 'percentage' ? '10' : '500'} value={policy.value} onChange={(e) => setPolicy((p) => ({ ...p, value: e.target.value }))} />
            </div>
            <input className="input" placeholder="Optional note/reason" value={policy.note} onChange={(e) => setPolicy((p) => ({ ...p, note: e.target.value }))} />
            <button className="btn-primary w-full justify-center" onClick={addPolicy}><Plus size={14} /> Add Policy</button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Name</th>
              <th className="th">Type</th>
              <th className="th text-right">Value</th>
              <th className="th">Note</th>
              <th className="th">Status</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {cfg.discountPolicies.map((item) => (
              <tr key={item.id}>
                <td className="td text-sm font-medium">{item.name}</td>
                <td className="td text-sm">{item.type === 'fixed' ? 'Fixed' : 'Percentage'}</td>
                <td className="td money text-right">{item.type === 'fixed' ? fmtBDT(item.value) : `${item.value}%`}</td>
                <td className="td text-xs">{item.note || '—'}</td>
                <td className="td">
                  <button className={`status-chip ${item.active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-600'}`} onClick={() => togglePolicy(item.id)}>
                    {item.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="td">
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-300 hover:text-red-600" onClick={() => removePolicy(item.id)} title="Delete policy">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {cfg.discountPolicies.length === 0 && <tr><td className="td text-pine/40 text-center" colSpan={6}>No discount policy configured.</td></tr>}
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
  const location = useLocation()
  const isSuperuser = role === 'SUPERUSER'
  const isAdminPlus = isSuperuser || isAdmin
  const [selectedId, setSelectedId] = useState(CMS_TABS[0].id)

  if (!isAdminPlus) {
    return (
      <div className="card p-8 max-w-xl">
        <h1 className="font-display text-xl font-bold text-pine mb-2 flex items-center gap-2">
          <ShieldCheck size={20} /> Access restricted
        </h1>
        <p className="text-sm text-pine/60">Configuration can only be accessed by administrators.</p>
      </div>
    )
  }

  const entity = CMS_ENTITIES.find((e) => e.id === selectedId) || CMS_ENTITIES[0]

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('entity')
    if (requested && CMS_TABS.some((t) => t.id === requested)) {
      setSelectedId(requested)
    }
  }, [location.search])

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-pine mb-1">Configuration</h1>
      <p className="text-sm text-pine/60 mb-6">Create and edit master records used across Reservations, POS, Inventory and Accounting.</p>
      <div>
        {selectedId === 'reservation_policies'
          ? <ReservationPoliciesCard />
          : <EntityManager key={entity.id} entity={entity} />
        }
      </div>
    </div>
  )
}
