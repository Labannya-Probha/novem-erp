import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO } from '../lib/helpers'
import { ChevronLeft, Printer, CheckCircle2, Clock } from 'lucide-react'
import PrintPortal from './PrintPortal.jsx'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function EmployeeProfile({ employee, company, userName, back }) {
  const [tab, setTab] = useState('overview')
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    supabase.from('v_employee_hris_summary').select('*').eq('employee_id', employee.id).maybeSingle()
      .then(({ data }) => setSummary(data))
  }, [employee.id])

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'leave', label: 'Leave' },
    { key: 'payslips', label: 'Payslips' },
    { key: 'compliance', label: 'Compliance' },
  ]

  return (
    <div className="space-y-4">
      <button className="btn-ghost !py-1" onClick={back}><ChevronLeft size={15} /> Back to employee list</button>

      <div className="card p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-pine">{employee.full_name}</h2>
            <p className="text-sm text-pine/60">{employee.emp_code} · {employee.designation || '—'} · {employee.department || '—'}</p>
            <p className="text-xs text-pine/40 mt-1">Joined {employee.join_date ? fmtDate(employee.join_date) : '—'} · {employee.phone || 'No phone on file'}</p>
          </div>
          <span className={`status-chip ${employee.status === 'ACTIVE' ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-700'}`}>{employee.status}</span>
        </div>
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-leaf">
            <Stat label="Gross Salary" value={fmtBDT(summary.gross_salary)} />
            <Stat label="Leave Taken" value={summary.leave_taken_count} />
            <Stat label="Comp Leave Avail." value={summary.comp_leave_available} />
            <Stat label="Latest Net Pay" value={summary.latest_net_payable ? fmtBDT(summary.latest_net_payable) : '—'} />
            <Stat label="Compliance" value={`${summary.compliance_total_count - summary.compliance_pending_count} / ${summary.compliance_total_count}`} highlight={summary.compliance_pending_count > 0} />
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-leaf flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${tab === t.key ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && <OverviewPanel employee={employee} />}
      {tab === 'attendance' && <AttendancePanel employeeId={employee.id} />}
      {tab === 'leave' && <LeavePanel employeeId={employee.id} />}
      {tab === 'payslips' && <PayslipsPanel employee={employee} company={company} />}
      {tab === 'compliance' && <CompliancePanel employeeId={employee.id} />}
    </div>
  )
}

function Stat({ label, value, highlight }) {
  return (
    <div>
      <div className="text-xs text-pine/50">{label}</div>
      <div className={`text-lg font-display font-bold ${highlight ? 'text-amber' : 'text-pine'}`}>{value}</div>
    </div>
  )
}

function OverviewPanel({ employee }) {
  return (
    <div className="card p-5 grid grid-cols-2 gap-4 text-sm">
      <div><span className="text-pine/50">Full Name</span><div className="font-medium">{employee.full_name}</div></div>
      <div><span className="text-pine/50">Employee Code</span><div className="font-medium">{employee.emp_code}</div></div>
      <div><span className="text-pine/50">Designation</span><div className="font-medium">{employee.designation || '—'}</div></div>
      <div><span className="text-pine/50">Department</span><div className="font-medium">{employee.department || '—'}</div></div>
      <div><span className="text-pine/50">Join Date</span><div className="font-medium">{employee.join_date ? fmtDate(employee.join_date) : '—'}</div></div>
      <div><span className="text-pine/50">Phone</span><div className="font-medium">{employee.phone || '—'}</div></div>
      <div><span className="text-pine/50">NID</span><div className="font-medium">{employee.nid || '—'}</div></div>
      <div><span className="text-pine/50">Gross Salary</span><div className="font-medium">{fmtBDT(employee.gross_salary)}</div></div>
      <div className="col-span-2"><span className="text-pine/50">Address</span><div className="font-medium">{employee.address || '—'}</div></div>
      <div className="col-span-2"><span className="text-pine/50">Notes</span><div className="font-medium">{employee.notes || '—'}</div></div>
    </div>
  )
}

function AttendancePanel({ employeeId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = `${year}-${String(month).padStart(2, '0')}-31`
    supabase.from('attendance_records').select('*').eq('employee_id', employeeId).gte('att_date', start).lte('att_date', end).order('att_date', { ascending: false })
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [employeeId, month, year])

  const counts = rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a }, {})

  return (
    <div className="space-y-3">
      <div className="card p-3 flex items-end gap-3 flex-wrap">
        <div><label className="label">Month</label>
          <select className="input !w-40" value={month} onChange={(e) => setMonth(+e.target.value)}>
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div><label className="label">Year</label><input type="number" className="input !w-28 money" value={year} onChange={(e) => setYear(+e.target.value)} /></div>
        <div className="flex gap-2 text-xs ml-auto">
          {['P','A','L','H','OFF'].map((s) => <span key={s} className="status-chip bg-leaf/50 text-pine/70">{s}: {counts[s] || 0}</span>)}
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Date</th><th className="th">Status</th><th className="th">In</th><th className="th">Out</th><th className="th">Notes</th></tr></thead>
          <tbody>
            {loading && <tr><td className="td text-pine/40" colSpan={5}>Loading...</td></tr>}
            {!loading && rows.map((r) => (
              <tr key={r.id}>
                <td className="td money text-sm">{fmtDate(r.att_date)}</td>
                <td className="td"><span className={`status-chip ${r.status === 'A' ? 'bg-red-100 text-red-600' : r.status === 'P' ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-700'}`}>{r.status}</span></td>
                <td className="td text-xs money">{r.in_time || '—'}</td>
                <td className="td text-xs money">{r.out_time || '—'}</td>
                <td className="td text-xs">{r.notes || '—'}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td className="td text-pine/40" colSpan={5}>No attendance records for this month.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LeavePanel({ employeeId }) {
  const [rows, setRows] = useState([])
  const [compRows, setCompRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('leave_applications').select('*, leave_types(name, annual_days)').eq('employee_id', employeeId).order('applied_at', { ascending: false }),
      supabase.from('comp_leave_register').select('*').eq('employee_id', employeeId).order('earned_date', { ascending: false }),
    ]).then(([{ data: la }, { data: cl }]) => { setRows(la || []); setCompRows(cl || []); setLoading(false) })
  }, [employeeId])

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="px-4 py-2 text-xs font-semibold text-pine/50 bg-leaf/30">Leave Applications</div>
        <table className="w-full">
          <thead><tr><th className="th">Type</th><th className="th">From → To</th><th className="th text-right">Days</th><th className="th">Status</th></tr></thead>
          <tbody>
            {loading && <tr><td className="td text-pine/40" colSpan={4}>Loading...</td></tr>}
            {!loading && rows.map((r) => (
              <tr key={r.id}>
                <td className="td text-sm">{r.leave_types?.name}</td>
                <td className="td money text-xs">{fmtDate(r.from_date)} → {fmtDate(r.to_date)}</td>
                <td className="td money text-right">{r.days}</td>
                <td className="td"><span className={`status-chip ${r.status === 'APPROVED' ? 'bg-forest/15 text-forest' : r.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-amber/20 text-amber'}`}>{r.status}</span></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td className="td text-pine/40" colSpan={4}>No leave applications.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-2 text-xs font-semibold text-pine/50 bg-leaf/30">Compensatory Leave</div>
        <table className="w-full">
          <thead><tr><th className="th">Earned</th><th className="th text-right">Days</th><th className="th">Reason</th><th className="th">Used</th></tr></thead>
          <tbody>
            {compRows.map((r) => (
              <tr key={r.id}>
                <td className="td money text-xs">{fmtDate(r.earned_date)}</td>
                <td className="td money text-right">{r.days}</td>
                <td className="td text-xs">{r.reason || '—'}</td>
                <td className="td"><span className={`status-chip ${r.used ? 'bg-stone-200 text-stone-700' : 'bg-forest/15 text-forest'}`}>{r.used ? 'Used' : 'Available'}</span></td>
              </tr>
            ))}
            {compRows.length === 0 && <tr><td className="td text-pine/40" colSpan={4}>No compensatory leave recorded.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PayslipsPanel({ employee, company }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [printSlip, setPrintSlip] = useState(null)

  useEffect(() => {
    supabase.from('v_employee_payslip_history').select('*').eq('employee_id', employee.id)
      .then(({ data }) => {
        const sorted = (data || []).sort((a, b) => b.period_year - a.period_year || b.period_month - a.period_month)
        setRows(sorted); setLoading(false)
      })
  }, [employee.id])

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Period</th><th className="th">Status</th><th className="th text-right">Gross</th><th className="th text-right">Deductions</th><th className="th text-right">Net Payable</th><th className="th text-right">Print</th></tr></thead>
          <tbody>
            {loading && <tr><td className="td text-pine/40" colSpan={6}>Loading...</td></tr>}
            {!loading && rows.map((r) => (
              <tr key={r.payslip_id}>
                <td className="td text-sm font-medium">{MONTH_NAMES[r.period_month - 1]} {r.period_year}</td>
                <td className="td"><span className={`status-chip ${r.run_status === 'PAID' ? 'bg-forest/15 text-forest' : r.run_status === 'APPROVED' ? 'bg-amber/20 text-amber' : 'bg-stone-200 text-stone-700'}`}>{r.run_status}</span></td>
                <td className="td money text-right">{fmtBDT(r.gross_salary)}</td>
                <td className="td money text-right">{fmtBDT(+r.absent_deduction + +r.advance_deduction + +r.other_deduction)}</td>
                <td className="td money text-right font-bold text-forest">{fmtBDT(r.net_payable)}</td>
                <td className="td text-right"><button className="btn-ghost !py-1" onClick={() => setPrintSlip(r)}><Printer size={13} /></button></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td className="td text-pine/40" colSpan={6}>No payslips generated yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {printSlip && (
        <PrintPortal title={`Payslip — ${employee.full_name}`} onClose={() => setPrintSlip(null)}>
          <ProfilePayslipDoc slip={printSlip} company={company} />
        </PrintPortal>
      )}
    </div>
  )
}

function ProfilePayslipDoc({ slip, company }) {
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
        PAYSLIP — {String(slip.period_month).padStart(2, '0')}/{slip.period_year}
      </div>
      <table style={{ width: '100%', fontSize: 11, marginBottom: 10 }}>
        <tbody>
          <tr><td><b>Employee:</b> {slip.full_name}</td><td style={{ textAlign: 'right' }}><b>Code:</b> {slip.emp_code}</td></tr>
          <tr><td><b>Designation:</b> {slip.designation || '—'}</td><td style={{ textAlign: 'right' }}><b>Department:</b> {slip.department || '—'}</td></tr>
        </tbody>
      </table>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: '#eee' }}><th style={cell}>Salary Breakdown</th><th style={{ ...cell, textAlign: 'right' }}>Amount</th><th style={cell}>Deductions</th><th style={{ ...cell, textAlign: 'right' }}>Amount</th></tr></thead>
        <tbody>
          <tr><td style={cell}>Basic</td><td style={rt}>{fmtBDT(slip.basic)}</td><td style={cell}>Absent ({slip.absent_days} day(s))</td><td style={rt}>{fmtBDT(slip.absent_deduction)}</td></tr>
          <tr><td style={cell}>House Rent</td><td style={rt}>{fmtBDT(slip.house_rent)}</td><td style={cell}>Advance</td><td style={rt}>{fmtBDT(slip.advance_deduction)}</td></tr>
          <tr><td style={cell}>Transportation</td><td style={rt}>{fmtBDT(slip.conveyance)}</td><td style={cell}>Other</td><td style={rt}>{fmtBDT(slip.other_deduction)}</td></tr>
          <tr><td style={cell}>Medical Allowance</td><td style={rt}>{fmtBDT(slip.medical)}</td><td style={cell}></td><td style={rt}></td></tr>
          <tr><td style={cell}>Internet/Telephone Allowance</td><td style={rt}>{fmtBDT(slip.internet_allowance)}</td><td style={cell}></td><td style={rt}></td></tr>
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

function CompliancePanel({ employeeId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    supabase.from('v_employee_compliance_register').select('*').eq('employee_id', employeeId).order('phase').order('form_code')
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }
  useEffect(() => { load() }, [employeeId])

  const toggle = async (r) => {
    if (r.status === 'COMPLETED') {
      await supabase.from('employee_compliance_records').update({ status: 'PENDING' }).eq('employee_id', employeeId).eq('compliance_item_id', r.compliance_item_id)
    } else {
      const { data: existing } = await supabase.from('employee_compliance_records').select('id').eq('employee_id', employeeId).eq('compliance_item_id', r.compliance_item_id).maybeSingle()
      if (existing) {
        await supabase.from('employee_compliance_records').update({ status: 'COMPLETED', record_date: todayISO() }).eq('id', existing.id)
      } else {
        await supabase.from('employee_compliance_records').insert({ employee_id: employeeId, compliance_item_id: r.compliance_item_id, status: 'COMPLETED', record_date: todayISO() })
      }
    }
    load()
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead><tr><th className="th">Form</th><th className="th">Name</th><th className="th">Category</th><th className="th">Status</th><th className="th"></th></tr></thead>
        <tbody>
          {loading && <tr><td className="td text-pine/40" colSpan={5}>Loading...</td></tr>}
          {!loading && rows.map((r) => (
            <tr key={r.compliance_item_id}>
              <td className="td text-sm font-medium">{r.form_code}</td>
              <td className="td text-sm">{r.form_name}</td>
              <td className="td text-sm">{r.category || '—'}</td>
              <td className="td"><span className={`status-chip ${r.status === 'COMPLETED' ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-600'}`}>{r.status}</span></td>
              <td className="td">
                <button className="btn-ghost !py-1 !text-xs flex items-center gap-1" onClick={() => toggle(r)}>
                  {r.status === 'COMPLETED' ? <><CheckCircle2 size={12} /> Mark Pending</> : <><Clock size={12} /> Mark Completed</>}
                </button>
              </td>
            </tr>
          ))}
          {!loading && rows.length === 0 && <tr><td className="td text-pine/40" colSpan={5}>No employee-level compliance items configured.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
