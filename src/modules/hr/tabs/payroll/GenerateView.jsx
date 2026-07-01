import { useEffect, useState } from 'react'
import { supabase } from '../../../../supabase'
import { fmtBDT } from '../../../../lib/helpers'
import { Play } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function splitSalary(gross) {
  const basic      = Math.round(gross * 0.60)
  const houseRent  = Math.round(gross * 0.25)
  const medical    = Math.round(gross * 0.10)
  const conveyance = gross - basic - houseRent - medical
  return { basic, houseRent, medical, conveyance }
}

export default function GenerateView({ flash, userName }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())
  const [rows, setRows]   = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [existingRun, setExistingRun] = useState(null)

  const load = async () => {
    setLoading(true)
    const pad = String(month).padStart(2, '0')
    const firstDay = `${year}-${pad}-01`
    const lastDay  = new Date(year, month, 0).toISOString().slice(0, 10)

    const [{ data: emps }, { data: att }, { data: run }] = await Promise.all([
      supabase.from('employees').select('id,full_name,designation,gross_salary').eq('status','ACTIVE'),
      supabase.from('attendance_records').select('employee_id,status').gte('att_date', firstDay).lte('att_date', lastDay),
      supabase.from('payroll_runs').select('id,status').eq('pay_month', firstDay).maybeSingle(),
    ])

    setExistingRun(run || null)

    const absentMap = {}
    ;(att || []).forEach((a) => {
      if (a.status === 'A') absentMap[a.employee_id] = (absentMap[a.employee_id] || 0) + 1
    })

    const workingDays = Math.round((new Date(lastDay) - new Date(firstDay)) / 86400000) + 1

    setRows((emps || []).map((e) => {
      const gross    = e.gross_salary || 0
      const absent   = absentMap[e.id] || 0
      const deduct   = workingDays > 0 ? Math.round((gross / workingDays) * absent) : 0
      const net      = gross - deduct
      const splits   = splitSalary(gross)
      return { ...e, gross, absent, deduct, net, ...splits, workingDays }
    }))
    setLoading(false)
  }

  useEffect(() => { load() }, [month, year])

  const generate = async () => {
    if (existingRun) { flash('এই মাসের payroll ইতিমধ্যে তৈরি হয়েছে।'); return }
    setSaving(true)
    const pad = String(month).padStart(2, '0')
    const payMonth = `${year}-${pad}-01`
    const totalGross = rows.reduce((s, r) => s + r.gross, 0)
    const totalNet   = rows.reduce((s, r) => s + r.net, 0)

    const { data: runData, error: runErr } = await supabase.from('payroll_runs')
      .insert({ pay_month: payMonth, total_gross: totalGross, total_net: totalNet, status: 'DRAFT', generated_by: userName })
      .select('id').single()

    if (runErr) { flash(runErr.message); setSaving(false); return }

    const slips = rows.map((r) => ({
      run_id: runData.id, employee_id: r.id,
      basic: r.basic, house_rent: r.houseRent, medical: r.medical, conveyance: r.conveyance,
      gross_salary: r.gross, absent_days: r.absent, deduction: r.deduct, net_salary: r.net,
    }))

    const { error: slipErr } = await supabase.from('payslips').insert(slips)
    if (slipErr) { flash(slipErr.message); setSaving(false); return }

    flash(`Payroll generated for ${MONTHS[month-1]} ${year} — ${rows.length} employees.`)
    setSaving(false)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex gap-3 items-end flex-wrap">
        <div>
          <label className="label">Month</label>
          <select className="input" value={month} onChange={(e) => setMonth(+e.target.value)}>
            {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Year</label>
          <input type="number" className="input" style={{width:90}} value={year} onChange={(e) => setYear(+e.target.value)} />
        </div>
        {existingRun && (
          <span className={`status-chip ${existingRun.status === 'POSTED' ? 'bg-forest/15 text-forest' : 'bg-amber/20 text-amber'}`}>
            {existingRun.status}
          </span>
        )}
        {!existingRun && rows.length > 0 && (
          <button className="btn-primary justify-center" onClick={generate} disabled={saving}>
            <Play size={14} /> {saving ? 'Generating…' : 'Generate Payroll'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="card p-6 text-center text-pine/40 text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card p-6 text-center text-pine/40 text-sm">No active employees found.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Employee</th>
                <th className="th">Designation</th>
                <th className="th text-right">Basic</th>
                <th className="th text-right">House Rent</th>
                <th className="th text-right">Medical</th>
                <th className="th text-right">Conveyance</th>
                <th className="th text-right">Gross</th>
                <th className="th text-right">Absent</th>
                <th className="th text-right">Deduction</th>
                <th className="th text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td font-medium">{r.full_name}</td>
                  <td className="td text-xs text-pine/60">{r.designation}</td>
                  <td className="td money text-right">{fmtBDT(r.basic)}</td>
                  <td className="td money text-right">{fmtBDT(r.houseRent)}</td>
                  <td className="td money text-right">{fmtBDT(r.medical)}</td>
                  <td className="td money text-right">{fmtBDT(r.conveyance)}</td>
                  <td className="td money text-right font-semibold">{fmtBDT(r.gross)}</td>
                  <td className="td text-right text-red-500">{r.absent || '—'}</td>
                  <td className="td money text-right text-red-500">{r.deduct ? fmtBDT(r.deduct) : '—'}</td>
                  <td className="td money text-right font-bold text-forest">{fmtBDT(r.net)}</td>
                </tr>
              ))}
              <tr className="bg-leaf/10 font-semibold text-sm">
                <td className="td" colSpan={6}>Total</td>
                <td className="td money text-right">{fmtBDT(rows.reduce((s,r)=>s+r.gross,0))}</td>
                <td className="td" />
                <td className="td money text-right text-red-500">{fmtBDT(rows.reduce((s,r)=>s+r.deduct,0))}</td>
                <td className="td money text-right text-forest">{fmtBDT(rows.reduce((s,r)=>s+r.net,0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
