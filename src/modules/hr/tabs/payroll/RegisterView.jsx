import { useEffect, useState } from 'react'
import { supabase } from '../../../../supabase'
import { fmtBDT, fmtDate } from '../../../../lib/helpers'
import { ChevronDown, ChevronRight, Printer } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtMonth(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function PayslipPrint({ run, slips }) {
  const html = `
    <html><head><title>Payroll — ${fmtMonth(run.pay_month)}</title>
    <style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #ccc;padding:4px 8px}th{background:#f0f0f0}
    .money{text-align:right}.total{font-weight:bold}h2{margin:4px 0}</style></head>
    <body>
    <h2>Payroll Register — ${fmtMonth(run.pay_month)}</h2>
    <p>Status: ${run.status} | Generated: ${fmtDate(run.created_at)}</p>
    <table><thead><tr>
      <th>#</th><th>Employee</th><th>Basic</th><th>House Rent</th><th>Medical</th>
      <th>Conveyance</th><th>Gross</th><th>Absent</th><th>Deduction</th><th class="money">Net</th>
    </tr></thead><tbody>
    ${slips.map((s, i) => `<tr>
      <td>${i+1}</td><td>${s.employees?.full_name || ''}</td>
      <td class="money">${s.basic?.toLocaleString()}</td>
      <td class="money">${s.house_rent?.toLocaleString()}</td>
      <td class="money">${s.medical?.toLocaleString()}</td>
      <td class="money">${s.conveyance?.toLocaleString()}</td>
      <td class="money">${s.gross_salary?.toLocaleString()}</td>
      <td>${s.absent_days || 0}</td>
      <td class="money">${s.deduction?.toLocaleString() || 0}</td>
      <td class="money total">${s.net_salary?.toLocaleString()}</td>
    </tr>`).join('')}
    <tr class="total"><td colspan="6">Total</td>
      <td class="money">${slips.reduce((s,r)=>s+(r.gross_salary||0),0).toLocaleString()}</td>
      <td></td>
      <td class="money">${slips.reduce((s,r)=>s+(r.deduction||0),0).toLocaleString()}</td>
      <td class="money">${slips.reduce((s,r)=>s+(r.net_salary||0),0).toLocaleString()}</td>
    </tr>
    </tbody></table></body></html>`
  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  w.print()
}

export default function RegisterView() {
  const [runs, setRuns] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [slips, setSlips] = useState({})

  useEffect(() => {
    supabase.from('payroll_runs').select('*').order('pay_month', { ascending: false })
      .then(({ data }) => setRuns(data || []))
  }, [])

  const toggle = async (run) => {
    if (expanded === run.id) { setExpanded(null); return }
    setExpanded(run.id)
    if (!slips[run.id]) {
      const { data } = await supabase.from('payslips')
        .select('*, employees(full_name)').eq('run_id', run.id).order('employee_id')
      setSlips((prev) => ({ ...prev, [run.id]: data || [] }))
    }
  }

  return (
    <div className="space-y-2">
      {runs.length === 0 && <div className="card p-6 text-center text-pine/40 text-sm">No payroll runs yet.</div>}
      {runs.map((run) => (
        <div key={run.id} className="card overflow-hidden">
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-leaf/10"
            onClick={() => toggle(run)}>
            <div className="flex items-center gap-3">
              {expanded === run.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              <span className="font-semibold text-sm text-pine">{fmtMonth(run.pay_month)}</span>
              <span className={`status-chip text-xs ${run.status === 'POSTED' ? 'bg-forest/15 text-forest' : run.status === 'APPROVED' ? 'bg-leaf/30 text-forest' : 'bg-amber/20 text-amber'}`}>{run.status}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-pine/60">Gross: <span className="font-semibold text-pine">{fmtBDT(run.total_gross)}</span></span>
              <span className="text-pine/60">Net: <span className="font-semibold text-forest">{fmtBDT(run.total_net)}</span></span>
            </div>
          </button>

          {expanded === run.id && slips[run.id] && (
            <div>
              <div className="px-4 pb-2 flex justify-end">
                <button className="btn-ghost text-xs flex items-center gap-1"
                  onClick={() => PayslipPrint({ run, slips: slips[run.id] })}>
                  <Printer size={13} /> Print Register
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="th">Employee</th>
                    <th className="th text-right">Basic</th>
                    <th className="th text-right">H.Rent</th>
                    <th className="th text-right">Medical</th>
                    <th className="th text-right">Conveyance</th>
                    <th className="th text-right">Gross</th>
                    <th className="th text-right">Absent</th>
                    <th className="th text-right">Deduction</th>
                    <th className="th text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {slips[run.id].map((s) => (
                    <tr key={s.id}>
                      <td className="td font-medium">{s.employees?.full_name}</td>
                      <td className="td money text-right">{fmtBDT(s.basic)}</td>
                      <td className="td money text-right">{fmtBDT(s.house_rent)}</td>
                      <td className="td money text-right">{fmtBDT(s.medical)}</td>
                      <td className="td money text-right">{fmtBDT(s.conveyance)}</td>
                      <td className="td money text-right">{fmtBDT(s.gross_salary)}</td>
                      <td className="td text-right text-red-500">{s.absent_days || '—'}</td>
                      <td className="td money text-right text-red-500">{s.deduction ? fmtBDT(s.deduction) : '—'}</td>
                      <td className="td money text-right font-bold text-forest">{fmtBDT(s.net_salary)}</td>
                    </tr>
                  ))}
                  <tr className="bg-leaf/10 font-semibold">
                    <td className="td text-xs text-pine/60" colSpan={5}>Total</td>
                    <td className="td money text-right">{fmtBDT(slips[run.id].reduce((s,r)=>s+(r.gross_salary||0),0))}</td>
                    <td className="td" />
                    <td className="td money text-right text-red-500">{fmtBDT(slips[run.id].reduce((s,r)=>s+(r.deduction||0),0))}</td>
                    <td className="td money text-right text-forest">{fmtBDT(slips[run.id].reduce((s,r)=>s+(r.net_salary||0),0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
