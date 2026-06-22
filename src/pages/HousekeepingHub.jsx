import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import KPICards from '../components/KPICards.jsx'

// Canonical HK vocabulary — must match Dashboard.jsx's HK_STATES exactly
// (previously this file used a different set: Occupied/Out of Service —
// that mismatch meant a status set on one page didn't render correctly
// styled on the other. 'Occupied' was dropped here since room occupancy
// is already tracked separately via reservation status on the Dashboard.)
const STATUSES = ['Clean', 'Dirty', 'Inspected', 'Out of Order']
const CHECKOUT_CLEAR_STATUS = 'Inspected'
const CHIP = {
  Clean: 'bg-forest/15 text-forest',
  Inspected: 'bg-sky-100 text-sky-700',
  Dirty: 'bg-amber/20 text-amber',
  'Out of Order': 'bg-red-100 text-red-600',
}

export default function HousekeepingHub({ role, isAdmin }) {
  const [rooms, setRooms] = useState([])
  const [msg, setMsg] = useState('')

  // Front Office / Reservation staff can VIEW room HK status but not change it —
  // only Admin/SUPERUSER/Manager can update housekeeping status.
  const canEdit = isAdmin || ['SUPERUSER', 'MANAGER', 'HOUSEKEEPING'].includes(role)

  const loadRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').eq('is_active', true).order('room_no')
    setRooms(data || [])
  }
  useEffect(() => { loadRooms() }, [])

  const updateStatus = async (id, newStatus) => {
    if (!canEdit) { setMsg('Front Office role cannot change housekeeping status — ask a Manager or Admin.'); setTimeout(() => setMsg(''), 4000); return }
    const { error } = await supabase.from('rooms').update({ hk_status: newStatus }).eq('id', id)
    if (error) { setMsg(error.message); setTimeout(() => setMsg(''), 4000); return }
    loadRooms()
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-pine mb-1">Housekeeping Hub</h1>
      <p className="text-sm text-pine/60 mb-5">Track and update the cleaning status of every room. Mark a room as Inspected to grant check-out clearance.</p>
      <KPICards module="housekeeping" />
      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{msg}</div>}
      {!canEdit && <div className="mb-4 px-4 py-2 rounded-lg bg-amber/10 text-amber text-sm">Read-only — your role can view housekeeping status but not change it.</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <div key={room.id} className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-pine">Room {room.room_no}{room.room_name ? ` · ${room.room_name}` : ''}</h3>
              <span className={`status-chip ${CHIP[room.hk_status] || 'bg-stone-200 text-stone-600'}`}>{room.hk_status || 'Clean'}</span>
            </div>
            <p className="text-xs text-pine/50 mt-1">{room.room_type}</p>
            <div className="mt-3 space-y-2">
              <label className="label">Change status</label>
              <select
                value={room.hk_status || 'Clean'}
                onChange={(e) => updateStatus(room.id, e.target.value)}
                className="input"
                disabled={!canEdit}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                className="btn-ghost w-full justify-center"
                onClick={() => updateStatus(room.id, CHECKOUT_CLEAR_STATUS)}
                disabled={!canEdit}
              >
                Mark checkout clearance
              </button>
            </div>
          </div>
        ))}
        {rooms.length === 0 && <p className="text-sm text-pine/40">No active rooms — add rooms in Settings.</p>}
      </div>
    </div>
  )
}
