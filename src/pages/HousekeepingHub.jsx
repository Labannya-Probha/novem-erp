import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const STATUSES = ['Clean', 'Dirty', 'Occupied', 'Out of Service']
const CHIP = {
  Clean: 'bg-forest/15 text-forest',
  Dirty: 'bg-amber/20 text-amber',
  Occupied: 'bg-pine/15 text-pine',
  'Out of Service': 'bg-red-100 text-red-600',
}

export default function HousekeepingHub() {
  const [rooms, setRooms] = useState([])
  const [msg, setMsg] = useState('')

  const loadRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').eq('is_active', true).order('room_no')
    setRooms(data || [])
  }
  useEffect(() => { loadRooms() }, [])

  const updateStatus = async (id, newStatus) => {
    const { error } = await supabase.from('rooms').update({ hk_status: newStatus }).eq('id', id)
    if (error) { setMsg(error.message); setTimeout(() => setMsg(''), 4000); return }
    loadRooms()
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-pine mb-1">Housekeeping Hub</h1>
      <p className="text-sm text-pine/60 mb-5">Track and update the cleaning status of every room.</p>
      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{msg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <div key={room.id} className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-pine">Room {room.room_no}{room.room_name ? ` · ${room.room_name}` : ''}</h3>
              <span className={`status-chip ${CHIP[room.hk_status] || 'bg-stone-200 text-stone-600'}`}>{room.hk_status || 'Clean'}</span>
            </div>
            <p className="text-xs text-pine/50 mt-1">{room.room_type}</p>
            <div className="mt-3">
              <label className="label">Change status</label>
              <select value={room.hk_status || 'Clean'} onChange={(e) => updateStatus(room.id, e.target.value)} className="input">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        ))}
        {rooms.length === 0 && <p className="text-sm text-pine/40">No active rooms — add rooms in Settings.</p>}
      </div>
    </div>
  )
}
