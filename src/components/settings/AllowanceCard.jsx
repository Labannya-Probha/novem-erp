import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { fmtBDT } from '../../lib/helpers'
import { Percent, Save, Plus, Trash2, Pencil } from 'lucide-react'

export default function AllowanceCard() {
  const [rows, setRows]     = useState([])
  const [msg, setMsg]       = useState('')
  const [editId, setEditId] = useState(null)
  const [editF, setEditF]   = useState({})
  const [f, setF] = useState({ designation: '', allowance_name: 'Internet/Telephone Allowance', amount: '' })
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const load  = async () => { const { data } = await supabase.from('allowance_config').select('*').order('designation'); setRows(data || []) }
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!f.designation.trim()) { flash('Enter a designation (or DEFAULT for the fallback amount).'); return }
    const { error } = await supabase.from('allowance_config').insert({
      designation: f.designation.trim(), allowance_name: f.allowance_name.trim() || 'Internet/Telephone Allowance', amount: +f.amount || 0,
    })
    if (error) flash(error.message.includes('duplicate') ? 'This designation + allowance already has a row — edit it instead.' : error.message)
    else { setF({ designation: '', allowance_name: 'Internet/Telephone Allowance', amount: '' }); load(); flash('Added.') }
  }
  const startEdit = (r) => { setEditId(r.id); setEditF({ designation: r.designation, allowance_name: r.allowance_name, amount: r.amount }) }
  const saveEdit  = async () => {
    const { error } = await supabase.from('allowance_config').update({
      designation: editF.designation, allowance_name: editF.allowance_name, amount: +editF.amount || 0, updated_at: new Date().toISOString(),
    }).eq('id', editId)
    if (error) flash(error.message); else { setEditId(null); load(); flash('Updated.') }
  }
  const toggleActive = async (r) => { await supabase.from('allowance_config').update({ is_active: !r.is_active, updated_at: new Date().toISOString() }).eq('id', r.id); load() }
  const del = async (id) => { await supabase.from('allowance_config').delete().eq('id', id); load() }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-1"><Percent size={18} className="text-forest" /> Allowance configuration</h2>
      <p className="text-xs text-pine/50 mb-4">Designation-wise fixed allowance amounts (e.g. Internet/Telephone) used when generating monthly payroll. Add a row named <span className="font-mono">DEFAULT</span> as a fallback for any designation without its own row.</p>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <input className="input" placeholder="Designation (e.g. Manager, DEFAULT)" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} />
        <input className="input col-span-2" placeholder="Allowance name" value={f.allowance_name} onChange={(e) => setF({ ...f, allowance_name: e.target.value })} />
        <input type="number" className="input money" placeholder="Amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Add</button>
      </div>
      <table className="w-full">
        <thead><tr><th className="th">Designation</th><th className="th">Allowance</th><th className="th text-right">Amount</th><th className="th">Status</th><th className="th"></th></tr></thead>
        <tbody>
          {rows.map((r) => editId === r.id ? (
            <tr key={r.id} className="bg-leaf/20">
              <td className="td"><input className="input !py-1" value={editF.designation} onChange={(e) => setEditF({ ...editF, designation: e.target.value })} /></td>
              <td className="td"><input className="input !py-1" value={editF.allowance_name} onChange={(e) => setEditF({ ...editF, allowance_name: e.target.value })} /></td>
              <td className="td"><input type="number" className="input money !py-1 !w-24 text-right" value={editF.amount} onChange={(e) => setEditF({ ...editF, amount: e.target.value })} /></td>
              <td className="td"><span className="text-xs text-pine/40">—</span></td>
              <td className="td">
                <div className="flex gap-1">
                  <button onClick={saveEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-forest/15 hover:bg-forest/30 text-forest" title="Save"><Save size={13} /></button>
                  <button onClick={() => setEditId(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40" title="Cancel">✕</button>
                </div>
              </td>
            </tr>
          ) : (
            <tr key={r.id} className={!r.is_active ? 'opacity-50' : ''}>
              <td className="td text-sm font-medium">{r.designation}</td>
              <td className="td text-sm">{r.allowance_name}</td>
              <td className="td money text-right">{fmtBDT(r.amount)}</td>
              <td className="td"><button onClick={() => toggleActive(r)} className={`status-chip ${r.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-500'}`}>{r.is_active ? 'Active' : 'Disabled'}</button></td>
              <td className="td">
                <div className="flex gap-1">
                  <button onClick={() => startEdit(r)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest" title="Edit"><Pencil size={13} /></button>
                  <button onClick={() => del(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-300 hover:text-red-600" title="Delete"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={5}>No allowance rows yet — add a DEFAULT row above so payroll has a fallback amount.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
