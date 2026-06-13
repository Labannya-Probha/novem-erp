import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, STATUS_COLORS } from '../lib/helpers'
import { Plus, Search } from 'lucide-react'

const STATUSES = ['ALL', 'QUERY', 'QUOTED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'SETTLED', 'CANCELLED']

export default function Reservations({ openReservation, userName }) {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [q, setQ] = useState('')
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('reservations')
      .select('id,res_no,reservation_name,status,check_in,check_out,pax_adults,pax_children,source,created_at, guests:primary_guest_id(full_name,phone), reservation_rooms(rooms(room_no,room_name))')
      .order('created_at', { ascending: false }).limit(300)
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const filtered = rows.filter((r) =>
    (filter === 'ALL' || r.status === filter) &&
    (!q || [r.res_no, r.reservation_name, r.guests?.full_name, r.guests?.phone].join(' ').toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine">Reservations</h1>
          <p className="text-sm text-pine/60">Query → Quotation → Confirmation → Check-in → Check-out</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}><Plus size={16} /> New reservation query</button>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-2.5 text-pine/40" />
          <input className="input pl-9 w-64" placeholder="Search name, phone, RES no…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === s ? 'bg-pine text-white' : 'bg-white border border-leaf text-pine/70 hover:bg-leaf/50'}`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr>
            <th className="th">Res No.</th><th className="th">Guest / Reservation name</th><th className="th">Stay</th>
            <th className="th">Rooms</th><th className="th">Pax</th><th className="th">Source</th><th className="th">Status</th>
          </tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-leaf/30 cursor-pointer" onClick={() => openReservation(r.id)}>
                <td className="td money font-medium">{r.res_no}</td>
                <td className="td">
                  <div className="font-semibold">{r.reservation_name || r.guests?.full_name || '—'}</div>
                  <div className="text-xs text-pine/50">{r.guests?.full_name} {r.guests?.phone && `· ${r.guests.phone}`}</div>
                </td>
                <td className="td money text-xs">{fmtDate(r.check_in)} → {fmtDate(r.check_out)}</td>
                <td className="td money text-xs font-semibold">{(r.reservation_rooms || []).map((x) => x.rooms ? `${x.rooms.room_no}${x.rooms.room_name ? ' ('+x.rooms.room_name+')' : ''}` : null).filter(Boolean).join(', ') || '—'}</td>
                <td className="td money">{r.pax_adults + r.pax_children}</td>
                <td className="td text-xs">{r.source}</td>
                <td className="td"><span className={`status-chip ${STATUS_COLORS[r.status]}`}>{r.status.replace('_', ' ')}</span></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td className="td text-pine/50" colSpan={7}>No reservations match. Create the first query to begin.</td></tr>}
          </tbody>
        </table>
      </div>

      {showNew && <NewReservation close={() => { setShowNew(false); load() }} openReservation={openReservation} userName={userName} />}
    </div>
  )
}

function NewReservation({ close, openReservation, userName }) {
  const t = todayISO()
  const [f, setF] = useState({
    guest_name: '', phone: '', email: '', address: '', reservation_name: '',
    check_in: t, check_out: t, pax_adults: 2, pax_children: 0, source: 'Phone', notes: '', discount_pct: 0,
  })
  const [rooms, setRooms] = useState([])
  const [busyIds, setBusyIds] = useState(new Set())
  const [selRooms, setSelRooms] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    supabase.from('rooms').select('*').eq('is_active', true).order('room_no')
      .then(({ data }) => setRooms(data || []))
  }, [])

  // Mark rooms already booked for an overlapping stay
  useEffect(() => {
    if (!f.check_in || !f.check_out || f.check_out <= f.check_in) { setBusyIds(new Set()); return }
    supabase.from('reservation_rooms')
      .select('room_id, reservations!inner(check_in,check_out,status)')
      .lt('reservations.check_in', f.check_out)
      .gt('reservations.check_out', f.check_in)
      .in('reservations.status', ['CONFIRMED', 'CHECKED_IN'])
      .then(({ data }) => setBusyIds(new Set((data || []).map((d) => d.room_id))))
  }, [f.check_in, f.check_out])

  const toggleRoom = (id) =>
    setSelRooms((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const save = async () => {
    setBusy(true); setErr('')
    try {
      if (!f.guest_name) throw new Error('Guest name is required')
      if (f.check_out <= f.check_in) throw new Error('Check-out must be after check-in')
      const { data: g, error: ge } = await supabase.from('guests')
        .insert({ full_name: f.guest_name, phone: f.phone, email: f.email, address: f.address }).select().single()
      if (ge) throw ge
      const firstRoom = rooms.find((r) => r.id === selRooms[0])
      const { data: r, error: re } = await supabase.from('reservations').insert({
        reservation_name: f.reservation_name || f.guest_name,
        primary_guest_id: g.id, check_in: f.check_in, check_out: f.check_out,
        pax_adults: +f.pax_adults, pax_children: +f.pax_children,
        discount_pct: +f.discount_pct || 0, room_rate: firstRoom ? firstRoom.base_rate : null,
        source: f.source, notes: f.notes, created_by: userName,
      }).select().single()
      if (re) throw re
      await supabase.from('reservation_guests').insert({
        reservation_id: r.id, guest_name: f.guest_name, is_primary: true,
      })
      if (selRooms.length > 0) {
        await supabase.from('reservation_rooms').insert(selRooms.map((rid) => {
          const rm = rooms.find((x) => x.id === rid)
          return { reservation_id: r.id, room_id: rid, rate: rm?.base_rate || 0 }
        }))
      }
      close(); openReservation(r.id)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 bg-ink/60 z-40 flex items-start justify-center overflow-auto p-6">
      <div className="card max-w-2xl w-full p-6 my-6">
        <h2 className="font-display text-lg font-bold text-pine mb-4">New reservation query</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Guest name *</label><input className="input" value={f.guest_name} onChange={(e) => set('guest_name', e.target.value)} /></div>
          <div><label className="label">Phone (WhatsApp)</label><input className="input" placeholder="01XXXXXXXXX" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div><label className="label">Email</label><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Reservation name (if different)</label><input className="input" value={f.reservation_name} onChange={(e) => set('reservation_name', e.target.value)} /></div>
          <div><label className="label">Check-in *</label><input type="date" className="input" value={f.check_in} onChange={(e) => set('check_in', e.target.value)} /></div>
          <div><label className="label">Check-out *</label><input type="date" className="input" value={f.check_out} onChange={(e) => set('check_out', e.target.value)} /></div>
          <div className="col-span-2">
            <label className="label">Room number(s) — booked rooms for these dates are marked</label>
            <div className="flex flex-wrap gap-2">
              {rooms.map((rm) => {
                const sel = selRooms.includes(rm.id)
                const taken = busyIds.has(rm.id)
                return (
                  <button key={rm.id} type="button" disabled={taken} onClick={() => toggleRoom(rm.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${taken ? 'bg-stone-100 border-stone-200 text-stone-400 line-through cursor-not-allowed' : sel ? 'bg-forest border-forest text-white' : 'bg-white border-leaf text-pine hover:bg-leaf/50'}`}>
                    {rm.room_no}{rm.room_name ? " · "+rm.room_name : ""} · {rm.room_type} · <span className="money">{fmtBDT(rm.base_rate)}</span>{taken ? ' (booked)' : ''}
                  </button>
                )
              })}
              {rooms.length === 0 && <span className="text-xs text-amber">No rooms defined — add room inventory in Settings first.</span>}
            </div>
          </div>
          <div><label className="label">Adults</label><input type="number" min="1" className="input" value={f.pax_adults} onChange={(e) => set('pax_adults', e.target.value)} /></div>
          <div><label className="label">Children</label><input type="number" min="0" className="input" value={f.pax_children} onChange={(e) => set('pax_children', e.target.value)} /></div>
          <div><label className="label">Discount %</label><input type="number" min="0" max="100" className="input money" value={f.discount_pct} onChange={(e) => set('discount_pct', e.target.value)} /></div>
          <div><label className="label">Source</label>
            <select className="input" value={f.source} onChange={(e) => set('source', e.target.value)}>
              {['Phone', 'WhatsApp', 'Facebook', 'Walk-in', 'Email', 'OTA', 'Agent'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className="label">Address</label><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Notes / special requests</label><textarea className="input" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
        </div>
        {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={close}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Create query'}</button>
        </div>
      </div>
    </div>
  )
}
