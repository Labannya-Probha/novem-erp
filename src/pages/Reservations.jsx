import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, nightsBetween, eachNight, rateFor, computeCharge, STATUS_COLORS } from '../lib/helpers'
import { loadReservationConfig } from '../lib/reservationConfig'
import { Search, Trash2, UserSearch, X, CheckCircle2 } from 'lucide-react'
import SearchableSelect from '../components/SearchableSelect.jsx'
import KPICards from '../components/KPICards.jsx'

const STATUSES = ['ALL', 'QUERY', 'QUOTED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'SETTLED', 'CANCELLED']

const STATUS_TO_TAB = {
  QUERY: 'Overview', QUOTED: 'Overview', CONFIRMED: 'Check-In',
  CHECKED_IN: 'Billings & Check-Out', CHECKED_OUT: 'Billings & Check-Out',
  SETTLED: 'Billings & Check-Out', CANCELLED: 'Overview',
}

const dayName = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' })
}

export default function Reservations({ openReservation, userName, prefill, clearPrefill }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('ALL')
  const [q, setQ]             = useState('')
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('reservations')
      .select('id,res_no,reservation_name,status,check_in,check_out,pax_adults,pax_children,source,created_at, guests:primary_guest_id(full_name,phone,customer_id), reservation_rooms(rooms(room_no,room_name))')
      .order('created_at', { ascending: false }).limit(300)
    if (error) console.error('Reservations load error:', error.message)
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (prefill) setShowNew(true) }, [prefill])

  const filtered = rows.filter((r) =>
    (filter === 'ALL' || r.status === filter) &&
    (!q || [r.res_no, r.reservation_name, r.guests?.full_name, r.guests?.phone, r.guests?.customer_id].join(' ').toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine">Reservations</h1>
        </div>
        <div className="text-xs text-pine/50">Create new queries from <span className="font-semibold">Booking Calendar</span>.</div>
      </div>
      <KPICards module="reservations" />

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-2.5 text-pine/40" />
          <input className="input pl-9 w-full" placeholder="Search name, phone, RES no, CUST ID…" value={q} onChange={(e) => setQ(e.target.value)} />
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
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead><tr>
                  <th className="th">Res No.</th>
                  <th className="th">Guest / Reservation name</th>
                  <th className="th">Stay</th>
                  <th className="th">Rooms</th>
                  <th className="th">Pax</th>
                  <th className="th">Source</th>
                  <th className="th">Status</th>
                </tr></thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-leaf/30 cursor-pointer" onClick={() => openReservation(r.id)}>
                      <td className="td money font-medium">{r.res_no}</td>
                      <td className="td">
                        <div className="font-semibold">{r.reservation_name || r.guests?.full_name || '—'}</div>
                        <div className="text-xs text-pine/50 flex items-center gap-1.5 flex-wrap">
                          {r.guests?.customer_id && (
                            <span className="font-mono bg-pine/10 text-pine/70 px-1 rounded text-[10px]">{r.guests.customer_id}</span>
                          )}
                          <span>{r.guests?.full_name}</span>
                          {r.guests?.phone && <span>· {r.guests.phone}</span>}
                        </div>
                      </td>
                      <td className="td money text-xs">{fmtDate(r.check_in)} → {fmtDate(r.check_out)}</td>
                      <td className="td money text-xs font-semibold">
                        {(r.reservation_rooms || []).map((x) => x.rooms ? `${x.rooms.room_no}${x.rooms.room_name ? ' ('+x.rooms.room_name+')' : ''}` : null).filter(Boolean).join(', ') || '—'}
                      </td>
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
                      No reservations found. Create a new query from Booking Calendar.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-leaf">
              {filtered.map((r) => (
                <div key={r.id} onClick={() => openReservation(r.id)} className="p-4 active:bg-leaf/30 cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{r.reservation_name || r.guests?.full_name || '—'}</div>
                      <div className="text-xs text-pine/50 truncate flex items-center gap-1">
                        {r.guests?.customer_id && (
                          <span className="font-mono bg-pine/10 text-pine/70 px-1 rounded text-[10px]">{r.guests.customer_id}</span>
                        )}
                        <span>{r.guests?.full_name} {r.guests?.phone && `· ${r.guests.phone}`}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openReservation(r.id, STATUS_TO_TAB[r.status] || 'Overview') }}
                      className={`status-chip shrink-0 whitespace-nowrap ${STATUS_COLORS[r.status]}`}
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
                  No reservations found. Create a new query from Booking Calendar.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showNew && (
        <NewReservation
          prefill={prefill}
          close={() => { setShowNew(false); clearPrefill?.(); load() }}
          openReservation={openReservation}
          userName={userName}
        />
      )}
    </div>
  )
}

/* ================================================================== */
/*  GUEST SEARCH POPUP — #3                                             */
/*  Search existing guests by name/phone, pick to auto-fill form       */
/* ================================================================== */
function GuestSearchPopup({ onSelect, onClose }) {
  const [q, setQ]           = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!q.trim() || q.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('guests')
        .select('id, full_name, phone, email, address, customer_id, loyalty_points')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,customer_id.ilike.%${q}%`)
        .order('full_name')
        .limit(10)
      setResults(data || [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-pine flex items-center gap-2">
            <UserSearch size={18} className="text-forest" /> Search Existing Guest
          </h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40">
            <X size={15} />
          </button>
        </div>

        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pine/30" />
          <input
            ref={inputRef}
            className="input pl-9 w-full"
            placeholder="Type name, phone, or CUST ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="min-h-[120px]">
          {loading && <p className="text-sm text-pine/40 text-center py-6">Searching…</p>}
          {!loading && q.length >= 2 && results.length === 0 && (
            <p className="text-sm text-pine/40 text-center py-6">No guests found matching "{q}"</p>
          )}
          {!loading && q.length < 2 && (
            <p className="text-sm text-pine/40 text-center py-6">Type at least 2 characters to search</p>
          )}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {results.map((g) => (
              <button
                key={g.id}
                onClick={() => onSelect(g)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-leaf/40 border border-transparent hover:border-leaf transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-pine">{g.full_name}</div>
                    <div className="text-xs text-pine/50 flex items-center gap-2 flex-wrap mt-0.5">
                      {g.customer_id && (
                        <span className="font-mono bg-pine/10 text-pine/70 px-1.5 py-0.5 rounded text-[10px]">{g.customer_id}</span>
                      )}
                      {g.phone && <span>{g.phone}</span>}
                      {g.email && <span className="truncate">{g.email}</span>}
                    </div>
                  </div>
                  {(g.loyalty_points > 0) && (
                    <span className="text-xs text-forest font-semibold shrink-0">{g.loyalty_points} pts</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-leaf">
          <button onClick={onClose} className="btn-ghost w-full text-sm">
            Cancel — create new guest instead
          </button>
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  NEW RESERVATION FORM                                                */
/* ================================================================== */
const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.', 'Engr.']

function NewReservation({ close, openReservation, userName, prefill }) {
  const t        = todayISO()
  const tomorrow = (d) => { const dt = new Date(d); dt.setDate(dt.getDate() + 1); return dt.toISOString().slice(0, 10) }

  const [f, setF] = useState({
    salutation: 'Mr.', guest_type: 'Individual',
    guest_name: '', phone: '', email: '', address: '', reservation_name: '',
    link_names: false, company_id: '',
    check_in: t, check_out: tomorrow(t), pax_adults: 2, pax_children: 0,
    source: 'Phone', notes: '', discount_pct: 0,
    discount_type: 'percentage', discount_val: 0,
    commission_pct: 0, vat_vds_pct: 0, tax_tds_pct: 0,
    vat_mode: 'EXCLUSIVE',
  })

  // #3 — existing guest picked from search
  const [linkedGuest, setLinkedGuest]     = useState(null)  // { id, full_name, phone, ... }
  const [showGuestSearch, setShowGuestSearch] = useState(false)

  const [rooms, setRooms]           = useState([])
  const [companies, setCompanies]   = useState([])
  const [booked, setBooked]         = useState([])
  const [roomRows, setRoomRows]     = useState([])
  const [taxConfig, setTaxConfig]   = useState([])
  const [facilityItems, setFacilityItems] = useState([])
  const [reservationCfg, setReservationCfg] = useState(() => loadReservationConfig())
  const [selectedPolicyId, setSelectedPolicyId] = useState('')
  const [addons, setAddons]         = useState({})
  const [serviceSearch, setServiceSearch] = useState('')
  const [busy, setBusy]             = useState(false)
  const [err, setErr]               = useState('')

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const toggleAddon  = (key) => setAddons((p) => ({ ...p, [key]: { ...p[key], selected: !p[key].selected } }))
  const updAddon     = (key, field, val) => setAddons((p) => ({ ...p, [key]: { ...p[key], [field]: val } }))

  const applyDiscountPolicy = (policyId) => {
    setSelectedPolicyId(policyId)
    const policy = reservationCfg.discountPolicies.find((item) => item.id === policyId)
    if (!policy) return
    setF((prev) => ({
      ...prev,
      discount_type: policy.type,
      discount_val: policy.value,
      notes: policy.note && !prev.notes?.includes(policy.note)
        ? `${prev.notes ? `${prev.notes}\n` : ''}${policy.note}`.trim()
        : prev.notes,
    }))
  }

  const hasBlackoutOverlap = (fromDate, toDate) => {
    if (!fromDate || !toDate || toDate <= fromDate) return false
    const blocked = new Set(reservationCfg.blackoutDays || [])
    return eachNight(fromDate, toDate).some((d) => blocked.has(d))
  }

  const setCheckIn = (val) => setF((p) => {
    const next = { ...p, check_in: val }
    if (!p.check_out || p.check_out <= val) next.check_out = tomorrow(val)
    return next
  })
  const setReservationName = (val) => setF((p) => ({
    ...p, reservation_name: val, guest_name: p.link_names ? val : p.guest_name,
  }))
  const toggleLinkNames = (checked) => setF((p) => ({
    ...p, link_names: checked, guest_name: checked ? p.reservation_name : p.guest_name,
  }))

  // Handle existing guest selection from search popup — #3
  const handleGuestSelect = (guest) => {
    setLinkedGuest(guest)
    setF((p) => ({
      ...p,
      guest_name:        guest.full_name  || '',
      phone:             guest.phone      || '',
      email:             guest.email      || '',
      address:           guest.address    || '',
      reservation_name:  p.reservation_name || guest.full_name || '',
    }))
    setShowGuestSearch(false)
  }

  const clearLinkedGuest = () => {
    setLinkedGuest(null)
    setF((p) => ({ ...p, guest_name: '', phone: '', email: '', address: '' }))
  }

  useEffect(() => {
    supabase.from('companies').select('id,name').eq('is_active', true).order('name').then(({ data }) => setCompanies(data || []))
    supabase.from('tax_config').select('*').then(({ data }) => setTaxConfig(data || []))
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

  useEffect(() => {
    const syncConfig = () => setReservationCfg(loadReservationConfig())
    syncConfig()
    window.addEventListener('focus', syncConfig)
    window.addEventListener('storage', syncConfig)
    return () => {
      window.removeEventListener('focus', syncConfig)
      window.removeEventListener('storage', syncConfig)
    }
  }, [])

  useEffect(() => {
    if (selectedPolicyId) return
    const defaultPolicy = (reservationCfg.discountPolicies || []).find((item) => item.active)
    if (!defaultPolicy) return
    applyDiscountPolicy(defaultPolicy.id)
  }, [reservationCfg.discountPolicies, selectedPolicyId])

  const createCompany = async (name) => {
    const { data, error } = await supabase.from('companies').insert({ name }).select().single()
    if (error) { setErr(error.message); return null }
    setCompanies((p) => [...p, { id: data.id, name: data.name }].sort((a, b) => a.name.localeCompare(b.name)))
    return data.id
  }

  useEffect(() => {
    supabase.from('rooms').select('*').eq('is_active', true).order('room_no').then(({ data }) => setRooms(data || []))
    supabase.from('reservation_rooms')
      .select('room_id, from_date, to_date, reservations!inner(check_in,check_out,status)')
      .in('reservations.status', ['CONFIRMED', 'CHECKED_IN'])
      .then(({ data }) => setBooked((data || []).map((d) => ({
        room_id: d.room_id,
        ci: d.from_date || d.reservations.check_in,
        co: d.to_date   || d.reservations.check_out,
      }))))
  }, [])

  const isBusy = (roomId, from, to) => !!roomId && from && to && to > from &&
    booked.some((b) => b.room_id === roomId && b.ci < to && b.co > from)

  const addRoomRow = () => setRoomRows((p) => [...p, { room_id: '', from_date: f.check_in, to_date: f.check_out }])
  const updRow     = (i, k, v) => setRoomRows((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r))
  const delRow     = (i) => setRoomRows((p) => p.filter((_, idx) => idx !== i))

  const validRows  = roomRows.filter((r) => r.room_id && r.from_date && r.to_date && r.to_date > r.from_date)
  const overallCI  = validRows.length ? validRows.reduce((m, r) => r.from_date < m ? r.from_date : m, validRows[0].from_date) : f.check_in
  const overallCO  = validRows.length ? validRows.reduce((m, r) => r.to_date > m ? r.to_date : m, validRows[0].to_date) : f.check_out

  const groupedFacilityItems = facilityItems.reduce((acc, it) => {
    (acc[it.category] = acc[it.category] || []).push(it)
    return acc
  }, {})

  // Generate auto Customer ID — CUST-{SHORT_CODE}-{8-digit} — #28
  // Uses DB function generate_customer_id() which reads short_code from company_settings
  const generateCustomerId = async () => {
    try {
      const { data, error } = await supabase.rpc('generate_customer_id')
      if (error || !data) return null
      return data
    } catch {
      return null
    }
  }

  const save = async () => {
    setBusy(true); setErr('')
    try {
      if (!f.reservation_name) throw new Error('Reservation Name is required')
      if (!f.guest_name)       throw new Error('Guest Name is required')
      if (validRows.length === 0 && f.check_out <= f.check_in) throw new Error('Check-out must be after check-in')
      if (hasBlackoutOverlap(overallCI, overallCO)) throw new Error('Selected stay window includes blackout day(s). Please adjust dates.')
      for (const r of validRows) {
        if (hasBlackoutOverlap(r.from_date, r.to_date)) {
          const rm = rooms.find((x) => x.id === r.room_id)
          throw new Error(`Room ${rm?.room_no || ''} dates include configured blackout day(s).`)
        }
        if (isBusy(r.room_id, r.from_date, r.to_date)) {
          const rm = rooms.find((x) => x.id === r.room_id)
          throw new Error(`Room ${rm?.room_no} is already booked for ${r.from_date} → ${r.to_date}`)
        }
      }

      let guestId = linkedGuest?.id || null

      if (guestId) {
        // Existing guest — update any changed contact info but keep their customer_id
        await supabase.from('guests').update({
          full_name: f.guest_name,
          phone:     f.phone    || linkedGuest.phone,
          email:     f.email    || linkedGuest.email,
          address:   f.address  || linkedGuest.address,
        }).eq('id', guestId)
      } else {
        // New guest — generate customer_id (#28)
        const customerId = await generateCustomerId()
        const { data: g, error: ge } = await supabase.from('guests').insert({
          full_name:   f.guest_name,
          phone:       f.phone,
          email:       f.email,
          address:     f.address,
          customer_id: customerId,
        }).select().single()
        if (ge) throw ge
        guestId = g.id
      }

      const firstRoom = validRows.length ? rooms.find((r) => r.id === validRows[0].room_id) : null
      const { data: r, error: re } = await supabase.from('reservations').insert({
        salutation:       f.salutation,
        guest_type:       f.guest_type,
        reservation_name: f.reservation_name || f.guest_name,
        company_id:       f.guest_type === 'Company' ? (f.company_id || null) : null,
        primary_guest_id: guestId,
        check_in:         overallCI,
        check_out:        overallCO,
        pax_adults:       +f.pax_adults,
        pax_children:     +f.pax_children,
        discount_pct:     f.discount_type === 'percentage' ? (+f.discount_val || 0) : 0,
        discount_type:    f.discount_type,
        discount_val:     +f.discount_val || 0,
        room_rate:        firstRoom ? firstRoom.base_rate : null,
        commission_pct:   f.guest_type === 'Company' ? (+f.commission_pct || 0) : 0,
        vat_vds_pct:      f.guest_type === 'Company' ? (+f.vat_vds_pct || 0) : 0,
        tax_tds_pct:      f.guest_type === 'Company' ? (+f.tax_tds_pct || 0) : 0,
        source:           f.source,
        notes:            f.notes,
        vat_mode:         f.vat_mode,
        created_by:       userName,
      }).select().single()
      if (re) throw re

      await supabase.from('reservation_guests').insert({ reservation_id: r.id, guest_name: f.guest_name, is_primary: true })

      if (validRows.length > 0) {
        await supabase.from('reservation_rooms').insert(validRows.map((row) => {
          const rm = rooms.find((x) => x.id === row.room_id)
          return { reservation_id: r.id, room_id: row.room_id, rate: rm?.base_rate || 0, from_date: row.from_date, to_date: row.to_date }
        }))
      }

      // Including Items
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

      // Auto-save quotation (best-effort)
      try {
        const qRate      = rateFor(taxConfig, 'ROOM', overallCI)
        const roomTotal  = firstRoom ? Number(firstRoom.base_rate) : 0
        const nightsCount = nightsBetween(overallCI, overallCO) || 1
        const discDescriptor = f.discount_type === 'fixed'
          ? { type: 'fixed', value: +f.discount_val || 0 }
          : (+f.discount_val || 0)
        const perNight   = computeCharge(roomTotal, discDescriptor, qRate)
        const grandTotal = +(perNight.total * nightsCount).toFixed(2)
        const validUntil = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
        await supabase.from('quotations').insert({
          reservation_id: r.id, total_amount: grandTotal, valid_until: validUntil,
          room_rate: roomTotal, room_count: validRows.length,
          discount_pct: f.discount_type === 'percentage' ? (+f.discount_val || 0) : 0,
          status: 'DRAFT', message: '',
        })
      } catch (qErr) { console.error('Auto-quotation failed (non-fatal):', qErr) }

      close(); openReservation(r.id)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  return (
    <>
      {showGuestSearch && (
        <GuestSearchPopup
          onSelect={handleGuestSelect}
          onClose={() => setShowGuestSearch(false)}
        />
      )}

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

            {/* ── Guest Name + Search existing — #3 ── */}
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="label !mb-0">Guest Name *</label>
                <div className="flex items-center gap-2">
                  {!linkedGuest && (
                    <button
                      type="button"
                      onClick={() => setShowGuestSearch(true)}
                      className="flex items-center gap-1.5 text-xs text-forest font-semibold hover:underline"
                    >
                      <UserSearch size={13} /> Search existing guest
                    </button>
                  )}
                  <label className="flex items-center gap-1.5 text-xs text-pine/70 cursor-pointer">
                    <input type="checkbox" checked={f.link_names} onChange={(e) => toggleLinkNames(e.target.checked)} disabled={!!linkedGuest} />
                    Same as Reservation Name
                  </label>
                </div>
              </div>

              {/* Linked guest badge */}
              {linkedGuest && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-forest/10 border border-forest/20">
                  <CheckCircle2 size={14} className="text-forest shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-pine">{linkedGuest.full_name}</span>
                    {linkedGuest.customer_id && (
                      <span className="ml-2 font-mono text-[10px] bg-pine/10 text-pine/70 px-1.5 py-0.5 rounded">{linkedGuest.customer_id}</span>
                    )}
                    {linkedGuest.phone && <span className="ml-2 text-xs text-pine/50">{linkedGuest.phone}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowGuestSearch(true)}
                      className="text-xs text-pine/50 hover:text-forest underline"
                    >Change</button>
                    <button
                      type="button"
                      onClick={clearLinkedGuest}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 text-pine/30 hover:text-red-500"
                    ><X size={12} /></button>
                  </div>
                </div>
              )}

              <input
                className="input"
                value={f.guest_name}
                disabled={f.link_names || !!linkedGuest}
                onChange={(e) => set('guest_name', e.target.value)}
                placeholder={
                  linkedGuest ? 'Linked from existing guest' :
                  f.link_names ? 'Pulled from Reservation Name above' : ''
                }
              />
            </div>

            <div><label className="label">Phone (WhatsApp)</label>
              <input className="input" placeholder="01XXXXXXXXX" value={f.phone}
                onChange={(e) => set('phone', e.target.value)}
                disabled={!!linkedGuest}
              />
            </div>
            <div><label className="label">Email</label>
              <input className="input" value={f.email}
                onChange={(e) => set('email', e.target.value)}
                disabled={!!linkedGuest}
              />
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
            <div className="text-[11px] text-pine/50 -mt-2">{dayName(f.check_in)}</div>
            <div><label className="label">Default check-out *</label><input type="date" className="input" value={f.check_out} onChange={(e) => set('check_out', e.target.value)} /></div>
            <div className="text-[11px] text-pine/50 -mt-2">{dayName(f.check_out)}</div>

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
                      <p className="sm:col-span-3 text-[10px] text-pine/50 -mt-1">{dayName(row.from_date)}</p>
                      <p className="sm:col-span-3 text-[10px] text-pine/50 -mt-1">{dayName(row.to_date)}</p>
                      <p className="sm:col-span-1" />
                      {taken && <p className="sm:col-span-12 text-xs text-red-600 -mt-1">This room is already booked for the selected dates.</p>}
                    </div>
                  )
                })}
                {roomRows.length === 0 && <p className="text-xs text-pine/50">No rooms added yet — click "Add room". Leave empty to keep it a query without room assignment.</p>}
                {rooms.length === 0 && <p className="text-xs text-amber">No rooms defined — add room inventory in Settings first.</p>}
              </div>
              {validRows.length > 0 && <p className="text-xs text-pine/50 mt-1">Stay window: <b>{overallCI} → {overallCO}</b> · {validRows.length} room booking(s).</p>}
              {reservationCfg.blackoutDays.length > 0 && (
                <p className="text-xs text-amber mt-1">Configured blackout days: {reservationCfg.blackoutDays.join(', ')}</p>
              )}
            </div>

            {/* Included Services — searchable, #3 */}
            <div className="col-span-2">
              <label className="label">Included Services</label>
              <p className="text-xs text-pine/50 mb-2">Select services included with this booking. Prices editable per booking.</p>
              {facilityItems.length === 0 && (
                <p className="text-xs text-amber py-2">No active Facility Items — add in Configuration → Facility Items.</p>
              )}
              {facilityItems.length > 0 && (
                <>
                  {/* Search + Add */}
                  <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pine/30" />
                      <input
                        className="input !pl-8 text-sm"
                        placeholder="Search services…"
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                      />
                      {serviceSearch && (
                        <button onClick={() => setServiceSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-pine/30 hover:text-pine">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    {/* Add matched item */}
                    {serviceSearch && (() => {
                      const match = facilityItems.find(it =>
                        it.name.toLowerCase().includes(serviceSearch.toLowerCase()) && !addons[it.id]?.selected
                      )
                      return match ? (
                        <button
                          type="button"
                          onClick={() => { toggleAddon(match.id); setServiceSearch('') }}
                          className="btn-primary !py-1.5 text-xs shrink-0"
                        >
                          + Add "{match.name}"
                        </button>
                      ) : null
                    })()}
                  </div>

                  {/* Selected services chips */}
                  {Object.values(addons).some(a => a.selected) && (
                    <div className="space-y-2">
                      {facilityItems.filter(it => addons[it.id]?.selected).map(it => (
                        <div key={it.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-forest bg-forest/5">
                          <span className="text-sm flex-1 font-medium text-pine">
                            {it.name}
                            <span className="text-pine/40 text-xs ml-1">/{it.unit}</span>
                          </span>
                          <input type="number" min="0" step="0.01"
                            className="input !w-24 !py-1 money text-right"
                            placeholder="Price ৳"
                            value={addons[it.id].price}
                            onChange={(e) => updAddon(it.id, 'price', e.target.value)} />
                          <input type="number" min="1"
                            className="input !w-14 !py-1 money text-right"
                            placeholder="Qty"
                            value={addons[it.id].qty}
                            onChange={(e) => updAddon(it.id, 'qty', e.target.value)} />
                          <button onClick={() => toggleAddon(it.id)}
                            className="text-red-300 hover:text-red-600 shrink-0">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {!Object.values(addons).some(a => a.selected) && !serviceSearch && (
                    <p className="text-xs text-pine/40 py-2">Search and add services above.</p>
                  )}
                </>
              )}
            </div>

            {/* VAT Mode */}
            <div className="col-span-2">
              <label className="label">VAT on Room Charges</label>
              <div className="flex gap-2">
                {[
                  { v: 'EXCLUSIVE', label: 'VAT Exclusive', hint: 'VAT added on top of rate' },
                  { v: 'INCLUSIVE', label: 'VAT Inclusive', hint: 'VAT included in rate' },
                  { v: 'NONE',      label: 'No VAT',        hint: 'VAT not applicable' },
                ].map((opt) => (
                  <button key={opt.v} type="button"
                    onClick={() => set('vat_mode', opt.v)}
                    className={`flex-1 py-2 px-3 rounded-xl border text-sm font-semibold transition-colors text-left ${
                      f.vat_mode === opt.v
                        ? 'bg-forest text-white border-forest'
                        : 'border-leaf text-pine/70 hover:border-forest/40'
                    }`}>
                    <div>{opt.label}</div>
                    <div className={`text-[10px] font-normal mt-0.5 ${f.vat_mode === opt.v ? 'text-white/70' : 'text-pine/40'}`}>
                      {opt.hint}
                    </div>
                  </button>
                ))}
              </div>
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
            <div className="col-span-2"><label className="label">Address</label><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} disabled={!!linkedGuest} /></div>
            <div className="col-span-2"><label className="label">Notes / special requests</label><textarea className="input" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
          </div>

          {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
          <div className="flex justify-end gap-2 mt-5">
            <button className="btn-ghost" onClick={close}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Create query'}</button>
          </div>
        </div>
      </div>
    </>
  )
}
