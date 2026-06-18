import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, todayISO } from '../lib/helpers'
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'

const DAY_W = 34
const monthDays = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  const n = new Date(y, m, 0).getDate()
  return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)
}
const shiftMonth = (ym, d) => {
  const [y, m] = ym.split('-').map(Number)
  const dt = new Date(y, m - 1 + d, 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}
const addDays = (d, n) => {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() + n)
  return dt.toISOString().slice(0, 10)
}
const nextDay = (d) => addDays(d, 1)

const STATUS_BG = {
  QUERY:       '#dbeafe',
  QUOTED:      '#e7d9b0',
  CONFIRMED:   '#fcd9a6',
  CHECKED_IN:  '#2E7D32',
  CHECKED_OUT: '#c7d6cb',
  SETTLED:     '#bfe3c4',
}

export default function BookingCalendar({ openReservation, onNewReservation }) {
  const [ym, setYm]         = useState(todayISO().slice(0, 7))
  const [rooms, setRooms]   = useState([])
  const [cells, setCells]   = useState({})
  const [paidSet, setPaidSet] = useState(new Set()) // reservation_ids with ≥1 payment
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState('')

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }

  const load = async () => {
    setLoading(true)
    const days  = monthDays(ym)
    const start = days[0]
    const end   = days[days.length - 1]

    const [
      { data: rm,  error: rmErr  },
      { data: rr,  error: rrErr  },
    ] = await Promise.all([
      supabase.from('rooms').select('*').eq('is_active', true).order('room_no'),
      supabase
        .from('reservation_rooms')
        .select(
          'id, room_id, from_date, to_date, ' +
          'reservations!inner(id, res_no, reservation_name, status, check_in, check_out, source, ' +
          'guests:primary_guest_id(full_name, phone))'
        )
        .in('reservations.status', ['QUERY','QUOTED','CONFIRMED','CHECKED_IN','CHECKED_OUT','SETTLED'])
        .lte('from_date', end)
        .gte('to_date', start),
    ])

    if (rmErr || rrErr) {
      flash(rmErr?.message || rrErr?.message || 'Failed to load calendar.')
      setLoading(false)
      return
    }

    // Build cell map
    const map = {}
    const resIds = []
    for (const row of rr || []) {
      const res = row.reservations
      const ci  = new Date(row.from_date || res.check_in).toISOString().slice(0, 10)
      const co  = new Date(row.to_date   || res.check_out).toISOString().slice(0, 10)
      const cell = { ...res, rrId: row.id, rr_ci: ci, rr_co: co }
      for (const day of days) if (day >= ci && day < co) map[`${row.room_id}|${day}`] = cell
      if (!resIds.includes(res.id)) resIds.push(res.id)
    }

    // Fetch payment existence for all reservation IDs in view
    let paid = new Set()
    if (resIds.length > 0) {
      const { data: pmts } = await supabase
        .from('payments')
        .select('reservation_id')
        .in('reservation_id', resIds)
      for (const p of pmts || []) paid.add(p.reservation_id)
    }

    setRooms(rm || [])
    setCells(map)
    setPaidSet(paid)
    setLoading(false)
  }

  useEffect(() => { load() }, [ym])

  const days         = monthDays(ym)
  const occRoomNights = Object.keys(cells).length
  const occPct       = rooms.length ? (occRoomNights / (rooms.length * days.length)) * 100 : 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2">
            <CalendarRange className="text-forest" /> Booking Calendar
          </h1>
          <p className="text-[11px] text-pine/40 sm:hidden">↔ পাশে swipe করে পুরো মাস দেখুন</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-ghost !px-2" onClick={() => setYm(shiftMonth(ym, -1))}><ChevronLeft size={16} /></button>
          <input type="month" className="input !w-44" value={ym} onChange={(e) => setYm(e.target.value)} />
          <button className="btn-ghost !px-2" onClick={() => setYm(shiftMonth(ym, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>

      {msg && <div className="px-4 py-2 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}

      {/* Legend + occupancy */}
      <div className="flex flex-wrap gap-3 text-xs items-center">
        <span className="font-semibold text-pine">
          Occupancy: <span className="money">{occPct.toFixed(1)}%</span>{' '}
          ({occRoomNights}/{rooms.length * days.length} room-nights)
        </span>
        {Object.entries(STATUS_BG).map(([s, bg]) => (
          <span key={s} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: bg }} />
            {s.replace('_', ' ')}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="card overflow-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div className="p-6 text-pine/50">Loading…</div>
        ) : (
          <table className="border-collapse" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th
                  className="th sticky left-0 bg-white z-10 border-r border-leaf"
                  style={{ minWidth: 150 }}
                >
                  Room
                </th>
                {days.map((d) => {
                  const dow  = new Date(d + 'T00:00:00').getDay()
                  const isWe = dow === 5 || dow === 6
                  return (
                    <th
                      key={d}
                      className={`th text-center !px-1 ${isWe ? 'bg-leaf/40' : ''}`}
                      style={{ minWidth: DAY_W }}
                      title={d}
                    >
                      {d.slice(8)}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => {
                const tds = []
                let i = 0
                while (i < days.length) {
                  const d   = days[i]
                  const res = cells[`${r.id}|${d}`]

                  if (res) {
                    // Calculate colspan
                    let span = 1
                    while (
                      i + span < days.length &&
                      cells[`${r.id}|${days[i + span]}`]?.id === res.id
                    ) span++

                    const g           = res.guests
                    const name        = g?.full_name || res.reservation_name || '—'
                    const phone       = g?.phone || '—'
                    const resNo       = res.res_no || '—'
                    const advancePaid = paidSet.has(res.id)
                    const isCheckedIn = res.status === 'CHECKED_IN'
                    const tooltipText = `${name}\n${phone}\n${resNo}\nAdvance: ${advancePaid ? 'Paid' : 'Unpaid'}`

                    tds.push(
                      <td
                        key={d}
                        colSpan={span}
                        className="border border-leaf/60 p-0"
                        style={{ height: 60 }}
                      >
                        <button
                          onClick={() => openReservation(res.id)}
                          title={tooltipText}
                          className="w-full h-full text-left text-[10px] leading-[1.4] px-1.5 py-1 overflow-hidden"
                          style={{
                            background: STATUS_BG[res.status] || '#ddd',
                            color: isCheckedIn ? '#fff' : '#1B4D2E',
                          }}
                        >
                          <div className="truncate font-semibold">{name}</div>
                          <div className="truncate opacity-80">{phone}</div>
                          <div className="truncate font-mono opacity-90 text-[9px]">{resNo}</div>
                          <div
                            className={`truncate text-[9px] font-medium mt-0.5 ${
                              advancePaid
                                ? isCheckedIn ? 'opacity-70' : 'text-forest'
                                : 'text-red-600'
                            }`}
                          >
                            Advance: {advancePaid ? 'Paid ✓' : 'Unpaid ✗'}
                          </div>
                        </button>
                      </td>
                    )
                    i += span
                  } else {
                    tds.push(
                      <td
                        key={d}
                        className="border border-leaf/60 p-0"
                        style={{ minWidth: DAY_W, height: 60 }}
                      >
                        <button
                          onClick={() => onNewReservation?.({ room_id: r.id, from_date: d, to_date: nextDay(d) })}
                          title={`New reservation — Room ${r.room_no}, ${d}`}
                          className="w-full h-full transition-colors hover:bg-forest/15"
                        />
                      </td>
                    )
                    i += 1
                  }
                }

                return (
                  <tr key={r.id}>
                    <td
                      className="td sticky left-0 bg-white z-10 font-medium text-sm border-r border-leaf"
                      style={{ minWidth: 150 }}
                    >
                      {r.room_no}{r.room_name ? ` · ${r.room_name}` : ''}
                      <div className="text-[10px] text-pine/50 money">{fmtBDT(r.base_rate)}</div>
                    </td>
                    {tds}
                  </tr>
                )
              })}
              {rooms.length === 0 && (
                <tr>
                  <td className="td text-pine/40" colSpan={days.length + 1}>
                    No active rooms — add rooms in Settings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
