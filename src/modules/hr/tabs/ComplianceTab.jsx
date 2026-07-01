import { useEffect, useState } from 'react'
import { supabase } from '../../../supabase'
import { fmtDate, todayISO } from '../../../lib/helpers'
import { Plus, BookOpen, Users } from 'lucide-react'

function IncidentsView({ flash, userName }) {
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ incident_date: todayISO(), category: 'GENERAL', description: '', action_taken: '' })

  const load = async () => {
    const { data } = await supabase.from('incident_register').select('*').order('incident_date', { ascending: false })
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!f.description) return
    const { error } = await supabase.from('incident_register').insert({ ...f, reported_by: userName })
    if (error) flash(error.message)
    else { setF({ incident_date: todayISO(), category: 'GENERAL', description: '', action_taken: '' }); load() }
  }
  const toggle = async (r) => {
    await supabase.from('incident_register').update({ status: r.status === 'OPEN' ? 'CLOSED' : 'OPEN' }).eq('id', r.id)
    load()
  }

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
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="td money text-xs">{fmtDate(r.incident_date)}</td>
                <td className="td text-xs">{r.category}</td>
                <td className="td text-sm">{r.description}</td>
                <td className="td text-xs">{r.action_taken || '—'}</td>
                <td className="td text-xs">{r.reported_by}</td>
                <td className="td"><button onClick={() => toggle(r)} className={`status-chip ${r.status === 'OPEN' ? 'bg-amber/20 text-amber' : 'bg-forest/15 text-forest'}`}>{r.status}</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={6}>No incidents logged.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PlaceholderView({ icon: Icon, title, desc }) {
  return (
    <div className="card p-8 text-center space-y-3">
      <Icon size={36} className="mx-auto text-forest/40" />
      <h3 className="font-semibold text-pine text-lg">{title}</h3>
      <p className="text-pine/60 text-sm max-w-sm mx-auto">{desc}</p>
      <p className="text-xs text-pine/40 italic">Coming in next phase.</p>
    </div>
  )
}

const SUB_VIEWS = [
  { key: '',                        label: 'Incidents' },
  { key: 'employee-register',       label: 'Employee Register' },
  { key: 'service-book-register',   label: 'Service Book Register' },
]

export default function ComplianceTab({ flash, userName, view, setView }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-leaf/60">
        {SUB_VIEWS.map((sv) => (
          <button key={sv.key} onClick={() => setView(sv.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t ${sv.key === (view || '') ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>
            {sv.label}
          </button>
        ))}
      </div>

      {(view === '' || view === 'incidents') && <IncidentsView flash={flash} userName={userName} />}
      {view === 'employee-register' && <PlaceholderView icon={Users} title="Employee Register" desc="Statutory employee register for labour law compliance." />}
      {view === 'service-book-register' && <PlaceholderView icon={BookOpen} title="Service Book Register" desc="Service book register across all employees." />}
    </div>
  )
}
