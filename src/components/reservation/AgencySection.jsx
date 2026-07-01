import { useEffect, useState } from 'react'
import { Handshake, Plus } from 'lucide-react'
import { fmtBDT } from '../../lib/helpers'
import { supabase } from '../../supabase'

export function AgencySection({ res, reload, flash }) {
  const agency = res.agencies
  const [agencies, setAgencies]         = useState([])
  const [showPicker, setShowPicker]     = useState(false)
  const [editingDue, setEditingDue]     = useState(false)
  const [dueVal, setDueVal]             = useState('')

  useEffect(() => {
    if (showPicker)
      supabase.from('agencies').select('id,name,commission_rate').order('name')
        .then(({ data }) => setAgencies(data || []))
  }, [showPicker])

  const assign = async (id) => {
    const { error } = await supabase.from('reservations').update({ agency_id: id }).eq('id', res.id)
    if (error) flash(error.message)
    else { setShowPicker(false); reload(); flash('Agency assigned.') }
  }
  const unassign = async () => {
    if (!window.confirm(`Remove ${agency?.name || 'this agency'}?`)) return
    await supabase.from('reservations').update({ agency_id: null }).eq('id', res.id)
    reload(); flash('Agency unassigned.')
  }
  const saveDue = async () => {
    if (dueVal === '' || isNaN(Number(dueVal))) { flash('Enter a valid amount.'); return }
    await supabase.from('agencies').update({ due_balance: Number(dueVal) }).eq('id', res.agency_id)
    setEditingDue(false); reload(); flash('Agency due updated.')
  }
  const addDue = async () => {
    const amt = window.prompt('Add to agency due (৳):')
    if (!amt || isNaN(Number(amt))) return
    await supabase.from('agencies')
      .update({ due_balance: (agency?.due_balance || 0) + Number(amt) }).eq('id', res.agency_id)
    reload(); flash('Agency due updated.')
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-pine text-sm flex items-center gap-2">
          <Handshake size={15} className="text-forest" /> Agency / OTA
        </h3>
        {agency && (
          <div className="flex gap-2 text-xs">
            <button onClick={() => setShowPicker(true)} className="text-pine/50 hover:text-forest underline">Change</button>
            <span className="text-pine/20">·</span>
            <button onClick={unassign} className="text-red-400 hover:text-red-600 underline">Unassign</button>
          </div>
        )}
      </div>

      {!agency && !showPicker && (
        <>
          <p className="text-xs text-pine/50">No agency linked.</p>
          <button onClick={() => setShowPicker(true)} className="btn-ghost text-sm">
            <Plus size={13} /> Assign Agency
          </button>
        </>
      )}

      {showPicker && (
        <div className="border border-leaf rounded-lg p-2 max-h-40 overflow-y-auto">
          {agencies.length === 0 && <p className="text-xs text-pine/40 p-2">No agencies found.</p>}
          {agencies.map(a => (
            <button key={a.id} onClick={() => assign(a.id)}
              className="block w-full text-left px-2 py-1.5 text-sm rounded hover:bg-leaf/40">
              {a.name}
              {a.commission_rate > 0 && <span className="text-xs text-pine/40 ml-2">{a.commission_rate}% commission</span>}
            </button>
          ))}
          <button onClick={() => setShowPicker(false)}
            className="block w-full text-left px-2 py-1.5 text-xs text-pine/40 hover:bg-leaf/40">Cancel</button>
        </div>
      )}

      {agency && (
        <>
          <div>
            <div className="font-semibold text-pine">{agency.name}</div>
            {agency.commission_rate > 0 && (
              <div className="text-xs text-pine/50">Commission: {agency.commission_rate}%</div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-pine/60">Due balance:</span>
            {!editingDue ? (
              <>
                <span className="font-bold money text-pine">{fmtBDT(agency.due_balance || 0)}</span>
                <button onClick={() => { setDueVal(String(agency.due_balance || 0)); setEditingDue(true) }}
                  className="text-xs text-pine/40 hover:text-forest underline">Edit</button>
                <button onClick={addDue} className="text-xs text-forest hover:underline">+ Add</button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input type="number" className="input money !w-28 !py-1" value={dueVal}
                  onChange={e => setDueVal(e.target.value)} />
                <button onClick={saveDue} className="text-xs text-forest font-semibold underline">Save</button>
                <button onClick={() => setEditingDue(false)} className="text-xs text-pine/40 underline">Cancel</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default AgencySection
