import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, todayISO, STATUS_COLORS } from '../lib/helpers'
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'

const monthDays = (ym) => { const [y, m] = ym.split('-').map(Number); const n = new Date(y, m, 0).getDate(); return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`) }
const shiftMonth = (ym, d) => { const [y, m] = ym.split('-').map(Number); const dt = new Date(y, m - 1 + d, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` }
const nextDay = (d) => { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + 1); return dt.toISOString().slice(0, 10) }
const STATUS_BG = { CONFIRMED: '#fcd9a6', CHECKED_IN: '#2E7D32', CHECKED_OUT: '#c7d6cb', SETTLED: '#bfe3c4', QUOTED: '#e7d9b0' }

export default function BookingCalendar({ openReservation, onNewReservation }) {
  const [ym, setYm] = useState(todayISO().slice(0, 7))
  const [rooms, setRooms] = useState([])
  const [cells, setCells] = useState({}) // `${room_id}|${day}` -> reservation
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const days = monthDays(ym)
    const start = days[0], end = days[days.length - 1]
    const [{ data: rm }, { data: rr }] = await Promise.all([
      supabase.from('rooms').select('*').eq('is_active', true).order('room_no'),
      supabase.from('reservation_rooms').select('room_id, from_date, to_date, reservations!inner(id, res_no, reservation_name, status, check_in, check_out)')
        .in('reservations.status', ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'SETTLED', 'QUOTED'])
        .lte('reservations.check_in', end).gte('reservations.check_out', start),
    ])
    setRooms(rm || [])
    const map = {}
    for (const row of rr || []) {
      const res = row.reservations
      const ci = row.from_date || res.check_in
      const co = row.to_date || res.check_out
      for (const day of days) if (day >= ci && day < co) map[`${row.room_id}|${day}`] = res
    }
    setCells(map); setLoading(false)
  }
  useEffect(() => { load() }, [ym])

  const days = monthDays(ym)
  const occRoomNights = Object.keys(cells).length
  const occPct = rooms.length ? (occRoomNights / (rooms.length * days.length)) * 100 : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2"><CalendarRange className="text-forest" /> Booking Calendar</h1>          
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost !px-2" onClick={() => setYm(shiftMonth(ym, -1))}><ChevronLeft size={16} /></button>
          <input type="month" className="input !w-44" value={ym} onChange={(e) => setYm(e.target.value)} />
          <button className="btn-ghost !px-2" onClick={() => setYm(shiftMonth(ym, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs items-center">
        <span className="font-semibold text-pine">Occupancy this month: <span className="money">{occPct.toFixed(1)}%</span> ({occRoomNights}/{rooms.length * days.length} room-nights)</span>
        {Object.entries(STATUS_BG).map(([s, bg]) => (<span key={s} className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: bg }} />{s}</span>))}
      </div>

      <div className="card overflow-auto">
        {loading ? <div className="p-6 text-pine/50">Loading…</div> : (
          <table className="border-collapse" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th className="th sticky left-0 bg-white z-10" style={{ minWidth: 150 }}>Room</th>
                {days.map((d) => { const dow = new Date(d + 'T00:00:00').getDay(); const isWe = dow === 5 || dow === 6; return (
                  <th key={d} className={`th text-center !px-1 ${isWe ? 'bg-leaf/40' : ''}`} style={{ minWidth: 30 }} title={d}>{d.slice(8)}</th>) })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td className="td sticky left-0 bg-white z-10 font-medium text-sm" style={{ minWidth: 150 }}>{r.room_no}{r.room_name ? ` · ${r.room_name}` : ''}<div className="text-[10px] text-pine/50 money">{fmtBDT(r.base_rate)}</div></td>
                  {days.map((d) => { const res = cells[`${r.id}|${d}`]; return (
                    <td key={d} className="border border-leaf/60 p-0" style={{ minWidth: 30, height: 34 }}>
                      {res
                        ? <button onClick={() => openReservation(res.id)} title={`${res.res_no} — ${res.reservation_name || ''} (${res.status})`} className="w-full h-full" style={{ background: STATUS_BG[res.status] || '#ddd' }} />
                        : <button
                            onClick={() => onNewReservation?.({ room_id: r.id, from_date: d, to_date: nextDay(d) })}
                            title={`New reservation — Room ${r.room_no}, ${d}`}
                            className="w-full h-full hover:bg-forest/15 transition-colors"/>}
                    </td>) })}
                </tr>
              ))}
              {rooms.length === 0 && <tr><td className="td text-pine/40" colSpan={days.length + 1}>No active rooms — add rooms in Settings.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
