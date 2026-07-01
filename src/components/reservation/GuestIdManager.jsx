import { useState } from 'react'
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import SearchableSelect from '../SearchableSelect.jsx'
import { supabase } from '../../supabase'

export function GuestIdManager({ reservationId, resGuests, guestIds, locked, reload, flash }) {
  const [adding, setAdding]     = useState(false)
  const [editId, setEditId]     = useState(null)
  const [form, setForm]         = useState({ guest_name: '', id_type: 'NID', id_number: '', notes: '' })
  const [busy, setBusy]         = useState(false)

  const ID_TYPES = ['NID', 'Passport', 'Driving License', 'Birth Certificate', 'Other']

  const startAdd = (guestName = '') => {
    setForm({ guest_name: guestName, id_type: 'NID', id_number: '', notes: '' })
    setEditId(null)
    setAdding(true)
  }

  const startEdit = (idRow) => {
    setForm({ guest_name: idRow.guest_name || '', id_type: idRow.id_type, id_number: idRow.id_number, notes: idRow.notes || '' })
    setEditId(idRow.id)
    setAdding(true)
  }

  const cancel = () => { setAdding(false); setEditId(null) }

  const save = async () => {
    if (!form.id_number.trim()) { flash('ID number is required.'); return }
    setBusy(true)
    if (editId) {
      const { error } = await supabase.from('guest_ids').update({
        guest_name: form.guest_name, id_type: form.id_type,
        id_number: form.id_number.trim(), notes: form.notes,
      }).eq('id', editId)
      if (error) { flash(error.message); setBusy(false); return }
    } else {
      const { error } = await supabase.from('guest_ids').insert({
        reservation_id: reservationId,
        guest_name: form.guest_name, id_type: form.id_type,
        id_number: form.id_number.trim(), notes: form.notes,
      })
      if (error) { flash(error.message); setBusy(false); return }
    }
    setBusy(false)
    setAdding(false)
    setEditId(null)
    await reload()
  }

  const remove = async (id) => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    await supabase.from('guest_ids').delete().eq('id', id)
    await reload()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="label !mb-0">Photo ID / Valid Documents</label>
        {!locked && (
          <button
            type="button"
            className="btn-ghost !py-1 text-xs"
            onClick={() => startAdd()}
          >
            <Plus size={12} /> Add ID
          </button>
        )}
      </div>

      {/* Existing IDs list */}
      {guestIds.length === 0 && !adding && (
        <p className="text-xs text-pine/40 py-2">No ID documents recorded yet. Click "+ Add ID" to add NID, Passport, or other documents.</p>
      )}

      {guestIds.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {guestIds.map((id) => (
            <div key={id.id} className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg border border-leaf bg-leaf/10 text-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="status-chip bg-forest/15 text-forest text-xs font-semibold">{id.id_type}</span>
                  <span className="font-mono font-semibold text-pine">{id.id_number}</span>
                  {id.guest_name && <span className="text-pine/50 text-xs">· {id.guest_name}</span>}
                </div>
                {id.notes && <div className="text-xs text-pine/50 mt-0.5 truncate">{id.notes}</div>}
              </div>
              {!locked && (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(id)}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-leaf text-pine/40 hover:text-forest"
                    title="Edit"
                  ><Pencil size={11} /></button>
                  <button
                    onClick={() => remove(id.id)}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-red-300 hover:text-red-600"
                    title="Delete"
                  ><Trash2 size={11} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      {adding && (
        <div className="rounded-xl border border-leaf bg-white p-3 space-y-3 mt-2">
          <div className="text-xs font-semibold text-pine/60">{editId ? 'Edit ID document' : 'Add new ID document'}</div>

          {/* Guest name selector — pick from resGuests or type freely */}
          <div>
            <label className="label !text-xs">Guest name (optional)</label>
            <div className="flex gap-2">
              <select
                className="input flex-1"
                value={form.guest_name}
                onChange={(e) => setForm((p) => ({ ...p, guest_name: e.target.value }))}
              >
                <option value="">— Select guest or type below —</option>
                {resGuests.map((g) => (
                  <option key={g.id} value={g.guest_name}>{g.guest_name}{g.is_primary ? ' (Primary)' : ''}</option>
                ))}
              </select>
            </div>
            <input
              className="input mt-1 text-xs"
              placeholder="Or type guest name manually…"
              value={form.guest_name}
              onChange={(e) => setForm((p) => ({ ...p, guest_name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label !text-xs">ID type *</label>
              <SearchableSelect
                value={form.id_type}
                onChange={v => setForm((p) => ({ ...p, id_type: v }))}
                options={ID_TYPES}
                placeholder="Select ID type…"
              />
            </div>
            <div>
              <label className="label !text-xs">ID number *</label>
              <input
                className="input money"
                placeholder="e.g. 1234567890123"
                value={form.id_number}
                onChange={(e) => setForm((p) => ({ ...p, id_number: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
            </div>
          </div>

          <div>
            <label className="label !text-xs">Notes (optional)</label>
            <input
              className="input text-xs"
              placeholder="e.g. Copy attached, Expired — renewal submitted, etc."
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2">
            <button className="btn-primary !py-1.5 text-xs" onClick={save} disabled={busy || !form.id_number.trim()}>
              <Save size={12} /> {busy ? 'Saving…' : editId ? 'Update ID' : 'Save ID'}
            </button>
            <button className="btn-ghost !py-1.5 text-xs" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {/* Quick-add buttons per guest */}
      {!locked && !adding && resGuests.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {resGuests.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => startAdd(g.guest_name)}
              className="text-xs px-2 py-1 rounded-lg border border-leaf hover:bg-leaf text-pine/60 hover:text-pine transition-colors"
            >
              <Plus size={10} className="inline mr-0.5" /> Add ID for {g.guest_name?.split(' ')[0] || 'guest'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default GuestIdManager
