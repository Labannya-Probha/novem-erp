import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtDate, todayISO } from '../lib/helpers'
import { ShieldCheck, Filter, X } from 'lucide-react'

const SUBTABS = ['Catalog', 'Establishment Filings', 'Employee Records']

export default function ComplianceTab({ role }) {
  const canManage = role === 'ADMIN' || role === 'SUPERUSER'
  const [sub, setSub] = useState('Catalog')

  if (!canManage) {
    return <div className="card p-6 text-center text-pine/50">You do not have access to this section.</div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-pine flex items-center gap-2"><ShieldCheck className="text-forest" /> Statutory & HR Compliance</h2>
        <p className="text-sm text-pine/60">Bangladesh Labour Act 2006 / Labour Rules 2015, as amended 2026.</p>
      </div>
      <div className="flex gap-2 border-b border-leaf">
        {SUBTABS.map((s) => (
          <button key={s} onClick={() => setSub(s)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${sub === s ? 'border-forest text-forest' : 'border-transparent text-pine/50 hover:text-pine'}`}>
            {s}
          </button>
        ))}
      </div>
      {sub === 'Catalog' && <CatalogPanel />}
      {sub === 'Establishment Filings' && <EstablishmentPanel />}
      {sub === 'Employee Records' && <EmployeePanel />}
    </div>
  )
}

function CatalogPanel() {
  const [items, setItems] = useState([])
  const [phaseFilter, setPhaseFilter] = useState('All')
  const [catFilter, setCatFilter] = useState('All')
  const [levelFilter, setLevelFilter] = useState('All')

  useEffect(() => {
    supabase.from('statutory_compliance_items').select('*').order('phase').order('form_code')
      .then(({ data }) => setItems(data || []))
  }, [])

  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))].sort()
  const filtered = items.filter((i) =>
    (phaseFilter === 'All' || String(i.phase) === phaseFilter) &&
    (catFilter === 'All' || i.category === catFilter) &&
    (levelFilter === 'All' || i.level === levelFilter)
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-pine/40" />
        <select className="input !w-32" value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}>
          <option value="All">All Phases</option>
          <option value="1">Phase 1</option>
          <option value="2">Phase 2</option>
          <option value="3">Phase 3</option>
        </select>
        <select className="input !w-48" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="All">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input !w-40" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="All">All Levels</option>
          <option value="ESTABLISHMENT">Establishment</option>
          <option value="EMPLOYEE">Employee</option>
        </select>
        <span className="text-xs text-pine/40 ml-auto">{filtered.length} of {items.length}</span>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Form</th>
              <th className="th">Register / Document</th>
              <th className="th">Law Ref</th>
              <th className="th">Category</th>
              <th className="th">Level</th>
              <th className="th">Phase</th>
              <th className="th">Verification</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} className={i.is_active ? '' : 'opacity-40'}>
                <td className="td text-sm font-medium">{i.form_code}</td>
                <td className="td text-sm">{i.form_name}{!i.is_active && <span className="text-xs text-pine/40"> (inactive)</span>}</td>
                <td className="td text-xs text-pine/60">{i.law_reference}</td>
                <td className="td text-xs">{i.category}</td>
                <td className="td text-xs">{i.level === 'EMPLOYEE' ? 'Employee' : 'Establishment'}</td>
                <td className="td text-xs">Phase {i.phase}</td>
                <td className="td">
                  <span className={`status-chip ${i.verification_status === 'CONFIRMED' ? 'bg-forest/15 text-forest' : 'bg-amber/15 text-amber'}`}>
                    {i.verification_status === 'CONFIRMED' ? 'Confirmed' : 'Topic confirmed'}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td className="td text-pine/40" colSpan={7}>No items match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EstablishmentPanel() {
  const [items, setItems] = useState([])
  const [active, setActive] = useState(null)

  const load = () => supabase.from('v_compliance_establishment_status').select('*').eq('is_active', true).order('phase').order('form_code')
    .then(({ data }) => setItems(data || []))

  useEffect(() => { load() }, [])

  const statusColor = (s) => s === 'FILED' ? 'bg-forest/15 text-forest' : s === 'OVERDUE' ? 'bg-red-100 text-red-600' : s === 'NOT_APPLICABLE' ? 'bg-stone-200 text-stone-500' : 'bg-amber/15 text-amber'

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Form</th>
              <th className="th">Register</th>
              <th className="th">Frequency</th>
              <th className="th">Latest Period</th>
              <th className="th">Due Date</th>
              <th className="th">Status</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.compliance_item_id}>
                <td className="td text-sm font-medium">{i.form_code}</td>
                <td className="td text-sm">{i.form_name}</td>
                <td className="td text-xs">{i.frequency}</td>
                <td className="td text-xs">{i.latest_period || '—'}</td>
                <td className="td text-xs">{i.latest_due_date ? fmtDate(i.latest_due_date) : '—'}</td>
                <td className="td"><span className={`status-chip ${statusColor(i.current_status)}`}>{i.current_status}</span></td>
                <td className="td"><button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => setActive(i)}>Log Filing</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {active && <FilingModal item={active} onClose={() => setActive(null)} onSaved={() => { setActive(null); load() }} />}
    </div>
  )
}

function FilingModal({ item, onClose, onSaved }) {
  const [period, setPeriod] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [filedDate, setFiledDate] = useState(todayISO())
  const [filedBy, setFiledBy] = useState('')
  const [referenceNo, setReferenceNo] = useState('')
  const [status, setStatus] = useState('FILED')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!period.trim()) { setErr('Period is required, e.g. 2026-06 or 2026.'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('statutory_filings').insert({
      compliance_item_id: item.compliance_item_id,
      period: period.trim(),
      due_date: dueDate || null,
      filed_date: status === 'FILED' ? (filedDate || null) : null,
      filed_by: filedBy || null,
      reference_no: referenceNo || null,
      status,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-start justify-center overflow-auto p-6">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full my-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-leaf">
          <h3 className="font-display font-semibold text-pine">{item.form_code} — Log Filing</h3>
          <button className="btn-ghost !py-1" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          {err && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{err}</div>}
          <div><label className="label">Period (e.g. 2026-06 or 2026)</label><input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Due Date</label><input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div><label className="label">Status</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="FILED">Filed</option>
                <option value="PENDING">Pending</option>
                <option value="OVERDUE">Overdue</option>
                <option value="NOT_APPLICABLE">Not Applicable</option>
              </select>
            </div>
          </div>
          {status === 'FILED' && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Filed Date</label><input type="date" className="input" value={filedDate} onChange={(e) => setFiledDate(e.target.value)} /></div>
              <div><label className="label">Reference No</label><input className="input" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} /></div>
            </div>
          )}
          <div><label className="label">Filed By</label><input className="input" value={filedBy} onChange={(e) => setFiledBy(e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmployeePanel() {
  const [items, setItems] = useState([])
  const [active, setActive] = useState(null)

  useEffect(() => {
    supabase.from('v_compliance_employee_status').select('*').eq('is_active', true).order('phase').order('form_code')
      .then(({ data }) => setItems(data || []))
  }, [])

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Form</th>
              <th className="th">Document</th>
              <th className="th">Active Employees</th>
              <th className="th">Completed</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.compliance_item_id}>
                <td className="td text-sm font-medium">{i.form_code}</td>
                <td className="td text-sm">{i.form_name}</td>
                <td className="td text-sm">{i.active_employees}</td>
                <td className="td text-sm">{i.completed_count} / {i.active_employees}</td>
                <td className="td"><button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => setActive(i)}>View Checklist</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {active && <EmployeeChecklistModal item={active} onClose={() => setActive(null)} />}
    </div>
  )
}

function EmployeeChecklistModal({ item, onClose }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const { data: emps } = await supabase.from('employees').select('id, full_name, emp_code, status').eq('status', 'ACTIVE').order('full_name')
    const { data: recs } = await supabase.from('employee_compliance_records').select('employee_id, status, record_date, reference_no').eq('compliance_item_id', item.compliance_item_id)
    const recMap = {}
    for (const r of recs || []) recMap[r.employee_id] = r
    setRows((emps || []).map((e) => ({ ...e, rec: recMap[e.id] || null })))
  }

  useEffect(() => { load() }, [])

  const toggle = async (emp) => {
    setBusy(true)
    if (emp.rec) {
      const newStatus = emp.rec.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
      await supabase.from('employee_compliance_records').update({ status: newStatus, record_date: newStatus === 'COMPLETED' ? todayISO() : null }).eq('employee_id', emp.id).eq('compliance_item_id', item.compliance_item_id)
    } else {
      await supabase.from('employee_compliance_records').insert({ compliance_item_id: item.compliance_item_id, employee_id: emp.id, status: 'COMPLETED', record_date: todayISO() })
    }
    await load()
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-start justify-center overflow-auto p-6">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full my-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-leaf">
          <h3 className="font-display font-semibold text-pine">{item.form_code} — {item.form_name}</h3>
          <button className="btn-ghost !py-1" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-2 max-h-96 overflow-auto">
          {rows.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-leaf/50 last:border-0">
              <div>
                <div className="text-sm font-medium text-pine">{e.full_name}</div>
                <div className="text-xs text-pine/50">{e.emp_code}{e.rec && e.rec.record_date ? ` · ${fmtDate(e.rec.record_date)}` : ''}</div>
              </div>
              <button disabled={busy} onClick={() => toggle(e)}
                className={`status-chip ${e.rec && e.rec.status === 'COMPLETED' ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-500'}`}>
                {e.rec && e.rec.status === 'COMPLETED' ? 'Completed' : 'Mark Done'}
              </button>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-pine/40">No active employees found.</p>}
        </div>
      </div>
    </div>
  )
}
