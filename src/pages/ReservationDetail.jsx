import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  fmtBDT, fmtDate, todayISO, nightsBetween, eachNight,
  rateFor, computeCharge, sumCharges, applyRounding, STATUS_COLORS,
} from '../lib/helpers'
import { canManualCheckIn, getCheckInActionCopy } from '../lib/noShowAutomation'
import PrintPortal from '../components/PrintPortal.jsx'
import RegistrationCard from '../components/print/RegistrationCard.jsx'
import GuestBill from '../components/print/GuestBill.jsx'
import Mushak63 from '../components/print/Mushak63.jsx'
import { exportXLSX } from '../lib/helpers'
import {
  ArrowLeft, MessageCircle, Mail, CheckCircle2, LogIn, BedDouble,
  Plus, Trash2, Printer, FileDown, Receipt, BadgeCheck, Ban, Pencil, Save,
  Users, Handshake,
} from 'lucide-react'
import Quotation from '../components/print/Quotation.jsx'
import SearchableSelect from '../components/SearchableSelect.jsx'
const TABS = ['Overview', 'Check-In', 'Billings & Check-Out']

const generateInvoiceNo = (resNo) => `INV-${resNo}-${Date.now().toString().slice(-6)}`

// Builds the discount argument computeCharge() expects, based on how this
// reservation's discount was set up (Sales Query: Percentage or Fixed ৳).
// Falls back to plain discount_pct for older reservations saved before
// discount_type/discount_val existed.
const resDiscount = (res) =>
  res.discount_type === 'fixed'
    ? { type: 'fixed', value: Number(res.discount_val) || 0 }
    : (Number(res.discount_pct) || 0)

export default function ReservationDetail({ id, back, userName, isAdmin }) {
  const [res, setRes] = useState(null)
  const [guest, setGuest] = useState(null)
  const [guestCompany, setGuestCompany] = useState(null)
  const [resGuests, setResGuests] = useState([])
  const [guestIds, setGuestIds]   = useState([]) // multiple IDs per guest (guest_ids table)
  const [resRooms, setResRooms] = useState([])
  const [rooms, setRooms] = useState([])
  const [charges, setCharges] = useState([])
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [addons, setAddons] = useState([])
  const [taxConfig, setTaxConfig] = useState([])
  const [company, setCompany] = useState(null)
  const [searchParams] = useSearchParams()
  const initialTab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'Overview'
  const [tab, setTab] = useState(initialTab)
  const [printDoc, setPrintDoc] = useState(null)
  const [msg, setMsg] = useState('')

  const loadAll = async () => {
    const { data: r } = await supabase
      .from('reservations')
      .select('*, agencies(*), shareholders(*)')
      .eq('id', id)
      .single()
    setRes(r)
    if (r?.primary_guest_id) {
      const { data: g } = await supabase.from('guests').select('*').eq('id', r.primary_guest_id).single()
      setGuest(g)
    }
    // Guest's linked company record (for corporate billing — Mushak/Guest
    // Bill buyer info). Distinct from `company` state below, which is this
    // property's OWN company_settings (Novem Eco Resort's own info).
    if (r?.company_id) {
      const { data: gc } = await supabase.from('companies').select('*').eq('id', r.company_id).maybeSingle()
      setGuestCompany(gc)
    } else {
      setGuestCompany(null)
    }
    const [
      { data: rg }, { data: rr }, { data: rm }, { data: ch },
      { data: pm }, { data: inv }, { data: ad }, { data: tc }, { data: co }, { data: gi },
    ] = await Promise.all([
      supabase.from('reservation_guests').select('*').eq('reservation_id', id).order('is_primary', { ascending: false }),
      supabase.from('reservation_rooms').select('*, rooms(*)').eq('reservation_id', id),
      supabase.from('rooms').select('*').eq('is_active', true).order('room_no'),
      supabase.from('folio_charges').select('*').eq('reservation_id', id).order('charge_date'),
      supabase.from('payments').select('*').eq('reservation_id', id).order('received_date'),
      supabase.from('invoices').select('*').eq('reservation_id', id).order('created_at', { ascending: false }),
      supabase.from('reservation_addons').select('*').eq('reservation_id', id).order('created_at'),
      supabase.from('tax_config').select('*'),
      supabase.from('company_settings').select('*').limit(1).maybeSingle(),
      supabase.from('guest_ids').select('*').eq('reservation_id', id).order('created_at'),
    ])
    setResGuests(rg || []); setResRooms(rr || []); setRooms(rm || [])
    setCharges(ch || []); setPayments(pm || []); setInvoices(inv || [])
    setAddons(ad || []); setTaxConfig(tc || []); setCompany(co); setGuestIds(gi || [])
  }

  useEffect(() => { loadAll() }, [id])

  const totals = useMemo(
    () => applyRounding(sumCharges(charges), company?.rounding_mode || 'NEAREST_1'),
    [charges, company],
  )
  const paid   = useMemo(() => payments.reduce((a, p) => a + Number(p.amount), 0), [payments])
  const due    = +(totals.grand_total - paid).toFixed(2)
  const nights = res ? nightsBetween(res.check_in, res.check_out) : 0

  const setStatus = async (status, extra = {}) => {
    await supabase.from('reservations').update({ status, ...extra }).eq('id', id)
    await loadAll()
  }

  if (!res) return <div className="text-pine/50">Loading…</div>

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  return (
    <div>
      <button className="btn-ghost mb-4" onClick={back}><ArrowLeft size={15} /> All reservations</button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine">{res.reservation_name || guest?.full_name}</h1>
          <span className={`status-chip ${STATUS_COLORS[res.status]}`}>{res.status.replace('_', ' ')}</span>
        </div>
        <div className="sm:text-right">
          <div className="text-xs uppercase text-pine/50">Balance due</div>
          <div className={`font-display text-2xl font-bold money ${due > 0 ? 'text-red-600' : 'text-forest'}`}>{fmtBDT(due)}</div>
        </div>
      </div>

      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}

      <div className="flex gap-1 border-b border-leaf mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 sm:px-4 py-2 text-sm font-semibold rounded-t-lg whitespace-nowrap ${tab === t ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <Overview
          res={res} guest={guest} resRooms={resRooms} resGuests={resGuests} setStatus={setStatus}
          payments={payments} advance={paid} flash={flash} isAdmin={isAdmin} userName={userName}
          addons={addons} taxConfig={taxConfig} reload={loadAll}
          nights={nights} company={company} setPrintDoc={setPrintDoc}
        />
      )}
      {tab === 'Check-In' && (
        <CheckInTab
          res={res} guest={guest} resGuests={resGuests} resRooms={resRooms} rooms={rooms}
          reload={loadAll} setStatus={setStatus} userName={userName}
          openCard={() => setPrintDoc({ type: 'REG' })}
          payments={payments} flash={flash} isAdmin={isAdmin}
          guestIds={guestIds}
        />
      )}
      {tab === 'Billings & Check-Out' && (
        <BillingsAndCheckOutTab
          res={res} guest={guest} charges={charges} payments={payments} resRooms={resRooms}
          taxConfig={taxConfig} invoices={invoices} company={company} reload={loadAll}
          userName={userName} setStatus={setStatus} setPrintDoc={setPrintDoc}
          totals={totals} paid={paid} due={due} flash={flash} isAdmin={isAdmin}
        />
      )}


      {/* ================================================================
          PRINT PORTALS
          ================================================================ */}

      {printDoc?.type === 'REG' && (
        <PrintPortal title="Registration Card" onClose={() => setPrintDoc(null)}>
          <RegistrationCard
            res={res} guest={guest} resGuests={resGuests}
            resRooms={resRooms} payments={payments} company={company}
          />
        </PrintPortal>
      )}

      {printDoc?.type === 'BILL' && (
        <PrintPortal title="Guest Bill" onClose={() => setPrintDoc(null)}>
          <GuestBill
            charges={printDoc.invoiceData?.charges ?? []}
            line_snapshot={printDoc.invoiceData?.line_snapshot ?? []}
            totals={printDoc.invoiceData?.totals ?? totals}
            paid={printDoc.invoiceData?.paid ?? paid}
            due={printDoc.invoiceData?.due ?? due}
            res={res}
            guest={guest}
            guestCompany={guestCompany}
            company={company}
            invoice_no={printDoc.invoiceData?.invoice_no}
            issued_at={printDoc.invoiceData?.issued_at}
            buyer_name={printDoc.invoiceData?.buyer_name}
            buyer_address={printDoc.invoiceData?.buyer_address}
            buyer_bin={printDoc.invoiceData?.buyer_bin}
          />
        </PrintPortal>
      )}

      {printDoc?.type === 'MUSHAK' && (
        <PrintPortal title="Mushak-6.3" onClose={() => setPrintDoc(null)}>
          <Mushak63
            charges={printDoc.invoiceData?.charges ?? []}
            line_snapshot={printDoc.invoiceData?.line_snapshot ?? []}
            totals={printDoc.invoiceData?.totals ?? totals}
            paid={printDoc.invoiceData?.paid ?? paid}
            due={printDoc.invoiceData?.due ?? due}
            res={res}
            guest={guest}
            guestCompany={guestCompany}
            company={company}
            invoice_no={printDoc.invoiceData?.invoice_no}
            issued_at={printDoc.invoiceData?.issued_at}
            buyer_name={printDoc.invoiceData?.buyer_name}
            buyer_address={printDoc.invoiceData?.buyer_address}
            buyer_bin={printDoc.invoiceData?.buyer_bin}
          />
        </PrintPortal>
      )}

      {printDoc?.type === 'QUOTE' && (
        <PrintPortal title="Quotation" onClose={() => setPrintDoc(null)}>
          <Quotation
            res={res}
            guest={guest}
            terms={printDoc.terms}
            roomRate={printDoc.roomRate}
            roomCount={printDoc.roomCount}
            discountPct={printDoc.discountPct}
            validDays={printDoc.validDays}
            taxConfig={taxConfig}
            company={company}
            resRooms={resRooms}
          />
        </PrintPortal>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  GUEST PROFILE CARD — Stay History, Preferences, Dates, Loyalty     */
/* ------------------------------------------------------------------ */
const PRESET_PREFERENCES = [
  'Quiet room', 'High floor', 'Low floor', 'Twin beds', 'King bed',
  'Extra pillows', 'Extra blanket', 'Early check-in', 'Late check-out',
  'Airport pickup', 'Vegan meals', 'Vegetarian', 'Halal meals',
  'No smoking', 'Accessible room', 'Baby cot', 'Honeymoon setup',
]

function GuestProfileCard({ guest, reservationId, isAdmin, userName, reload, flash }) {
  const [profile, setProfile]     = useState(null)
  const [ledger, setLedger]       = useState([])
  const [editing, setEditing]     = useState(false)
  const [prefInput, setPrefInput] = useState('')
  const [form, setForm]           = useState({
    birthday: '', anniversary_date: '', preferences: [], notes: '',
  })
  const [ptForm, setPtForm]       = useState({ change: '', reason: 'MANUAL', note: '' })
  const [busy, setBusy]           = useState(false)
  const [showLedger, setShowLedger] = useState(false)

  const loadProfile = async () => {
    if (!guest?.id) return
    const { data } = await supabase.from('v_guest_profile').select('*').eq('id', guest.id).single()
    if (data) {
      setProfile(data)
      setForm({
        birthday: data.birthday || '',
        anniversary_date: data.anniversary_date || '',
        preferences: data.preferences || [],
        notes: data.notes || '',
      })
    }
  }

  const loadLedger = async () => {
    if (!guest?.id) return
    const { data } = await supabase.from('loyalty_ledger').select('*').eq('guest_id', guest.id).order('created_at', { ascending: false }).limit(20)
    setLedger(data || [])
  }

  useEffect(() => { loadProfile() }, [guest?.id])

  const saveProfile = async () => {
    if (!guest?.id) return
    setBusy(true)
    const { error } = await supabase.from('guests').update({
      birthday: form.birthday || null,
      anniversary_date: form.anniversary_date || null,
      preferences: form.preferences,
      notes: form.notes,
    }).eq('id', guest.id)
    setBusy(false)
    if (error) { flash(error.message); return }
    await loadProfile()
    setEditing(false)
    flash('Guest profile updated.')
  }

  const addPreference = (pref) => {
    if (!pref.trim() || form.preferences.includes(pref.trim())) return
    setForm(p => ({ ...p, preferences: [...p.preferences, pref.trim()] }))
    setPrefInput('')
  }

  const removePreference = (pref) => setForm(p => ({ ...p, preferences: p.preferences.filter(x => x !== pref) }))

  const adjustPoints = async () => {
    if (!ptForm.change || isNaN(Number(ptForm.change))) { flash('Enter a valid points amount.'); return }
    setBusy(true)
    const change = Number(ptForm.change)
    const newBalance = (profile?.loyalty_points || 0) + change
    if (newBalance < 0) { flash('Points cannot go below 0.'); setBusy(false); return }
    const { error: gErr } = await supabase.from('guests').update({ loyalty_points: newBalance }).eq('id', guest.id)
    if (gErr) { flash(gErr.message); setBusy(false); return }
    await supabase.from('loyalty_ledger').insert({
      guest_id: guest.id,
      reservation_id: reservationId || null,
      change,
      balance_after: newBalance,
      reason: ptForm.reason,
      created_by: userName,
    })
    setPtForm({ change: '', reason: 'MANUAL', note: '' })
    await loadProfile()
    await loadLedger()
    flash(`${change > 0 ? '+' : ''}${change} points ${change > 0 ? 'added' : 'deducted'}.`)
    setBusy(false)
  }

  if (!guest) return null

  const p = profile

  return (
    <div className="card p-5 lg:col-span-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-pine flex items-center gap-2">
          Guest Profile
        </h3>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button className="btn-primary !py-1.5 text-xs" onClick={saveProfile} disabled={busy}>
                <Save size={12} /> {busy ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-ghost !py-1.5 text-xs" onClick={() => setEditing(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => setEditing(true)}>
              <Pencil size={12} /> Edit profile
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Stay History */}
        <div className="bg-leaf/20 rounded-xl p-4">
          <div className="text-xs font-bold text-pine/50 uppercase tracking-wide mb-3">Stay History</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-pine/60">Total stays</span>
              <span className="font-bold money text-pine">{p?.booking_count ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-pine/60">Total spend</span>
              <span className="font-bold money text-forest">{p ? fmtBDT(p.total_spend) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-pine/60">Last stay</span>
              <span className="font-semibold">{p?.last_stay_date ? fmtDate(p.last_stay_date) : '—'}</span>
            </div>
            {p?.active_stays > 0 && (
              <div className="flex justify-between">
                <span className="text-pine/60">Currently in</span>
                <span className="status-chip bg-forest/15 text-forest text-xs">{p.active_stays} active</span>
              </div>
            )}
          </div>
        </div>

        {/* Important Dates */}
        <div className="bg-leaf/20 rounded-xl p-4">
          <div className="text-xs font-bold text-pine/50 uppercase tracking-wide mb-3">Important Dates</div>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="label !text-xs">Birthday</label>
                <input type="date" className="input" value={form.birthday} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
              </div>
              <div>
                <label className="label !text-xs">Anniversary</label>
                <input type="date" className="input" value={form.anniversary_date} onChange={e => setForm(f => ({ ...f, anniversary_date: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-pine/60">Birthday</span>
                <span className="font-semibold">{p?.birthday ? fmtDate(p.birthday) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pine/60">Anniversary</span>
                <span className="font-semibold">{p?.anniversary_date ? fmtDate(p.anniversary_date) : '—'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Loyalty Points */}
        <div className="bg-leaf/20 rounded-xl p-4">
          <div className="text-xs font-bold text-pine/50 uppercase tracking-wide mb-3">Loyalty Points</div>
          <div className="text-3xl font-display font-bold text-forest money mb-3">
            {p?.loyalty_points ?? 0}
            <span className="text-sm font-normal text-pine/50 ml-1">pts</span>
          </div>
          {isAdmin && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  className="input money flex-1 !py-1.5 text-sm"
                  placeholder="±points"
                  value={ptForm.change}
                  onChange={e => setPtForm(p => ({ ...p, change: e.target.value }))}
                />
                <SearchableSelect
                  className="flex-1"
                  value={ptForm.reason}
                  onChange={v => setPtForm(p => ({ ...p, reason: v }))}
                  options={['STAY', 'MANUAL', 'REDEMPTION', 'ADJUSTMENT', 'BONUS']}
                />
              </div>
              <button className="btn-ghost !py-1.5 text-xs w-full justify-center" onClick={adjustPoints} disabled={busy || !ptForm.change}>
                <Plus size={12} /> Apply
              </button>
            </div>
          )}
          <button
            className="text-xs text-pine/50 hover:text-pine mt-2 underline"
            onClick={() => { setShowLedger(v => !v); if (!showLedger) loadLedger() }}
          >
            {showLedger ? 'Hide' : 'View'} ledger
          </button>
          {showLedger && (
            <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
              {ledger.length === 0 && <p className="text-xs text-pine/40">No transactions yet.</p>}
              {ledger.map(l => (
                <div key={l.id} className="flex justify-between text-xs py-1 border-b border-leaf/40">
                  <span className="text-pine/60">{l.reason} · {l.created_at?.slice(0, 10)}</span>
                  <span className={l.change > 0 ? 'text-forest font-semibold' : 'text-red-500 font-semibold'}>
                    {l.change > 0 ? '+' : ''}{l.change} → {l.balance_after}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preferences */}
        <div className="lg:col-span-3">
          <div className="text-xs font-bold text-pine/50 uppercase tracking-wide mb-3">Preferences & Special Requests</div>
          <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
            {(editing ? form.preferences : (p?.preferences || [])).map(pref => (
              <span key={pref} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${editing ? 'bg-forest/15 text-forest' : 'bg-leaf text-pine'}`}>
                {pref}
                {editing && (
                  <button onClick={() => removePreference(pref)} className="text-forest/60 hover:text-red-500 ml-0.5">×</button>
                )}
              </span>
            ))}
            {!editing && (p?.preferences || []).length === 0 && (
              <span className="text-sm text-pine/40">No preferences recorded.</span>
            )}
          </div>
          {editing && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Type a preference and press Enter…"
                  value={prefInput}
                  onChange={e => setPrefInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPreference(prefInput) } }}
                />
                <button className="btn-ghost !py-1.5" onClick={() => addPreference(prefInput)}><Plus size={14} /></button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_PREFERENCES.filter(p => !form.preferences.includes(p)).map(p => (
                  <button key={p} type="button" onClick={() => addPreference(p)}
                    className="text-xs px-2 py-1 rounded-full border border-leaf hover:bg-leaf text-pine/60 hover:text-pine transition-colors">
                    + {p}
                  </button>
                ))}
              </div>
              <div>
                <label className="label !text-xs mt-2">Internal notes</label>
                <textarea className="input text-xs" rows={2} value={form.notes} placeholder="Internal staff notes about this guest…" onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          )}
          {!editing && p?.notes && (
            <div className="mt-2 text-xs text-pine/60 bg-amber/10 rounded-lg px-3 py-2">
              <span className="font-semibold text-amber-700">Note:</span> {p.notes}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  OVERVIEW TAB  (with single-quote row and full edit modal)          */
/* ------------------------------------------------------------------ */
function Overview({
  res, guest, resRooms, resGuests = [], setStatus, payments, advance, flash,
  isAdmin, userName, addons = [], taxConfig = [], reload, nights, company, setPrintDoc,
}) {
  const canConfirm = ['QUERY', 'QUOTED'].includes(res.status)
  const isCompany  = res.guest_type === 'Company'
  const [posting, setPosting] = useState(false)

  // Quotation states
  const [quote, setQuote]               = useState(null)
  const [quoteEditorOpen, setQuoteEditorOpen] = useState(false)
  const [editing, setEditing]           = useState(false)

  const [editForm, setEditForm] = useState({
    salutation: res.salutation || '',
    full_name: guest?.full_name || '',
    phone: guest?.phone || '',
    email: guest?.email || '',
    address: guest?.address || '',
    check_in: res.check_in,
    check_out: res.check_out,
    pax_adults: res.pax_adults || 1,
    pax_children: res.pax_children || 0,
    source: res.source || '',
    reservation_name: res.reservation_name || '',
    use_reservation_name_only: res.use_reservation_name_only || false,
    guest_type: res.guest_type || 'Individual',
    notes: res.notes || '',
    discount_type: res.discount_type || 'percentage',
    discount_val: res.discount_val || 0,
    discount_pct: res.discount_pct || 0,
    terms_conditions: res.terms_conditions || company?.terms_conditions || '',
  })

  const [roomList, setRoomList]   = useState([])
  const [roomsAll, setRoomsAll]   = useState([])
  const [addonList, setAddonList] = useState([])
  const [newAddon, setNewAddon]   = useState({ label: '', price: '', qty: 1 })

  // Load latest quotation
  const loadLatestQuote = async () => {
    const { data } = await supabase
      .from('quotations')
      .select('*')
      .eq('reservation_id', res.id)
      .order('created_at', { ascending: false })
      .limit(1)
    setQuote(data?.[0] || null)
  }
  useEffect(() => { loadLatestQuote() }, [res.id])

  // Open editor
  const openQuoteEditor = (editExisting = false) => {
    setEditing(editExisting)
    setEditForm({
      salutation: res.salutation || '',
      full_name: guest?.full_name || '',
      phone: guest?.phone || '',
      email: guest?.email || '',
      address: guest?.address || '',
      check_in: res.check_in,
      check_out: res.check_out,
      pax_adults: res.pax_adults || 1,
      pax_children: res.pax_children || 0,
      source: res.source || '',
      reservation_name: res.reservation_name || '',
      use_reservation_name_only: res.use_reservation_name_only || false,
      guest_type: res.guest_type || 'Individual',
      notes: res.notes || '',
      discount_type: res.discount_type || 'percentage',
      discount_val: res.discount_val || 0,
      discount_pct: res.discount_pct || 0,
      terms_conditions: res.terms_conditions || company?.terms_conditions || '',
    })
    setRoomList(resRooms.map(rr => ({
      id: rr.id,
      room_id: rr.room_id,
      room_no: rr.rooms?.room_no,
      room_name: rr.rooms?.room_name,
      room_type: rr.rooms?.room_type,
      rate: rr.rate || rr.rooms?.base_rate || 0,
      from_date: rr.from_date,
      to_date: rr.to_date,
    })))
    setAddonList(addons.map(a => ({ ...a })))
    setNewAddon({ label: '', price: '', qty: 1 })
    setQuoteEditorOpen(true)
  }

  useEffect(() => {
    if (quoteEditorOpen) {
      supabase.from('rooms').select('*').eq('is_active', true).order('room_no')
        .then(({ data }) => setRoomsAll(data || []))
    }
  }, [quoteEditorOpen])

  // Room handlers
  const assignRoomInModal = (room) => setRoomList(prev => [...prev, {
    id: null, room_id: room.id, room_no: room.room_no, room_name: room.room_name,
    room_type: room.room_type, rate: res.room_rate || room.base_rate || 0,
    from_date: editForm.check_in, to_date: editForm.check_out,
  }])
  const removeRoomInModal = (idx) => setRoomList(prev => prev.filter((_, i) => i !== idx))
  const updateRoomRateInModal = (idx, val) =>
    setRoomList(prev => prev.map((r, i) => i === idx ? { ...r, rate: Number(val) } : r))

  // Addon handlers
  const addAddonItem = () => {
    if (!newAddon.label || !newAddon.price) return
    setAddonList(prev => [...prev, {
      id: null, label: newAddon.label, price: Number(newAddon.price),
      qty: Number(newAddon.qty) || 1, posted: false, reservation_id: res.id,
    }])
    setNewAddon({ label: '', price: '', qty: 1 })
  }
  const removeAddonItem = (idx) => setAddonList(prev => prev.filter((_, i) => i !== idx))

  // Update handler — saves reservation + quotation record
  const handleUpdateQuotation = async () => {
    if (guest) {
      await supabase.from('guests').update({
        full_name: editForm.full_name, phone: editForm.phone,
        email: editForm.email, address: editForm.address,
      }).eq('id', guest.id)
    }
    const resUpdate = {
      salutation: editForm.salutation, check_in: editForm.check_in, check_out: editForm.check_out,
      pax_adults: Number(editForm.pax_adults), pax_children: Number(editForm.pax_children),
      source: editForm.source, reservation_name: editForm.reservation_name,
      use_reservation_name_only: editForm.use_reservation_name_only,
      guest_type: editForm.guest_type, notes: editForm.notes,
      discount_type: editForm.discount_type,
      discount_val: editForm.discount_type === 'fixed' ? Number(editForm.discount_val) : 0,
      discount_pct: editForm.discount_type === 'percentage' ? Number(editForm.discount_pct) : 0,
      terms_conditions: editForm.terms_conditions,
      room_rate: roomList.length > 0 ? roomList[0].rate : 0,
    }
    const { error: resErr } = await supabase.from('reservations').update(resUpdate).eq('id', res.id)
    if (resErr) { flash(resErr.message); return }

    // Sync rooms
    const currentRoomIds = resRooms.map(rr => rr.id)
    const newRoomIds = roomList.map(r => r.id).filter(id => id !== null)
    const toDelete = currentRoomIds.filter(id => !newRoomIds.includes(id))
    if (toDelete.length) await supabase.from('reservation_rooms').delete().in('id', toDelete)
    for (const room of roomList) {
      if (room.id) {
        await supabase.from('reservation_rooms').update({
          room_id: room.room_id, rate: room.rate,
          from_date: room.from_date || editForm.check_in,
          to_date: room.to_date || editForm.check_out,
        }).eq('id', room.id)
      } else {
        await supabase.from('reservation_rooms').insert({
          reservation_id: res.id, room_id: room.room_id, rate: room.rate,
          from_date: room.from_date || editForm.check_in,
          to_date: room.to_date || editForm.check_out,
        })
      }
    }

    // Sync addons
    const currentAddonIds = addons.map(a => a.id)
    const newAddonIds = addonList.map(a => a.id).filter(id => id !== null)
    const addonsToDelete = currentAddonIds.filter(id => !newAddonIds.includes(id))
    if (addonsToDelete.length) await supabase.from('reservation_addons').delete().in('id', addonsToDelete)
    for (const ad of addonList) {
      if (ad.id) {
        await supabase.from('reservation_addons').update({ label: ad.label, price: ad.price, qty: ad.qty }).eq('id', ad.id)
      } else {
        await supabase.from('reservation_addons').insert({
          reservation_id: res.id, label: ad.label, price: ad.price, qty: ad.qty, posted: false,
        })
      }
    }

    // Update / create quotation record
    const qRate = rateFor(taxConfig, 'ROOM', editForm.check_in)
    const roomTotal = roomList.reduce((sum, rm) => sum + Number(rm.rate), 0)
    const nightsCount = nightsBetween(editForm.check_in, editForm.check_out)
    const discDescriptor = editForm.discount_type === 'fixed'
      ? { type: 'fixed', value: Number(editForm.discount_val) }
      : Number(editForm.discount_pct)
    const perNight = computeCharge(roomTotal, discDescriptor, qRate)
    const grandTotal = +(perNight.total * nightsCount).toFixed(2)
    const validUntil = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const quoteSnapshot = {
      total_amount: grandTotal, valid_until: validUntil,
      room_rate: roomList.length > 0 ? roomList[0].rate : 0,
      room_count: roomList.length,
      discount_pct: editForm.discount_type === 'percentage' ? Number(editForm.discount_pct) : 0,
      updated_at: new Date().toISOString(),
    }
    if (quote) {
      await supabase.from('quotations').update(quoteSnapshot).eq('id', quote.id)
    } else {
      await supabase.from('quotations').insert({
        reservation_id: res.id, ...quoteSnapshot, status: 'DRAFT', message: '',
      })
    }

    await reload()
    await loadLatestQuote()
    flash(editing ? 'Quotation updated successfully.' : 'New quotation saved.')
    setQuoteEditorOpen(false)
  }

  // Addon posting
  const unposted   = addons.filter((a) => !a.posted)
  const lineTotal  = (a) => Number(a.price) * Number(a.qty)
  const addonsTotal = addons.reduce((sum, a) => sum + lineTotal(a), 0)

  const postAddonCharges = async () => {
    if (unposted.length === 0) { flash('No unposted addon items to post.'); return }
    setPosting(true)
    try {
      const rate = rateFor(taxConfig, 'OTHER', todayISO())
      for (const a of unposted) {
        const calc = computeCharge(lineTotal(a), 0, rate)
        const { data: fc, error: fcErr } = await supabase.from('folio_charges').insert({
          reservation_id: res.id, charge_date: todayISO(), charge_type: 'OTHER',
          description: `${a.label}${a.qty > 1 ? ` × ${a.qty}` : ''}`,
          ...calc, created_by: userName,
        }).select().single()
        if (fcErr) throw fcErr
        const { error: updErr } = await supabase.from('reservation_addons')
          .update({ posted: true, folio_charge_id: fc.id }).eq('id', a.id)
        if (updErr) throw updErr
      }
      await reload?.()
      flash(`${unposted.length} addon item(s) posted to the folio.`)
    } catch (e) { flash(e.message || 'Failed to post addon charges.') }
    setPosting(false)
  }

  // WhatsApp / Email / Print
  const buildQuoteMsg = () => {
    if (!quote) return ''
    const qr = rateFor(taxConfig, 'ROOM', res.check_in)
    const pn = computeCharge((quote.room_rate || 0) * (quote.room_count || 0), quote.discount_pct || 0, qr)
    const tot = +(pn.total * nights).toFixed(2)
    return `Dear ${guest?.full_name || 'Guest'},\n\nGreetings from ${company?.name || 'Novem Eco Resort'}!\n\nQuotation for your stay:\n• Check-in: ${fmtDate(res.check_in)}\n• Check-out: ${fmtDate(res.check_out)} (${nights} night${nights !== 1 ? 's' : ''})\n• Rooms: ${quote.room_count} × ${fmtBDT(quote.room_rate)}/night${quote.discount_pct > 0 ? `\n• Discount: ${quote.discount_pct}%` : ''}\n• Total: ${fmtBDT(tot)}\n\nWarm regards,\n${company?.name || 'Novem Eco Resort'}\n${company?.phone || ''}`
  }
  const sendQuoteWhatsApp = () => {
    const phone = (guest?.phone || '').replace(/[^0-9]/g, '')
    const intl = phone.startsWith('880') ? phone : phone.startsWith('0') ? '88' + phone : '880' + phone
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(buildQuoteMsg())}`, '_blank')
  }
  const sendQuoteEmail = () => window.open(
    `mailto:${guest?.email || ''}?subject=${encodeURIComponent(`Quotation — ${company?.name || 'Novem Eco Resort'} (${res.res_no})`)}&body=${encodeURIComponent(buildQuoteMsg())}`,
    '_blank'
  )
  const printQuote = () => {
    if (!quote) return
    setPrintDoc?.({
      type: 'QUOTE',
      terms: editForm.terms_conditions || company?.terms_conditions || '',
      roomRate: quote.room_rate, roomCount: quote.room_count,
      discountPct: quote.discount_pct, validDays: 7,
      taxConfig, company, resRooms,
    })
  }

  // ── RENDER ──
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* Guest & stay */}
      <div className="card p-5 lg:col-span-3">
        <h3 className="font-display font-semibold text-pine mb-3">Guest & stay</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt className="label">Primary guest</dt><dd className="font-semibold">{res.salutation ? `${res.salutation} ` : ''}{guest?.full_name || '—'}</dd></div>
          <div><dt className="label">Contact</dt><dd>{guest?.phone || '—'}{guest?.email ? ` · ${guest.email}` : ''}</dd></div>
          <div><dt className="label">Address</dt><dd>{guest?.address || '—'}</dd></div>
          <div><dt className="label">Source</dt><dd>{res.source}</dd></div>
          <div><dt className="label">Guest type</dt><dd>{res.guest_type || 'Individual'}</dd></div>
          <div><dt className="label">Reservation name</dt><dd>{res.reservation_name || '—'}{res.use_reservation_name_only && <span className="text-xs text-pine/50"> (used everywhere)</span>}</dd></div>
          <div><dt className="label">Discount</dt><dd>{
            res.discount_type === 'fixed'
              ? (Number(res.discount_val) > 0 ? `${fmtBDT(res.discount_val)} fixed` : '—')
              : (Number(res.discount_pct) > 0 ? `${res.discount_pct}%` : '—')
          }</dd></div>
          <div><dt className="label">Rooms assigned</dt><dd>{resRooms.length ? resRooms.map((r) => r.rooms?.room_no).join(', ') : 'Not yet assigned'}</dd></div>
          <div className="col-span-1 sm:col-span-2"><dt className="label">Notes</dt><dd>{res.notes || '—'}</dd></div>
        </dl>

        {isCompany && (
          <>
            <h3 className="font-display font-semibold text-pine mb-3 mt-5">Company / OTA terms</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <div><dt className="label">Commission rate</dt><dd className="font-semibold money">{Number(res.commission_pct) || 0}%</dd></div>
              <div><dt className="label">Vat/VDS</dt><dd className="font-semibold money">{Number(res.vat_vds_pct) || 0}%</dd></div>
              <div><dt className="label">Tax/TDS</dt><dd className="font-semibold money">{Number(res.tax_tds_pct) || 0}%</dd></div>
            </dl>
          </>
        )}

        <div className="flex items-center justify-between mt-5 mb-2">
          <h3 className="font-display font-semibold text-pine">Including items</h3>
        </div>
        {addons.length === 0 && <p className="text-sm text-pine/50">No additional items selected for this booking.</p>}
        {addons.length > 0 && (
          <AddonTable
            addons={addons}
            taxConfig={taxConfig}
            res={res}
            userName={userName}
            reload={reload}
            flash={flash}
            isAdmin={isAdmin}
          />
        )}

        {/* Pipeline actions */}
        <div className="mt-5 pt-4 border-t border-leaf">
          <h3 className="font-display font-semibold text-pine mb-3"></h3>
          <div className="space-y-2">
            {canConfirm && (
              <button className="btn-primary w-full justify-center" onClick={() => {
                if (advance <= 0 && payments.length === 0) { flash('Record the advance payment first (Billings & Check-Out tab).'); return }
                setStatus('CONFIRMED'); flash('Booking confirmed.')
              }}>
                <CheckCircle2 size={16} /> Confirm booking
              </button>
            )}
            {['QUERY', 'QUOTED', 'CONFIRMED'].includes(res.status) && (
              <button className="btn-ghost w-full justify-center text-red-600" onClick={() => setStatus('CANCELLED')}>
                <Ban size={15} /> Cancel reservation
              </button>
            )}
            <p className="text-xs text-pine/50 pt-2">Advance received: <span className="money font-semibold">{fmtBDT(advance)}</span>.</p>
          </div>
        </div>
      </div>      

      {/* QUOTATION TABLE — single latest row */}
      <div className="card p-5 lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-pine">Quotation</h3>
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => openQuoteEditor(false)}>
            <Plus size={13} /> New quotation
          </button>
        </div>
        {!quote ? (
          <p className="text-sm text-pine/50 py-4">No quotation created yet. Click "+ New quotation" to create one.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Col 1 — IDs & Guest */}
            <div className="space-y-1">
              <div className="text-xs text-pine/50 uppercase tracking-wide font-semibold">Quotation</div>
              <div className="font-bold text-forest money text-sm">{res.res_no}</div>
              <div className="font-semibold text-pine text-sm">{guest?.full_name || res.reservation_name || '—'}</div>
              <div className="text-xs text-pine/50">{guest?.phone || '—'}</div>
            </div>
      
            {/* Col 2 — Stay */}
            <div className="space-y-1">
              <div className="text-xs text-pine/50 uppercase tracking-wide font-semibold">Stay</div>
              <div className="text-sm text-pine">{fmtDate(res.check_in)} → {fmtDate(res.check_out)}</div>
              <div className="text-xs text-pine/40">{nights} night{nights !== 1 ? 's' : ''}</div>
              <div className="text-xs text-pine/60">
                {quote.room_count ?? resRooms.length} room{(quote.room_count ?? resRooms.length) !== 1 ? 's' : ''} ·{' '}
                {((res.pax_adults || 0) + (res.pax_children || 0)) || resGuests.length || '—'} pax ·{' '}
                {res.source || '—'}
              </div>
            </div>
      
            {/* Col 3 — Amount & Valid */}
            <div className="space-y-1">
              <div className="text-xs text-pine/50 uppercase tracking-wide font-semibold">Total</div>
              <div className="font-bold text-forest money text-xl">{fmtBDT(quote.total_amount)}</div>
              <div className="text-xs text-pine/50">Valid till {fmtDate(quote.valid_until)}</div>
            </div>
      
            {/* Col 4 — Actions */}
            <div className="space-y-1">
              <div className="text-xs text-pine/50 uppercase tracking-wide font-semibold">Actions</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openQuoteEditor(true)} title="Edit quotation"
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest transition-colors border border-leaf">
                  <Pencil size={13} />
                </button>
                <button onClick={printQuote} title="Print quotation"
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest transition-colors border border-leaf">
                  <Printer size={13} />
                </button>
                <button onClick={sendQuoteWhatsApp} title={guest?.phone ? 'Send via WhatsApp' : 'No phone number'}
                  disabled={!guest?.phone}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-100 text-pine/40 hover:text-green-600 transition-colors border border-leaf disabled:opacity-25 disabled:cursor-not-allowed">
                  <MessageCircle size={13} />
                </button>
                <button onClick={sendQuoteEmail} title="Send via Email"
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-pine/40 hover:text-blue-600 transition-colors border border-leaf">
                  <Mail size={13} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GUEST PROFILE */}
      <GuestProfileCard
        guest={guest}
        reservationId={res.id}
        isAdmin={isAdmin}
        userName={userName}
        reload={reload}
        flash={flash}
      />

      {/* QUOTATION EDIT MODAL — New Reservation Query clone */}
      {quoteEditorOpen && (
        <div className="fixed inset-0 bg-ink/60 z-50 flex items-start justify-center overflow-auto p-3 sm:p-6">
          <div className="card max-w-lg w-full p-4 sm:p-6 my-3 sm:my-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-bold text-pine">
                {editing ? 'Edit Quotation' : 'New Quotation'}
              </h2>
              <button onClick={() => setQuoteEditorOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-pine">✕</button>
            </div>

            {/* Primary Guest */}
            <fieldset className="border border-leaf rounded-xl p-4 mb-4">
              <legend className="text-xs font-bold text-pine/60 px-2 uppercase tracking-wide">Primary Guest</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="label">Salutation</label>
                  <SearchableSelect
                    value={editForm.salutation}
                    onChange={v => setEditForm({...editForm, salutation: v})}
                    options={['', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'].map(s => ({ value: s, label: s || '—' }))}
                    placeholder="Select…"
                  />
                </div>
                <div><label className="label">Full Name *</label>
                  <input className="input" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} />
                </div>
                <div><label className="label">Phone (WhatsApp)</label>
                  <input className="input" placeholder="01XXXXXXXXX" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                </div>
                <div><label className="label">Email</label>
                  <input className="input" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                </div>
                <div className="col-span-1 sm:col-span-2"><label className="label">Address</label>
                  <textarea className="input" rows={2} value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                </div>
              </div>
            </fieldset>

            {/* Stay */}
            <fieldset className="border border-leaf rounded-xl p-4 mb-4">
              <legend className="text-xs font-bold text-pine/60 px-2 uppercase tracking-wide">Stay Details</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="label">Default Check-in *</label>
                  <input type="date" className="input" value={editForm.check_in} onChange={e => setEditForm({...editForm, check_in: e.target.value})} />
                </div>
                <div><label className="label">Default Check-out *</label>
                  <input type="date" className="input" value={editForm.check_out} onChange={e => setEditForm({...editForm, check_out: e.target.value})} />
                </div>
                <div><label className="label">Adults</label>
                  <input type="number" min="1" className="input" value={editForm.pax_adults} onChange={e => setEditForm({...editForm, pax_adults: e.target.value})} />
                </div>
                <div><label className="label">Children</label>
                  <input type="number" min="0" className="input" value={editForm.pax_children} onChange={e => setEditForm({...editForm, pax_children: e.target.value})} />
                </div>
                <div><label className="label">Guest Type</label>
                  <div className="flex gap-2">
                    {['Individual', 'Company'].map(t => (
                      <button key={t} type="button"
                        className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-colors ${editForm.guest_type === t ? 'bg-forest text-white border-forest' : 'border-leaf text-pine hover:border-forest'}`}
                        onClick={() => setEditForm({...editForm, guest_type: t})}>{t}</button>
                    ))}
                  </div>
                </div>
                <div><label className="label">Source</label>
                  <SearchableSelect
                    value={editForm.source}
                    onChange={v => setEditForm({...editForm, source: v})}
                    options={['Phone', 'Walk-in', 'Email', 'Website', 'OTA', 'Agent', 'Corporate', 'Other']}
                    placeholder="Select source…"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2"><label className="label">Reservation Name</label>
                  <input className="input" value={editForm.reservation_name} onChange={e => setEditForm({...editForm, reservation_name: e.target.value})} />
                  <div className="flex items-center gap-2 mt-1">
                    <input type="checkbox" id="useResName" checked={editForm.use_reservation_name_only} onChange={e => setEditForm({...editForm, use_reservation_name_only: e.target.checked})} />
                    <label htmlFor="useResName" className="text-xs text-pine/60">Same as Reservation Name</label>
                  </div>
                </div>
                <div className="col-span-1 sm:col-span-2"><label className="label">Notes / Special Requests</label>
                  <textarea className="input" rows={2} value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} />
                </div>
              </div>
            </fieldset>

            {/* Rooms */}
            <fieldset className="border border-leaf rounded-xl p-4 mb-4">
              <legend className="text-xs font-bold text-pine/60 px-2 uppercase tracking-wide">Rooms — Pick from dropdown, each with its own dates</legend>
              <div className="flex gap-2 mb-3">
                <SearchableSelect
                  className="flex-1"
                  value=""
                  onChange={(roomId) => {
                    const room = roomsAll.find(r => r.id === roomId)
                    if (room) assignRoomInModal(room)
                  }}
                  options={roomsAll
                    .filter(r => !roomList.some(rl => rl.room_id === r.id))
                    .map(r => ({ value: r.id, label: `${r.room_no}${r.room_name ? ` - ${r.room_name}` : ''} (${r.room_type})` }))}
                  placeholder="+ Add room"
                />
              </div>
              {roomList.length === 0 && <p className="text-xs text-pine/50">No rooms added yet — click "+ Add room". You can add the same or different rooms with different date ranges.</p>}
              {roomList.map((rm, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 border-b border-leaf/30 py-2">
                  <span className="text-sm font-semibold flex-1">{rm.room_no}{rm.room_name ? ` · ${rm.room_name}` : ''}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="date" className="input !py-1 !w-36" value={rm.from_date || editForm.check_in} onChange={e => setRoomList(prev => prev.map((r, i) => i === idx ? {...r, from_date: e.target.value} : r))} />
                    <input type="date" className="input !py-1 !w-36" value={rm.to_date || editForm.check_out} onChange={e => setRoomList(prev => prev.map((r, i) => i === idx ? {...r, to_date: e.target.value} : r))} />
                    <input type="number" className="input !w-20 !py-1 money" value={rm.rate} onChange={e => updateRoomRateInModal(idx, e.target.value)} />
                    <button onClick={() => removeRoomInModal(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </fieldset>

            {/* Including Items */}
            <fieldset className="border border-leaf rounded-xl p-4 mb-4">
              <legend className="text-xs font-bold text-pine/60 px-2 uppercase tracking-wide">Including Items</legend>
              <p className="text-xs text-pine/50 mb-3">Select any items included with this booking. Prices entered here are saved against the reservation but only posted to the bill when you choose to (Overview tab → Post addon charges).</p>
              <div className="flex flex-wrap gap-2 mb-2">
                <input className="input flex-1 min-w-[120px]" placeholder="Item label" value={newAddon.label} onChange={e => setNewAddon({...newAddon, label: e.target.value})} />
                <input type="number" className="input !w-24" placeholder="Price" value={newAddon.price} onChange={e => setNewAddon({...newAddon, price: e.target.value})} />
                <input type="number" className="input !w-16" placeholder="Qty" min="1" value={newAddon.qty} onChange={e => setNewAddon({...newAddon, qty: e.target.value})} />
                <button className="btn-ghost !py-1" onClick={addAddonItem}><Plus size={14} /></button>
              </div>
              {addonList.length === 0 && <p className="text-xs text-pine/40 py-1">No items added.</p>}
              {addonList.map((a, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-leaf/20 py-1.5">
                  <span className="text-sm">{a.label} × {a.qty}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm money text-pine/70">{fmtBDT(Number(a.price) * Number(a.qty))}</span>
                    <button onClick={() => removeAddonItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </fieldset>

            {/* Discount */}
            <fieldset className="border border-leaf rounded-xl p-4 mb-4">
              <legend className="text-xs font-bold text-pine/60 px-2 uppercase tracking-wide">Discount</legend>
              <div className="flex flex-wrap gap-2">
                <button type="button"
                  className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-colors ${editForm.discount_type === 'percentage' ? 'bg-forest text-white border-forest' : 'border-leaf text-pine'}`}
                  onClick={() => setEditForm({...editForm, discount_type: 'percentage'})}>%</button>
                <button type="button"
                  className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-colors ${editForm.discount_type === 'fixed' ? 'bg-forest text-white border-forest' : 'border-leaf text-pine'}`}
                  onClick={() => setEditForm({...editForm, discount_type: 'fixed'})}>৳ Fixed</button>
                {editForm.discount_type === 'percentage' ? (
                  <input type="number" min="0" max="100" className="input money flex-1 min-w-[100px]" value={editForm.discount_pct} onChange={e => setEditForm({...editForm, discount_pct: e.target.value})} />
                ) : (
                  <input type="number" min="0" className="input money flex-1 min-w-[100px]" value={editForm.discount_val} onChange={e => setEditForm({...editForm, discount_val: e.target.value})} />
                )}
              </div>
            </fieldset>

            {/* Terms & Conditions — auto-pulled, read-only */}
            <fieldset className="border border-leaf rounded-xl p-4 mb-5">
              <legend className="text-xs font-bold text-pine/60 px-2 uppercase tracking-wide">Terms & Conditions</legend>
              {(editForm.terms_conditions || company?.terms_conditions) ? (
                <div className="text-sm text-pine/70 bg-leaf/20 rounded-lg p-3 min-h-[72px] max-h-48 overflow-y-auto">
                  {/<[a-z][\s\S]*>/i.test(editForm.terms_conditions || company?.terms_conditions || '')
                    ? <div dangerouslySetInnerHTML={{ __html: editForm.terms_conditions || company?.terms_conditions }} />
                    : <div style={{ whiteSpace: 'pre-wrap' }}>{editForm.terms_conditions || company?.terms_conditions}</div>
                  }
                </div>
              ) : (
                <p className="text-sm text-pine/40 italic py-3">No terms configured. Go to Settings → Company to add default terms.</p>
              )}
              <p className="text-xs text-pine/45 mt-1.5">Auto-pulled from company Settings. To change, go to <b>Settings → Branding → Terms & Conditions</b>.</p>
            </fieldset>

            <div className="flex flex-wrap gap-3 justify-end border-t border-leaf pt-4">
              <button className="btn-ghost" onClick={() => setQuoteEditorOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleUpdateQuotation}>
                <Save size={16} /> {editing ? 'Update Quotation' : 'Save Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
function GuestIdManager({ reservationId, resGuests, guestIds, locked, reload, flash }) {
  const [adding, setAdding]     = useState(false)
  const [editId, setEditId]     = useState(null)
  const [form, setForm]         = useState({ guest_name: '', id_type: 'NID', id_number: '', notes: '' })
  const [busy, setBusy]         = useState(false)

  const ID_TYPES = ['NID', 'Passport', 'Driving License', 'Birth Certificate', 'Other']

  const startAdd = (guestName = '') => {
    setForm({ guest_name: guestName, id_type: 'NID', id_number: '', notes: '' })
    setEditId(null)
    setAdding(true)
  }

  const startEdit = (idRow) => {
    setForm({ guest_name: idRow.guest_name || '', id_type: idRow.id_type, id_number: idRow.id_number, notes: idRow.notes || '' })
    setEditId(idRow.id)
    setAdding(true)
  }

  const cancel = () => { setAdding(false); setEditId(null) }

  const save = async () => {
    if (!form.id_number.trim()) { flash('ID number is required.'); return }
    setBusy(true)
    if (editId) {
      const { error } = await supabase.from('guest_ids').update({
        guest_name: form.guest_name, id_type: form.id_type,
        id_number: form.id_number.trim(), notes: form.notes,
      }).eq('id', editId)
      if (error) { flash(error.message); setBusy(false); return }
    } else {
      const { error } = await supabase.from('guest_ids').insert({
        reservation_id: reservationId,
        guest_name: form.guest_name, id_type: form.id_type,
        id_number: form.id_number.trim(), notes: form.notes,
      })
      if (error) { flash(error.message); setBusy(false); return }
    }
    setBusy(false)
    setAdding(false)
    setEditId(null)
    await reload()
  }

  const remove = async (id) => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    await supabase.from('guest_ids').delete().eq('id', id)
    await reload()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="label !mb-0">Photo ID / Valid Documents</label>
        {!locked && (
          <button
            type="button"
            className="btn-ghost !py-1 text-xs"
            onClick={() => startAdd()}
          >
            <Plus size={12} /> Add ID
          </button>
        )}
      </div>

      {/* Existing IDs list */}
      {guestIds.length === 0 && !adding && (
        <p className="text-xs text-pine/40 py-2">No ID documents recorded yet. Click "+ Add ID" to add NID, Passport, or other documents.</p>
      )}

      {guestIds.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {guestIds.map((id) => (
            <div key={id.id} className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg border border-leaf bg-leaf/10 text-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="status-chip bg-forest/15 text-forest text-xs font-semibold">{id.id_type}</span>
                  <span className="font-mono font-semibold text-pine">{id.id_number}</span>
                  {id.guest_name && <span className="text-pine/50 text-xs">· {id.guest_name}</span>}
                </div>
                {id.notes && <div className="text-xs text-pine/50 mt-0.5 truncate">{id.notes}</div>}
              </div>
              {!locked && (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(id)}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-leaf text-pine/40 hover:text-forest"
                    title="Edit"
                  ><Pencil size={11} /></button>
                  <button
                    onClick={() => remove(id.id)}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-red-300 hover:text-red-600"
                    title="Delete"
                  ><Trash2 size={11} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      {adding && (
        <div className="rounded-xl border border-leaf bg-white p-3 space-y-3 mt-2">
          <div className="text-xs font-semibold text-pine/60">{editId ? 'Edit ID document' : 'Add new ID document'}</div>

          {/* Guest name selector — pick from resGuests or type freely */}
          <div>
            <label className="label !text-xs">Guest name (optional)</label>
            <div className="flex gap-2">
              <select
                className="input flex-1"
                value={form.guest_name}
                onChange={(e) => setForm((p) => ({ ...p, guest_name: e.target.value }))}
              >
                <option value="">— Select guest or type below —</option>
                {resGuests.map((g) => (
                  <option key={g.id} value={g.guest_name}>{g.guest_name}{g.is_primary ? ' (Primary)' : ''}</option>
                ))}
              </select>
            </div>
            <input
              className="input mt-1 text-xs"
              placeholder="Or type guest name manually…"
              value={form.guest_name}
              onChange={(e) => setForm((p) => ({ ...p, guest_name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label !text-xs">ID type *</label>
              <SearchableSelect
                value={form.id_type}
                onChange={v => setForm((p) => ({ ...p, id_type: v }))}
                options={ID_TYPES}
                placeholder="Select ID type…"
              />
            </div>
            <div>
              <label className="label !text-xs">ID number *</label>
              <input
                className="input money"
                placeholder="e.g. 1234567890123"
                value={form.id_number}
                onChange={(e) => setForm((p) => ({ ...p, id_number: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
            </div>
          </div>

          <div>
            <label className="label !text-xs">Notes (optional)</label>
            <input
              className="input text-xs"
              placeholder="e.g. Copy attached, Expired — renewal submitted, etc."
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2">
            <button className="btn-primary !py-1.5 text-xs" onClick={save} disabled={busy || !form.id_number.trim()}>
              <Save size={12} /> {busy ? 'Saving…' : editId ? 'Update ID' : 'Save ID'}
            </button>
            <button className="btn-ghost !py-1.5 text-xs" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {/* Quick-add buttons per guest */}
      {!locked && !adding && resGuests.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {resGuests.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => startAdd(g.guest_name)}
              className="text-xs px-2 py-1 rounded-lg border border-leaf hover:bg-leaf text-pine/60 hover:text-pine transition-colors"
            >
              <Plus size={10} className="inline mr-0.5" /> Add ID for {g.guest_name?.split(' ')[0] || 'guest'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
/* ------------------------------------------------------------------ */
/*  ADDON TABLE — per-row Edit / Cancel / Confirm                       */
/* ------------------------------------------------------------------ */
function AddonTable({ addons, taxConfig, res, userName, reload, flash, isAdmin }) {
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ label: '', price: '', qty: 1 })
  const [busy, setBusy] = useState(false)

  const lineTotal = (a) => Number(a.price) * Number(a.qty)
  const addonsTotal = addons.reduce((s, a) => s + lineTotal(a), 0)

  const startEdit = (a) => {
    setEditId(a.id)
    setEditForm({ label: a.label, price: String(a.price), qty: String(a.qty) })
  }

  const cancelEdit = () => { setEditId(null) }

  const saveEdit = async (a) => {
    if (!editForm.label.trim() || !editForm.price) return
    setBusy(true)
    const { error } = await supabase
      .from('reservation_addons')
      .update({ label: editForm.label, price: Number(editForm.price), qty: Number(editForm.qty) || 1 })
      .eq('id', a.id)
    setBusy(false)
    if (error) { flash(error.message); return }
    setEditId(null)
    flash('Item updated.')
    reload()
  }

  const cancelAddon = async (a) => {
    if (a.posted) {
      if (!isAdmin) { flash('Administrator access required to remove posted items.'); return }
      if (!window.confirm('This item is already posted to folio. Remove it and reverse the charge?')) return
      if (a.folio_charge_id) {
        await supabase.from('folio_charges').delete().eq('id', a.folio_charge_id)
      }
    }
    const { error } = await supabase.from('reservation_addons').delete().eq('id', a.id)
    if (error) { flash(error.message); return }
    flash('Item removed.')
    reload()
  }

  const confirmAddon = async (a) => {
    if (a.posted) { flash('Already posted to folio.'); return }
    setBusy(true)
    try {
      const rate = rateFor(taxConfig, 'OTHER', todayISO())
      const calc = computeCharge(lineTotal(a), 0, rate)
      const { data: fc, error: fcErr } = await supabase
        .from('folio_charges')
        .insert({
          reservation_id: res.id,
          charge_date: todayISO(),
          charge_type: 'OTHER',
          description: `${a.label}${a.qty > 1 ? ` × ${a.qty}` : ''}`,
          ...calc,
          created_by: userName,
        })
        .select().single()
      if (fcErr) throw fcErr
      await supabase.from('reservation_addons')
        .update({ posted: true, folio_charge_id: fc.id })
        .eq('id', a.id)
      flash(`"${a.label}" posted to folio.`)
      reload()
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  return (
    <div className="border border-leaf rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-leaf/30">
            <th className="th">Item</th>
            <th className="th text-right">Price</th>
            <th className="th text-right">Qty</th>
            <th className="th text-right">Total</th>
            <th className="th text-center">Status</th>
            <th className="th text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {addons.map((a) => (
            <tr key={a.id} className={`border-t border-leaf/60 ${editId === a.id ? 'bg-leaf/20' : ''}`}>
              {editId === a.id ? (
                /* ── Edit mode ── */
                <>
                  <td className="td" colSpan={3}>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        className="input flex-1 !py-1 text-sm"
                        value={editForm.label}
                        onChange={e => setEditForm(p => ({ ...p, label: e.target.value }))}
                        placeholder="Item name"
                      />
                      <input
                        type="number"
                        className="input !w-24 !py-1 money text-right"
                        value={editForm.price}
                        onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))}
                        placeholder="Price"
                      />
                      <input
                        type="number"
                        min="1"
                        className="input !w-16 !py-1 money text-right"
                        value={editForm.qty}
                        onChange={e => setEditForm(p => ({ ...p, qty: e.target.value }))}
                        placeholder="Qty"
                      />
                    </div>
                  </td>
                  <td className="td money text-right font-semibold">
                    {fmtBDT((Number(editForm.price) || 0) * (Number(editForm.qty) || 1))}
                  </td>
                  <td className="td text-center">
                    <span className="status-chip bg-amber/20 text-amber">Editing</span>
                  </td>
                  <td className="td">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => saveEdit(a)}
                        disabled={busy}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-forest text-white text-xs font-semibold hover:bg-forest/80 transition-colors"
                        title="Save"
                      >
                        <Save size={12} /> Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-leaf text-pine/60 text-xs hover:bg-leaf transition-colors"
                        title="Cancel edit"
                      >
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  </td>
                </>
              ) : (
                /* ── View mode ── */
                <>
                  <td className="td">{a.label}</td>
                  <td className="td money text-right">{fmtBDT(a.price)}</td>
                  <td className="td money text-right">{a.qty}</td>
                  <td className="td money text-right font-semibold">{fmtBDT(lineTotal(a))}</td>
                  <td className="td text-center">
                    <span className={`status-chip ${a.posted ? 'bg-forest/15 text-forest' : 'bg-amber/20 text-amber'}`}>
                      {a.posted ? 'Posted' : 'Pending'}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex gap-1 justify-center">
                      {/* Edit — only if not posted */}
                      {!a.posted && (
                        <button
                          onClick={() => startEdit(a)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest transition-colors"
                          title="Edit item"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {/* Confirm — post to folio */}
                      {!a.posted && (
                        <button
                          onClick={() => confirmAddon(a)}
                          disabled={busy}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-forest/10 text-pine/40 hover:text-forest transition-colors"
                          title="Confirm — post to folio"
                        >
                          <CheckCircle2 size={13} />
                        </button>
                      )}
                      {/* Cancel/Delete */}
                      <button
                        onClick={() => cancelAddon(a)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-300 hover:text-red-600 transition-colors"
                        title={a.posted ? 'Remove & reverse charge' : 'Remove item'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-leaf/40 font-bold money border-t border-leaf">
            <td className="td" colSpan={3}>Total</td>
            <td className="td text-right">{fmtBDT(addonsTotal)}</td>
            <td className="td" colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  CHECK-IN TAB                                                        */
/* ------------------------------------------------------------------ */
function CheckInTab({ res, guest, resGuests, resRooms, rooms, reload, setStatus, userName, openCard, payments, flash, isAdmin, guestIds = [] }) {
  const locked = !isAdmin && ['CHECKED_IN', 'CHECKED_OUT', 'SETTLED'].includes(res.status)
  const [f, setF] = useState({
    extra_pax: res.extra_pax, extra_pax_rate: res.extra_pax_rate,
    driver_accommodation: res.driver_accommodation, driver_count: res.driver_count, driver_rate: res.driver_rate,
    special_instructions: res.special_instructions || '',
  })
  const [newGuest, setNewGuest] = useState('')
  const [roomSel, setRoomSel]   = useState('')
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  const assignRoom = async () => {
    if (locked) { flash('After check-in, only an administrator can change room assignment.'); return }
    if (!roomSel) return
    const room = rooms.find((r) => r.id === roomSel)
    await supabase.from('reservation_rooms').insert({ reservation_id: res.id, room_id: room.id, rate: res.room_rate || room.base_rate, from_date: res.check_in, to_date: res.check_out })
    setRoomSel(''); await reload()
  }
  const removeRoom = async (rrId) => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    await supabase.from('reservation_rooms').delete().eq('id', rrId); await reload()
  }
  const updateRoomRate = async (rrId, rate) => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    if (rate === '' || isNaN(+rate)) return
    await supabase.from('reservation_rooms').update({ rate: +rate }).eq('id', rrId); await reload()
  }
  const updateRoomDates = async (rrId, field, val) => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    if (!val) return
    await supabase.from('reservation_rooms').update({ [field]: val }).eq('id', rrId); await reload()
  }
  const addGuest = async () => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    if (!newGuest.trim()) return
    await supabase.from('reservation_guests').insert({ reservation_id: res.id, guest_name: newGuest.trim() })
    setNewGuest(''); await reload()
  }
  const removeGuest = async (gid) => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    await supabase.from('reservation_guests').delete().eq('id', gid); await reload()
  }

  const doCheckIn = async () => {
    if (resRooms.length === 0) { flash('Assign at least one room before check-in.'); return }
    const notReadyRooms = resRooms.filter((rr) => {
      const hk = (rr.rooms?.hk_status || '').toLowerCase()
      return !['clean', 'inspected'].includes(hk)
    })
    if (notReadyRooms.length > 0) {
      flash(`Check-in blocked: room(s) not ready/clean (${notReadyRooms.map((rr) => rr.rooms?.room_no).join(', ')}).`)
      return
    }
    const wasNoShow = res.status === 'NO_SHOW'
    await setStatus('CHECKED_IN', {
      extra_pax: +f.extra_pax, extra_pax_rate: +f.extra_pax_rate,
      driver_accommodation: f.driver_accommodation, driver_count: +f.driver_count, driver_rate: +f.driver_rate,
      special_instructions: f.special_instructions,
      checked_in_at: new Date().toISOString(), checkin_by: userName,
    })
    if (wasNoShow) {
      await supabase.from('audit_log').insert({
        actor: userName,
        action: 'NO_SHOW_OVERRIDE_CHECKIN',
        entity: 'reservation',
        entity_id: res.res_no,
        details: { from_status: 'NO_SHOW', to_status: 'CHECKED_IN', source: 'MANUAL_OVERRIDE' },
      })
    }
    flash(wasNoShow ? 'Guest checked in and no-show overridden. Print the Registration Card for signatures.' : 'Guest checked in. Print the Registration Card for signatures.')
  }

  const assignedIds = new Set(resRooms.map((r) => r.room_id))
  const checkInAction = getCheckInActionCopy(res.status)

  return (
    <>
      {locked && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-amber/10 text-amber text-sm font-medium">
          This reservation is checked in — room assignment and guest details are locked. Only an administrator can change them.
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5 space-y-4">
          <h3 className="font-display font-semibold text-pine">Room assignment</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <SearchableSelect
              className="flex-1"
              value={roomSel}
              onChange={setRoomSel}
              options={rooms.filter((r) => !assignedIds.has(r.id)).map((r) => ({
                value: r.id,
                label: `${r.room_no}${r.room_name ? ` — ${r.room_name}` : ''} · ${r.room_type} (${fmtBDT(r.base_rate)})`
              }))}
              placeholder="Select room…"
            />
            <button className="btn-primary justify-center" onClick={assignRoom}><BedDouble size={15} /> Assign</button>
          </div>
          {resRooms.map((rr) => (
            <div key={rr.id} className="text-sm border border-leaf rounded-lg px-3 py-2 space-y-2">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="font-semibold">Room {rr.rooms?.room_no}{rr.rooms?.room_name ? ` · ${rr.rooms.room_name}` : ''} <span className="text-pine/50 font-normal">· {rr.rooms?.room_type}</span></span>
                <span className="flex items-center gap-2 money flex-wrap">
                  {locked ? (
                    <>{fmtBDT(rr.rate)}/night</>
                  ) : (
                    <>
                      <input type="number" defaultValue={rr.rate} onBlur={(e) => updateRoomRate(rr.id, e.target.value)} className="input !w-28 !py-1 money text-right" title="Edit rate — then Repost room charges in Folio" />/night
                      <button onClick={() => removeRoom(rr.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                    </>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-pine/60">
                <span>Stay:</span>
                {locked ? (
                  <span className="money">{fmtDate(rr.from_date || res.check_in)} → {fmtDate(rr.to_date || res.check_out)}</span>
                ) : (
                  <>
                    <input type="date" defaultValue={rr.from_date || res.check_in} onBlur={(e) => updateRoomDates(rr.id, 'from_date', e.target.value)} className="input !py-1 !w-36" />
                    <span>→</span>
                    <input type="date" defaultValue={rr.to_date || res.check_out} onBlur={(e) => updateRoomDates(rr.id, 'to_date', e.target.value)} className="input !py-1 !w-36" />
                  </>
                )}
              </div>
            </div>
          ))}
          {rooms.length === 0 && <p className="text-xs text-amber">No rooms defined yet — add your room inventory in Settings → Rooms.</p>}

          <h3 className="font-display font-semibold text-pine pt-2">All guest names (for Registration Card)</h3>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Add accompanying guest name" value={newGuest} onChange={(e) => setNewGuest(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGuest()} />
            <button className="btn-ghost" onClick={addGuest}><Plus size={15} /></button>
          </div>
          {resGuests.map((g) => (
            <div key={g.id} className="flex justify-between items-center text-sm px-3 py-1.5 border-b border-leaf/60">
              <span>{g.guest_name} {g.is_primary && <span className="status-chip bg-forest/15 text-forest ml-2">Primary</span>}</span>
              {!g.is_primary && <button onClick={() => removeGuest(g.id)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>}
            </div>
          ))}
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="font-display font-semibold text-pine">Check-in details</h3>

          {/* ── Multi-ID Section ── */}
          <GuestIdManager
            reservationId={res.id}
            resGuests={resGuests}
            guestIds={guestIds}
            locked={locked}
            reload={reload}
            flash={flash}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Extra pax</label><input type="number" min="0" className="input money" value={f.extra_pax} onChange={(e) => set('extra_pax', e.target.value)} /></div>
            <div><label className="label">Extra pax rate / night</label><input type="number" className="input money" value={f.extra_pax_rate} onChange={(e) => set('extra_pax_rate', e.target.value)} /></div>
            <div className="col-span-1 sm:col-span-2 flex items-center gap-2 pt-1">
              <input type="checkbox" id="drv" checked={f.driver_accommodation} onChange={(e) => set('driver_accommodation', e.target.checked)} />
              <label htmlFor="drv" className="text-sm font-medium">Driver accommodation needed</label>
            </div>
            {f.driver_accommodation && (
              <>
                <div><label className="label">No. of drivers</label><input type="number" min="0" className="input money" value={f.driver_count} onChange={(e) => set('driver_count', e.target.value)} /></div>
                <div><label className="label">Driver rate / night</label><input type="number" className="input money" value={f.driver_rate} onChange={(e) => set('driver_rate', e.target.value)} /></div>
              </>
            )}
            <div className="col-span-1 sm:col-span-2">
              <label className="label">Notes / special instructions</label>
              <textarea className="input" rows={2} value={f.special_instructions} onChange={(e) => set('special_instructions', e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {canManualCheckIn(res.status) ? (
              <button className="btn-primary flex-1 justify-center" onClick={doCheckIn}><LogIn size={16} /> {checkInAction.label}</button>
            ) : (
              <div className="text-sm text-forest font-semibold flex items-center gap-2">
                <BadgeCheck size={16} /> Checked in {res.checked_in_at && `· ${fmtDate(res.checked_in_at)}`} {res.checkin_by && `by ${res.checkin_by}`}
              </div>
            )}
            <button className="btn-amber flex-1 justify-center" onClick={openCard}><Printer size={16} /> Registration Card</button>
          </div>
          {checkInAction.hint && canManualCheckIn(res.status) && <p className="text-xs text-pine/50">{checkInAction.hint}</p>}
          <p className="text-xs text-pine/50">
            Advance on record: <span className="money font-semibold">{fmtBDT(payments.filter((p) => p.payment_class === 'ADVANCE').reduce((a, p) => a + +p.amount, 0))}</span> — shown on the card.
          </p>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  BILLINGS & CHECK-OUT TAB                                            */
/* ------------------------------------------------------------------ */
function BillingsAndCheckOutTab({
  res, guest, charges, payments, resRooms, taxConfig, invoices, company,
  reload, userName, setStatus, setPrintDoc, totals, paid, due, flash, isAdmin,
}) {
  const isCheckedOut = ['CHECKED_OUT', 'SETTLED'].includes(res.status)
  const editable     = isAdmin || !['CHECKED_OUT', 'SETTLED', 'CANCELLED'].includes(res.status)
  const pendingClearanceRooms = resRooms.filter((rr) => (rr.rooms?.hk_status || '').toLowerCase() !== 'inspected')
  const [c, setC]           = useState({ charge_type: 'OTHER', description: '', base_amount: '', discount_pct: 0, charge_date: todayISO() })
  const [facilityItems, setFacilityItems] = useState([])

  useEffect(() => {
    supabase.from('facility_items')
      .select('id, name, default_price, unit')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setFacilityItems(data || []))
  }, [])
  const [discBusy, setDiscBusy] = useState(false)
  const [discountForm, setDiscountForm] = useState({
    discount_type: res.discount_type || 'percentage',
    discount_pct: Number(res.discount_pct) || 0,
    discount_val: Number(res.discount_val) || 0,
  })
  const [p, setP]           = useState({ amount: '', method: 'CASH', reference: '', received_date: todayISO(), received_by: userName, paid_by_party: '', payment_class: 'SETTLEMENT' })

  useEffect(() => {
    setDiscountForm({
      discount_type: res.discount_type || 'percentage',
      discount_pct: Number(res.discount_pct) || 0,
      discount_val: Number(res.discount_val) || 0,
    })
  }, [res.discount_type, res.discount_pct, res.discount_val])

  const printLiveInvoice = (type) => {
    setPrintDoc({
      type,
      invoiceData: {
        charges,
        line_snapshot: [],
        totals,
        paid,
        due,
        invoice_no: undefined,
        issued_at:  new Date().toISOString(),
        buyer_name: undefined,
        buyer_address: undefined,
        buyer_bin: undefined,
      },
    })
  }

  const printHistoryInvoice = (inv, type) => {
    const hasNewCharges  = Array.isArray(inv.charges) && inv.charges.length > 0
    const hasLegacyLines = Array.isArray(inv.line_snapshot) && inv.line_snapshot.length > 0
    setPrintDoc({
      type,
      invoiceData: {
        // NEVER fall back to today's live `charges` here — that was the bug:
        // reprinting an old invoice must show what was actually billed at
        // the time, not whatever is currently on the live folio.
        charges:       hasNewCharges ? inv.charges : [],
        line_snapshot: !hasNewCharges && hasLegacyLines ? inv.line_snapshot : [],
        totals:        inv.totals  ?? totals,
        paid:           inv.paid    ?? paid,
        due:           inv.due     ?? due,
        invoice_no:    inv.invoice_no,
        issued_at:     inv.issued_at,
        buyer_name:    inv.buyer_name,
        buyer_address: inv.buyer_address,
        buyer_bin:     inv.buyer_bin,
      },
    })
  }

  // ----------------------------------------------------------------
  // Folio actions
  // ----------------------------------------------------------------
  const buildRoomRows = () => {
    const rows = []
    const discDescriptor = resDiscount(res)
    const totalRoomNights = resRooms.reduce((sum, rr) => {
      const ci = rr.from_date || res.check_in
      const co = rr.to_date   || res.check_out
      return sum + eachNight(ci, co).length
    }, 0)
    const perNightDiscount = discDescriptor && typeof discDescriptor === 'object' && totalRoomNights > 0
      ? { type: 'fixed', value: discDescriptor.value / totalRoomNights }
      : discDescriptor

    for (const rr of resRooms) {
      const ci = rr.from_date || res.check_in
      const co = rr.to_date   || res.check_out
      for (const night of eachNight(ci, co)) {
        const rate = rateFor(taxConfig, 'ROOM', night)
        rows.push({
          reservation_id: res.id, charge_date: night, charge_type: 'ROOM',
          description: `Room ${rr.rooms?.room_no}${rr.rooms?.room_name ? ` (${rr.rooms.room_name})` : ''} — Night of ${fmtDate(night)}`,
          ...computeCharge(rr.rate, perNightDiscount, rate), created_by: userName,
        })
      }
    }
    const addonDiscount = discDescriptor && typeof discDescriptor === 'object' ? 0 : discDescriptor
    for (const night of eachNight(res.check_in, res.check_out)) {
      const rate = rateFor(taxConfig, 'ROOM', night)
      if (res.extra_pax > 0 && res.extra_pax_rate > 0)
        rows.push({ reservation_id: res.id, charge_date: night, charge_type: 'ROOM', description: `Extra pax × ${res.extra_pax} — ${fmtDate(night)}`, ...computeCharge(res.extra_pax * res.extra_pax_rate, addonDiscount, rate), created_by: userName })
      if (res.driver_accommodation && res.driver_count > 0 && res.driver_rate > 0)
        rows.push({ reservation_id: res.id, charge_date: night, charge_type: 'ROOM', description: `Driver accommodation × ${res.driver_count} — ${fmtDate(night)}`, ...computeCharge(res.driver_count * res.driver_rate, addonDiscount, rate), created_by: userName })
    }
    return rows
  }

  const postRoomCharges = async () => {
    if (resRooms.length === 0)                             { flash('Assign rooms first (Check-In tab).'); return }
    if (charges.some((ch) => ch.charge_type === 'ROOM'))   { flash('Room charges already posted — use "Repost" to replace them.'); return }
    const rows = buildRoomRows()
    const { error } = await supabase.from('folio_charges').insert(rows)
    if (error) flash(error.message); else { await reload(); flash(`${rows.length} room charge line(s) posted.`) }
  }

  const repostRoomCharges = async () => {
    if (!editable)             { flash('Room bill can only be edited before check-out (administrator override available).'); return }
    if (resRooms.length === 0) { flash('Assign rooms first (Check-In tab).'); return }
    const { error: de } = await supabase.from('folio_charges').delete().eq('reservation_id', res.id).eq('charge_type', 'ROOM')
    if (de) { flash(de.message); return }
    const rows = buildRoomRows()
    const { error } = await supabase.from('folio_charges').insert(rows)
    if (error) flash(error.message); else { await reload(); flash(`Room bill reposted — ${rows.length} line(s).`) }
  }

  const addCharge = async () => {
    if (!c.description || !c.base_amount) return
    const rate = rateFor(taxConfig, c.charge_type, c.charge_date)
    const { error } = await supabase.from('folio_charges').insert({
      reservation_id: res.id, charge_date: c.charge_date, charge_type: c.charge_type,
      description: c.description, ...computeCharge(c.base_amount, c.discount_pct, rate), created_by: userName,
    })
    if (error) flash(error.message)
    else { setC({ charge_type: 'OTHER', description: '', base_amount: '', discount_pct: 0, charge_date: todayISO() }); await reload() }
  }

  const toggleStatus = async (ch) => { await supabase.from('folio_charges').update({ status: ch.status === 'PAID' ? 'DUE' : 'PAID' }).eq('id', ch.id); await reload() }
  const delCharge    = async (chId) => { await supabase.from('folio_charges').delete().eq('id', chId); await reload() }

  // ----------------------------------------------------------------
  // Payment actions
  // ----------------------------------------------------------------
  const syncInvoiceStatus = async () => {
    const { data: freshPayments } = await supabase
      .from('payments').select('amount').eq('reservation_id', res.id)
    const { data: activeInv } = await supabase
      .from('invoices').select('id, totals')
      .eq('reservation_id', res.id).eq('is_void', false).single()

    if (!activeInv) return

    const totalPaid = (freshPayments || []).reduce((a, p) => a + Number(p.amount), 0)
    const snapGrandTotal = activeInv.totals?.grand_total ?? totals.grand_total
    const newDue    = +(snapGrandTotal - totalPaid).toFixed(2)
    const newStatus = newDue <= 0 ? 'PAID' : 'PARTIAL'

    await supabase.from('invoices').update({ paid: totalPaid, due: newDue, status: newStatus }).eq('id', activeInv.id)

    if (newDue <= 0 && res.status === 'CHECKED_OUT') {
      await supabase.from('reservations').update({ status: 'SETTLED' }).eq('id', res.id)
      await reload()
      flash('Balance cleared — reservation marked SETTLED.')
    }
  }

  const addPayment = async () => {
    if (!p.amount || +p.amount <= 0) return
    const { error } = await supabase.from('payments').insert({
      reservation_id: res.id,
      amount:         +p.amount,
      method:         p.method,
      reference:      p.reference,
      received_date:  p.received_date,
      received_by:    p.received_by,
      paid_by_party:  p.paid_by_party || null,
      payment_class:  p.payment_class || 'SETTLEMENT',
    })
    if (error) { flash(error.message); return }
    setP({ amount: '', method: 'CASH', reference: '', received_date: todayISO(), received_by: userName, paid_by_party: '', payment_class: 'SETTLEMENT' })
    await reload()
    if (isCheckedOut) await syncInvoiceStatus()
    else flash('Payment recorded.')
  }

  const delPayment = async (pm) => {
    const { error } = await supabase.from('payments').delete().eq('id', pm.id)
    if (error) flash('Administrator access required to delete payments.')
    else {
      await reload()
      if (isCheckedOut) await syncInvoiceStatus()
      else flash('Payment deleted.')
    }
  }

  const saveReservationDiscount = async () => {
    const isPct = discountForm.discount_type === 'percentage'
    const pct = isPct ? Number(discountForm.discount_pct) : 0
    const fixed = isPct ? 0 : Number(discountForm.discount_val)
    if (isPct && (pct < 0 || pct > 100)) { flash('Discount % must be between 0 and 100.'); return }
    if (!isPct && fixed < 0) { flash('Fixed discount cannot be negative.'); return }

    setDiscBusy(true)
    const { error } = await supabase.from('reservations').update({
      discount_type: discountForm.discount_type,
      discount_pct: isPct ? pct : 0,
      discount_val: isPct ? 0 : fixed,
      updated_at: new Date().toISOString(),
    }).eq('id', res.id)
    setDiscBusy(false)
    if (error) { flash(error.message); return }
    await reload()
    flash('Reservation discount updated.')
  }

  // ----------------------------------------------------------------
  // Checkout handler — saves full invoice snapshot
  // ----------------------------------------------------------------
  const handleCheckOut = async () => {
  if (pendingClearanceRooms.length > 0) {
    const names = pendingClearanceRooms.map((rr) => `${rr.rooms?.room_no} (${rr.rooms?.hk_status || 'Unknown'})`).join(', ')
    flash(`Cannot check out — housekeeping clearance pending. Mark room status as Inspected first: ${names}.`)
    return
  }
  if (due > 0) {
      const ok = window.confirm(
        `Guest has an outstanding balance of ${fmtBDT(due)}.\n\nCheck out anyway? The invoice will be marked PARTIAL.`
      )
      if (!ok) return
    }

    const invoiceNo  = generateInvoiceNo(res.res_no)
    const issuedAt   = new Date().toISOString()
    const invStatus  = due <= 0 ? 'PAID' : 'PARTIAL'

    const { error: invErr } = await supabase.from('invoices').insert({
      reservation_id: res.id,
      invoice_no:     invoiceNo,
      issued_at:      issuedAt,
      issued_by:      userName,
      invoice_type:   'GUEST_BILL',
      charges,
      totals,
      paid,
      due,
      status:         invStatus,
      is_void:        false,
    })

    if (invErr) { flash(`Failed to generate invoice: ${invErr.message}`); return }

    await setStatus('CHECKED_OUT', { checked_out_at: issuedAt })
    const roomIds = resRooms.map((rr) => rr.room_id).filter(Boolean)
    if (roomIds.length > 0) {
      await supabase.from('rooms').update({ hk_status: 'Dirty' }).in('id', roomIds)
    }
    await reload()
    flash(
      due > 0
        ? `Checked out with ${fmtBDT(due)} outstanding. Invoice ${invoiceNo} marked PARTIAL.`
        : `Checked out. Invoice ${invoiceNo} generated — fully paid.`
    )
  }

  // ----------------------------------------------------------------
  // Re-check-in (admin) — voids invoices + audit log
  // ----------------------------------------------------------------
  const handleReCheckIn = async () => {
    const reason = window.prompt('Re-check-in will VOID the issued invoices. Reason:', 'Guest stay extended')
    if (reason === null) return
    await supabase.from('invoices')
      .update({ is_void: true, void_reason: reason || 'Re-check-in', voided_by: userName, voided_at: new Date().toISOString() })
      .eq('reservation_id', res.id)
      .not('is_void', 'is', true)
    await supabase.from('audit_log').insert({
      actor: userName, action: 'RE_CHECKIN', entity: 'reservation',
      entity_id: res.res_no, details: { reason },
    })
    await setStatus('CHECKED_IN', { checked_out_at: null })
    await reload()
    flash('Guest re-checked-in. Previous invoices voided; folio is editable again.')
  }

  return (
    <div className="space-y-6">

      {/* 1. Header & Check-out Actions */}
      <div className="card p-5 border-l-4 border-l-pine">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="font-display font-semibold text-pine text-lg">Guest Billing & Check-out</h3>            
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button className="btn-ghost" onClick={() => printLiveInvoice('BILL')}><Printer size={16} /> Preview Bill</button>
            <button className="btn-ghost" onClick={() => printLiveInvoice('MUSHAK')}><Receipt size={16} /> Mushak Print</button>
            <div className="h-6 w-px bg-leaf/60 mx-2 hidden sm:block" />
            {!isCheckedOut ? (
              <>
                {pendingClearanceRooms.length > 0 && (
                  <span className="text-xs text-amber font-semibold mr-1">⚠ Clearance pending: {pendingClearanceRooms.map(rr => rr.rooms?.room_no).join(', ')}</span>
                )}
                <button className="btn-primary" onClick={handleCheckOut}>
                  <CheckCircle2 size={16} /> Check Out
                </button>
              </>
            ) : (
              isAdmin && (
                <button className="btn-amber" onClick={handleReCheckIn}>
                  <LogIn size={16} /> Re-check-in (Admin)
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* 2. Add Charges */}
      {editable && (
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h3 className="font-display font-semibold text-pine">Add charge</h3>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={postRoomCharges}>
                <BedDouble size={15} /> Post room charges ({nightsBetween(res.check_in, res.check_out)} nights)
              </button>
              {charges.some((ch) => ch.charge_type === 'ROOM') && (
                <button className="btn-amber !py-2" onClick={repostRoomCharges}>Repost</button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-2">
          <div className="min-w-0 sm:col-span-2 xl:col-span-1">
            <ChargeTypeSelect
              value={c.charge_type}
              items={facilityItems}
              onChange={(id, item) => setC(prev => ({
                ...prev,
                charge_type: item?.name || id,
                description: prev.description || item?.name || '',
                base_amount: prev.base_amount || String(item?.default_price ?? ''),
              }))}
            />
          </div>
        
          <div className="min-w-0 sm:col-span-2 xl:col-span-2">
            <input
              className="input w-full"
              placeholder="Description"
              value={c.description}
              onChange={(e) => setC({ ...c, description: e.target.value })}
            />
          </div>
        
          <div className="min-w-0">
            <input
              type="number"
              className="input money w-full"
              placeholder="Base ৳"
              value={c.base_amount}
              onChange={(e) => setC({ ...c, base_amount: e.target.value })}
            />
          </div>
        
          <div className="min-w-0">
            <input
              type="number"
              min="0"
              max="100"
              className="input money w-full"
              placeholder="Disc %"
              value={c.discount_pct}
              onChange={(e) => setC({ ...c, discount_pct: e.target.value })}
            />
          </div>
        
          <div className="min-w-0 sm:col-span-2 xl:col-span-1">
            <button className="btn-primary justify-center w-full" onClick={addCharge}>
              <Plus size={15} /> Add
            </button>
          </div>
        </div>
        </div>
      )}

      {/* 3. Record Payment */}
      {editable && (
        <div className="card p-4">
          <h3 className="font-display font-semibold text-pine mb-3 flex items-center gap-2">
            <Receipt size={16} className="text-forest" /> Record Payment
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Row 1: Amount + Method */}
            <div>
              <label className="label !text-xs">Amount (৳) *</label>
              <input type="number" className="input money"
                placeholder="0.00" value={p.amount}
                onChange={(e) => setP({ ...p, amount: e.target.value })} />
            </div>
            <div>
              <label className="label !text-xs">Payment method</label>
              <SearchableSelect
                value={p.method}
                onChange={v => setP({ ...p, method: v })}
                options={['CASH', 'BKASH', 'NAGAD', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']}
                placeholder="Method…"
              />
            </div>
            <div>
              <label className="label !text-xs">Date</label>
              <input type="date" className="input" value={p.received_date}
                onChange={(e) => setP({ ...p, received_date: e.target.value })} />
            </div>
            <div>
              <label className="label !text-xs">Reference / TrxID</label>
              <input className="input" placeholder="Optional"
                value={p.reference} onChange={(e) => setP({ ...p, reference: e.target.value })} />
            </div>
            {/* Row 2: Paid by party + Class */}
            <div className="sm:col-span-2">
              <label className="label !text-xs">Paid by</label>
              <SearchableSelect
                value={p.paid_by_party || ''}
                onChange={v => setP({ ...p, paid_by_party: v })}
                options={[
                  { value: guest?.full_name || 'Guest', label: `👤 ${guest?.full_name || 'Guest'} (Guest)` },
                  ...(res.agencies ? [{ value: res.agencies.name, label: `🤝 ${res.agencies.name} (Agency)` }] : []),
                  ...(res.shareholders ? [{ value: res.shareholders.name, label: `👥 ${res.shareholders.name} (Shareholder)` }] : []),
                  ...(res.company_id && guest ? [] : []),
                ].filter(Boolean)}
                placeholder="Select who is paying…"
                allowCreate
                onCreate={async (v) => v}
              />
            </div>
            <div>
              <label className="label !text-xs">Payment class</label>
              <SearchableSelect
                value={p.payment_class || 'SETTLEMENT'}
                onChange={v => setP({ ...p, payment_class: v })}
                options={[
                  { value: 'ADVANCE', label: 'Advance' },
                  { value: 'SETTLEMENT', label: 'Settlement' },
                  { value: 'PARTIAL', label: 'Partial' },
                ]}
                placeholder="Class…"
              />
            </div>
            <div className="sm:col-span-4 flex justify-end">
              <button className="btn-primary" onClick={addPayment} disabled={!p.amount || +p.amount <= 0}>
                <Receipt size={15} /> Save payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Reservation Discount (Admin) */}
      {isAdmin && editable && (
        <div className="card p-4 border border-amber/30 bg-amber/5">
          <h3 className="font-display font-semibold text-pine flex items-center gap-2 mb-3">
            Update Reservation Discount
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              <label className="label !text-xs">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDiscountForm((p) => ({ ...p, discount_type: 'percentage' }))}
                  className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-colors ${discountForm.discount_type === 'percentage' ? 'bg-forest text-white border-forest' : 'border-leaf text-pine'}`}
                >%</button>
                <button
                  type="button"
                  onClick={() => setDiscountForm((p) => ({ ...p, discount_type: 'fixed' }))}
                  className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-colors ${discountForm.discount_type === 'fixed' ? 'bg-forest text-white border-forest' : 'border-leaf text-pine'}`}
                >৳ Fixed</button>
              </div>
            </div>
            <div>
              <label className="label !text-xs">{discountForm.discount_type === 'percentage' ? 'Discount %' : 'Fixed discount (৳)'}</label>
              {discountForm.discount_type === 'percentage' ? (
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="input money"
                  value={discountForm.discount_pct}
                  onChange={(e) => setDiscountForm((p) => ({ ...p, discount_pct: e.target.value }))}
                />
              ) : (
                <input
                  type="number"
                  min="0"
                  className="input money"
                  value={discountForm.discount_val}
                  onChange={(e) => setDiscountForm((p) => ({ ...p, discount_val: e.target.value }))}
                />
              )}
            </div>
            <div className="flex items-end">
              <button className="btn-amber w-full justify-center" onClick={saveReservationDiscount} disabled={discBusy}>
                {discBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Billing & Folio Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-leaf font-display font-semibold text-pine">Guest Total Billing History</div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th">Date</th><th className="th">Type</th><th className="th">Description</th>
            <th className="th text-right">Base</th><th className="th text-right">Disc.</th><th className="th text-right">SC</th>
            <th className="th text-right">VAT</th><th className="th text-right">Total</th>
            <th className="th">Status</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {charges.map((ch) => (
              <tr key={ch.id} className="hover:bg-leaf/20">
                <td className="td money text-xs">{fmtDate(ch.charge_date)}</td>
                <td className="td text-xs">{ch.charge_type}</td>
                <td className="td text-sm">{ch.description}</td>
                <td className="td money text-right">{Number(ch.base_amount).toFixed(2)}</td>
                <td className="td money text-right">{Number(ch.discount).toFixed(2)}</td>
                <td className="td money text-right">{Number(ch.service_charge).toFixed(2)}</td>
                <td className="td money text-right">{Number(ch.vat).toFixed(2)}</td>
                <td className="td money text-right font-semibold">{Number(ch.total).toFixed(2)}</td>
                <td className="td">
                  <button
                    onClick={() => editable ? toggleStatus(ch) : flash('Editing a checked-out folio requires administrator access.')}
                    className={`status-chip ${ch.status === 'PAID' ? 'bg-forest/15 text-forest' : 'bg-red-100 text-red-600'} ${!editable ? 'opacity-60' : ''}`}
                  >{ch.status}</button>
                </td>
                <td className="td">{editable && <button onClick={() => delCharge(ch.id)} className="text-red-300 hover:text-red-600"><Trash2 size={13} /></button>}</td>
              </tr>
            ))}
            {charges.length === 0 && <tr><td className="td text-pine/50" colSpan={10}>No charges yet.</td></tr>}
          </tbody>
          {charges.length > 0 && (
            <tfoot><tr className="bg-leaf/40 font-bold money">
              <td className="td" colSpan={3}>Totals</td>
              <td className="td text-right">{totals.base.toFixed(2)}</td>
              <td className="td text-right">{totals.discount.toFixed(2)}</td>
              <td className="td text-right">{totals.service_charge.toFixed(2)}</td>
              <td className="td text-right">{totals.vat.toFixed(2)}</td>
              <td className="td text-right">{(totals.grand_total_raw ?? totals.grand_total).toFixed(2)}</td>
              <td className="td" colSpan={2}></td>
            </tr></tfoot>
          )}
        </table>
        </div>
        {charges.length > 0 && (
          <div className="px-4 py-3 border-t border-leaf flex justify-end">
            <div className="w-full sm:w-72 text-sm money space-y-1">
              <div className="flex justify-between text-pine/70"><span>Subtotal</span><span>{fmtBDT(totals.grand_total_raw ?? totals.grand_total)}</span></div>
              {!!totals.rounding && (
                <div className="flex justify-between text-pine/70">
                  <span>Rounding adjustment</span>
                  <span>{totals.rounding > 0 ? '+ ' : '− '}{fmtBDT(Math.abs(totals.rounding))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-pine border-t border-leaf pt-1"><span>Grand total (payable)</span><span>{fmtBDT(totals.grand_total)}</span></div>
              <div className="flex justify-between text-forest"><span>Paid</span><span>{fmtBDT(paid)}</span></div>
              <div className={`flex justify-between font-bold text-lg border-t border-leaf pt-1 mt-1 ${due > 0 ? 'text-red-600' : 'text-forest'}`}>
                <span>Balance due</span><span>{fmtBDT(due)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Payments History */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-leaf font-display font-semibold text-pine">Payments History</div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th">Date</th><th className="th">Paid by</th><th className="th">Class</th><th className="th">Method</th>
            <th className="th">Reference</th><th className="th text-right">Amount</th>
          </tr></thead>
          <tbody>
            {payments.map((pm) => (
              <tr key={pm.id}>
                <td className="td money text-xs">
                  {fmtDate(pm.received_date)}
                  {isAdmin && (
                    <button title="Delete payment (admin)" onClick={() => delPayment(pm)} className="ml-2 text-red-300 hover:text-red-600 align-middle">
                      <Trash2 size={12} />
                    </button>
                  )}
                </td>
                <td className="td text-sm font-medium">{pm.paid_by_party || pm.received_by || '—'}</td>
                <td className="td">
                  <span className={`status-chip text-xs ${
                    pm.payment_class === 'ADVANCE'    ? 'bg-amber/20 text-amber' :
                    pm.payment_class === 'SETTLEMENT' ? 'bg-forest/15 text-forest' :
                    'bg-sky-50 text-sky-700'
                  }`}>{pm.payment_class || 'SETTLEMENT'}</span>
                </td>
                <td className="td text-sm">{pm.method}</td>
                <td className="td text-xs">{pm.reference || '—'}</td>
                <td className="td money text-right font-semibold">{Number(pm.amount).toFixed(2)}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td className="td text-pine/50" colSpan={6}>No payments recorded.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
      {/* 5b. Guest Refund */}
      <GuestRefundCard
        res={res}
        payments={payments}
        charges={charges}
        totals={totals}
        paid={paid}
        resRooms={resRooms}
        reload={reload}
        flash={flash}
        userName={userName}
        isAdmin={isAdmin}
      />
      {/* 6. Partners — Shareholder Redemption + Agency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Shareholder redemption */}
        <ShareholderRedemption res={res} charges={charges} reload={reload} flash={flash} userName={userName} />

        {/* Agency — simple assignment + due tracking */}
        <AgencySection res={res} reload={reload} flash={flash} />
      </div>

      {/* 7. Historical Invoices */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-leaf font-display font-semibold text-pine">Historical Invoices</div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th">Invoice No.</th>
            <th className="th">Issued Date</th>
            <th className="th text-right">Grand Total</th>
            <th className="th text-right">Paid</th>
            <th className="th text-right">Due</th>
            <th className="th text-center">Status</th>
            <th className="th text-right">Actions</th>
          </tr></thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className={inv.is_void ? 'opacity-60 bg-red-50' : ''}>
                <td className="td font-semibold money">{inv.invoice_no}</td>
                <td className="td text-xs">{fmtDate(inv.issued_at)}</td>
                <td className="td text-right money font-semibold">{fmtBDT(inv.totals?.grand_total ?? 0)}</td>
                <td className="td text-right money">{fmtBDT(inv.paid ?? 0)}</td>
                <td className={`td text-right money font-semibold ${(inv.due ?? 0) > 0 ? 'text-red-600' : 'text-forest'}`}>{fmtBDT(inv.due ?? 0)}</td>
                <td className="td text-center">
                  {inv.is_void
                    ? <span className="status-chip bg-red-100 text-red-600">VOID</span>
                    : inv.status === 'PARTIAL'
                      ? <span className="status-chip bg-amber/20 text-amber">PARTIAL</span>
                      : <span className="status-chip bg-green-100 text-green-700">PAID</span>
                  }
                </td>
                <td className="td text-right">
                  <button className="btn-ghost !py-1 !px-2 text-xs mr-1" onClick={() => printHistoryInvoice(inv, 'BILL')}><Printer size={13} /> Bill</button>
                  <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => printHistoryInvoice(inv, 'MUSHAK')}><Receipt size={13} /> Mushak</button>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td className="td text-pine/50 text-center" colSpan={7}>No historical invoices found.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  SHAREHOLDER REDEMPTION — inline in Billings tab                    */
/*  Shareholder balance is separate from guest loyalty points.          */
/*  100 loyalty points = ৳1; but shareholder balance is in BDT points  */
/*  where 100 shareholder points = ৳1 redeemable against ROOM only.    */
/* ------------------------------------------------------------------ */
function ShareholderRedemption({ res, charges = [], reload, flash, userName }) {
  const shareholder = res.shareholders
  const [redeemAmt, setRedeemAmt]       = useState('')
  const [shareholders, setShareholders] = useState([])
  const [showPicker, setShowPicker]     = useState(false)
  const [editingBalance, setEditingBalance] = useState(false)
  const [balanceVal, setBalanceVal]     = useState('')
  const [busy, setBusy]                 = useState(false)

  useEffect(() => {
    if (showPicker)
      supabase.from('shareholders').select('id,name').order('name')
        .then(({ data }) => setShareholders(data || []))
  }, [showPicker])

  const assignShareholder = async (id) => {
    const { error } = await supabase.from('reservations').update({ shareholder_id: id }).eq('id', res.id)
    if (error) flash(error.message)
    else { setShowPicker(false); reload(); flash('Shareholder assigned.') }
  }
  const unassignShareholder = async () => {
    if (!window.confirm(`Remove ${shareholder?.name || 'this shareholder'}?`)) return
    const { error } = await supabase.from('reservations').update({ shareholder_id: null }).eq('id', res.id)
    if (error) flash(error.message)
    else { reload(); flash('Shareholder unassigned.') }
  }
  const saveBalance = async () => {
    if (balanceVal === '' || isNaN(Number(balanceVal))) { flash('Enter a valid amount.'); return }
    const { error } = await supabase.from('shareholders')
      .update({ free_stay_balance: Number(balanceVal) }).eq('id', res.shareholder_id)
    if (error) flash(error.message)
    else { setEditingBalance(false); reload(); flash('Shareholder balance corrected.') }
  }

  // Room charge totals
  const roomChargeTotal  = charges.filter(c => c.charge_type === 'ROOM').reduce((a,c) => a + (+c.total||0), 0)
  const alreadyRedeemed  = charges.filter(c => c.charge_type === 'SHAREHOLDER_REDEEM').reduce((a,c) => a + Math.abs(+c.total||0), 0)
  const roomRedeemableLeft = Math.max(0, +(roomChargeTotal - alreadyRedeemed).toFixed(2))
  const hasRoomCharge    = roomChargeTotal > 0

  // 100 shareholder points = ৳1
  const maxRedeemTaka    = Math.floor((shareholder?.free_stay_balance || 0) / 100)

  const redeem = async () => {
    const amount = Number(redeemAmt)
    if (!amount || amount <= 0)        { flash('Enter a valid ৳ amount.'); return }
    if (!hasRoomCharge)                 { flash('No room charge posted — redemption only against room charges.'); return }
    if (amount > roomRedeemableLeft)    { flash(`Max redeemable against room: ${fmtBDT(roomRedeemableLeft)}`); return }
    const pointsNeeded = Math.ceil(amount * 100)
    if ((shareholder?.free_stay_balance || 0) < pointsNeeded) {
      flash(`Insufficient balance. ${shareholder?.free_stay_balance || 0} pts = max ${fmtBDT(maxRedeemTaka)}.`)
      return
    }
    setBusy(true)
    const { error: chErr } = await supabase.from('folio_charges').insert({
      reservation_id: res.id,
      charge_type:    'SHAREHOLDER_REDEEM',
      description:    `Shareholder redemption — ${shareholder?.name} (against room charge)`,
      base_amount:    -amount, discount: 0, service_charge: 0, vat: 0, total: -amount,
      status:         'PAID', charge_date: todayISO(), created_by: userName || 'System',
    })
    if (chErr) { flash('Error recording redemption.'); setBusy(false); return }
    await supabase.from('shareholders')
      .update({ free_stay_balance: shareholder.free_stay_balance - pointsNeeded })
      .eq('id', res.shareholder_id)
    setRedeemAmt('')
    await reload()
    flash(`Redeemed ${fmtBDT(amount)} — ${pointsNeeded} pts deducted from ${shareholder?.name}.`)
    setBusy(false)
  }

  if (!shareholder) {
    return (
      <div className="card p-4">
        <h3 className="font-display font-semibold text-pine text-sm mb-2 flex items-center gap-2">
          <Users size={15} className="text-forest" /> Shareholder Redemption
        </h3>
        <p className="text-xs text-pine/50 mb-3">No shareholder linked to this reservation.</p>
        <button onClick={() => setShowPicker(true)} className="btn-ghost text-sm">
          <Plus size={13} /> Assign Shareholder
        </button>
        {showPicker && (
          <div className="mt-2 border border-leaf rounded-lg p-2 max-h-40 overflow-y-auto">
            {shareholders.map(s => (
              <button key={s.id} onClick={() => assignShareholder(s.id)}
                className="block w-full text-left px-2 py-1.5 text-sm rounded hover:bg-leaf/40">{s.name}</button>
            ))}
            <button onClick={() => setShowPicker(false)}
              className="block w-full text-left px-2 py-1.5 text-xs text-pine/40 hover:bg-leaf/40">Cancel</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-pine text-sm flex items-center gap-2">
          <Users size={15} className="text-forest" /> Shareholder Redemption
        </h3>
        {shareholder && (
          <div className="flex gap-2 text-xs">
            <button onClick={() => setShowPicker(true)} className="text-pine/50 hover:text-forest underline">Change</button>
            <span className="text-pine/20">·</span>
            <button onClick={unassignShareholder} className="text-red-400 hover:text-red-600 underline">Unassign</button>
          </div>
        )}
      </div>

      {showPicker && (
        <div className="border border-leaf rounded-lg p-2 max-h-40 overflow-y-auto">
          {shareholders.map(s => (
            <button key={s.id} onClick={() => assignShareholder(s.id)}
              className="block w-full text-left px-2 py-1.5 text-sm rounded hover:bg-leaf/40">{s.name}</button>
          ))}
          <button onClick={() => setShowPicker(false)}
            className="block w-full text-left px-2 py-1.5 text-xs text-pine/40 hover:bg-leaf/40">Cancel</button>
        </div>
      )}

      {shareholder && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-pine">{shareholder.name}</span>
            <span className="text-xs text-pine/40">·</span>
            {!editingBalance ? (
              <span className="text-sm text-pine/60">
                Balance: <span className="font-bold text-forest">{shareholder.free_stay_balance || 0} pts</span>
                {' '}= <span className="font-semibold money">{fmtBDT(maxRedeemTaka)}</span>
                <button onClick={() => { setBalanceVal(String(shareholder.free_stay_balance || 0)); setEditingBalance(true) }}
                  className="ml-2 text-xs text-pine/40 hover:text-forest underline">Edit</button>
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <input type="number" className="input money !w-28 !py-1" value={balanceVal}
                  onChange={e => setBalanceVal(e.target.value)} />
                <button onClick={saveBalance} className="text-xs text-forest font-semibold underline">Save</button>
                <button onClick={() => setEditingBalance(false)} className="text-xs text-pine/40 underline">Cancel</button>
              </div>
            )}
          </div>

          {/* Rate info */}
          <div className="text-xs text-pine/40 bg-leaf/20 rounded-lg px-3 py-2">
            100 shareholder pts = ৳1.00 &nbsp;·&nbsp; Redeemable against room charges only
            {hasRoomCharge
              ? <span className="ml-2">· Room remaining: <span className="font-semibold text-pine/60">{fmtBDT(roomRedeemableLeft)}</span></span>
              : <span className="ml-2 text-amber-600">· No room charge posted yet</span>}
          </div>

          {/* Redeem input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input type="number" min="0" step="0.01"
                className="input money flex-1"
                placeholder="Amount to redeem (৳)"
                value={redeemAmt}
                onChange={e => setRedeemAmt(e.target.value)}
                disabled={!hasRoomCharge || roomRedeemableLeft <= 0}
              />
              <button onClick={redeem} disabled={busy || !hasRoomCharge || roomRedeemableLeft <= 0 || !redeemAmt}
                className="btn-amber">
                Redeem
              </button>
            </div>
            {redeemAmt && Number(redeemAmt) > 0 && (
              <p className="text-xs text-pine/50">
                = {Math.ceil(Number(redeemAmt) * 100)} pts will be deducted from {shareholder.name}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  AGENCY SECTION — inline in Billings tab                            */
/*  Agency is for B2B / OTA bookings — separate from guest loyalty.    */
/* ------------------------------------------------------------------ */
function AgencySection({ res, reload, flash }) {
  const agency = res.agencies
  const [agencies, setAgencies]         = useState([])
  const [showPicker, setShowPicker]     = useState(false)
  const [editingDue, setEditingDue]     = useState(false)
  const [dueVal, setDueVal]             = useState('')

  useEffect(() => {
    if (showPicker)
      supabase.from('agencies').select('id,name,commission_rate').order('name')
        .then(({ data }) => setAgencies(data || []))
  }, [showPicker])

  const assign = async (id) => {
    const { error } = await supabase.from('reservations').update({ agency_id: id }).eq('id', res.id)
    if (error) flash(error.message)
    else { setShowPicker(false); reload(); flash('Agency assigned.') }
  }
  const unassign = async () => {
    if (!window.confirm(`Remove ${agency?.name || 'this agency'}?`)) return
    await supabase.from('reservations').update({ agency_id: null }).eq('id', res.id)
    reload(); flash('Agency unassigned.')
  }
  const saveDue = async () => {
    if (dueVal === '' || isNaN(Number(dueVal))) { flash('Enter a valid amount.'); return }
    await supabase.from('agencies').update({ due_balance: Number(dueVal) }).eq('id', res.agency_id)
    setEditingDue(false); reload(); flash('Agency due updated.')
  }
  const addDue = async () => {
    const amt = window.prompt('Add to agency due (৳):')
    if (!amt || isNaN(Number(amt))) return
    await supabase.from('agencies')
      .update({ due_balance: (agency?.due_balance || 0) + Number(amt) }).eq('id', res.agency_id)
    reload(); flash('Agency due updated.')
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-pine text-sm flex items-center gap-2">
          <Handshake size={15} className="text-forest" /> Agency / OTA
        </h3>
        {agency && (
          <div className="flex gap-2 text-xs">
            <button onClick={() => setShowPicker(true)} className="text-pine/50 hover:text-forest underline">Change</button>
            <span className="text-pine/20">·</span>
            <button onClick={unassign} className="text-red-400 hover:text-red-600 underline">Unassign</button>
          </div>
        )}
      </div>

      {!agency && !showPicker && (
        <>
          <p className="text-xs text-pine/50">No agency linked.</p>
          <button onClick={() => setShowPicker(true)} className="btn-ghost text-sm">
            <Plus size={13} /> Assign Agency
          </button>
        </>
      )}

      {showPicker && (
        <div className="border border-leaf rounded-lg p-2 max-h-40 overflow-y-auto">
          {agencies.length === 0 && <p className="text-xs text-pine/40 p-2">No agencies found.</p>}
          {agencies.map(a => (
            <button key={a.id} onClick={() => assign(a.id)}
              className="block w-full text-left px-2 py-1.5 text-sm rounded hover:bg-leaf/40">
              {a.name}
              {a.commission_rate > 0 && <span className="text-xs text-pine/40 ml-2">{a.commission_rate}% commission</span>}
            </button>
          ))}
          <button onClick={() => setShowPicker(false)}
            className="block w-full text-left px-2 py-1.5 text-xs text-pine/40 hover:bg-leaf/40">Cancel</button>
        </div>
      )}

      {agency && (
        <>
          <div>
            <div className="font-semibold text-pine">{agency.name}</div>
            {agency.commission_rate > 0 && (
              <div className="text-xs text-pine/50">Commission: {agency.commission_rate}%</div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-pine/60">Due balance:</span>
            {!editingDue ? (
              <>
                <span className="font-bold money text-pine">{fmtBDT(agency.due_balance || 0)}</span>
                <button onClick={() => { setDueVal(String(agency.due_balance || 0)); setEditingDue(true) }}
                  className="text-xs text-pine/40 hover:text-forest underline">Edit</button>
                <button onClick={addDue} className="text-xs text-forest hover:underline">+ Add</button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input type="number" className="input money !w-28 !py-1" value={dueVal}
                  onChange={e => setDueVal(e.target.value)} />
                <button onClick={saveDue} className="text-xs text-forest font-semibold underline">Save</button>
                <button onClick={() => setEditingDue(false)} className="text-xs text-pine/40 underline">Cancel</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  GUEST REFUND CARD                                                   */
/* ------------------------------------------------------------------ */
function GuestRefundCard({ res, payments, charges, totals, paid, resRooms = [], reload, flash, userName, isAdmin }) {
  const [open, setOpen]               = useState(false)
  const [policies, setPolicies]       = useState([])
  const [selectedPolicyId, setSelectedPolicyId] = useState('')
  const [cancelCharge, setCancelCharge] = useState(0)
  const [isManual, setIsManual]       = useState(false)
  const [manualCharge, setManualCharge] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [refundMethod, setRefundMethod] = useState('CASH')
  const [refundDate, setRefundDate]   = useState(todayISO())
  const [notes, setNotes]             = useState('')
  const [busy, setBusy]               = useState(false)
  const [existingRefund, setExistingRefund] = useState(null)

  // Load policies + existing refund
  useEffect(() => {
    if (!open) return
    supabase.from('cancellation_policies').select('*').eq('is_active', true)
      .order('is_default', { ascending: false }).order('name')
      .then(({ data }) => {
        const list = data || []
        setPolicies(list)
        // Auto-select default
        const def = list.find(p => p.is_default) || list[0]
        if (def && !selectedPolicyId) {
          setSelectedPolicyId(def.id)
          applyPolicy(def, paid)
        }
      })
    supabase.from('refunds').select('*').eq('reservation_id', res.id).maybeSingle()
      .then(({ data }) => setExistingRefund(data))
  }, [open])

  const applyPolicy = (policy, totalPaid) => {
    if (!policy || policy.charge_type === 'none') {
      setCancelCharge(0); return
    }
    if (policy.charge_type === 'percentage') {
      setCancelCharge(+(totalPaid * policy.charge_value / 100).toFixed(2))
    } else if (policy.charge_type === 'fixed') {
      setCancelCharge(Math.min(policy.charge_value, totalPaid))
    } else if (policy.charge_type === 'nights') {
      // N nights × room rate
      const nightlyRate = resRooms?.[0]?.rate || Number(res.room_rate) || 0
      setCancelCharge(Math.min(policy.charge_value * nightlyRate, totalPaid))
    }
  }

  const handlePolicyChange = (policyId) => {
    setSelectedPolicyId(policyId)
    setIsManual(false)
    const policy = policies.find(p => p.id === policyId)
    if (policy) applyPolicy(policy, paid)
  }

  const effectiveCharge = isManual ? (Number(manualCharge) || 0) : cancelCharge
  const refundAmount    = Math.max(0, +(paid - effectiveCharge).toFixed(2))
  const selectedPolicy  = policies.find(p => p.id === selectedPolicyId)

  const processRefund = async () => {
    if (paid <= 0) { flash('No payment recorded — nothing to refund.'); return }
    if (!window.confirm(`Process refund of ${fmtBDT(refundAmount)} to guest?`)) return
    setBusy(true)
    try {
      // 1. Record refund
      const { error: refErr } = await supabase.from('refunds').insert({
        reservation_id:      res.id,
        refund_date:         refundDate,
        total_paid:          paid,
        cancellation_charge: effectiveCharge,
        refund_amount:       refundAmount,
        refund_method:       refundMethod,
        policy_id:           isManual ? null : (selectedPolicyId || null),
        policy_name:         isManual ? 'Manual Override' : (selectedPolicy?.name || null),
        override_reason:     isManual ? overrideReason : null,
        is_manual_override:  isManual,
        processed_by:        userName,
        notes,
      })
      if (refErr) throw refErr

      // 2. If cancellation charge > 0, post it as a folio charge
      if (effectiveCharge > 0) {
        await supabase.from('folio_charges').insert({
          reservation_id: res.id,
          charge_date:    refundDate,
          charge_type:    'CANCELLATION_FEE',
          description:    `Cancellation fee — ${isManual ? overrideReason || 'Manual' : selectedPolicy?.name}`,
          base_amount:    effectiveCharge,
          discount:       0,
          service_charge: 0,
          vat:            0,
          total:          effectiveCharge,
          status:         'PAID',
          created_by:     userName,
        })
      }

      // 3. Record refund as negative payment
      await supabase.from('payments').insert({
        reservation_id: res.id,
        amount:         -refundAmount,
        method:         refundMethod,
        reference:      `REFUND-${res.res_no}`,
        received_date:  refundDate,
        received_by:    userName,
        payment_class:  'REFUND',
        notes:          `Guest refund — ${isManual ? overrideReason || 'Manual override' : selectedPolicy?.name}`,
      })

      // 4. Audit log
      await supabase.from('audit_log').insert({
        actor: userName, action: 'GUEST_REFUND', entity: 'reservation',
        entity_id: res.res_no,
        details: { total_paid: paid, cancellation_charge: effectiveCharge, refund_amount: refundAmount, method: refundMethod, policy: selectedPolicy?.name || 'Manual' },
      })

      await reload()
      flash(`Refund of ${fmtBDT(refundAmount)} processed via ${refundMethod}.${effectiveCharge > 0 ? ` Cancellation fee ${fmtBDT(effectiveCharge)} recorded.` : ''}`)
      setOpen(false)
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  if (!isAdmin) return null

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-leaf/20 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <Receipt size={16} className="text-amber" />
          <div>
            <div className="font-display font-semibold text-pine">Guest Refund</div>
            {existingRefund && (
              <div className="text-xs text-pine/50">
                Previous refund: {fmtBDT(existingRefund.refund_amount)} on {fmtDate(existingRefund.refund_date)}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-pine/60 money">Total paid: <span className="font-bold text-pine">{fmtBDT(paid)}</span></span>
          <svg className={`w-4 h-4 text-pine/40 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-leaf space-y-4 pt-4">

          {paid <= 0 && (
            <div className="px-4 py-3 rounded-lg bg-amber/10 text-amber text-sm">
              No payment recorded for this reservation — nothing to refund.
            </div>
          )}

          {paid > 0 && (
            <>
              {/* Cancellation Policy */}
              <div>
                <label className="label">Cancellation Policy</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SearchableSelect
                    value={selectedPolicyId}
                    onChange={handlePolicyChange}
                    options={[
                      { value: '', label: 'No policy / full refund' },
                      ...policies.map(p => ({
                        value: p.id,
                        label: `${p.name} · ${p.charge_type === 'none' ? 'No charge' : p.charge_type === 'percentage' ? `${p.charge_value}% of paid` : p.charge_type === 'fixed' ? fmtBDT(p.charge_value) : `${p.charge_value} nights`}`,
                      })),
                    ]}
                    placeholder="Select policy…"
                    disabled={isManual}
                  />
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-leaf/30 text-sm">
                    <span className="text-pine/60">Policy charge:</span>
                    <span className="font-bold money text-pine">{fmtBDT(cancelCharge)}</span>
                    {selectedPolicy?.description && (
                      <span className="text-xs text-pine/40 ml-1">— {selectedPolicy.description}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Manual Override */}
              <div className="border border-amber/30 rounded-lg p-3 bg-amber/5">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={isManual} onChange={e => setIsManual(e.target.checked)} className="accent-amber" />
                  <span className="text-sm font-medium text-amber-700">Manual override (exception)</span>
                </label>
                {isManual && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="label !text-xs">Cancellation charge (৳)</label>
                      <input type="number" min="0" max={paid}
                        className="input money"
                        placeholder="e.g. 500"
                        value={manualCharge}
                        onChange={e => setManualCharge(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label !text-xs">Reason *</label>
                      <input className="input"
                        placeholder="e.g. VIP guest, emergency cancellation…"
                        value={overrideReason}
                        onChange={e => setOverrideReason(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Refund Summary */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-leaf/30 rounded-lg p-3">
                  <div className="text-xs text-pine/50 mb-1">Total Paid</div>
                  <div className="font-bold money text-pine">{fmtBDT(paid)}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-xs text-pine/50 mb-1">Cancellation Fee</div>
                  <div className="font-bold money text-red-600">− {fmtBDT(effectiveCharge)}</div>
                </div>
                <div className="bg-forest/10 rounded-lg p-3">
                  <div className="text-xs text-pine/50 mb-1">Refund Amount</div>
                  <div className="font-bold money text-forest text-lg">{fmtBDT(refundAmount)}</div>
                </div>
              </div>

              {/* Refund Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label !text-xs">Refund Method</label>
                  <SearchableSelect
                    value={refundMethod}
                    onChange={setRefundMethod}
                    options={['CASH', 'BKASH', 'NAGAD', 'CARD', 'BANK', 'OTHER']}
                    placeholder="Method…"
                  />
                </div>
                <div>
                  <label className="label !text-xs">Refund Date</label>
                  <input type="date" className="input" value={refundDate} onChange={e => setRefundDate(e.target.value)} />
                </div>
                <div>
                  <label className="label !text-xs">Notes (optional)</label>
                  <input className="input" placeholder="Internal note…" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>

              <button
                onClick={processRefund}
                disabled={busy || refundAmount < 0 || (isManual && !overrideReason)}
                className="btn-primary w-full justify-center"
              >
                <Receipt size={15} />
                {busy ? 'Processing…' : `Process Refund — ${fmtBDT(refundAmount)}`}
              </button>

              {isManual && !overrideReason && (
                <p className="text-xs text-red-500 text-center">Override reason required for manual charge.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
/* ── Charge Type Select (fixed-position, pulls from facility_items) ── */
function ChargeTypeSelect({ value, onChange, items = [] }) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const btnRef            = useRef(null)
  const inputRef          = useRef(null)
  const [pos, setPos]     = useState({ top: 0, left: 0, width: 0 })

  const selected = items.find(it => it.name === value) || null

  const filtered = query
    ? items.filter(it => it.name.toLowerCase().includes(query.toLowerCase()))
    : items

  const openDropdown = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!btnRef.current?.contains(e.target)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openDropdown}
        className="input flex items-center justify-between gap-2 cursor-pointer text-sm font-medium w-full"
      >
        <span className={value ? 'text-pine truncate' : 'text-pine/40'}>
          {value || 'Select service…'}
        </span>
        <svg className={`w-4 h-4 text-pine/40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white border border-leaf rounded-xl shadow-xl overflow-hidden"
        >
          <div className="p-2 border-b border-leaf">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search service…"
              className="w-full text-sm px-2 py-1.5 rounded-lg border border-leaf focus:outline-none focus:ring-2 focus:ring-forest/30"
              onKeyDown={e => e.key === 'Escape' && setOpen(false)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {items.length === 0 && (
              <div className="px-3 py-3 text-sm text-pine/40 text-center">
                No services — add in Configuration → Facility Items
              </div>
            )}
            {filtered.length === 0 && items.length > 0 && (
              <div className="px-3 py-3 text-sm text-pine/40 text-center">No match</div>
            )}
            {filtered.map(it => (
              <button
                key={it.id}
                type="button"
                onClick={() => { onChange(it.name, it); setOpen(false); setQuery('') }}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-leaf/40 transition-colors
                  ${value === it.name ? 'bg-forest/[0.08] text-forest' : 'text-pine'}`}
              >
                <div className="font-medium">{it.name}</div>
                <div className="text-xs text-pine/40">{fmtBDT(it.default_price)} / {it.unit}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
