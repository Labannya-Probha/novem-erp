import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtDate, todayISO, STATUS_COLORS } from '../lib/helpers'
import { BedDouble, Sparkles, Brush, Wrench, DoorOpen, RefreshCw } from 'lucide-react'
import KPICards from '../components/KPICards.jsx'

const HK_STATES = ['Clean', 'Dirty', 'Inspected', 'Out of Order']
const HK_STYLE = {
  'Clean': 'bg-forest/15 text-forest border-forest/30',
  'Inspected': 'bg-sky-100 text-sky-700 border-sky-300',
  'Dirty': 'bg-amber/20 text-amber-700 border-amber/40',
  'Out of Order': 'bg-red-100 text-red-700 border-red-300',
}
const HK_ICON = { 'Clean': Sparkles, 'Inspected': BedDouble, 'Dirty': Brush, 'Out of Order': Wrench }
const OCC_STYLE = { OCCUPIED: 'bg-pine text-white', ARRIVAL: 'bg-amber text-white', DEPARTURE: 'bg-sky-600 text-white', VACANT: 'bg-leaf/50 text-pine' }
const OCC_LABEL = { OCCUPIED: 'In-house', ARRIVAL: 'Arrival', DEPARTURE: 'Departure', VACANT: 'Vacant' }

export default function Dashboard({ openReservation }) {
  const [arrivals, setArrivals] = useState([])
  const [departures, setDepartures] = useState([])
  const [rooms, setRooms] = useState([])
  const [occ, setOcc] = useState({})
  const [boardBusy, setBoardBusy] = useState(false)
  const today = todayISO()

  const loadBoard = async () => {
    setBoardBusy(true)
    const { data: rm } = await supabase.from('rooms').select('id, room_no, room_name, room_type, hk_status, is_active').eq('is_active', true).order('room_no')
    const { data: rr } = await supabase
      .from('reservation_rooms')
      .select('room_id, reservations!inner(status, res_no, reservation_name, check_in, check_out, guests:primary_guest_id(full_name, phone))')
      .in('reservations.status', ['CHECKED_IN', 'CONFIRMED'])
    const map = {}
    for (const x of rr || []) {
      const r = x.reservations
      if (!r) continue
      const depToday = r.status === 'CHECKED_IN' && r.check_out === today
      const arrToday = r.status === 'CONFIRMED' && r.check_in === today
      let st = null
      if (depToday) st = 'DEPARTURE'
      else if (r.status === 'CHECKED_IN') st = 'OCCUPIED'
      else if (arrToday) st = 'ARRIVAL'
      if (st) map[x.room_id] = {
        st,
        guest: r.reservation_name || r.guests?.full_name,
        phone: r.guests?.phone || '',
        res_no: r.res_no,
        check_in: r.check_in,
        check_out: r.check_out,
      }
    }
    setRooms(rm || [])
    setOcc(map)
    setBoardBusy(false)
  }

  useEffect(() => {
    const load = async () => {
      const { data: arr } = await supabase.from('reservations')
        .select('id,res_no,reservation_name,check_in,check_out,status, guests:primary_guest_id(full_name)')
        .eq('check_in', today).in('status', ['QUERY', 'QUOTED', 'CONFIRMED'])
      setArrivals(arr || [])
      const { data: dep } = await supabase.from('reservations')
        .select('id,res_no,reservation_name,check_in,check_out,status, guests:primary_guest_id(full_name)')
        .eq('check_out', today).eq('status', 'CHECKED_IN')
      setDepartures(dep || [])
    }
    load()
    loadBoard()
  }, [])

  const cycleHK = async (room) => {
    const idx = HK_STATES.indexOf(room.hk_status || 'Clean')
    const next = HK_STATES[(idx + 1) % HK_STATES.length]
    setRooms((rs) => rs.map((r) => r.id === room.id ? { ...r, hk_status: next } : r))
    await supabase.from('rooms').update({ hk_status: next }).eq('id', room.id)
  }

  const List = ({ title, rows, empty }) => (
    <div className="card p-5">
      <h3 className="font-display font-semibold text-pine mb-3">{title}</h3>
      {rows.length === 0 && <p className="text-sm text-pine/50">{empty}</p>}
      <div className="space-y-2">
        {rows.map((r) => (
          <button key={r.id} onClick={() => openReservation(r.id)}
            className="w-full flex items-center justify-between gap-2 p-3 rounded-lg border border-leaf hover:bg-leaf/40 text-left">
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{r.reservation_name || r.guests?.full_name || '—'}</div>
              <div className="text-xs text-pine/60 money truncate">{r.res_no} · {fmtDate(r.check_in)} → {fmtDate(r.check_out)}</div>
            </div>
            <span className={`status-chip shrink-0 whitespace-nowrap ${STATUS_COLORS[r.status]}`}>{r.status.replace('_', ' ')}</span>
          </button>
        ))}
      </div>
    </div>
  )

  const groups = rooms.reduce((a, r) => { (a[r.room_type] = a[r.room_type] || []).push(r); return a }, {})
  const occCount = (s) => rooms.filter((r) => (occ[r.id] && occ[r.id].st) === s).length
  const hkAttn = rooms.filter((r) => ['Dirty', 'Out of Order'].includes(r.hk_status || 'Clean')).length

  return (
    <div>
      <h1 className="font-display text-xl sm:text-2xl font-bold text-pine mb-1">Front Office — {fmtDate(today)}</h1>
      <p className="text-sm text-pine/60 mb-6">The day at a glance.</p>
      <KPICards module="dashboard" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <List title="Expected arrivals" rows={arrivals} empty="No arrivals expected today." />
        <List title="Due to check out" rows={departures} empty="No departures due today." />
      </div>

      {/* ---------------- ROOM STATUS BOARD ---------------- */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-display text-lg font-bold text-pine flex items-center gap-2"><DoorOpen size={18} className="text-forest" /> Room Status Board</h2>
        <button className="btn-ghost !py-1" onClick={loadBoard} disabled={boardBusy}><RefreshCw size={14} className={boardBusy ? 'animate-spin' : ''} /> Refresh</button>
      </div>
      <div className="card p-3 mb-3 flex flex-wrap gap-3 text-[11px] text-pine/70">
        <span className="font-semibold text-pine/50 uppercase tracking-wide">Occupancy:</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-pine inline-block" /> In-house ({occCount('OCCUPIED')})</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber inline-block" /> Arrival ({occCount('ARRIVAL')})</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-600 inline-block" /> Departure ({occCount('DEPARTURE')})</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-leaf inline-block" /> Vacant</span>
        <span className="font-semibold text-pine/50 uppercase tracking-wide ml-2">HK need attention: {hkAttn}</span>
      </div>
      {Object.entries(groups).map(([type, list]) => (
        <div key={type} className="mb-4">
          <div className="text-[11px] uppercase tracking-widest text-pine/40 font-semibold mb-2">{type} · {list.length}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {list.map((room) => {
              const o = occ[room.id]
              const occSt = (o && o.st) || 'VACANT'
              const hk = room.hk_status || 'Clean'
              const Icon = HK_ICON[hk] || Sparkles
              return (
                <div key={room.id} className="card p-0 overflow-hidden border border-leaf">
                  <div className={`px-2 py-1.5 flex items-center justify-between ${OCC_STYLE[occSt]}`}>
                    <span className="font-bold text-xs flex items-center gap-1"><DoorOpen size={12} /> {room.room_no}</span>
                    <span className="text-[9px] font-medium opacity-90">{OCC_LABEL[occSt]}</span>
                  </div>
                  <div className="p-1.5 space-y-1.5">
                    <div className="text-[10px] text-pine/60 leading-tight h-6 overflow-hidden">{room.room_name}</div>
                    {o
                      ? (
                        <div className="text-[10px] text-pine leading-tight space-y-0.5">
                          <div className="truncate"><span className="text-pine/50">Res:</span> <span className="font-medium">{o.res_no || '—'}</span></div>
                          <div className="truncate"><span className="text-pine/50">Name:</span> {o.guest || '—'}</div>
                          <div className="truncate"><span className="text-pine/50">Mobile:</span> {o.phone || '—'}</div>
                        </div>
                      )
                      : <div className="text-[10px] text-pine/30 h-6">No booking</div>}
                    <button onClick={() => cycleHK(room)}
                      className={`w-full px-1.5 py-1 rounded-lg text-[10px] font-medium border flex items-center justify-center gap-1 hover:opacity-80 ${HK_STYLE[hk]}`}>
                      <Icon size={11} /> {hk}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
