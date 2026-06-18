import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, STATUS_COLORS } from '../lib/helpers'
import { Plus, Search, Trash2 } from 'lucide-react'

const STATUSES = ['ALL', 'QUERY', 'QUOTED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'SETTLED', 'CANCELLED']

export default function Reservations({ openReservation, userName, prefill, clearPrefill }) {
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
  useEffect(() => { if (prefill) setShowNew(true) }, [prefill])

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

      {showNew && ( <NewReservation prefill={prefill} close={() => { setShowNew(false); clearPrefill?.(); load() }} openReservation={openReservation} userName={userName} />)}
    </div>
  )
}

const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.', 'Engr.']

const ADDON_DEFS = [
  { key: 'BB', label: 'Bed & Breakfast' },
  { key: 'PICKUP', label: 'Pick & Drop' },
  { key: 'LUNCH', label: 'Lunch' },
  { key: 'DINNER', label: 'Dinner' },
  { key: 'DECOR', label: 'Room Decoration' },
  { key: 'CAKE', label: 'Cake' },
  { key: 'BOUQUET', label: 'Flower Bouquet' },
  { key: 'SIGHTSEEING', label: 'Sight Seeing' },
]

function NewReservation({ close, openReservation, userName }) {
  const t = todayISO()
  const [f, setF] = useState({
    salutation: 'Mr.', guest_type: 'Individual',
    guest_name: '', phone: '', email: '', address: '', reservation_name: '',
    use_reservation_name_only: false,
    check_in: t, check_out: t, pax_adults: 2, pax_children: 0, source: 'Phone', notes: '', discount_pct: 0,
    commission_pct: 0, vat_vds_pct: 0, tax_tds_pct: 0,
  })
  const [rooms, setRooms] = useState([])
  const [booked, setBooked] = useState([]) // {room_id, ci, co}
  const [roomRows, setRoomRows] = useState([]) // {room_id, from_date, to_date}
  // addons: { [item_key]: { selected: bool, label, price, qty } }
  const [addons, setAddons] = useState(() =>
    Object.fromEntries(ADDON_DEFS.map((a) => [a.key, { selected: false, label: a.label, price: '', qty: 1 }]))
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const toggleAddon = (key) => setAddons((p) => ({ ...p, [key]: { ...p[key], selected: !p[key].selected } }))
  const updAddon = (key, field, val) => setAddons((p) => ({ ...p, [key]: { ...p[key], [field]: val } }))

  useEffect(() => {
    supabase.from('rooms').select('*').eq('is_active', true).order('room_no').then(({ data }) => setRooms(data || []))
    // Pull existing occupancy once; overlap is checked per room-row client-side (each row can have its own dates).
    supabase.from('reservation_rooms')
      .select('room_id, from_date, to_date, reservations!inner(check_in,check_out,status)')
      .in('reservations.status', ['CONFIRMED', 'CHECKED_IN'])
      .then(({ data }) => setBooked((data || []).map((d) => ({
        room_id: d.room_id,
        ci: d.from_date || d.reservations.check_in,
        co: d.to_date || d.reservations.check_out,
      }))))
  }, [])

  const isBusy = (roomId, from, to) => !!roomId && from && to && to > from &&
    booked.some((b) => b.room_id === roomId && b.ci < to && b.co > from)

  const addRoomRow = () => setRoomRows((p) => [...p, { room_id: '', from_date: f.check_in, to_date: f.check_out }])
  const updRow = (i, k, v) => setRoomRows((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r))
  const delRow = (i) => setRoomRows((p) => p.filter((_, idx) => idx !== i))

  const validRows = roomRows.filter((r) => r.room_id && r.from_date && r.to_date && r.to_date > r.from_date)
  const overallCI = validRows.length ? validRows.reduce((m, r) => r.from_date < m ? r.from_date : m, validRows[0].from_date) : f.check_in
  const overallCO = validRows.length ? validRows.reduce((m, r) => r.to_date > m ? r.to_date : m, validRows[0].to_date) : f.check_out

  const save = async () => {
    setBusy(true); setErr('')
    try {
      if (!f.guest_name) throw new Error('Guest name is required')
      if (f.guest_type === 'Company' && !f.reservation_name) throw new Error('Reservation/Company name is required for Company & OTA bookings')
      if (validRows.length === 0) {
        if (f.check_out <= f.check_in) throw new Error('Check-out must be after check-in')
      }
      // block double-booking
      for (const r of validRows) if (isBusy(r.room_id, r.from_date, r.to_date)) {
        const rm = rooms.find((x) => x.id === r.room_id)
        throw new Error(`Room ${rm?.room_no} is already booked for ${r.from_date} → ${r.to_date}`)
      }
      const { data: g, error: ge } = await supabase.from('guests')
        .insert({ full_name: f.guest_name, phone: f.phone, email: f.email, address: f.address }).select().single()
      if (ge) throw ge
      const firstRoom = validRows.length ? rooms.find((r) => r.id === validRows[0].room_id) : null
      const { data: r, error: re } = await supabase.from('reservations').insert({
        salutation: f.salutation, guest_type: f.guest_type,
        use_reservation_name_only: f.use_reservation_name_only,
        reservation_name: f.reservation_name || f.guest_name,
        primary_guest_id: g.id, check_in: overallCI, check_out: overallCO,
        pax_adults: +f.pax_adults, pax_children: +f.pax_children,
        discount_pct: +f.discount_pct || 0, room_rate: firstRoom ? firstRoom.base_rate : null,
        commission_pct: f.guest_type === 'Company' ? (+f.commission_pct || 0) : 0,
        vat_vds_pct: f.guest_type === 'Company' ? (+f.vat_vds_pct || 0) : 0,
        tax_tds_pct: f.guest_type === 'Company' ? (+f.tax_tds_pct || 0) : 0,
        source: f.source, notes: f.notes, created_by: userName,
      }).select().single()
      if (re) throw re
      await supabase.from('reservation_guests').insert({ reservation_id: r.id, guest_name: f.guest_name, is_primary: true })
      if (validRows.length > 0) {
        await supabase.from('reservation_rooms').insert(validRows.map((row) => {
          const rm = rooms.find((x) => x.id === row.room_id)
          return { reservation_id: r.id, room_id: row.room_id, rate: rm?.base_rate || 0, from_date: row.from_date, to_date: row.to_date }
        }))
      }
      const selectedAddons = ADDON_DEFS
        .filter((a) => addons[a.key].selected)
        .map((a) => ({
          reservation_id: r.id, item_key: a.key, label: addons[a.key].label || a.label,
          price: +addons[a.key].price || 0, qty: +addons[a.key].qty || 1,
          posted: false, created_by: userName,
        }))
      if (selectedAddons.length > 0) {
        const { error: ae } = await supabase.from('reservation_addons').insert(selectedAddons)
        if (ae) throw ae
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
          <div><label className="label">Salutation</label>
            <select className="input" value={f.salutation} onChange={(e) => set('salutation', e.target.value)}>
              {SALUTATIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="label">Guest Type</label>
            <div className="flex gap-2 h-[38px] items-center">
              {['Individual', 'Company'].map((gt) => (
                <button key={gt} type="button" onClick={() => set('guest_type', gt)}
                  className={`flex-1 h-full rounded-lg text-sm font-semibold border ${f.guest_type === gt ? 'bg-pine text-white border-pine' : 'border-leaf text-pine/70'}`}>
                  {gt}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2"><label className="label">Guest name *</label><input className="input" value={f.guest_name} onChange={(e) => set('guest_name', e.target.value)} /></div>
          <div><label className="label">Phone (WhatsApp)</label><input className="input" placeholder="01XXXXXXXXX" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div><label className="label">Email</label><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0">{f.guest_type === 'Company' ? 'Reservation / Company name *' : 'Reservation name (if different)'}</label>
              <label className="flex items-center gap-1.5 text-xs text-pine/70 cursor-pointer">
                <input type="checkbox" checked={f.use_reservation_name_only} onChange={(e) => set('use_reservation_name_only', e.target.checked)} />
                Use reservation name everywhere (instead of guest name)
              </label>
            </div>
            <input className="input" value={f.reservation_name} onChange={(e) => set('reservation_name', e.target.value)} placeholder={f.guest_type === 'Company' ? 'e.g. Acme Corporation' : ''} />
          </div>

          {f.guest_type === 'Company' && (
            <div className="col-span-2 grid grid-cols-3 gap-4 p-3 rounded-lg bg-leaf/30 border border-leaf">
              <div><label className="label">Commission Rate %</label><input type="number" min="0" max="100" className="input money" value={f.commission_pct} onChange={(e) => set('commission_pct', e.target.value)} /></div>
              <div><label className="label">Vat/VDS %</label><input type="number" min="0" max="100" className="input money" value={f.vat_vds_pct} onChange={(e) => set('vat_vds_pct', e.target.value)} /></div>
              <div><label className="label">Tax/TDS %</label><input type="number" min="0" max="100" className="input money" value={f.tax_tds_pct} onChange={(e) => set('tax_tds_pct', e.target.value)} /></div>
            </div>
          )}
          <div><label className="label">Default check-in *</label><input type="date" className="input" value={f.check_in} onChange={(e) => set('check_in', e.target.value)} /></div>
          <div><label className="label">Default check-out *</label><input type="date" className="input" value={f.check_out} onChange={(e) => set('check_out', e.target.value)} /></div>

          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0">Rooms — pick from dropdown, each with its own dates</label>
              <button type="button" className="btn-ghost !py-1 text-xs" onClick={addRoomRow}>+ Add room</button>
            </div>
            <div className="space-y-2">
              {roomRows.map((row, i) => {
                const taken = isBusy(row.room_id, row.from_date, row.to_date)
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <select className={`input col-span-5 ${taken ? 'border-red-400' : ''}`} value={row.room_id} onChange={(e) => updRow(i, 'room_id', e.target.value)}>
                      <option value="">Select room…</option>
                      {rooms.map((rm) => (
                        <option key={rm.id} value={rm.id}>{rm.room_no}{rm.room_name ? ` · ${rm.room_name}` : ''} · {rm.room_type} · {fmtBDT(rm.base_rate)}</option>
                      ))}
                    </select>
                    <input type="date" className="input col-span-3" value={row.from_date} onChange={(e) => updRow(i, 'from_date', e.target.value)} />
                    <input type="date" className="input col-span-3" value={row.to_date} onChange={(e) => updRow(i, 'to_date', e.target.value)} />
                    <button type="button" className="text-red-400 hover:text-red-600 col-span-1" onClick={() => delRow(i)}><Trash2 size={15} /></button>
                    {taken && <p className="col-span-12 text-xs text-red-600 -mt-1">This room is already booked for the selected dates.</p>}
                  </div>
                )
              })}
              {roomRows.length === 0 && <p className="text-xs text-pine/50">No rooms added yet — click “Add room”. You can add the same or different rooms with different date ranges. Leave empty to keep it a query without room assignment.</p>}
              {rooms.length === 0 && <p className="text-xs text-amber">No rooms defined — add room inventory in Settings first.</p>}
            </div>
            {validRows.length > 0 && <p className="text-xs text-pine/50 mt-1">Stay window: <b>{overallCI} → {overallCO}</b> · {validRows.length} room booking(s).</p>}
          </div>

          <div className="col-span-2">
            <label className="label">Including Items</label>
            <p className="text-xs text-pine/50 mb-2">Select any items included with this booking. Prices entered here are saved against the reservation but only posted to the bill when you choose to (Overview tab → Post addon charges).</p>
            <div className="grid grid-cols-2 gap-2">
              {ADDON_DEFS.map((a) => (
                <div key={a.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${addons[a.key].selected ? 'border-forest bg-forest/5' : 'border-leaf'}`}>
                  <input type="checkbox" checked={addons[a.key].selected} onChange={() => toggleAddon(a.key)} />
                  <span className="text-sm flex-1">{a.label}</span>
                  {addons[a.key].selected && (
                    <>
                      <input type="number" min="0" step="0.01" className="input !w-24 !py-1 money text-right" placeholder="Price ৳"
                        value={addons[a.key].price} onChange={(e) => updAddon(a.key, 'price', e.target.value)} />
                      <input type="number" min="1" className="input !w-14 !py-1 money text-right" placeholder="Qty"
                        value={addons[a.key].qty} onChange={(e) => updAddon(a.key, 'qty', e.target.value)} />
                    </>
                  )}
                </div>
              ))}
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
