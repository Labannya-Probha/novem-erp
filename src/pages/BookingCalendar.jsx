import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import * as pms from '../lib/pms.api'
import { fmtBDT, todayISO } from '../lib/helpers'
import { CalendarRange, ChevronLeft, ChevronRight, Move, X } from 'lucide-react'

const DAY_W = 34 // প্রতি দিনের কলাম px — desktop এ লেখা বেশি দেখাতে বাড়াও
const monthDays = (ym) => { const [y, m] = ym.split('-').map(Number); const n = new Date(y, m, 0).getDate(); return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`) }
const shiftMonth = (ym, d) => { const [y, m] = ym.split('-').map(Number); const dt = new Date(y, m - 1 + d, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` }
const addDays = (d, n) => { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10) }
const nextDay = (d) => addDays(d, 1)
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)
const STATUS_BG = { CONFIRMED: '#fcd9a6', CHECKED_IN: '#2E7D32', CHECKED_OUT: '#c7d6cb', SETTLED: '#bfe3c4', QUOTED: '#e7d9b0' }

export default function BookingCalendar({ openReservation, onNewReservation }) {
  const [ym, setYm] = useState(todayISO().slice(0, 7))
  const [rooms, setRooms] = useState([])
  const [cells, setCells] = useState({}) // `${room_id}|${day}` -> cell
  const [loading, setLoading] = useState(false)
  const [moveMode, setMoveMode] = useState(false)
  const [picked, setPicked] = useState(null) // {rrId, reservationId, nights, label}
  const [msg, setMsg] = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }

  const load = async () => {
    setLoading(true)
    const days = monthDays(ym)
    const start = days[0], end = days[days.length - 1]
    const [{ data: rm }, { data: rr }] = await Promise.all([
      supabase.from('rooms').select('*').eq('is_active', true).order('room_no'),
      supabase.from('reservation_rooms')
        .select('id, room_id, from_date, to_date, reservations!inner(id, res_no, reservation_name, status, check_in, check_out, source, guests:primary_guest_id(full_name, phone))')
        .in('reservations.status', ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'SETTLED', 'QUOTED'])
        .lte('from_date', end).gte('to_date', start),
    ])
    setRooms(rm || [])
    const map = {}
    for (const row of rr || []) {
      const res = row.reservations
      const ci = new Date(row.from_date || res.check_in).toISOString().split('T')[0];
      const co = new Date(row.to_date || res.check_out).toISOString().split('T')[0];
      const cell = { ...res, rrId: row.id, rr_ci: ci, rr_co: co }
      for (const day of days) if (day >= ci && day < co) map[`${row.room_id}|${day}`] = cell
    }
    setCells(map); setLoading(false)
  }
  useEffect(() => { load() }, [ym])

  // tap a target room+date while holding a booking → move it (nights preserved)
  const dropOn = async (roomId, date) => {
    if (!picked) return
    const from_date = date
    const to_date = addDays(date, picked.nights)
    const { free } = await pms.isRoomFree({ room_id: roomId, from_date, to_date, exclude_rr_id: picked.rrId })
    if (!free) { flash(`এই room ${from_date} থেকে আগে থেকেই booked.`); return }
    const { error } = await pms.moveBooking({ rrId: picked.rrId, room_id: roomId, from_date, to_date })
    if (error) { flash(error.message); return }
    await pms.syncReservationWindow(picked.reservationId)
    flash(`${picked.label} সরানো হলো → ${from_date}`)
    setPicked(null)
    await load()
  }

  const days = monthDays(ym)
  const occRoomNights = Object.keys(cells).length
  const occPct = rooms.length ? (occRoomNights / (rooms.length * days.length)) * 100 : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2"><CalendarRange className="text-forest" /> Booking Calendar</h1>
          <p className="text-sm text-pine/60">Occupied cell এ tap করে reservation খুলুন · খালি cell এ tap করে নতুন booking · Move দিয়ে booking সরান।</p>
          <p className="text-[11px] text-pine/40 sm:hidden">↔ পাশে swipe করে পুরো মাস দেখুন</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className={`btn-ghost !px-3 ${moveMode ? '!bg-amber/20 !text-amber' : ''}`} onClick={() => { setMoveMode((v) => !v); setPicked(null) }} title="Move/shift a booking to another room or date">
            <Move size={15} /> {moveMode ? 'Move: ON' : 'Move'}
          </button>
          <button className="btn-ghost !px-2" onClick={() => setYm(shiftMonth(ym, -1))}><ChevronLeft size={16} /></button>
          <input type="month" className="input !w-44" value={ym} onChange={(e) => setYm(e.target.value)} />
          <button className="btn-ghost !px-2" onClick={() => setYm(shiftMonth(ym, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>

      {moveMode && (
        <div className="px-4 py-2 rounded-lg bg-amber/10 text-amber text-sm font-medium flex items-center justify-between gap-3">
          <span>{picked ? `"${picked.label}" ধরা আছে — যেখানে সরাবেন সেই ঘরে tap করুন।` : 'যে booking সরাবেন সেটিতে tap করুন।'}</span>
          {picked && <button className="btn-ghost !py-1 text-xs" onClick={() => setPicked(null)}><X size={13} /> বাতিল</button>}
        </div>
      )}
      {msg && <div className="px-4 py-2 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}

      <div className="flex flex-wrap gap-3 text-xs items-center">
        <span className="font-semibold text-pine">Occupancy this month: <span className="money">{occPct.toFixed(1)}%</span> ({occRoomNights}/{rooms.length * days.length} room-nights)</span>
        {Object.entries(STATUS_BG).map(([s, bg]) => (<span key={s} className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: bg }} />{s}</span>))}
      </div>

      <div className="card overflow-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {loading ? <div className="p-6 text-pine/50">Loading…</div> : (
          <table className="border-collapse" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th className="th sticky left-0 bg-white z-10 border-r border-leaf" style={{ minWidth: 150 }}>Room</th>
                {days.map((d) => { const dow = new Date(d + 'T00:00:00').getDay(); const isWe = dow === 5 || dow === 6; return (
                  <th key={d} className={`th text-center !px-1 ${isWe ? 'bg-leaf/40' : ''}`} style={{ minWidth: DAY_W }} title={d}>{d.slice(8)}</th>) })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => {
                const tds = []
                let i = 0
                while (i < days.length) {
                  const d = days[i]
                  const res = cells[`${r.id}|${d}`]
                  if (res) {
                    let span = 1
                    while (i + span < days.length && cells[`${r.id}|${days[i + span]}`]?.id === res.id) span++
                    const g = res.guests
                    const name = g?.full_name || res.reservation_name || '—'
                    const label = `${name} · ${g?.phone || ''} · ${res.res_no}${res.source ? ' · ' + res.source : ''}`
                    tds.push(
                      <td key={d} colSpan={span} className="border border-leaf/60 p-0" style={{ height: 34 }}>
                        <button
                          onClick={() => {
                            if (!moveMode) return openReservation(res.id)
                            if (picked) return dropOn(r.id, d)
                            setPicked({ rrId: res.rrId, reservationId: res.id, nights: daysBetween(res.rr_ci, res.rr_co), label: res.res_no })
                            flash(`${res.res_no} ধরা হলো — এখন নতুন ঘরে tap করুন।`)
                          }}
                          title={`${label} (${res.status})`}
                          className={`w-full h-full text-left text-[10px] leading-tight px-1 overflow-hidden whitespace-nowrap text-ellipsis ${res.rrId === picked?.rrId ? 'ring-2 ring-amber ring-inset' : ''}`}
                          style={{ background: STATUS_BG[res.status] || '#ddd', color: res.status === 'CHECKED_IN' ? '#fff' : '#1B4D2E' }}
                        >
                          {label}
                        </button>
                      </td>
                    )
                    i += span
                  } else {
                    tds.push(
                      <td key={d} className="border border-leaf/60 p-0" style={{ minWidth: DAY_W, height: 34 }}>
                        <button
                          onClick={() => {
                            if (moveMode) { if (picked) dropOn(r.id, d); return }
                            onNewReservation?.({ room_id: r.id, from_date: d, to_date: nextDay(d) })
                          }}
                          title={moveMode ? `এখানে সরান — Room ${r.room_no}, ${d}` : `New reservation — Room ${r.room_no}, ${d}`}
                          className={`w-full h-full transition-colors ${moveMode && picked ? 'hover:bg-amber/25' : 'hover:bg-forest/15'}`}
                        />
                      </td>
                    )
                    i += 1
                  }
                }
                return (
                  <tr key={r.id}>
                    <td className="td sticky left-0 bg-white z-10 font-medium text-sm border-r border-leaf" style={{ minWidth: 150 }}>
                      {r.room_no}{r.room_name ? ` · ${r.room_name}` : ''}
                      <div className="text-[10px] text-pine/50 money">{fmtBDT(r.base_rate)}</div>
                    </td>
                    {tds}
                  </tr>
                )
              })}
              {rooms.length === 0 && <tr><td className="td text-pine/40" colSpan={days.length + 1}>No active rooms — add rooms in Settings.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
