import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  fmtBDT, fmtDate, todayISO, nightsBetween, eachNight,
  rateFor, computeCharge, sumCharges, applyRounding, STATUS_COLORS,
} from '../lib/helpers'
import PrintPortal from '../components/PrintPortal.jsx'
import RegistrationCard from '../components/print/RegistrationCard.jsx'
import GuestBill from '../components/print/GuestBill.jsx'
import Mushak63 from '../components/print/Mushak63.jsx'
import Quotation from '../components/print/Quotation.jsx'
import { exportXLSX } from '../lib/helpers'
import {
  ArrowLeft, MessageCircle, Mail, CheckCircle2, LogIn, BedDouble,
  Plus, Trash2, Printer, FileDown, Receipt, BadgeCheck, Ban, BadgePercent, Pencil, Save,
} from 'lucide-react'

const TABS = ['Overview', 'Check-In', 'Billings & Check-Out', 'Partners']

/* ------------------------------------------------------------------ */
/*  SEARCHABLE SELECT — reusable, no external lib                       */
/* ------------------------------------------------------------------ */
function SearchableSelect({ value, onChange, options, placeholder = 'Select…', disabled = false, className = '' }) {
  // options: [{ value, label }] or plain strings
  const normalised = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  )
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const containerRef        = useRef(null)
  const inputRef            = useRef(null)

  const selected = normalised.find(o => o.value === value)
  const filtered = query
    ? normalised.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : normalised

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) { setOpen(false); setQuery('') } }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus search when opened
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30) }, [open])

  const select = (opt) => { onChange(opt.value); setOpen(false); setQuery('') }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={`input w-full text-left flex items-center justify-between gap-2 ${disabled ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
      >
        <span className={selected ? 'text-pine' : 'text-pine/40'}>{selected?.label || placeholder}</span>
        <svg className={`w-4 h-4 text-pine/40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-leaf rounded-xl shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-leaf">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full text-sm px-2 py-1.5 rounded-lg border border-leaf focus:outline-none focus:ring-2 focus:ring-forest/30"
              onKeyDown={e => {
                if (e.key === 'Escape') { setOpen(false); setQuery('') }
                if (e.key === 'Enter' && filtered.length === 1) select(filtered[0])
              }}
            />
          </div>
          {/* Options */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-pine/40">No results</div>}
            {filtered.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => select(opt)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-leaf/40 transition-colors ${opt.value === value ? 'bg-forest/10 text-forest font-semibold' : 'text-pine'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

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
      {tab === 'Partners' && (
        <PartnerAccounts res={res} reload={loadAll} flash={flash} userName={userName} />
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
            charges={
              printDoc.invoiceData?.charges?.length
                ? printDoc.invoiceData.charges
                : charges
            }
            totals={printDoc.invoiceData?.totals ?? totals}
            paid={printDoc.invoiceData?.paid ?? paid}
            due={printDoc.invoiceData?.due ?? due}
            res={res}
            guest={guest}
            company={company}
            invoice_no={printDoc.invoiceData?.invoice_no}
            issued_at={printDoc.invoiceData?.issued_at}
          />
        </PrintPortal>
      )}

      {printDoc?.type === 'MUSHAK' && (
        <PrintPortal title="Mushak-6.3" onClose={() => setPrintDoc(null)}>
          <Mushak63
            charges={
              printDoc.invoiceData?.charges?.length
                ? printDoc.invoiceData.charges
                : charges
            }
            totals={printDoc.invoiceData?.totals ?? totals}
            res={res}
            company={company}
            invoice_no={printDoc.invoiceData?.invoice_no}
            issued_at={printDoc.invoiceData?.issued_at}
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
      <div className="card p-5 lg:col-span-2">
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
          {addons.length > 0 && (
            <button className="btn-amber !py-1.5 text-xs" onClick={postAddonCharges} disabled={posting || unposted.length === 0}>
              {posting ? 'Posting…' : unposted.length === 0 ? 'All posted' : `Post ${unposted.length} item(s) to folio`}
            </button>
          )}
        </div>
        {addons.length === 0 && <p className="text-sm text-pine/50">No additional items selected for this booking.</p>}
        {addons.length > 0 && (
          <div className="border border-leaf rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-leaf/30">
                <th className="th">Item</th><th className="th text-right">Price</th><th className="th text-right">Qty</th>
                <th className="th text-right">Total</th><th className="th text-center">Status</th>
              </tr></thead>
              <tbody>
                {addons.map((a) => (
                  <tr key={a.id} className="border-t border-leaf/60">
                    <td className="td">{a.label}</td>
                    <td className="td money text-right">{fmtBDT(a.price)}</td>
                    <td className="td money text-right">{a.qty}</td>
                    <td className="td money text-right font-semibold">{fmtBDT(lineTotal(a))}</td>
                    <td className="td text-center">
                      <span className={`status-chip ${a.posted ? 'bg-forest/15 text-forest' : 'bg-amber/20 text-amber'}`}>{a.posted ? 'Posted' : 'Pending'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-leaf/40 font-bold money border-t border-leaf">
                <td className="td" colSpan={3}>Total</td>
                <td className="td text-right">{fmtBDT(addonsTotal)}</td>
                <td className="td"></td>
              </tr></tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Pipeline actions */}
      <div className="card p-5">
        <h3 className="font-display font-semibold text-pine mb-3">Pipeline actions</h3>
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
          {['CHECKED_OUT', 'SETTLED'].includes(res.status) && (
            isAdmin ? (
              <button className="btn-amber w-full justify-center" onClick={async () => {
                const reason = window.prompt('Re-check-in will VOID the issued invoices. Reason:', 'Guest stay extended')
                if (reason === null) return
                await supabase.from('invoices')
                  .update({ is_void: true, void_reason: reason || 'Re-check-in', voided_by: userName, voided_at: new Date().toISOString() })
                  .eq('reservation_id', res.id).not('is_void', 'is', true)
                await supabase.from('audit_log').insert({
                  actor: userName, action: 'RE_CHECKIN', entity: 'reservation',
                  entity_id: res.res_no, details: { reason },
                })
                await setStatus('CHECKED_IN', { checked_out_at: null })
                flash('Guest re-checked-in. Previous invoices voided; folio is editable again.')
              }}>
                <LogIn size={15} /> Re-check-in guest (admin)
              </button>
            ) : (
              <p className="text-xs text-pine/50">Re-check-in requires administrator access.</p>
            )
          )}
          <p className="text-xs text-pine/50 pt-2">Advance received: <span className="money font-semibold">{fmtBDT(advance)}</span>.</p>
        </div>
      </div>

      {/* QUOTATION TABLE — single latest row */}
      <div className="card p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-pine">Quotation</h3>
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => openQuoteEditor(false)}>
            <Plus size={13} /> New quotation
          </button>
        </div>
        {!quote ? (
          <p className="text-sm text-pine/50 py-4">No quotation created yet. Click "+ New quotation" to create one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Quotation ID</th>
                  <th className="th">Guest / Reservation</th>
                  <th className="th">Stay</th>
                  <th className="th text-center">Rooms</th>
                  <th className="th text-center">Pax</th>
                  <th className="th">Source</th>
                  <th className="th text-right">Total</th>
                  <th className="th text-right">Valid Till</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-leaf/20 border-b border-leaf/40">
                  <td className="td money font-semibold text-sm text-forest">{res.res_no}</td>
                  <td className="td text-sm">
                    <div className="font-semibold">{guest?.full_name || res.reservation_name || '—'}</div>
                    <div className="text-xs text-pine/50">{guest?.phone || '—'}</div>
                  </td>
                  <td className="td text-xs text-pine/70 whitespace-nowrap">
                    {fmtDate(res.check_in)} → {fmtDate(res.check_out)}
                    <div className="text-pine/40">{nights} night{nights !== 1 ? 's' : ''}</div>
                  </td>
                  <td className="td text-center money font-semibold">{quote.room_count ?? resRooms.length}</td>
                  <td className="td text-center money">{((res.pax_adults || 0) + (res.pax_children || 0)) || resGuests.length || '—'}</td>
                  <td className="td text-sm text-pine/70">{res.source || '—'}</td>
                  <td className="td text-right money font-bold text-forest">{fmtBDT(quote.total_amount)}</td>
                  <td className="td text-right text-xs text-pine/60 whitespace-nowrap">{fmtDate(quote.valid_until)}</td>
                  <td className="td">
                    <div className="flex gap-1 justify-end items-center">
                      <button onClick={() => openQuoteEditor(true)} title="Edit quotation"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest transition-colors">
                        <Pencil size={13} /></button>
                      <button onClick={printQuote} title="Print quotation"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest transition-colors">
                        <Printer size={13} /></button>
                      <button onClick={sendQuoteWhatsApp} title={guest?.phone ? 'Send via WhatsApp' : 'No phone number'}
                        disabled={!guest?.phone}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-100 text-pine/40 hover:text-green-600 transition-colors disabled:opacity-25 disabled:cursor-not-allowed">
                        <MessageCircle size={13} /></button>
                      <button onClick={sendQuoteEmail} title="Send via Email"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-pine/40 hover:text-blue-600 transition-colors">
                        <Mail size={13} /></button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
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

            {/* Terms & Conditions */}
            <fieldset className="border border-leaf rounded-xl p-4 mb-5">
              <legend className="text-xs font-bold text-pine/60 px-2 uppercase tracking-wide">Terms & Conditions</legend>
              <textarea className="input" rows={4} value={editForm.terms_conditions} onChange={e => setEditForm({...editForm, terms_conditions: e.target.value})} placeholder="Default terms from Settings will be used if left blank." />
              <p className="text-xs text-pine/50 mt-1">Default from company Settings. Edits apply to this reservation only.</p>
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
