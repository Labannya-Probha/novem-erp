import { useEffect, useState } from 'react'
import { supabase } from '../../../supabase'
import { todayISO } from '../../../lib/helpers'
import { CalendarDays } from 'lucide-react'

const STAT = [['P', 'Present'], ['A', 'Absent'], ['L', 'Leave'], ['H', 'Holiday'], ['OFF', 'Off']]

export default function AttendanceTab({ flash }) {
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
    const { error } = await supabase.from('attendance_records')
      .upsert({ employee_id: empId, att_date: date, status }, { onConflict: 'employee_id,att_date' })
    if (error) flash(error.message)
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center gap-3">
        <CalendarDays size={16} className="text-forest" />
        <span className="label !mb-0">Date</span>
        <input type="date" className="input !w-44" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Code</th><th className="th">Employee</th><th className="th">Mark</th></tr></thead>
          <tbody>
            {emps.map((e) => (
              <tr key={e.id}>
                <td className="td money text-xs">{e.emp_code}</td>
                <td className="td text-sm font-medium">{e.full_name}</td>
                <td className="td">
                  <div className="flex gap-1">
                    {STAT.map(([s, label]) => (
                      <button key={s} onClick={() => mark(e.id, s)} title={label}
                        className={`px-2.5 py-1 rounded text-xs font-bold ${recs[e.id] === s ? (s === 'A' ? 'bg-red-500 text-white' : 'bg-forest text-white') : 'bg-leaf/50 text-pine/70 hover:bg-leaf'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {emps.length === 0 && <tr><td className="td text-pine/40" colSpan={3}>No active employees.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
