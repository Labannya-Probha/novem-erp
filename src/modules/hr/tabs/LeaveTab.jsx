import { useEffect, useState } from 'react'
import { supabase } from '../../../supabase'
import { fmtDate, todayISO } from '../../../lib/helpers'
import { Plus, Check, X } from 'lucide-react'

function LeaveApplications({ flash, userName, canApprove }) {
  const [emps, setEmps] = useState([])
  const [types, setTypes] = useState([])
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ employee_id: '', leave_type_id: '', from_date: todayISO(), to_date: todayISO(), reason: '' })

  const load = async () => {
    const [{ data: e }, { data: t }, { data: la }] = await Promise.all([
      supabase.from('employees').select('id, full_name, emp_code').eq('status', 'ACTIVE').order('full_name'),
      supabase.from('leave_types').select('*').order('name'),
      supabase.from('leave_applications').select('*, employees(full_name), leave_types(name, annual_days)').order('applied_at', { ascending: false }),
    ])
    setEmps(e || []); setTypes(t || []); setRows(la || [])
  }
  useEffect(() => { load() }, [])

  const days = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1)
  const apply = async () => {
    if (!f.employee_id || !f.leave_type_id) { flash('Pick employee and leave type.'); return }
    const { error } = await supabase.from('leave_applications').insert({ ...f, days: days(f.from_date, f.to_date) })
    if (error) flash(error.message)
    else { setF({ employee_id: '', leave_type_id: '', from_date: todayISO(), to_date: todayISO(), reason: '' }); load() }
  }
  const setStatus = async (id, status) => {
    await supabase.from('leave_applications').update({ status, approved_by: userName, approved_at: new Date().toISOString() }).eq('id', id)
    load()
  }
  const taken = (empId, typeId) =>
    rows.filter((r) => r.employee_id === empId && r.leave_type_id === typeId && r.status === 'APPROVED')
      .reduce((a, r) => a + +r.days, 0)

  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-6 gap-2">
        <select className="input col-span-2" value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })}>
          <option value="">Employee…</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        <select className="input" value={f.leave_type_id} onChange={(e) => setF({ ...f, leave_type_id: e.target.value })}>
          <option value="">Type…</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="date" className="input" value={f.from_date} onChange={(e) => setF({ ...f, from_date: e.target.value })} />
        <input type="date" className="input" value={f.to_date} onChange={(e) => setF({ ...f, to_date: e.target.value })} />
        <button className="btn-primary justify-center" onClick={apply}><Plus size={15} /> Apply</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Employee</th><th className="th">Type</th><th className="th">From → To</th><th className="th text-right">Days</th><th className="th text-right">Balance</th><th className="th">Status</th><th className="th"></th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const bal = (+r.leave_types?.annual_days || 0) - taken(r.employee_id, r.leave_type_id)
              return (
                <tr key={r.id}>
                  <td className="td text-sm">{r.employees?.full_name}</td>
                  <td className="td text-xs">{r.leave_types?.name}</td>
                  <td className="td money text-xs">{fmtDate(r.from_date)} → {fmtDate(r.to_date)}</td>
                  <td className="td money text-right">{r.days}</td>
                  <td className="td money text-right">{bal}</td>
                  <td className="td"><span className={`status-chip ${r.status === 'APPROVED' ? 'bg-forest/15 text-forest' : r.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-amber/20 text-amber'}`}>{r.status}</span></td>
                  <td className="td">{r.status === 'PENDING' && canApprove && (
                    <div className="flex gap-1">
                      <button className="text-forest" onClick={() => setStatus(r.id, 'APPROVED')}><Check size={15} /></button>
                      <button className="text-red-500" onClick={() => setStatus(r.id, 'REJECTED')}><X size={15} /></button>
                    </div>
                  )}</td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={7}>No leave applications.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CompLeave({ flash }) {
  const [emps, setEmps] = useState([])
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ employee_id: '', earned_date: todayISO(), days: 1, reason: '' })

  const load = async () => {
    const [{ data: e }, { data: c }] = await Promise.all([
      supabase.from('employees').select('id, full_name').eq('status', 'ACTIVE').order('full_name'),
      supabase.from('comp_leave_register').select('*, employees(full_name)').order('earned_date', { ascending: false }),
    ])
    setEmps(e || []); setRows(c || [])
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!f.employee_id) return
    const { error } = await supabase.from('comp_leave_register').insert({ ...f, days: +f.days })
    if (error) flash(error.message)
    else { setF({ employee_id: '', earned_date: todayISO(), days: 1, reason: '' }); load() }
  }
  const toggle = async (r) => {
    await supabase.from('comp_leave_register').update({ used: !r.used, used_date: !r.used ? todayISO() : null }).eq('id', r.id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-5 gap-2">
        <select className="input col-span-2" value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })}>
          <option value="">Employee…</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        <input type="date" className="input" value={f.earned_date} onChange={(e) => setF({ ...f, earned_date: e.target.value })} />
        <input className="input" placeholder="Reason (worked on holiday)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Earn</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Employee</th><th className="th">Earned</th><th className="th text-right">Days</th><th className="th">Reason</th><th className="th">Used</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="td text-sm">{r.employees?.full_name}</td>
                <td className="td money text-xs">{fmtDate(r.earned_date)}</td>
                <td className="td money text-right">{r.days}</td>
                <td className="td text-xs">{r.reason || '—'}</td>
                <td className="td"><button onClick={() => toggle(r)} className={`status-chip ${r.used ? 'bg-stone-200 text-stone-700' : 'bg-forest/15 text-forest'}`}>{r.used ? `Used ${r.used_date ? fmtDate(r.used_date) : ''}` : 'Available'}</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={5}>No compensatory leave recorded.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const SUB_VIEWS = [{ key: '', label: 'Leave Applications' }, { key: 'comp-leave', label: 'Compensatory Leave' }]

export default function LeaveTab({ flash, userName, canApprove, view, setView }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-leaf/60">
        {SUB_VIEWS.map((sv) => (
          <button key={sv.key} onClick={() => setView(sv.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t ${view === sv.key ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>
            {sv.label}
          </button>
        ))}
      </div>
      {view !== 'comp-leave'
        ? <LeaveApplications flash={flash} userName={userName} canApprove={canApprove} />
        : <CompLeave flash={flash} />}
    </div>
  )
}
