import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, nightsBetween, rateFor, computeCharge, STATUS_COLORS } from '../lib/helpers'
import { Search, Trash2 } from 'lucide-react'
import SearchableSelect from '../components/SearchableSelect.jsx'
import KPICards from '../components/KPICards.jsx'

const STATUSES = ['ALL', 'QUERY', 'QUOTED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'SETTLED', 'CANCELLED']

// Which ReservationDetail tab the status badge should jump to when clicked
const STATUS_TO_TAB = {
  QUERY: 'Overview',
  QUOTED: 'Overview',
  CONFIRMED: 'Check-In',
  CHECKED_IN: 'Billings & Check-Out',
  CHECKED_OUT: 'Billings & Check-Out',
  SETTLED: 'Billings & Check-Out',
  CANCELLED: 'Overview',
}

export default function Reservations({ openReservation, userName, prefill, clearPrefill }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [q, setQ] = useState('')
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('reservations')
      .select('id,res_no,reservation_name,status,check_in,check_out,pax_adults,pax_children,source,created_at, guests:primary_guest_id(full_name,phone), reservation_rooms(rooms(room_no,room_name))')
      .order('created_at', { ascending: false }).limit(300)
    if (error) console.error('Reservations load error:', error.message)
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (prefill) setShowNew(true) }, [prefill])

  const filtered = rows.filter((r) =>
    (filter === 'ALL' || r.status === filter) &&
    (!q || [r.res_no, r.reservation_name, r.guests?.full_name, r.guests?.phone].join(' ').toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine">Reservations</h1>          
        </div>
      </div>
      <KPICards module="reservations" />

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-2.5 text-pine/40" />
          <input className="input pl-9 w-full" placeholder="Search name, phone, RES no…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === s ? 'bg-pine text-white' : 'bg-white border border-leaf text-pine/70 hover:bg-leaf/50'}`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-pine/40 text-sm">Loading reservations…</div>
        ) : (
          <>
            {/* Tablet / desktop — full table */}
            <div className="hidden md:block overflow-x-auto">
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
                      <td className="td money">{(r.pax_adults || 0) + (r.pax_children || 0)}</td>
                      <td className="td text-xs">{r.source || '—'}</td>
                      <td className="td">
                        <button
                          onClick={(e) => { e.stopPropagation(); openReservation(r.id, STATUS_TO_TAB[r.status] || 'Overview') }}
                          className={`status-chip ${STATUS_COLORS[r.status]} hover:ring-2 hover:ring-offset-1 hover:ring-pine/30 transition-shadow`}
                          title={`Open ${STATUS_TO_TAB[r.status] || 'Overview'} tab`}
                        >
                          {r.status.replace('_', ' ')}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td className="td text-pine/50 text-center py-8" colSpan={7}>
                      No reservations yet. Click <span className="font-semibold">+ New reservation query</span> to begin.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
      
            {/* Mobile — card list */}
            <div className="md:hidden divide-y divide-leaf">
              {filtered.map((r) => (
                <div key={r.id} onClick={() => openReservation(r.id)} className="p-4 active:bg-leaf/30 cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{r.reservation_name || r.guests?.full_name || '—'}</div>
                      <div className="text-xs text-pine/50 truncate">{r.guests?.full_name} {r.guests?.phone && `· ${r.guests.phone}`}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openReservation(r.id, STATUS_TO_TAB[r.status] || 'Overview') }}
                      className={`status-chip shrink-0 whitespace-nowrap ${STATUS_COLORS[r.status]}`}
                      title={`Open ${STATUS_TO_TAB[r.status] || 'Overview'} tab`}
                    >
                      {r.status.replace('_', ' ')}
                    </button>
                  </div>
                  <div className="text-xs text-pine/70 money mb-1">{r.res_no} · {fmtDate(r.check_in)} → {fmtDate(r.check_out)}</div>
                  <div className="text-xs text-pine/60 money mb-1">
                    {(r.reservation_rooms || []).map((x) => x.rooms ? `${x.rooms.room_no}${x.rooms.room_name ? ' ('+x.rooms.room_name+')' : ''}` : null).filter(Boolean).join(', ') || 'No rooms assigned'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-pine/50">
                    <span>{(r.pax_adults || 0) + (r.pax_children || 0)} pax</span>
                    <span>·</span>
                    <span>{r.source || '—'}</span>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-pine/50 text-center py-8 text-sm px-4">
                  No reservations yet. Tap <span className="font-semibold">+ New reservation query</span> to begin.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showNew && ( <NewReservation prefill={prefill} close={() => { setShowNew(false); clearPrefill?.(); load() }} openReservation={openReservation} userName={userName} />)}
    </div>
  )
}

const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.', 'Engr.']

function NewReservation({ close, openReservation, userName }) {
  const t = todayISO()
  const tomorrow = (d) => { const dt = new Date(d); dt.setDate(dt.getDate() + 1); return dt.toISOString().slice(0, 10) }
  const [f, setF] = useState({
    salutation: 'Mr.', guest_type: 'Individual',
    guest_name: '', phone: '', email: '', address: '', reservation_name: '',
    link_names: false, company_id: '',
    check_in: t, check_out: tomorrow(t), pax_adults: 2, pax_children: 0, source: 'Phone', notes: '', discount_pct: 0,
    discount_type: 'percentage', discount_val: 0,
    commission_pct: 0, vat_vds_pct: 0, tax_tds_pct: 0,
  })
  const [rooms, setRooms] = useState([])
  const [companies, setCompanies] = useState([])
  const [booked, setBooked] = useState([]) // {room_id, ci, co}
  const [roomRows, setRoomRows] = useState([]) // {room_id, from_date, to_date}
  const [taxConfig, setTaxConfig] = useState([])

  // ── Including Items — now sourced from Facility Items (Settings → Facilities) ──
  const [facilityItems, setFacilityItems] = useState([])
  // addons keyed by facility_items.id: { [facilityItemId]: { selected, label, price, qty, category } }
  const [addons, setAddons] = useState({})

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const toggleAddon = (key) => setAddons((p) => ({ ...p, [key]: { ...p[key], selected: !p[key].selected } }))
  const updAddon = (key, field, val) => setAddons((p) => ({ ...p, [key]: { ...p[key], [field]: val } }))

  // Changing check-in auto-advances check-out to the next day, but only when
  // check-out hasn't already been pushed further out by the user — once they've
  // set a longer stay manually we don't want to silently shrink it back to 1 night.
  const setCheckIn = (val) => setF((p) => {
    const next = { ...p, check_in: val }
    if (!p.check_out || p.check_out <= val) next.check_out = tomorrow(val)
    return next
  })

  // When "link names" is on, typing in Reservation Name also drives Guest Name.
  const setReservationName = (val) => setF((p) => ({
    ...p, reservation_name: val, guest_name: p.link_names ? val : p.guest_name,
  }))
  const toggleLinkNames = (checked) => setF((p) => ({
    ...p, link_names: checked, guest_name: checked ? p.reservation_name : p.guest_name,
  }))

  useEffect(() => {
    supabase.from('companies').select('id,name').eq('is_active', true).order('name').then(({ data }) => setCompanies(data || []))
    supabase.from('tax_config').select('*').then(({ data }) => setTaxConfig(data || []))
    // Facility Items — drives the "Including Items" picker. Only active items, grouped by category.
    supabase.from('facility_items').select('*').eq('is_active', true).order('category').order('name')
      .then(({ data }) => {
        const items = data || []
        setFacilityItems(items)
        setAddons(Object.fromEntries(items.map((it) => [
          it.id,
          { selected: false, label: it.name, price: String(it.default_price ?? ''), qty: 1, category: it.category, unit: it.unit },
        ])))
      })
  }, [])

  const createCompany = async (name) => {
    const { data, error } = await supabase.from('companies').insert({ name }).select().single()
    if (error) { setErr(error.message); return null }
    setCompanies((p) => [...p, { id: data.id, name: data.name }].sort((a, b) => a.name.localeCompare(b.name)))
    return data.id
  }

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

  // Group facility items by category for a cleaner picker
  const groupedFacilityItems = facilityItems.reduce((acc, it) => {
    (acc[it.category] = acc[it.category] || []).push(it)
    return acc
  }, {})

  const save = async () => {
    setBusy(true); setErr('')
    try {
      if (!f.reservation_name) throw new Error('Reservation Name is required')
      if (!f.guest_name) throw new Error('Guest Name is required')
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
        reservation_name: f.reservation_name || f.guest_name,
        company_id: f.guest_type === 'Company' ? (f.company_id || null) : null,
        primary_guest_id: g.id, check_in: overallCI, check_out: overallCO,
        pax_adults: +f.pax_adults, pax_children: +f.pax_children,
        discount_pct: f.discount_type === 'percentage' ? (+f.discount_val || 0) : 0,
        discount_type: f.discount_type, discount_val: +f.discount_val || 0,
        room_rate: firstRoom ? firstRoom.base_rate : null,
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

      // Including Items — selected facility items become reservation_addons rows.
      // item_key stores the facility_items.id so it traces back to the source item.
      const selectedAddons = facilityItems
        .filter((it) => addons[it.id]?.selected)
        .map((it) => ({
          reservation_id: r.id, item_key: it.id, label: addons[it.id].label || it.name,
          price: +addons[it.id].price || 0, qty: +addons[it.id].qty || 1,
          posted: false, created_by: userName,
        }))
      if (selectedAddons.length > 0) {
        const { error: ae } = await supabase.from('reservation_addons').insert(selectedAddons)
        if (ae) throw ae
      }

      // ── Auto-save a quotation for this new query (best-effort — reservation
      // is already saved at this point, so a quotation failure shouldn't block
      // the user; they can still create one manually from ReservationDetail). ──
      try {
        const qRate = rateFor(taxConfig, 'ROOM', overallCI)
        const roomTotal = firstRoom ? Number(firstRoom.base_rate) : 0
        const nightsCount = nightsBetween(overallCI, overallCO) || 1
        const discDescriptor = f.discount_type === 'fixed'
          ? { type: 'fixed', value: +f.discount_val || 0 }
          : (+f.discount_val || 0)
        const perNight = computeCharge(roomTotal, discDescriptor, qRate)
        const grandTotal = +(perNight.total * nightsCount).toFixed(2)
        const validUntil = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
        await supabase.from('quotations').insert({
          reservation_id: r.id,
          total_amount: grandTotal,
          valid_until: validUntil,
          room_rate: roomTotal,
          room_count: validRows.length,
          discount_pct: f.discount_type === 'percentage' ? (+f.discount_val || 0) : 0,
          status: 'DRAFT',
          message: '',
        })
      } catch (qErr) {
        console.error('Auto-quotation failed (non-fatal):', qErr)
      }

      close(); openReservation(r.id)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 bg-ink/60 z-40 flex items-start justify-center overflow-auto p-3 sm:p-6">
      <div className="card max-w-2xl w-full p-4 sm:p-6 my-3 sm:my-6">
        <h2 className="font-display text-lg font-bold text-pine mb-4">New reservation query</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">Salutation</label>
            <SearchableSelect
              options={SALUTATIONS.map((s) => ({ value: s, label: s }))}
              value={f.salutation}
              onChange={(val) => set('salutation', val)}
              placeholder="Select…"
            />
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
          <div className="col-span-2">
            <label className="label">{f.guest_type === 'Company' ? 'Reservation / Company Name *' : 'Reservation Name *'}</label>
            <input className="input" value={f.reservation_name} onChange={(e) => setReservationName(e.target.value)} placeholder={f.guest_type === 'Company' ? 'e.g. Acme Corporation' : ''} />
          </div>
          <div><label className="label">Phone (WhatsApp)</label><input className="input" placeholder="01XXXXXXXXX" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div><label className="label">Email</label><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0">Guest Name *</label>
              <label className="flex items-center gap-1.5 text-xs text-pine/70 cursor-pointer">
                <input type="checkbox" checked={f.link_names} onChange={(e) => toggleLinkNames(e.target.checked)} />
                Same as Reservation Name
              </label>
            </div>
            <input className="input" value={f.guest_name} disabled={f.link_names}
              onChange={(e) => set('guest_name', e.target.value)}
              placeholder={f.link_names ? 'Pulled from Reservation Name above' : ''} />
          </div>

          {f.guest_type === 'Company' && (
            <div className="col-span-2">
              <label className="label">Company</label>
              <SearchableSelect
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
                value={f.company_id}
                onChange={(val) => {
                  set('company_id', val)
                  const c = companies.find((x) => x.id === val)
                  if (c) setReservationName(c.name)
                }}
                placeholder="Search or add a company…"
                allowCreate
                onCreate={createCompany}
                clearable
              />
            </div>
          )}

          {f.guest_type === 'Company' && (
            <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 rounded-lg bg-leaf/30 border border-leaf">
              <div><label className="label">Commission Rate %</label><input type="number" min="0" max="100" className="input money" value={f.commission_pct} onChange={(e) => set('commission_pct', e.target.value)} /></div>
              <div><label className="label">Vat/VDS %</label><input type="number" min="0" max="100" className="input money" value={f.vat_vds_pct} onChange={(e) => set('vat_vds_pct', e.target.value)} /></div>
              <div><label className="label">Tax/TDS %</label><input type="number" min="0" max="100" className="input money" value={f.tax_tds_pct} onChange={(e) => set('tax_tds_pct', e.target.value)} /></div>
            </div>
          )}
          <div><label className="label">Default check-in *</label><input type="date" className="input" value={f.check_in} onChange={(e) => setCheckIn(e.target.value)} /></div>
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
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <SearchableSelect
                      className={`sm:col-span-5 ${taken ? 'ring-1 ring-red-400 rounded-lg' : ''}`}
                      options={rooms.map((rm) => ({
                        value: rm.id,
                        label: `${rm.room_no}${rm.room_name ? ` · ${rm.room_name}` : ''}`,
                        sublabel: `${rm.room_type} · ${fmtBDT(rm.base_rate)}`,
                      }))}
                      value={row.room_id}
                      onChange={(val) => updRow(i, 'room_id', val)}
                      placeholder="Select room…"
                      clearable
                    />
                    <input type="date" className="input sm:col-span-3" value={row.from_date} onChange={(e) => updRow(i, 'from_date', e.target.value)} />
                    <input type="date" className="input sm:col-span-3" value={row.to_date} onChange={(e) => updRow(i, 'to_date', e.target.value)} />
                    <button type="button" className="text-red-400 hover:text-red-600 sm:col-span-1 justify-self-end sm:justify-self-auto" onClick={() => delRow(i)}><Trash2 size={15} /></button>
                    {taken && <p className="sm:col-span-12 text-xs text-red-600 -mt-1">This room is already booked for the selected dates.</p>}
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
            <p className="text-xs text-pine/50 mb-2">Select from your Facility Items (Settings → Facilities). Prices are pulled from the item's default price but can be edited here for this booking — only posted to the bill when you choose to (Overview tab → Post addon charges).</p>
            {facilityItems.length === 0 && (
              <p className="text-xs text-amber py-2">No active Facility Items found — add some in Settings → Facilities to make them selectable here.</p>
            )}
            {Object.entries(groupedFacilityItems).map(([category, catItems]) => (
              <div key={category} className="mb-3">
                <div className="text-[10px] uppercase tracking-wide font-bold text-pine/40 mb-1.5">{category}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">  
                  {catItems.map((it) => (
                    <div key={it.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${addons[it.id]?.selected ? 'border-forest bg-forest/5' : 'border-leaf'}`}>
                      <input type="checkbox" checked={!!addons[it.id]?.selected} onChange={() => toggleAddon(it.id)} />
                      <span className="text-sm flex-1">{it.name} <span className="text-pine/40 text-xs">/{it.unit}</span></span>
                      {addons[it.id]?.selected && (
                        <>
                          <input type="number" min="0" step="0.01" className="input !w-24 !py-1 money text-right" placeholder="Price ৳"
                            value={addons[it.id].price} onChange={(e) => updAddon(it.id, 'price', e.target.value)} />
                          <input type="number" min="1" className="input !w-14 !py-1 money text-right" placeholder="Qty"
                            value={addons[it.id].qty} onChange={(e) => updAddon(it.id, 'qty', e.target.value)} />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div><label className="label">Adults</label><input type="number" min="1" className="input" value={f.pax_adults} onChange={(e) => set('pax_adults', e.target.value)} /></div>
          <div><label className="label">Children</label><input type="number" min="0" className="input" value={f.pax_children} onChange={(e) => set('pax_children', e.target.value)} /></div>
          <div className="col-span-2">
            <label className="label">Discount</label>
            <div className="flex gap-2">
              <div className="flex gap-1 h-[38px] items-center shrink-0">
                {[{ v: 'percentage', label: '%' }, { v: 'fixed', label: '৳ Fixed' }].map((opt) => (
                  <button key={opt.v} type="button" onClick={() => set('discount_type', opt.v)}
                    className={`px-3 h-full rounded-lg text-sm font-semibold border ${f.discount_type === opt.v ? 'bg-pine text-white border-pine' : 'border-leaf text-pine/70'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <input type="number" min="0" max={f.discount_type === 'percentage' ? 100 : undefined}
                className="input money flex-1" placeholder={f.discount_type === 'percentage' ? 'e.g. 10' : 'e.g. 500'}
                value={f.discount_val} onChange={(e) => set('discount_val', e.target.value)} />
            </div>
          </div>
          <div><label className="label">Source</label>
            <SearchableSelect
              options={['Phone', 'WhatsApp', 'Facebook', 'Walk-in', 'Email', 'OTA', 'Agent'].map((s) => ({ value: s, label: s }))}
              value={f.source}
              onChange={(val) => set('source', val)}
              placeholder="Select source…"
            />
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
