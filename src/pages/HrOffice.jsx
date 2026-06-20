import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO } from '../lib/helpers'
import { Users, Plus, Check, X, CalendarDays, FileText, Wallet, Printer } from 'lucide-react'
import PrintPortal from '../components/PrintPortal.jsx'

const TABS = ['Employees', 'Attendance', 'Leave', 'Comp Leave', 'Payroll', 'Incidents', 'Letters / Docket']

export default function HrOffice({ userName, role, isAdmin, company }) {
  const [tab, setTab] = useState('Employees')
  const [msg, setMsg] = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 5000) }
  const canApprove = isAdmin || role === 'MANAGER' || role === 'HR'
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2"><Users className="text-forest" /> HR & Office</h1>
        <p className="text-sm text-pine/60">Employee records, attendance, leave, payroll, incidents and the office document register.</p>
      </div>
      {msg && <div className="px-4 py-3 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}
      <div className="flex gap-1 border-b border-leaf flex-wrap">
        {TABS.map((t) => (<button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${tab === t ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>{t}</button>))}
      </div>
      {tab === 'Employees' && <EmployeesTab flash={flash} isAdmin={isAdmin} />}
      {tab === 'Attendance' && <AttendanceTab flash={flash} />}
      {tab === 'Leave' && <LeaveTab flash={flash} userName={userName} canApprove={canApprove} />}
      {tab === 'Comp Leave' && <CompLeaveTab flash={flash} />}
      {tab === 'Payroll' && <PayrollTab flash={flash} userName={userName} canApprove={canApprove} isAdmin={isAdmin} company={company} />}
      {tab === 'Incidents' && <IncidentsTab flash={flash} userName={userName} />}
      {tab === 'Letters / Docket' && <DocketTab flash={flash} userName={userName} />}
    </div>
  )
}

function EmployeesTab({ flash, isAdmin }) {
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ full_name: '', designation: '', department: '', join_date: todayISO(), phone: '', gross_salary: '' })
  const load = async () => { const { data } = await supabase.from('employees').select('*').order('created_at'); setRows(data || []) }
  useEffect(() => { load() }, [])
  const add = async () => { if (!f.full_name) return; const { error } = await supabase.from('employees').insert({ ...f, gross_salary: +f.gross_salary || 0 }); if (error) flash(error.message); else { setF({ full_name: '', designation: '', department: '', join_date: todayISO(), phone: '', gross_salary: '' }); load() } }
  const setStatus = async (id, status) => { await supabase.from('employees').update({ status }).eq('id', id); load() }
  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-6 gap-2">
        <input className="input col-span-2" placeholder="Full name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        <input className="input" placeholder="Designation" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} />
        <input className="input" placeholder="Department" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} />
        <input type="number" className="input money" placeholder="Gross salary" value={f.gross_salary} onChange={(e) => setF({ ...f, gross_salary: e.target.value })} />
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Add</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Code</th><th className="th">Name</th><th className="th">Designation</th><th className="th">Dept</th><th className="th text-right">Gross</th><th className="th">Status</th></tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="td money text-xs">{e.emp_code}</td><td className="td text-sm font-medium">{e.full_name}</td>
                <td className="td text-sm">{e.designation || '—'}</td><td className="td text-xs">{e.department || '—'}</td>
                <td className="td money text-right">{fmtBDT(e.gross_salary)}</td>
                <td className="td">{isAdmin ? <select className="input !py-1 !w-32" value={e.status} onChange={(ev) => setStatus(e.id, ev.target.value)}>{['ACTIVE', 'RESIGNED', 'TERMINATED'].map((s) => <option key={s}>{s}</option>)}</select> : <span className={`status-chip ${e.status === 'ACTIVE' ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-700'}`}>{e.status}</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={6}>No employees yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AttendanceTab({ flash }) {
  const [emps, setEmps] = useState([])
  const [date, setDate] = useState(todayISO())
  const [recs, setRecs] = useState({})
  const load = async () => {
    const [{ data: e }, { data: a }] = await Promise.all([
      supabase.from('employees').select('*').eq('status', 'ACTIVE').order('full_name'),
      supabase.from('attendance_records').select('*').eq('att_date', date),
    ])
    setEmps(e || [])
    setRecs(Object.fromEntries((a || []).map((r) => [r.employee_id, r.status])))
  }
  useEffect(() => { load() }, [date])
  const mark = async (empId, status) => {
    setRecs((p) => ({ ...p, [empId]: status }))
    const { error } = await supabase.from('attendance_records').upsert({ employee_id: empId, att_date: date, status }, { onConflict: 'employee_id,att_date' })
    if (error) flash(error.message)
  }
  const STAT = [['P', 'Present'], ['A', 'Absent'], ['L', 'Leave'], ['H', 'Holiday'], ['OFF', 'Off']]
  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center gap-3"><CalendarDays size={16} className="text-forest" /><span className="label !mb-0">Date</span><input type="date" className="input !w-44" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Code</th><th className="th">Employee</th><th className="th">Mark</th></tr></thead>
          <tbody>
            {emps.map((e) => (
              <tr key={e.id}>
                <td className="td money text-xs">{e.emp_code}</td><td className="td text-sm font-medium">{e.full_name}</td>
                <td className="td"><div className="flex gap-1">{STAT.map(([s, label]) => (<button key={s} onClick={() => mark(e.id, s)} title={label} className={`px-2.5 py-1 rounded text-xs font-bold ${recs[e.id] === s ? (s === 'A' ? 'bg-red-500 text-white' : 'bg-forest text-white') : 'bg-leaf/50 text-pine/70 hover:bg-leaf'}`}>{s}</button>))}</div></td>
              </tr>
            ))}
            {emps.length === 0 && <tr><td className="td text-pine/40" colSpan={3}>No active employees.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LeaveTab({ flash, userName, canApprove }) {
  const [emps, setEmps] = useState([]); const [types, setTypes] = useState([]); const [rows, setRows] = useState([])
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
    if (error) flash(error.message); else { setF({ employee_id: '', leave_type_id: '', from_date: todayISO(), to_date: todayISO(), reason: '' }); load() }
  }
  const setStatus = async (id, status) => { await supabase.from('leave_applications').update({ status, approved_by: userName, approved_at: new Date().toISOString() }).eq('id', id); load() }
  const taken = (empId, typeId) => rows.filter((r) => r.employee_id === empId && r.leave_type_id === typeId && r.status === 'APPROVED').reduce((a, r) => a + +r.days, 0)
  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-6 gap-2">
        <select className="input col-span-2" value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })}><option value="">Employee…</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select>
        <select className="input" value={f.leave_type_id} onChange={(e) => setF({ ...f, leave_type_id: e.target.value })}><option value="">Type…</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <input type="date" className="input" value={f.from_date} onChange={(e) => setF({ ...f, from_date: e.target.value })} />
        <input type="date" className="input" value={f.to_date} onChange={(e) => setF({ ...f, to_date: e.target.value })} />
        <button className="btn-primary justify-center" onClick={apply}><Plus size={15} /> Apply</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Employee</th><th className="th">Type</th><th className="th">From → To</th><th className="th text-right">Days</th><th className="th text-right">Balance</th><th className="th">Status</th><th className="th"></th></tr></thead>
          <tbody>
            {rows.map((r) => { const bal = (+r.leave_types?.annual_days || 0) - taken(r.employee_id, r.leave_type_id); return (
              <tr key={r.id}>
                <td className="td text-sm">{r.employees?.full_name}</td><td className="td text-xs">{r.leave_types?.name}</td>
                <td className="td money text-xs">{fmtDate(r.from_date)} → {fmtDate(r.to_date)}</td><td className="td money text-right">{r.days}</td>
                <td className="td money text-right">{bal}</td>
                <td className="td"><span className={`status-chip ${r.status === 'APPROVED' ? 'bg-forest/15 text-forest' : r.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-amber/20 text-amber'}`}>{r.status}</span></td>
                <td className="td">{r.status === 'PENDING' && canApprove && (<div className="flex gap-1"><button className="text-forest" onClick={() => setStatus(r.id, 'APPROVED')}><Check size={15} /></button><button className="text-red-500" onClick={() => setStatus(r.id, 'REJECTED')}><X size={15} /></button></div>)}</td>
              </tr>) })}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={7}>No leave applications.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CompLeaveTab({ flash }) {
  const [emps, setEmps] = useState([]); const [rows, setRows] = useState([])
  const [f, setF] = useState({ employee_id: '', earned_date: todayISO(), days: 1, reason: '' })
  const load = async () => {
    const [{ data: e }, { data: c }] = await Promise.all([
      supabase.from('employees').select('id, full_name').eq('status', 'ACTIVE').order('full_name'),
      supabase.from('comp_leave_register').select('*, employees(full_name)').order('earned_date', { ascending: false }),
    ])
    setEmps(e || []); setRows(c || [])
  }
  useEffect(() => { load() }, [])
  const add = async () => { if (!f.employee_id) return; const { error } = await supabase.from('comp_leave_register').insert({ ...f, days: +f.days }); if (error) flash(error.message); else { setF({ employee_id: '', earned_date: todayISO(), days: 1, reason: '' }); load() } }
  const toggle = async (r) => { await supabase.from('comp_leave_register').update({ used: !r.used, used_date: !r.used ? todayISO() : null }).eq('id', r.id); load() }
  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-5 gap-2">
        <select className="input col-span-2" value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })}><option value="">Employee…</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select>
        <input type="date" className="input" value={f.earned_date} onChange={(e) => setF({ ...f, earned_date: e.target.value })} />
        <input className="input" placeholder="Reason (worked on holiday)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Earn</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Employee</th><th className="th">Earned</th><th className="th text-right">Days</th><th className="th">Reason</th><th className="th">Used</th></tr></thead>
          <tbody>
            {rows.map((r) => (<tr key={r.id}><td className="td text-sm">{r.employees?.full_name}</td><td className="td money text-xs">{fmtDate(r.earned_date)}</td><td className="td money text-right">{r.days}</td><td className="td text-xs">{r.reason || '—'}</td><td className="td"><button onClick={() => toggle(r)} className={`status-chip ${r.used ? 'bg-stone-200 text-stone-700' : 'bg-forest/15 text-forest'}`}>{r.used ? `Used ${r.used_date ? fmtDate(r.used_date) : ''}` : 'Available'}</button></td></tr>))}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={5}>No compensatory leave recorded.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  PAYROLL TAB — generate a monthly run, review/edit payslips, print  */
/* ------------------------------------------------------------------ */
// Salary-head split mirrors the gazette-compliant structure used for
// Novem's salary workbook: Basic 60% / House Rent 25% / Medical 10% /
// Conveyance 5% of gross. This is a sensible default split, not a legal
// requirement — adjust the percentages below if your structure differs.
const SPLIT = { basic: 0.60, house_rent: 0.25, medical: 0.10, conveyance: 0.05 }
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function PayrollTab({ flash, userName, canApprove, isAdmin, company }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [runs, setRuns] = useState([])
  const [active, setActive] = useState(null)
  const [slips, setSlips] = useState([])
  const [busy, setBusy] = useState(false)
  const [printSlip, setPrintSlip] = useState(null)

  const loadRuns = async () => {
    const { data } = await supabase.from('payroll_runs').select('*').order('period_year', { ascending: false }).order('period_month', { ascending: false })
    setRuns(data || [])
  }
  useEffect(() => { loadRuns() }, [])

  const loadSlips = async (runId) => {
    const { data } = await supabase.from('payslips').select('*').eq('payroll_run_id', runId).order('full_name')
    setSlips(data || [])
  }
  const openRun = async (run) => { setActive(run); await loadSlips(run.id) }

  // Builds payslip snapshots for every ACTIVE employee for the chosen month,
  // pulling absent-day counts from attendance_records to apply a simple
  // per-day deduction (gross / 30 per absent day beyond what's already
  // reflected as unpaid leave).
  const generateRun = async () => {
    setBusy(true)
    try {
      const { data: existing } = await supabase.from('payroll_runs').select('id').eq('period_month', month).eq('period_year', year).maybeSingle()
      if (existing) { flash(`Payroll for ${MONTH_NAMES[month - 1]} ${year} already exists — open it below to review.`); setBusy(false); return }

      const { data: run, error: re } = await supabase.from('payroll_runs')
        .insert({ period_month: month, period_year: year, generated_by: userName })
        .select().single()
      if (re) throw re

      const { data: emps } = await supabase.from('employees').select('*').eq('status', 'ACTIVE')
      const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
      const periodEnd = `${year}-${String(month).padStart(2, '0')}-31`

      const slipsToInsert = []
      for (const e of emps || []) {
        const { count } = await supabase.from('attendance_records').select('*', { count: 'exact', head: true })
          .eq('employee_id', e.id).eq('status', 'A').gte('att_date', periodStart).lte('att_date', periodEnd)
        const absentDays = count || 0
        const gross = +e.gross_salary || 0
        const basic = +(gross * SPLIT.basic).toFixed(2)
        const houseRent = +(gross * SPLIT.house_rent).toFixed(2)
        const medical = +(gross * SPLIT.medical).toFixed(2)
        const conveyance = +(gross * SPLIT.conveyance).toFixed(2)
        const perDay = gross / 30
        const absentDeduction = +(perDay * absentDays).toFixed(2)
        const netPayable = +(gross - absentDeduction).toFixed(2)

        slipsToInsert.push({
          payroll_run_id: run.id, employee_id: e.id,
          emp_code: e.emp_code, full_name: e.full_name, designation: e.designation, department: e.department,
          gross_salary: gross, basic, house_rent: houseRent, medical, conveyance, other_allowance: 0,
          absent_days: absentDays, absent_deduction: absentDeduction, advance_deduction: 0, other_deduction: 0,
          net_payable: netPayable,
        })
      }
      if (slipsToInsert.length === 0) { flash('No active employees to run payroll for.'); setBusy(false); return }
      const { error: se } = await supabase.from('payslips').insert(slipsToInsert)
      if (se) throw se

      await loadRuns()
      await openRun(run)
      flash(`Payroll generated for ${MONTH_NAMES[month - 1]} ${year} — ${slipsToInsert.length} payslip(s).`)
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  const updateSlip = async (slip, field, value) => {
    const n = { ...slip, [field]: value }
    n.net_payable = +(
      (+n.gross_salary) - (+n.absent_deduction) - (+n.advance_deduction || 0) - (+n.other_deduction || 0) + (+n.other_allowance || 0)
    ).toFixed(2)
    setSlips((prev) => prev.map((s) => s.id === slip.id ? n : s))
    const { error } = await supabase.from('payslips').update({
      [field]: value, net_payable: n.net_payable,
    }).eq('id', slip.id)
    if (error) flash(error.message)
  }

  const approveRun = async () => {
    if (!window.confirm(`Approve payroll for ${MONTH_NAMES[active.period_month - 1]} ${active.period_year}? Net amounts will be locked for payout.`)) return
    const { error } = await supabase.from('payroll_runs').update({ status: 'APPROVED', approved_by: userName, approved_at: new Date().toISOString() }).eq('id', active.id)
    if (error) flash(error.message); else { await loadRuns(); setActive((a) => ({ ...a, status: 'APPROVED' })) }
  }

  const markPaid = async () => {
    if (!window.confirm('Mark this payroll run as PAID? This should only be done once salaries are actually disbursed.')) return
    const { error } = await supabase.from('payroll_runs').update({ status: 'PAID', paid_at: new Date().toISOString() }).eq('id', active.id)
    if (error) { flash(error.message); return }
    await supabase.from('payslips').update({ paid_at: new Date().toISOString() }).eq('payroll_run_id', active.id)
    await loadRuns(); setActive((a) => ({ ...a, status: 'PAID' }))
    flash('Payroll marked as paid.')
  }

  const totalNet = slips.reduce((a, s) => a + (+s.net_payable || 0), 0)

  if (active) {
    const locked = active.status !== 'DRAFT'
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <button className="btn-ghost !py-1" onClick={() => setActive(null)}>← All runs</button>
            <h3 className="font-display font-semibold text-pine flex items-center gap-2"><Wallet size={16} className="text-forest" /> {MONTH_NAMES[active.period_month - 1]} {active.period_year}</h3>
            <span className={`status-chip ${active.status === 'PAID' ? 'bg-forest/15 text-forest' : active.status === 'APPROVED' ? 'bg-amber/20 text-amber' : 'bg-stone-200 text-stone-700'}`}>{active.status}</span>
          </div>
          <div className="flex gap-2">
            {canApprove && active.status === 'DRAFT' && <button className="btn-primary !py-1.5" onClick={approveRun}><Check size={14} /> Approve</button>}
            {isAdmin && active.status === 'APPROVED' && <button className="btn-amber !py-1.5" onClick={markPaid}><Wallet size={14} /> Mark paid</button>}
          </div>
        </div>
        {locked && <div className="px-4 py-2 rounded-lg bg-amber/10 text-amber text-sm">This run is {active.status.toLowerCase()} — amounts are locked. Contact an administrator to make changes.</div>}
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr>
              <th className="th">Employee</th><th className="th text-right">Gross</th><th className="th text-right">Absent days</th>
              <th className="th text-right">Absent ded.</th><th className="th text-right">Advance ded.</th><th className="th text-right">Other ded.</th>
              <th className="th text-right">Net payable</th><th className="th text-right">Print</th>
            </tr></thead>
            <tbody>
              {slips.map((s) => (
                <tr key={s.id}>
                  <td className="td text-sm font-medium">{s.full_name}<div className="text-xs text-pine/40">{s.emp_code} · {s.designation}</div></td>
                  <td className="td money text-right">{fmtBDT(s.gross_salary)}</td>
                  <td className="td money text-right">{s.absent_days}</td>
                  <td className="td money text-right">{fmtBDT(s.absent_deduction)}</td>
                  <td className="td text-right">
                    {locked ? fmtBDT(s.advance_deduction) : (
                      <input type="number" className="input !w-24 !py-1 money text-right" defaultValue={s.advance_deduction}
                        onBlur={(e) => updateSlip(s, 'advance_deduction', +e.target.value || 0)} />
                    )}
                  </td>
                  <td className="td text-right">
                    {locked ? fmtBDT(s.other_deduction) : (
                      <input type="number" className="input !w-24 !py-1 money text-right" defaultValue={s.other_deduction}
                        onBlur={(e) => updateSlip(s, 'other_deduction', +e.target.value || 0)} />
                    )}
                  </td>
                  <td className="td money text-right font-bold text-forest">{fmtBDT(s.net_payable)}</td>
                  <td className="td text-right"><button className="btn-ghost !py-1" onClick={() => setPrintSlip(s)}><Printer size={13} /></button></td>
                </tr>
              ))}
              {slips.length === 0 && <tr><td className="td text-pine/40" colSpan={8}>No payslips in this run.</td></tr>}
            </tbody>
            {slips.length > 0 && (
              <tfoot><tr className="bg-leaf/40 font-bold money"><td className="td" colSpan={6}>Total net payable</td><td className="td text-right">{fmtBDT(totalNet)}</td><td className="td"></td></tr></tfoot>
            )}
          </table>
        </div>
        {printSlip && (
          <PrintPortal title={`Payslip — ${printSlip.full_name}`} onClose={() => setPrintSlip(null)}>
            <PayslipDoc slip={printSlip} run={active} company={company} />
          </PrintPortal>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="label">Month</label>
          <select className="input !w-40" value={month} onChange={(e) => setMonth(+e.target.value)}>
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Year</label>
          <input type="number" className="input !w-28 money" value={year} onChange={(e) => setYear(+e.target.value)} />
        </div>
        {canApprove && <button className="btn-primary" disabled={busy} onClick={generateRun}><Wallet size={15} /> {busy ? 'Generating…' : 'Generate payroll'}</button>}
      </div>
      <p className="text-xs text-pine/50">Generates a payslip for every active employee using gross salary split into Basic 60% / House Rent 25% / Medical 10% / Conveyance 5%, with absent-day deductions pulled automatically from Attendance. Existing months won't be regenerated — open the run below to edit instead.</p>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Period</th><th className="th">Status</th><th className="th">Generated by</th><th className="th text-right">Open</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="hover:bg-leaf/20 cursor-pointer" onClick={() => openRun(r)}>
                <td className="td text-sm font-medium">{MONTH_NAMES[r.period_month - 1]} {r.period_year}</td>
                <td className="td"><span className={`status-chip ${r.status === 'PAID' ? 'bg-forest/15 text-forest' : r.status === 'APPROVED' ? 'bg-amber/20 text-amber' : 'bg-stone-200 text-stone-700'}`}>{r.status}</span></td>
                <td className="td text-xs">{r.generated_by || '—'}</td>
                <td className="td text-right"><button className="btn-ghost !py-1" onClick={() => openRun(r)}>Open →</button></td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td className="td text-pine/40" colSpan={4}>No payroll runs yet — generate one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------------- A4 Payslip (print) ---------------- */
function PayslipDoc({ slip, run, company }) {
  const cell = { border: '1px solid #000', padding: '6px 8px', fontSize: 11, verticalAlign: 'top' }
  const rt = { ...cell, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', color: '#000' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid #1B4D2E', paddingBottom: 8, marginBottom: 12 }}>
        {company?.logo_url && <img src={company.logo_url} alt="" style={{ height: 50, width: 50, objectFit: 'contain' }} />}
        <div style={{ flex: 1, textAlign: company?.logo_url ? 'left' : 'center' }}>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: 'Fraunces, serif', color: '#1B4D2E' }}>{company?.name || 'Resort'}</div>
          <div style={{ fontSize: 10.5 }}>{company?.address}</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, letterSpacing: 1, marginBottom: 10, textDecoration: 'underline' }}>
        PAYSLIP — {String(run.period_month).padStart(2, '0')}/{run.period_year}
      </div>
      <table style={{ width: '100%', fontSize: 11, marginBottom: 10 }}>
        <tbody>
          <tr><td><b>Employee:</b> {slip.full_name}</td><td style={{ textAlign: 'right' }}><b>Code:</b> {slip.emp_code}</td></tr>
          <tr><td><b>Designation:</b> {slip.designation || '—'}</td><td style={{ textAlign: 'right' }}><b>Department:</b> {slip.department || '—'}</td></tr>
        </tbody>
      </table>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: '#eee' }}><th style={cell}>Earnings</th><th style={{ ...cell, textAlign: 'right' }}>Amount</th><th style={cell}>Deductions</th><th style={{ ...cell, textAlign: 'right' }}>Amount</th></tr></thead>
        <tbody>
          <tr><td style={cell}>Basic</td><td style={rt}>{fmtBDT(slip.basic)}</td><td style={cell}>Absent ({slip.absent_days} day(s))</td><td style={rt}>{fmtBDT(slip.absent_deduction)}</td></tr>
          <tr><td style={cell}>House Rent</td><td style={rt}>{fmtBDT(slip.house_rent)}</td><td style={cell}>Advance</td><td style={rt}>{fmtBDT(slip.advance_deduction)}</td></tr>
          <tr><td style={cell}>Medical</td><td style={rt}>{fmtBDT(slip.medical)}</td><td style={cell}>Other</td><td style={rt}>{fmtBDT(slip.other_deduction)}</td></tr>
          <tr><td style={cell}>Conveyance</td><td style={rt}>{fmtBDT(slip.conveyance)}</td><td style={cell}></td><td style={rt}></td></tr>
          {+slip.other_allowance > 0 && <tr><td style={cell}>Other allowance</td><td style={rt}>{fmtBDT(slip.other_allowance)}</td><td style={cell}></td><td style={rt}></td></tr>}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700, background: '#f5f5f5' }}><td style={cell}>Gross</td><td style={rt}>{fmtBDT(slip.gross_salary)}</td><td style={cell}>Total deduction</td><td style={rt}>{fmtBDT(+slip.absent_deduction + +slip.advance_deduction + +slip.other_deduction)}</td></tr>
        </tfoot>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#fff', background: '#2E7D32', padding: '8px 12px', borderRadius: 6, margin: '10px 0' }}>
        <span>NET PAYABLE</span><span>{fmtBDT(slip.net_payable)}</span>
      </div>
      <table style={{ width: '100%', marginTop: 40, fontSize: 11 }}>
        <tbody><tr>
          <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: 6, textAlign: 'center' }}>Employee Signature</td>
          <td style={{ width: '10%' }}></td>
          <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: 6, textAlign: 'center' }}>Authorized Signature</td>
        </tr></tbody>
      </table>
    </div>
  )
}

function IncidentsTab({ flash, userName }) {
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ incident_date: todayISO(), category: 'GENERAL', description: '', action_taken: '' })
  const load = async () => { const { data } = await supabase.from('incident_register').select('*').order('incident_date', { ascending: false }); setRows(data || []) }
  useEffect(() => { load() }, [])
  const add = async () => { if (!f.description) return; const { error } = await supabase.from('incident_register').insert({ ...f, reported_by: userName }); if (error) flash(error.message); else { setF({ incident_date: todayISO(), category: 'GENERAL', description: '', action_taken: '' }); load() } }
  const toggle = async (r) => { await supabase.from('incident_register').update({ status: r.status === 'OPEN' ? 'CLOSED' : 'OPEN' }).eq('id', r.id); load() }
  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-6 gap-2">
        <input type="date" className="input" value={f.incident_date} onChange={(e) => setF({ ...f, incident_date: e.target.value })} />
        <input className="input" placeholder="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <input className="input col-span-2" placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <input className="input" placeholder="Action taken" value={f.action_taken} onChange={(e) => setF({ ...f, action_taken: e.target.value })} />
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Log</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Date</th><th className="th">Category</th><th className="th">Description</th><th className="th">Action</th><th className="th">By</th><th className="th">Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (<tr key={r.id}><td className="td money text-xs">{fmtDate(r.incident_date)}</td><td className="td text-xs">{r.category}</td><td className="td text-sm">{r.description}</td><td className="td text-xs">{r.action_taken || '—'}</td><td className="td text-xs">{r.reported_by}</td><td className="td"><button onClick={() => toggle(r)} className={`status-chip ${r.status === 'OPEN' ? 'bg-amber/20 text-amber' : 'bg-forest/15 text-forest'}`}>{r.status}</button></td></tr>))}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={6}>No incidents logged.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DocketTab({ flash, userName }) {
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ doc_date: todayISO(), department: 'GEN', doc_type: 'LETTER', subject: '', party: '' })
  const load = async () => { const { data } = await supabase.from('doc_register').select('*').order('created_at', { ascending: false }); setRows(data || []) }
  useEffect(() => { load() }, [])
  const add = async () => { if (!f.subject) return; const { error } = await supabase.from('doc_register').insert({ ...f, created_by: userName }); if (error) flash(error.message); else { setF({ doc_date: todayISO(), department: 'GEN', doc_type: 'LETTER', subject: '', party: '' }); load() } }
  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-6 gap-2">
        <input type="date" className="input" value={f.doc_date} onChange={(e) => setF({ ...f, doc_date: e.target.value })} />
        <input className="input" placeholder="Dept" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} />
        <select className="input" value={f.doc_type} onChange={(e) => setF({ ...f, doc_type: e.target.value })}>{['LETTER', 'MEMO', 'NOTICE', 'CIRCULAR', 'INWARD', 'OUTWARD'].map((t) => <option key={t}>{t}</option>)}</select>
        <input className="input" placeholder="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        <input className="input" placeholder="Party" value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} />
        <button className="btn-primary justify-center" onClick={add}><FileText size={15} /> Register</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Docket No</th><th className="th">Date</th><th className="th">Type</th><th className="th">Subject</th><th className="th">Party</th></tr></thead>
          <tbody>
            {rows.map((r) => (<tr key={r.id}><td className="td money text-xs font-semibold">{r.doc_no}</td><td className="td money text-xs">{fmtDate(r.doc_date)}</td><td className="td text-xs">{r.doc_type}</td><td className="td text-sm">{r.subject}</td><td className="td text-xs">{r.party || '—'}</td></tr>))}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={5}>No documents registered.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
