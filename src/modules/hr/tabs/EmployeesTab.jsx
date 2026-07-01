import { useEffect, useState } from 'react'
import { supabase } from '../../../supabase'
import { fmtBDT, todayISO } from '../../../lib/helpers'
import { Plus } from 'lucide-react'
import EmployeeProfileDrawer from '../components/EmployeeProfileDrawer'

export default function EmployeesTab({ flash, isAdmin, userName }) {
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [f, setF] = useState({
    full_name: '', designation: '', department: '',
    join_date: todayISO(), phone: '', gross_salary: '',
  })

  const load = async () => {
    const { data } = await supabase.from('employees').select('*').order('created_at')
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!f.full_name) return
    const { error } = await supabase.from('employees').insert({ ...f, gross_salary: +f.gross_salary || 0 })
    if (error) flash(error.message)
    else { setF({ full_name: '', designation: '', department: '', join_date: todayISO(), phone: '', gross_salary: '' }); load() }
  }

  const setStatus = async (id, status) => {
    await supabase.from('employees').update({ status }).eq('id', id)
    load()
  }

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
              <tr key={e.id} className="cursor-pointer hover:bg-leaf/10" onClick={() => setSelected(e)}>
                <td className="td money text-xs">{e.emp_code}</td>
                <td className="td text-sm font-medium text-forest underline-offset-2 hover:underline">{e.full_name}</td>
                <td className="td text-sm">{e.designation || '—'}</td>
                <td className="td text-xs">{e.department || '—'}</td>
                <td className="td money text-right">{fmtBDT(e.gross_salary)}</td>
                <td className="td" onClick={(ev) => ev.stopPropagation()}>
                  {isAdmin
                    ? <select className="input !py-1 !w-32" value={e.status} onChange={(ev) => setStatus(e.id, ev.target.value)}>
                        {['ACTIVE', 'RESIGNED', 'TERMINATED'].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    : <span className={`status-chip ${e.status === 'ACTIVE' ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-700'}`}>{e.status}</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={6}>No employees yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <EmployeeProfileDrawer
          emp={selected}
          userName={userName}
          flash={flash}
          onClose={() => setSelected(null)}
          onSave={() => { load(); setSelected(null) }}
        />
      )}
    </div>
  )
}
