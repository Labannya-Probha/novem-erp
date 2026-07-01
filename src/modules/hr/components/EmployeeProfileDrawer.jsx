import { useEffect, useState } from 'react'
import { supabase } from '../../../supabase'
import { fmtDate, todayISO } from '../../../lib/helpers'
import { X, Plus, Trash2 } from 'lucide-react'

function ProfileTab({ emp, onSave, flash }) {
  const [f, setF] = useState(emp)
  const save = async () => {
    const { error } = await supabase.from('employees').update({
      full_name: f.full_name, designation: f.designation, department: f.department,
      phone: f.phone, gross_salary: f.gross_salary ? +f.gross_salary : null,
      join_date: f.join_date, status: f.status,
    }).eq('id', emp.id)
    if (error) flash(error.message); else { flash('Saved.'); onSave() }
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Full Name</label>
          <input className="input" value={f.full_name || ''} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div><label className="label">Designation</label>
          <input className="input" value={f.designation || ''} onChange={(e) => setF({ ...f, designation: e.target.value })} /></div>
        <div><label className="label">Department</label>
          <input className="input" value={f.department || ''} onChange={(e) => setF({ ...f, department: e.target.value })} /></div>
        <div><label className="label">Phone</label>
          <input className="input" value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div><label className="label">Join Date</label>
          <input type="date" className="input" value={f.join_date || ''} onChange={(e) => setF({ ...f, join_date: e.target.value })} /></div>
        <div><label className="label">Gross Salary (৳)</label>
          <input type="number" className="input money" value={f.gross_salary || ''} onChange={(e) => setF({ ...f, gross_salary: e.target.value })} /></div>
        <div><label className="label">Status</label>
          <select className="input" value={f.status || 'ACTIVE'} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {['ACTIVE','INACTIVE','TERMINATED'].map((s) => <option key={s}>{s}</option>)}
          </select></div>
      </div>
      <button className="btn-primary" onClick={save}>Save Changes</button>
    </div>
  )
}

function ServiceBookTab({ empId, flash, userName }) {
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ event_date: todayISO(), event_type: 'OTHER', description: '', order_no: '' })

  const load = async () => {
    const { data } = await supabase.from('service_book').select('*').eq('employee_id', empId).order('event_date', { ascending: false })
    setRows(data || [])
  }
  useEffect(() => { load() }, [empId])

  const add = async () => {
    if (!f.description) { flash('Description required.'); return }
    const { error } = await supabase.from('service_book').insert({ ...f, employee_id: empId, created_by: userName })
    if (error) flash(error.message); else { setF({ event_date: todayISO(), event_type: 'OTHER', description: '', order_no: '' }); load() }
  }
  const remove = async (id) => {
    await supabase.from('service_book').delete().eq('id', id); load()
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 items-end">
        <div><label className="label">Date</label>
          <input type="date" className="input" value={f.event_date} onChange={(e) => setF({ ...f, event_date: e.target.value })} /></div>
        <div><label className="label">Type</label>
          <select className="input" value={f.event_type} onChange={(e) => setF({ ...f, event_type: e.target.value })}>
            {['JOINING','PROMOTION','TRANSFER','TRAINING','AWARD','DISCIPLINARY','RESIGNATION','TERMINATION','OTHER'].map((t) => <option key={t}>{t}</option>)}
          </select></div>
        <div><label className="label">Description</label>
          <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <button className="btn-primary justify-center" onClick={add}><Plus size={14} /> Add</button>
      </div>
      <table className="w-full text-sm">
        <thead><tr><th className="th">Date</th><th className="th">Type</th><th className="th">Description</th><th className="th"></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="td money text-xs">{fmtDate(r.event_date)}</td>
              <td className="td text-xs">{r.event_type}</td>
              <td className="td text-sm">{r.description}</td>
              <td className="td text-right"><button onClick={() => remove(r.id)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={4}>No entries.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function NomineesTab({ empId, flash }) {
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ full_name: '', relation: '', share_pct: 100, nid_no: '', phone: '' })

  const load = async () => {
    const { data } = await supabase.from('employee_nominees').select('*').eq('employee_id', empId)
    setRows(data || [])
  }
  useEffect(() => { load() }, [empId])

  const add = async () => {
    if (!f.full_name || !f.relation) { flash('Name and relation required.'); return }
    const { error } = await supabase.from('employee_nominees').insert({ ...f, employee_id: empId, share_pct: +f.share_pct })
    if (error) flash(error.message); else { setF({ full_name: '', relation: '', share_pct: 100, nid_no: '', phone: '' }); load() }
  }
  const remove = async (id) => {
    await supabase.from('employee_nominees').delete().eq('id', id); load()
  }

  const totalShare = rows.reduce((s, r) => s + (+r.share_pct || 0), 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 items-end">
        <div><label className="label">Full Name</label><input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div><label className="label">Relation</label><input className="input" value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })} /></div>
        <div><label className="label">Share %</label><input type="number" className="input" value={f.share_pct} onChange={(e) => setF({ ...f, share_pct: e.target.value })} /></div>
        <div><label className="label">NID No.</label><input className="input" value={f.nid_no} onChange={(e) => setF({ ...f, nid_no: e.target.value })} /></div>
        <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <button className="btn-primary justify-center" onClick={add}><Plus size={14} /> Add</button>
      </div>
      {totalShare !== 100 && rows.length > 0 && (
        <div className="text-xs text-amber font-semibold">Warning: total share is {totalShare}% (should be 100%)</div>
      )}
      <table className="w-full text-sm">
        <thead><tr><th className="th">Name</th><th className="th">Relation</th><th className="th text-right">Share %</th><th className="th">NID</th><th className="th">Phone</th><th className="th"></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="td font-medium">{r.full_name}</td>
              <td className="td text-xs">{r.relation}</td>
              <td className="td text-right">{r.share_pct}%</td>
              <td className="td text-xs">{r.nid_no || '—'}</td>
              <td className="td text-xs">{r.phone || '—'}</td>
              <td className="td text-right"><button onClick={() => remove(r.id)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={6}>No nominees.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

const TABS = ['Profile', 'Service Book', 'Nominees']

export default function EmployeeProfileDrawer({ emp, onClose, flash, onSave, userName }) {
  const [activeTab, setActiveTab] = useState('Profile')
  if (!emp) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-leaf flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-pine text-lg">{emp.full_name}</h2>
            <div className="text-xs text-pine/50">{emp.designation}{emp.department ? ` · ${emp.department}` : ''}</div>
          </div>
          <button onClick={onClose} className="text-pine/40 hover:text-pine"><X size={18} /></button>
        </div>
        <div className="flex gap-1 px-6 pt-3 border-b border-leaf/60">
          {TABS.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t ${activeTab === t ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'Profile'      && <ProfileTab emp={emp} onSave={onSave} flash={flash} />}
          {activeTab === 'Service Book' && <ServiceBookTab empId={emp.id} flash={flash} userName={userName} />}
          {activeTab === 'Nominees'     && <NomineesTab empId={emp.id} flash={flash} />}
        </div>
      </div>
    </div>
  )
}
