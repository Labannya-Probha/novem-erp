import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import { fmtDate, todayISO, STATUS_COLORS } from '../lib/helpers'
import { BedDouble, Sparkles, Brush, Wrench, DoorOpen, RefreshCw, Clock, XCircle, Search, Users } from 'lucide-react'
import KPICards from '../components/KPICards.jsx'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { useToast } from '../components/Toast'
import { cn } from '../lib/utils'
const HK_STYLE = {
  'Clean':        'bg-forest/15 text-forest border-forest/30',
  'Inspected':    'bg-sky-100 text-sky-700 border-sky-300',
  'Dirty':        'bg-amber/20 text-amber-700 border-amber/40',
  'Out of Order': 'bg-red-100 text-red-700 border-red-300',
}
const HK_ICON = { 'Clean': Sparkles, 'Inspected': BedDouble, 'Dirty': Brush, 'Out of Order': Wrench }
const OCC_STYLE = {
  OCCUPIED:   'bg-pine text-white',
  ARRIVAL:    'bg-amber text-white',
  DEPARTURE:  'bg-sky-600 text-white',
  VACANT:     'bg-leaf/50 text-pine',
}
const OCC_LABEL = { OCCUPIED: 'In-house', ARRIVAL: 'Arrival', DEPARTURE: 'Departure', VACANT: 'Vacant' }
const STATUS_BADGE_VARIANTS = {
  QUERY: 'warning',
  QUOTED: 'info',
  CONFIRMED: 'success',
  CHECKED_IN: 'default',
  CANCELLED: 'destructive',
  NO_SHOW: 'destructive',
  COMPLETED: 'secondary',
}

function getStatusBadgeVariant(status) {
  return STATUS_BADGE_VARIANTS[status] || 'outline'
}

function getHousekeepingBadgeVariant(hk) {
  if (hk === 'Dirty') return 'warning'
  if (hk === 'Out of Order') return 'destructive'
  if (hk === 'Inspected') return 'info'
  return 'success'
}

export default function Dashboard({ openReservation, userName, role, isAdmin }) {
  const [arrivals, setArrivals] = useState([])
  const [departures, setDepartures] = useState([])
  const [rooms, setRooms] = useState([])
  const [occ, setOcc] = useState({})
  const [boardBusy, setBoardBusy] = useState(false)
  const [dayBusy, setDayBusy] = useState(false)
  const [foCloseRow, setFoCloseRow] = useState(null)
  const [allGuests, setAllGuests] = useState([])
  const [guestsBusy, setGuestsBusy] = useState(false)
  const [guestSearch, setGuestSearch] = useState('')
  const [guestStatusFilter, setGuestStatusFilter] = useState('ALL')
  const toast = useToast()
  const today = todayISO()
  const canCloseFrontDay = isAdmin || role === 'MANAGER' || role === 'FRONT_OFFICE' || role === 'ACCOUNTS'
  const canOpenDay = role === 'SUPERUSER'
  const flashDay = (m, type = 'info') => { toast(m, type) }

  const loadAllGuests = async () => {
    setGuestsBusy(true)
    const { data } = await supabase
      .from('reservations')
      .select('id,res_no,reservation_name,check_in,check_out,status,source, guests:primary_guest_id(full_name,phone,customer_id), reservation_rooms(rooms(room_no,room_name))')
      .order('check_in', { ascending: false })
      .limit(300)
    setAllGuests(data || [])
    setGuestsBusy(false)
  }

  const filteredGuests = useMemo(() => {
    const q = guestSearch.toLowerCase()
    return allGuests.filter((r) => {
      if (guestStatusFilter !== 'ALL' && r.status !== guestStatusFilter) return false
      if (!q) return true
      return [r.res_no, r.reservation_name, r.guests?.full_name, r.guests?.phone, r.guests?.customer_id]
        .join(' ').toLowerCase().includes(q)
    })
  }, [allGuests, guestSearch, guestStatusFilter])

  const loadBoard = async () => {
    setBoardBusy(true)
    const { data: rm } = await supabase.from('rooms').select('id, room_no, room_name, room_type, hk_status, is_active').eq('is_active', true).order('room_no')
    const { data: rr } = await supabase
      .from('reservation_rooms')
      .select('room_id, reservations!inner(id, status, res_no, reservation_name, check_in, check_out, guests:primary_guest_id(full_name, phone))')
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
        reservation_id: r.id,
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
    loadFrontOfficeClose()
    loadAllGuests()
  }, [])

  const loadFrontOfficeClose = async () => {
    const { data } = await supabase.from('day_closes').select('*').eq('close_date', today).eq('type', 'RESERVATION').maybeSingle()
    setFoCloseRow(data || null)
  }

  const closeFrontOfficeDay = async () => {
    if (!canCloseFrontDay) {
      flashDay('Front Office day-close requires Front Office, Accounts, Manager, Admin or SUPERUSER access.', 'warning')
      return
    }
    setDayBusy(true)
    const payload = { close_date: today, type: 'RESERVATION', closed_by: userName, closed_at: new Date().toISOString() }
    const { error: delErr } = await supabase.from('day_closes').delete().eq('close_date', today).eq('type', 'RESERVATION')
    if (delErr) {
      setDayBusy(false)
      flashDay(delErr.message, 'error')
      return
    }
    const { error } = await supabase.from('day_closes').insert(payload)
    setDayBusy(false)
    if (error) flashDay(error.message, 'error')
    else {
      flashDay(`Front Office day closed for ${today}.`, 'success')
      loadFrontOfficeClose()
    }
  }

  const openFrontOfficeDay = async () => {
    if (!canOpenDay) {
      flashDay('Only SUPERUSER can open a closed day.', 'warning')
      return
    }
    setDayBusy(true)
    const { error } = await supabase.from('day_closes').delete().eq('close_date', today).eq('type', 'RESERVATION')
    setDayBusy(false)
    if (error) flashDay(error.message, 'error')
    else {
      flashDay(`Front Office day opened for ${today}.`, 'success')
      loadFrontOfficeClose()
    }
  }

  const ReservationList = ({ title, rows, empty }) => (
    <Card className="erp-panel-card">
      <CardHeader className="pt-4 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0
          ? <p className="text-sm text-pine/50">{empty}</p>
          : (
            <div className="space-y-2">
              {rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openReservation(r.id)}
                  className="w-full flex items-center justify-between gap-2 p-3 rounded-lg border border-leaf/50 bg-white/80 hover:bg-leaf/20 text-left transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{r.reservation_name || r.guests?.full_name || '-'}</div>
                    <div className="text-xs text-pine/60 font-mono truncate">{r.res_no} - {fmtDate(r.check_in)} to {fmtDate(r.check_out)}</div>
                  </div>
                  <Badge variant={getStatusBadgeVariant(r.status)} className="shrink-0 whitespace-nowrap">
                    {r.status.replace('_', ' ')}
                  </Badge>
                </button>
              ))}
            </div>
          )
        }
      </CardContent>
    </Card>
  )

  const occCount = (s) => rooms.filter((r) => (occ[r.id] && occ[r.id].st) === s).length
  const hkAttn = rooms.filter((r) => ['Dirty', 'Out of Order'].includes(r.hk_status || 'Clean')).length
  const totalRooms = rooms.length
  const occupiedRooms = occCount('OCCUPIED')
  const arrivalRooms = occCount('ARRIVAL')
  const departureRooms = occCount('DEPARTURE')
  const readyRooms = rooms.filter((r) => !occ[r.id] && (r.hk_status || 'Clean') === 'Clean').length

  return (
    <div className="front-office-page">
      <Card className="erp-page-header-card no-print">
        <CardContent className="p-0">
          <div className="erp-page-header">
            <div className="min-w-0">
              <p className="erp-page-kicker">Front Office</p>
              <div>
                <h1>
                  Operational Desk
                </h1>
                <p className="erp-page-subtitle">{fmtDate(today)} - {userName || 'Current user'}</p>
              </div>
            </div>
            <div className="erp-header-metrics" aria-label="Front office room metrics">
              <div><span>Rooms</span><strong>{totalRooms}</strong></div>
              <div><span>In-house</span><strong>{occupiedRooms}</strong></div>
              <div><span>Ready</span><strong>{readyRooms}</strong></div>
              <div><span>HK Issues</span><strong>{hkAttn}</strong></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <KPICards module="dashboard" />

      <Card className="erp-control-strip mb-5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="font-semibold text-pine flex items-center gap-2">
                <Clock size={15} className="text-amber" /> Front Office Day Close
              </div>
              {foCloseRow && (
                <p className="text-xs text-pine/50 mt-1">
                  Closed by {foCloseRow.closed_by || '-'} at {fmtDate(foCloseRow.closed_at || foCloseRow.created_at || today)}.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={foCloseRow ? 'warning' : 'success'} className="capitalize">
                {foCloseRow ? 'Closed' : 'Open'}
              </Badge>
              {canOpenDay && foCloseRow && (
                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300" onClick={openFrontOfficeDay} disabled={dayBusy}>
                  <XCircle size={14} /> Day Open
                </Button>
              )}
              <Button variant="amber" size="sm" onClick={closeFrontOfficeDay} disabled={dayBusy}>
                <Clock size={14} /> Close Day
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <ReservationList title="Expected arrivals" rows={arrivals} empty="No arrivals expected today." />
        <ReservationList title="Due to check out" rows={departures} empty="No departures due today." />
      </div>

      <div className="erp-section-header no-print">
        <h2>
          <DoorOpen size={18} className="text-forest" /> Room Status Board
        </h2>
        <Button variant="outline" size="sm" onClick={loadBoard} disabled={boardBusy}>
          <RefreshCw size={14} className={boardBusy ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      <Card className="erp-board-legend no-print">
        <span className="font-semibold text-pine/50 uppercase tracking-wide">Occupancy:</span>
        <Badge variant="default" className="bg-pine text-white">In-house ({occupiedRooms})</Badge>
        <Badge variant="warning">Arrival ({arrivalRooms})</Badge>
        <Badge variant="info">Departure ({departureRooms})</Badge>
        <Badge variant="success">Vacant</Badge>
        <span className="font-semibold text-pine/50 uppercase tracking-wide ml-2">HK need attention: {hkAttn}</span>
      </Card>

      <div className="erp-room-grid">
            {rooms.map((room) => {
              const o = occ[room.id]
              const occSt = (o && o.st) || 'VACANT'
              const canOpenOverview = o?.reservation_id && occSt === 'OCCUPIED'
              const hk = room.hk_status || 'Clean'
              const Icon = HK_ICON[hk] || Sparkles
              return (
                <Card
                  key={room.id}
                  role={canOpenOverview ? 'button' : undefined}
                  tabIndex={canOpenOverview ? 0 : undefined}
                  onClick={() => canOpenOverview && openReservation(o.reservation_id, 'Overview')}
                  onKeyDown={(e) => {
                    if (canOpenOverview && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      openReservation(o.reservation_id, 'Overview')
                    }
                  }}
                  className={cn(
                    'p-0 overflow-hidden border-leaf/60 rounded-xl shadow-sm',
                    canOpenOverview && 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-forest/30',
                  )}
                  title={canOpenOverview ? `Open overview for Room ${room.room_no}` : undefined}
                >
                  <div className={cn('px-2 py-1.5 flex items-center justify-between', OCC_STYLE[occSt])}>
                    <span className="font-bold text-xs flex items-center gap-1"><DoorOpen size={12} /> {room.room_no}</span>
                    <span className="text-[9px] font-medium opacity-90">{OCC_LABEL[occSt]}</span>
                  </div>

                  <div className="p-1.5 space-y-1.5">
                    <div className="text-[10px] text-pine/60 leading-tight h-6 overflow-hidden">{room.room_name}</div>
                    {o
                      ? (
                        <div className="text-[10px] text-pine leading-tight space-y-0.5">
                          <div className="truncate"><span className="text-pine/50">Res:</span> <span className="font-medium">{o.res_no || '-'}</span></div>
                          <div className="truncate"><span className="text-pine/50">Name:</span> {o.guest || '-'}</div>
                          <div className="truncate"><span className="text-pine/50">Mobile:</span> {o.phone || '-'}</div>
                        </div>
                      )
                      : <div className="text-[10px] text-pine/30 h-6">No booking</div>
                    }

                    <Separator className="my-1" />

                    <Badge variant={getHousekeepingBadgeVariant(hk)} className="w-full justify-center">
                      <Icon size={11} /> {hk}
                    </Badge>
                  </div>
                </Card>
              )
            })}
      </div>

      {/* ── All Guests Panel ── */}
      <div className="erp-section-header no-print mt-6">
        <h2>
          <Users size={18} className="text-forest" /> All Guests
        </h2>
        <Button variant="outline" size="sm" onClick={loadAllGuests} disabled={guestsBusy}>
          <RefreshCw size={14} className={guestsBusy ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 space-y-3">
          {/* Search & filter bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pine/40 pointer-events-none" />
              <input
                type="text"
                className="input !pl-8 w-full"
                placeholder="Search by name, phone, res no…"
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {['ALL', 'QUERY', 'QUOTED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'SETTLED'].map((s) => (
                <button
                  key={s}
                  onClick={() => setGuestStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                    guestStatusFilter === s
                      ? 'bg-pine text-white border-pine'
                      : 'border-leaf text-pine/60 hover:text-pine hover:border-pine/40'
                  }`}
                >
                  {s === 'ALL' ? 'All' : s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Guest list */}
          {guestsBusy ? (
            <div className="text-sm text-pine/50 py-4 text-center">Loading…</div>
          ) : filteredGuests.length === 0 ? (
            <div className="text-sm text-pine/50 py-4 text-center">No guests found.</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="th">Res No.</th>
                      <th className="th">Guest / Reservation</th>
                      <th className="th">Stay</th>
                      <th className="th">Room(s)</th>
                      <th className="th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGuests.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-leaf/30 cursor-pointer"
                        onClick={() => openReservation(r.id, 'Overview')}
                      >
                        <td className="td money font-medium text-xs">{r.res_no}</td>
                        <td className="td">
                          <div className="font-semibold text-sm">{r.reservation_name || r.guests?.full_name || '—'}</div>
                          <div className="text-xs text-pine/50">
                            {r.guests?.full_name && r.guests.full_name !== r.reservation_name && <span>{r.guests.full_name} · </span>}
                            {r.guests?.phone || ''}
                          </div>
                        </td>
                        <td className="td money text-xs">{fmtDate(r.check_in)} → {fmtDate(r.check_out)}</td>
                        <td className="td text-xs">
                          {(r.reservation_rooms || []).map((x) => x.rooms?.room_no).filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="td">
                          <span className={`status-chip ${STATUS_COLORS[r.status] || ''}`}>
                            {r.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-leaf">
                {filteredGuests.map((r) => (
                  <button
                    key={r.id}
                    className="w-full text-left p-3 hover:bg-leaf/20 active:bg-leaf/40 transition-colors"
                    onClick={() => openReservation(r.id, 'Overview')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{r.reservation_name || r.guests?.full_name || '—'}</div>
                        <div className="text-xs text-pine/50 truncate">{r.res_no} · {r.guests?.phone || ''}</div>
                        <div className="text-xs text-pine/60 money mt-0.5">{fmtDate(r.check_in)} → {fmtDate(r.check_out)}</div>
                      </div>
                      <span className={`status-chip shrink-0 whitespace-nowrap ${STATUS_COLORS[r.status] || ''}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="text-xs text-pine/40 text-right pt-1">
                Showing {filteredGuests.length} of {allGuests.length} reservations
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
