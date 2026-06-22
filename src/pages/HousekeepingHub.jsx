import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import KPICards from '../components/KPICards.jsx'
import { BellRing } from 'lucide-react'

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

export default function HousekeepingHub({ role, isAdmin, userName }) {
  const [rooms, setRooms] = useState([])
  const [requests, setRequests] = useState([])
  const [msg, setMsg] = useState('')

  // Front Office / Reservation staff can VIEW room HK status but not change it —
  // only Admin/SUPERUSER/Manager can update housekeeping status.
  const canEdit = isAdmin || ['SUPERUSER', 'MANAGER', 'HOUSEKEEPING'].includes(role)

  const loadRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').eq('is_active', true).order('room_no')
    setRooms(data || [])
  }
  const loadRequests = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, description, status, created_at, due_date')
      .eq('source', 'CHECKOUT_CLEARANCE')
      .in('status', ['OPEN', 'IN_PROGRESS'])
      .order('created_at', { ascending: false })
      .limit(40)
    setRequests(data || [])
  }
  useEffect(() => { loadRooms(); loadRequests() }, [])

  const clearRoomRequests = async (room) => {
    const roomTag = `Room ${room.room_no}`
    const pendingIds = requests
      .filter((r) => (r.title || '').includes(roomTag))
      .map((r) => r.id)
    if (!pendingIds.length) return
    await supabase.from('tasks').update({ status: 'DONE', completed_by: userName || role || 'HOUSEKEEPING', completed_at: new Date().toISOString() }).in('id', pendingIds)
  }

  const updateStatus = async (room, newStatus) => {
    if (!canEdit) { setMsg('Front Office role cannot change housekeeping status — ask a Manager or Admin.'); setTimeout(() => setMsg(''), 4000); return }
    const { error } = await supabase.from('rooms').update({ hk_status: newStatus }).eq('id', room.id)
    if (error) { setMsg(error.message); setTimeout(() => setMsg(''), 4000); return }
    if (newStatus === CHECKOUT_CLEAR_STATUS) await clearRoomRequests(room)
    loadRooms()
    loadRequests()
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-pine mb-1">Housekeeping Hub</h1>
      <p className="text-sm text-pine/60 mb-5">Track and update the cleaning status of every room. Mark a room as Inspected to grant check-out clearance.</p>
      <KPICards module="housekeeping" />
      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{msg}</div>}
      {!canEdit && <div className="mb-4 px-4 py-2 rounded-lg bg-amber/10 text-amber text-sm">Read-only — your role can view housekeeping status but not change it.</div>}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-2 text-pine">
          <BellRing size={16} className="text-sky-600" />
          <h3 className="font-display font-semibold">Checkout Clearance Requests</h3>
          <span className="status-chip bg-sky-100 text-sky-700">{requests.length}</span>
        </div>
        {requests.length === 0 && <p className="text-sm text-pine/50">No pending clearance requests.</p>}
        {requests.length > 0 && (
          <div className="space-y-2">
            {requests.slice(0, 8).map((r) => (
              <div key={r.id} className="rounded-lg border border-leaf p-3 bg-white">
                <div className="text-sm font-semibold text-pine">{r.title}</div>
                {r.description && <div className="text-xs text-pine/60 whitespace-pre-wrap mt-0.5">{r.description}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

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
                onChange={(e) => updateStatus(room, e.target.value)}
                className="input"
                disabled={!canEdit}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                className="btn-ghost w-full justify-center"
                onClick={() => updateStatus(room, CHECKOUT_CLEAR_STATUS)}
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
