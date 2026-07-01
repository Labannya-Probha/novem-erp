import { useState } from 'react'
import { CheckCircle2, Pencil, Save, Trash2, X } from 'lucide-react'
import { computeCharge, fmtBDT, rateFor, todayISO } from '../../lib/helpers'
import { supabase } from '../../supabase'

export function AddonTable({ addons, taxConfig, res, userName, reload, flash, isAdmin }) {
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ label: '', price: '', qty: 1 })
  const [busy, setBusy] = useState(false)

  const lineTotal = (a) => Number(a.price) * Number(a.qty)
  const addonsTotal = addons.reduce((s, a) => s + lineTotal(a), 0)

  const startEdit = (a) => {
    setEditId(a.id)
    setEditForm({ label: a.label, price: String(a.price), qty: String(a.qty) })
  }

  const cancelEdit = () => { setEditId(null) }

  const saveEdit = async (a) => {
    if (!editForm.label.trim() || !editForm.price) return
    setBusy(true)
    const { error } = await supabase
      .from('reservation_addons')
      .update({ label: editForm.label, price: Number(editForm.price), qty: Number(editForm.qty) || 1 })
      .eq('id', a.id)
    setBusy(false)
    if (error) { flash(error.message); return }
    setEditId(null)
    flash('Item updated.')
    reload()
  }

  const cancelAddon = async (a) => {
    if (a.posted) {
      if (!isAdmin) { flash('Administrator access required to remove posted items.'); return }
      if (!window.confirm('This item is already posted to folio. Remove it and reverse the charge?')) return
      if (a.folio_charge_id) {
        await supabase.from('folio_charges').delete().eq('id', a.folio_charge_id)
      }
    }
    const { error } = await supabase.from('reservation_addons').delete().eq('id', a.id)
    if (error) { flash(error.message); return }
    flash('Item removed.')
    reload()
  }

  const confirmAddon = async (a) => {
    if (a.posted) { flash('Already posted to folio.'); return }
    setBusy(true)
    try {
      const rate = rateFor(taxConfig, 'OTHER', todayISO())
      const calc = computeCharge(lineTotal(a), 0, rate)
      const { data: fc, error: fcErr } = await supabase
        .from('folio_charges')
        .insert({
          reservation_id: res.id,
          charge_date: todayISO(),
          charge_type: 'OTHER',
          description: `${a.label}${a.qty > 1 ? ` × ${a.qty}` : ''}`,
          ...calc,
          created_by: userName,
        })
        .select().single()
      if (fcErr) throw fcErr
      await supabase.from('reservation_addons')
        .update({ posted: true, folio_charge_id: fc.id })
        .eq('id', a.id)
      flash(`"${a.label}" posted to folio.`)
      reload()
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  return (
    <div className="border border-leaf rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-leaf/30">
            <th className="th">Item</th>
            <th className="th text-right">Price</th>
            <th className="th text-right">Qty</th>
            <th className="th text-right">Total</th>
            <th className="th text-center">Status</th>
            <th className="th text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {addons.map((a) => (
            <tr key={a.id} className={`border-t border-leaf/60 ${editId === a.id ? 'bg-leaf/20' : ''}`}>
              {editId === a.id ? (
                /* ── Edit mode ── */
                <>
                  <td className="td" colSpan={3}>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        className="input flex-1 !py-1 text-sm"
                        value={editForm.label}
                        onChange={e => setEditForm(p => ({ ...p, label: e.target.value }))}
                        placeholder="Item name"
                      />
                      <input
                        type="number"
                        className="input !w-24 !py-1 money text-right"
                        value={editForm.price}
                        onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))}
                        placeholder="Price"
                      />
                      <input
                        type="number"
                        min="1"
                        className="input !w-16 !py-1 money text-right"
                        value={editForm.qty}
                        onChange={e => setEditForm(p => ({ ...p, qty: e.target.value }))}
                        placeholder="Qty"
                      />
                    </div>
                  </td>
                  <td className="td money text-right font-semibold">
                    {fmtBDT((Number(editForm.price) || 0) * (Number(editForm.qty) || 1))}
                  </td>
                  <td className="td text-center">
                    <span className="status-chip bg-amber/20 text-amber">Editing</span>
                  </td>
                  <td className="td">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => saveEdit(a)}
                        disabled={busy}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-forest text-white text-xs font-semibold hover:bg-forest/80 transition-colors"
                        title="Save"
                      >
                        <Save size={12} /> Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-leaf text-pine/60 text-xs hover:bg-leaf transition-colors"
                        title="Cancel edit"
                      >
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  </td>
                </>
              ) : (
                /* ── View mode ── */
                <>
                  <td className="td">{a.label}</td>
                  <td className="td money text-right">{fmtBDT(a.price)}</td>
                  <td className="td money text-right">{a.qty}</td>
                  <td className="td money text-right font-semibold">{fmtBDT(lineTotal(a))}</td>
                  <td className="td text-center">
                    <span className={`status-chip ${a.posted ? 'bg-forest/15 text-forest' : 'bg-amber/20 text-amber'}`}>
                      {a.posted ? 'Posted' : 'Pending'}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex gap-1 justify-center">
                      {/* Edit — only if not posted */}
                      {!a.posted && (
                        <button
                          onClick={() => startEdit(a)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest transition-colors"
                          title="Edit item"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {/* Confirm — post to folio */}
                      {!a.posted && (
                        <button
                          onClick={() => confirmAddon(a)}
                          disabled={busy}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-forest/10 text-pine/40 hover:text-forest transition-colors"
                          title="Confirm — post to folio"
                        >
                          <CheckCircle2 size={13} />
                        </button>
                      )}
                      {/* Cancel/Delete */}
                      <button
                        onClick={() => cancelAddon(a)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-300 hover:text-red-600 transition-colors"
                        title={a.posted ? 'Remove & reverse charge' : 'Remove item'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-leaf/40 font-bold money border-t border-leaf">
            <td className="td" colSpan={3}>Total</td>
            <td className="td text-right">{fmtBDT(addonsTotal)}</td>
            <td className="td" colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default AddonTable
