import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Search } from 'lucide-react'

export default function GuestPicker({ close, pick }) {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  useEffect(() => {
    supabase.from('reservations')
      .select('id,res_no,reservation_name, guests:primary_guest_id(full_name), reservation_rooms(rooms(room_no))')
      .eq('status', 'CHECKED_IN')
      .then(({ data }) => setRows(data || []))
  }, [])
  const filtered = rows.filter((r) => {
    const roomStr = (r.reservation_rooms || []).map((x) => x.rooms?.room_no).join(', ')
    return !q || [r.res_no, r.reservation_name, r.guests?.full_name, roomStr].join(' ').toLowerCase().includes(q.toLowerCase())
  })
  return (
    <div className="fixed inset-0 bg-ink/60 z-40 flex items-start justify-center p-3 sm:p-6 overflow-auto overscroll-contain">
      <div className="card max-w-lg w-full p-5 my-0 sm:my-10 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-5rem)] flex flex-col">
        <h3 className="font-display font-semibold text-pine mb-3">In-house guests (checked-in)</h3>
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-2.5 text-pine/40" />
          <input className="input pl-9" autoFocus placeholder="Search guest or room no…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto space-y-2">
          {filtered.map((r) => {
            const roomStr = (r.reservation_rooms || []).map((x) => x.rooms?.room_no).join(', ')
            const name = r.guests?.full_name || r.reservation_name
            return (
              <button key={r.id} onClick={() => pick({ reservation_id: r.id, guest_name: name, room_no: roomStr })}
                className="w-full flex justify-between items-center p-3 rounded-lg border border-leaf hover:bg-leaf/40 text-left">
                <span className="font-semibold text-sm">{name}</span>
                <span className="text-xs text-pine/60 money">Room {roomStr || '—'} · {r.res_no}</span>
              </button>
            )
          })}
          {filtered.length === 0 && <p className="text-sm text-pine/50 text-center py-4">No checked-in guests found.</p>}
        </div>
        <div className="flex justify-end mt-3"><button className="btn-ghost" onClick={close}>Close</button></div>
      </div>
    </div>
  )
}
