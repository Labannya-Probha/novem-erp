import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtDate, todayISO } from '../lib/helpers'
import { ClipboardList, Building2, Users, Plus, X, CheckCircle2, Clock, AlertCircle, Search, ChevronLeft } from 'lucide-react'

export default function ComplianceTab({ role }) {
  const canAccess = role === 'ADMIN' || role === 'SUPERUSER'
  const [tab, setTab] = useState('catalog')

  if (!canAccess) {
    return (
      <div className="card p-6 text-center text-pine/60">
        <AlertCircle className="mx-auto mb-2 text-pine/30" size={28} />
        This section is restricted to Admin and Superuser roles.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-pine flex items-center gap-2">
          <ClipboardList className="text-forest" size={20} /> Statutory & HR Compliance
        </h2>
        <p className="text-sm text-pine/60">Bangladesh Labour Act 2006 / Labour Rules 2015, as amended 2026.</p>
      </div>
      <div className="flex gap-2 border-b border-leaf">
        {[
          { key: 'catalog', label: 'Catalog', icon: ClipboardList },
          { key: 'establishment', label: 'Establishment Filings', icon: Building2 },
          { key: 'employee', label: 'Employee Records', icon: Users },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium flex items-center gap-1.5 border-b-2 -mb-px ${tab === t.key ? 'border-forest text-forest' : 'border-transparent text-pine/50 hover:text-pine'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'catalog' && <CatalogView />}
      {tab === 'establishment' && <EstablishmentView />}
      {tab === 'employee' && <EmployeeView />}
    </div>
  )
}

function StatusChip({ status }) {
  const map = {
    PENDING: 'bg-stone-200 text-stone-600',
    FILED: 'bg-forest/15 text-forest',
    COMPLETED: 'bg-forest/15 text-forest',
    OVERDUE: 'bg-red-100 text-red-600',
    NOT_APPLICABLE: 'bg-stone-100 text-stone-400',
  }
  return <span className={`status-chip ${map[status] || 'bg-stone-200 text-stone-600'}`}>{status}</span>
}

function CatalogView() {
  const [items, setItems] = useState([])
  const [phase, setPhase] = useState('All')
  const [level, setLevel] = useState('All')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('statutory_compliance_items').select('*').order('phase').order('form_code')
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  const filtered = items.filter((i) =>
    (phase === 'All' || String(i.phase) === phase) &&
    (level === 'All' || i.level === level) &&
    (i.form_name + ' ' + (i.form_code || '') + ' ' + (i.category || '')).toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="space-y-3">
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <Search size={15} className="text-pine/40" />
        <input className="input !border-0 !ring-0 flex-1 !w-auto" placeholder="Search form, name, category..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-32" value={phase} onChange={(e) => setPhase(e.target.value)}>
          <option>All</option><option value="1">Phase 1</option><option value="2">Phase 2</option><option value="3">Phase 3</option>
        </select>
        <select className="input !w-40" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option>All</option><option value="ESTABLISHMENT">Establishment</option><option value="EMPLOYEE">Employee</option>
        </select>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr>
            <th className="th">Form</th><th className="th">Name</th><th className="th">Category</th>
            <th className="th">Level</th><th className="th">Frequency</th><th className="th">Phase</th><th className="th">Verification</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td className="td text-pine/40" colSpan={7}>Loading...</td></tr>}
            {!loading && filtered.map((i) => (
              <tr key={i.id} className={i.is_active ? '' : 'opacity-40'}>
                <td className="td text-sm font-medium">{i.form_code}</td>
                <td className="td text-sm">{i.form_name}{!i.is_active && <span className="ml-2 status-chip bg-stone-100 text-stone-400">Not applicable</span>}</td>
                <td className="td text-sm">{i.category || '—'}</td>
                <td className="td text-sm">{i.level === 'ESTABLISHMENT' ? 'Establishment' : 'Employee'}</td>
                <td className="td text-sm">{i.frequency.replace('_', ' ')}</td>
                <td className="td text-sm">Phase {i.phase}</td>
                <td className="td"><StatusChip status={i.verification_status === 'CONFIRMED' ? 'FILED' : 'PENDING'} /></td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && <tr><td className="td text-pine/40" colSpan={7}>No items match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EstablishmentView() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [logging, setLogging] = useState(null)

  const load = () => supabase.from('v_compliance_establishment_status').select('*').eq('is_active', true).order('phase').order('form_code')
    .then(({ data }) => { setItems(data || []); setLoading(false) })

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr>
            <th className="th">Form</th><th className="th">Name</th><th className="th">Frequency</th>
            <th className="th">Latest Period</th><th className="th">Due Date</th><th className="th">Status</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {loading && <tr><td className="td text-pine/40" colSpan={7}>Loading...</td></tr>}
            {!loading && items.map((i) => (
              <tr key={i.compliance_item_id}>
                <td className="td text-sm font-medium">{i.form_code}</td>
                <td className="td text-sm">{i.form_name}</td>
                <td className="td text-sm">{i.frequency.replace('_', ' ')}</td>
                <td className="td text-sm">{i.latest_period || '—'}</td>
                <td className="td text-sm">{i.latest_due_date ? fmtDate(i.latest_due_date) : '—'}</td>
                <td className="td"><StatusChip status={i.current_status} /></td>
                <td className="td"><button className="btn-ghost !py-1 !text-xs" onClick={() => setLogging(i)}><Plus size={12} /> Log Filing</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {logging && <LogFilingModal item={logging} onClose={() => setLogging(null)} onSaved={() => { setLogging(null); load() }} />}
    </div>
  )
}

function LogFilingModal({ item, onClose, onSaved }) {
  const [period, setPeriod] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [filedDate, setFiledDate] = useState(todayISO())
  const [status, setStatus] = useState('FILED')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!period.trim()) return
    setBusy(true)
    await supabase.from('statutory_filings').insert({
      compliance_item_id: item.compliance_item_id, period: period.trim(),
      due_date: dueDate || null, filed_date: filedDate || null, status, reference_no: referenceNo || null, notes: notes || null,
    })
    setBusy(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-start justify-center overflow-auto p-6">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full my-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-leaf">
          <h3 className="font-display font-semibold text-pine">Log Filing — {item.form_code}</h3>
          <button className="btn-ghost !py-1" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div><label className="label">Period (e.g. 2026-06 or 2026)</label><input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Due Date</label><input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div><label className="label">Filed Date</label><input type="date" className="input" value={filedDate} onChange={(e) => setFiledDate(e.target.value)} /></div>
          </div>
          <div><label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PENDING">Pending</option><option value="FILED">Filed</option><option value="OVERDUE">Overdue</option><option value="NOT_APPLICABLE">Not Applicable</option>
            </select>
          </div>
          <div><label className="label">Reference No</label><input className="input" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} /></div>
          <div><label className="label">Notes</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmployeeView() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null)

  useEffect(() => {
    supabase.from('v_compliance_employee_status').select('*').eq('is_active', true).order('phase').order('form_code')
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  if (active) return <EmployeeChecklist item={active} back={() => setActive(null)} />

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead><tr>
          <th className="th">Form</th><th className="th">Name</th><th className="th">Category</th>
          <th className="th text-right">Active Employees</th><th className="th text-right">Completed</th><th className="th"></th>
        </tr></thead>
        <tbody>
          {loading && <tr><td className="td text-pine/40" colSpan={6}>Loading...</td></tr>}
          {!loading && items.map((i) => (
            <tr key={i.compliance_item_id}>
              <td className="td text-sm font-medium">{i.form_code}</td>
              <td className="td text-sm">{i.form_name}</td>
              <td className="td text-sm">{i.category || '—'}</td>
              <td className="td text-sm text-right">{i.active_employees}</td>
              <td className="td text-sm text-right">{i.completed_count} / {i.active_employees}</td>
              <td className="td"><button className="btn-ghost !py-1 !text-xs" onClick={() => setActive(i)}>Manage</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmployeeChecklist({ item, back }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    supabase.from('employees').select('id, emp_code, full_name, designation, employee_compliance_records(id, status, record_date, reference_no, compliance_item_id)')
      .eq('status', 'ACTIVE').order('full_name')
      .then(({ data }) => {
        const mapped = (data || []).map((e) => ({
          ...e,
          record: (e.employee_compliance_records || []).find((r) => r.compliance_item_id === item.compliance_item_id) || null,
        }))
        setRows(mapped)
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [])

  const toggle = async (emp) => {
    if (emp.record && emp.record.status === 'COMPLETED') {
      await supabase.from('employee_compliance_records').update({ status: 'PENDING' }).eq('id', emp.record.id)
    } else if (emp.record) {
      await supabase.from('employee_compliance_records').update({ status: 'COMPLETED', record_date: todayISO() }).eq('id', emp.record.id)
    } else {
      await supabase.from('employee_compliance_records').insert({ compliance_item_id: item.compliance_item_id, employee_id: emp.id, status: 'COMPLETED', record_date: todayISO() })
    }
    load()
  }

  return (
    <div className="space-y-3">
      <button className="btn-ghost !py-1" onClick={back}><ChevronLeft size={15} /> Back</button>
      <div>
        <h3 className="font-display font-semibold text-pine">{item.form_code} — {item.form_name}</h3>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Emp Code</th><th className="th">Name</th><th className="th">Designation</th><th className="th">Status</th><th className="th"></th></tr></thead>
          <tbody>
            {loading && <tr><td className="td text-pine/40" colSpan={5}>Loading...</td></tr>}
            {!loading && rows.map((e) => (
              <tr key={e.id}>
                <td className="td text-sm">{e.emp_code}</td>
                <td className="td text-sm font-medium">{e.full_name}</td>
                <td className="td text-sm">{e.designation || '—'}</td>
                <td className="td"><StatusChip status={e.record ? e.record.status : 'PENDING'} /></td>
                <td className="td">
                  <button className="btn-ghost !py-1 !text-xs flex items-center gap-1" onClick={() => toggle(e)}>
                    {e.record && e.record.status === 'COMPLETED' ? <><CheckCircle2 size={12} /> Mark Pending</> : <><Clock size={12} /> Mark Completed</>}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td className="td text-pine/40" colSpan={5}>No active employees found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
