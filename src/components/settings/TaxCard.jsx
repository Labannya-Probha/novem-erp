import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { todayISO } from '../../lib/helpers'
import { Percent, Plus, Save, Trash2, Pencil } from 'lucide-react'

function TaxCard() {
  const [rows, setRows]   = useState([])
  const [msg, setMsg]     = useState('')
  const [editId, setEditId] = useState(null)
  const [editF, setEditF] = useState({})
  const [f, setF] = useState({ charge_type: 'ROOM', vat_pct: 15, service_charge_pct: 10, effective_from: todayISO() })
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const load  = async () => { const { data } = await supabase.from('tax_config').select('*').order('effective_from', { ascending: false }); setRows(data || []) }
  useEffect(() => { load() }, [])

  const add = async () => {
    const { error } = await supabase.from('tax_config').insert({ charge_type: f.charge_type, vat_pct: +f.vat_pct || 0, service_charge_pct: +f.service_charge_pct || 0, effective_from: f.effective_from })
    if (error) flash(error.message); else { load(); flash('Added.') }
  }
  const startEdit = (r) => { setEditId(r.id); setEditF({ charge_type: r.charge_type, vat_pct: r.vat_pct, service_charge_pct: r.service_charge_pct, effective_from: r.effective_from }) }
  const saveEdit  = async () => {
    const { error } = await supabase.from('tax_config').update({ charge_type: editF.charge_type, vat_pct: +editF.vat_pct || 0, service_charge_pct: +editF.service_charge_pct || 0, effective_from: editF.effective_from }).eq('id', editId)
    if (error) flash(error.message); else { setEditId(null); load(); flash('Updated.') }
  }
  const del = async (id) => { await supabase.from('tax_config').delete().eq('id', id); load() }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-pine flex items-center gap-2 mb-4"><Percent size={18} className="text-forest" /> NBR tax rates</h2>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-forest/10 text-forest text-sm">{msg}</div>}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <select className="input" value={f.charge_type} onChange={(e) => setF({ ...f, charge_type: e.target.value })}>
          {['ROOM', 'FOOD', 'OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="number" className="input money" placeholder="VAT %" value={f.vat_pct} onChange={(e) => setF({ ...f, vat_pct: e.target.value })} />
        <input type="number" className="input money" placeholder="SC %" value={f.service_charge_pct} onChange={(e) => setF({ ...f, service_charge_pct: e.target.value })} />
        <input type="date" className="input" value={f.effective_from} onChange={(e) => setF({ ...f, effective_from: e.target.value })} />
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Add</button>
      </div>
      <table className="w-full">
        <thead><tr><th className="th">Type</th><th className="th text-right">VAT %</th><th className="th text-right">SC %</th><th className="th">From</th><th className="th"></th></tr></thead>
        <tbody>
          {rows.map((r) => editId === r.id ? (
            <tr key={r.id} className="bg-leaf/20">
              <td className="td">
                <select className="input !py-1 !w-28" value={editF.charge_type} onChange={(e) => setEditF({ ...editF, charge_type: e.target.value })}>
                  {['ROOM', 'FOOD', 'OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td className="td"><input type="number" className="input money !py-1 !w-20 text-right" value={editF.vat_pct} onChange={(e) => setEditF({ ...editF, vat_pct: e.target.value })} /></td>
              <td className="td"><input type="number" className="input money !py-1 !w-20 text-right" value={editF.service_charge_pct} onChange={(e) => setEditF({ ...editF, service_charge_pct: e.target.value })} /></td>
              <td className="td"><input type="date" className="input !py-1" value={editF.effective_from} onChange={(e) => setEditF({ ...editF, effective_from: e.target.value })} /></td>
              <td className="td">
                <div className="flex gap-1">
                  <button onClick={saveEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-forest/15 hover:bg-forest/30 text-forest" title="Save"><Save size={13} /></button>
                  <button onClick={() => setEditId(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40" title="Cancel">✕</button>
                </div>
              </td>
            </tr>
          ) : (
            <tr key={r.id}>
              <td className="td">{r.charge_type}</td>
              <td className="td money text-right">{r.vat_pct}%</td>
              <td className="td money text-right">{r.service_charge_pct}%</td>
              <td className="td text-sm">{r.effective_from}</td>
              <td className="td">
                <div className="flex gap-1">
                  <button onClick={() => startEdit(r)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest" title="Edit"><Pencil size={13} /></button>
                  <button onClick={() => del(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-300 hover:text-red-600" title="Delete"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TaxCard
