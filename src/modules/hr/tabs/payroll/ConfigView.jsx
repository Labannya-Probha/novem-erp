import { useEffect, useState } from 'react'
import { supabase } from '../../../../supabase'
import { fmtBDT } from '../../../../lib/helpers'
import { Plus, Trash2 } from 'lucide-react'

export default function ConfigView({ flash }) {
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ designation: '', allowance_name: 'House Rent', amount: '' })

  const load = async () => {
    const { data } = await supabase.from('allowance_config').select('*').eq('is_active', true).order('designation').order('allowance_name')
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!f.designation || !f.allowance_name || !f.amount) { flash('সব field পূরণ করুন।'); return }
    const { error } = await supabase.from('allowance_config').insert({ ...f, amount: +f.amount })
    if (error) flash(error.message)
    else { setF({ designation: '', allowance_name: 'House Rent', amount: '' }); load() }
  }

  const remove = async (id) => {
    const { error } = await supabase.from('allowance_config').update({ is_active: false }).eq('id', id)
    if (error) flash(error.message); else load()
  }

  const grouped = rows.reduce((acc, r) => {
    if (!acc[r.designation]) acc[r.designation] = []
    acc[r.designation].push(r)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-4 gap-2 items-end">
        <div>
          <label className="label">Designation</label>
          <input className="input" placeholder="e.g. Manager" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} />
        </div>
        <div>
          <label className="label">Allowance Name</label>
          <select className="input" value={f.allowance_name} onChange={(e) => setF({ ...f, allowance_name: e.target.value })}>
            {['Basic', 'House Rent', 'Medical', 'Conveyance', 'Internet/Telephone', 'Food Allowance', 'Other Allowance'].map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Amount (৳)</label>
          <input type="number" className="input money" placeholder="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </div>
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Add</button>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="card p-6 text-center text-pine/40 text-sm">Allowance config নেই। উপরে add করুন।</div>
      )}

      {Object.entries(grouped).map(([desig, items]) => (
        <div key={desig} className="card overflow-hidden">
          <div className="px-4 py-2 bg-leaf/30 font-semibold text-sm text-pine">{desig}</div>
          <table className="w-full">
            <thead><tr><th className="th">Allowance</th><th className="th text-right">Amount</th><th className="th"></th></tr></thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="td text-sm">{r.allowance_name}</td>
                  <td className="td money text-right">{fmtBDT(r.amount)}</td>
                  <td className="td text-right">
                    <button onClick={() => remove(r.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              <tr className="bg-leaf/10 font-semibold">
                <td className="td text-xs text-pine/60">Total</td>
                <td className="td money text-right">{fmtBDT(items.reduce((s, r) => s + +r.amount, 0))}</td>
                <td className="td" />
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
