import { useEffect, useMemo, useState } from 'react'
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
  Plus, Trash2, Printer, FileDown, Receipt, BadgeCheck, Ban, BadgePercent,
} from 'lucide-react'

const TABS = ['Overview', 'Quotation', 'Check-In', 'Folio & Payments', 'Invoices']

export default function ReservationDetail({ id, back, userName, isAdmin }) {
  const [res, setRes] = useState(null)
  const [guest, setGuest] = useState(null)
  const [resGuests, setResGuests] = useState([])
  const [resRooms, setResRooms] = useState([])
  const [rooms, setRooms] = useState([])
  const [charges, setCharges] = useState([])
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [taxConfig, setTaxConfig] = useState([])
  const [company, setCompany] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [printDoc, setPrintDoc] = useState(null)
  const [msg, setMsg] = useState('')

  const loadAll = async () => {
    const { data: r } = await supabase.from('reservations').select('*').eq('id', id).single()
    setRes(r)
    if (r?.primary_guest_id) {
      const { data: g } = await supabase.from('guests').select('*').eq('id', r.primary_guest_id).single()
      setGuest(g)
    }
    const [{ data: rg }, { data: rr }, { data: rm }, { data: ch }, { data: pm }, { data: inv }, { data: tc }, { data: co }] =
      await Promise.all([
        supabase.from('reservation_guests').select('*').eq('reservation_id', id).order('is_primary', { ascending: false }),
        supabase.from('reservation_rooms').select('*, rooms(*)').eq('reservation_id', id),
        supabase.from('rooms').select('*').eq('is_active', true).order('room_no'),
        supabase.from('folio_charges').select('*').eq('reservation_id', id).order('charge_date'),
        supabase.from('payments').select('*').eq('reservation_id', id).order('received_date'),
        supabase.from('invoices').select('*').eq('reservation_id', id).order('created_at'),
        supabase.from('tax_config').select('*'),
        supabase.from('company_settings').select('*').eq('id', 1).single(),
      ])
    setResGuests(rg || []); setResRooms(rr || []); setRooms(rm || [])
    setCharges(ch || []); setPayments(pm || []); setInvoices(inv || [])
    setTaxConfig(tc || []); setCompany(co)
  }
  useEffect(() => { loadAll() }, [id])

  const totals = useMemo(() => applyRounding(sumCharges(charges), company?.rounding_mode || 'NEAREST_1'), [charges, company])
  const paid = useMemo(() => payments.reduce((a, p) => a + Number(p.amount), 0), [payments])
  const due = +(totals.grand_total - paid).toFixed(2)
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
      
      {/* (Reservation Header Section - unchanged) */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine">{res.reservation_name || guest?.full_name}</h1>
          <span className={`status-chip ${STATUS_COLORS[res.status]}`}>{res.status.replace('_', ' ')}</span>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-pine/50">Balance due</div>
          <div className={`font-display text-2xl font-bold money ${due > 0 ? 'text-red-600' : 'text-forest'}`}>{fmtBDT(due)}</div>
        </div>
      </div>

      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}

      <div className="flex gap-1 border-b border-leaf mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${tab === t ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tabs */}
      {tab === 'Overview' && <Overview res={res} guest={guest} resRooms={resRooms} setStatus={setStatus} payments={payments} flash={flash} isAdmin={isAdmin} userName={userName} />}
      {tab === 'Quotation' && <QuotationTab res={res} guest={guest} nights={nights} taxConfig={taxConfig} company={company} reload={loadAll} flash={flash} userName={userName} resRooms={resRooms} setPrintDoc={setPrintDoc} />}
      {tab === 'Check-In' && <CheckInTab res={res} guest={guest} resGuests={resGuests} resRooms={resRooms} rooms={rooms} reload={loadAll} setStatus={setStatus} userName={userName} openCard={() => setPrintDoc({ type: 'REG' })} payments={payments} flash={flash} isAdmin={isAdmin} />}
      {tab === 'Folio & Payments' && <FolioTab res={res} charges={charges} payments={payments} resRooms={resRooms} taxConfig={taxConfig} reload={loadAll} userName={userName} totals={totals} paid={paid} due={due} flash={flash} isAdmin={isAdmin} />}
      {tab === 'Invoices' && <InvoicesTab res={res} charges={charges} totals={totals} paid={paid} due={due} company={company} setPrintDoc={setPrintDoc} setStatus={setStatus} reload={loadAll} />}

      {/* Print Modals */}
      {printDoc?.type === 'REG' && <PrintPortal title="Registration Card" onClose={() => setPrintDoc(null)}><RegistrationCard res={res} guest={guest} resGuests={resGuests} resRooms={resRooms} payments={payments} company={company} /></PrintPortal>}
      {printDoc?.type === 'BILL' && <PrintPortal title="Guest Bill" onClose={() => setPrintDoc(null)}><GuestBill charges={charges} totals={totals} paid={paid} due={due} res={res} guest={guest} company={company} /></PrintPortal>}
      {printDoc?.type === 'MUSHAK' && <PrintPortal title="Mushak-6.3" onClose={() => setPrintDoc(null)}><Mushak63 charges={charges} totals={totals} res={res} company={company} /></PrintPortal>}
    </div>
  )
}

/* ---------------- LIVE INVOICES TAB ---------------- */
function InvoicesTab({ res, charges, totals, paid, due, company, setPrintDoc, setStatus, reload }) {
  return (
    <div className="space-y-4">
      <div className="card p-5 flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-pine">Guest Billing</h3>
          <p className="text-sm text-pine/60">Live billing: updates automatically from Folio.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setPrintDoc({ type: 'BILL' })}><Printer size={16} /> Print Guest Bill</button>
          <button className="btn-primary" onClick={() => setPrintDoc({ type: 'MUSHAK' })}><Receipt size={16} /> Print Mushak 6.3</button>
        </div>
      </div>
      <div className="card p-5 text-sm money">
        <div className="flex justify-between font-bold text-lg">
          <span>Balance Due</span>
          <span className={due > 0 ? 'text-red-600' : 'text-forest'}>{fmtBDT(due)}</span>
        </div>
      </div>
    </div>
  )
}

/* ---------------- OVERVIEW ---------------- */
function Overview({ res, guest, resRooms, setStatus, payments, advance, flash, isAdmin, userName }) {
  const canConfirm = ['QUERY', 'QUOTED'].includes(res.status)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="card p-5 lg:col-span-2">
        <h3 className="font-display font-semibold text-pine mb-3">Guest & stay</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt className="label">Primary guest</dt><dd className="font-semibold">{guest?.full_name || '—'}</dd></div>
          <div><dt className="label">Contact</dt><dd>{guest?.phone || '—'}{guest?.email ? ` · ${guest.email}` : ''}</dd></div>
          <div><dt className="label">Address</dt><dd>{guest?.address || '—'}</dd></div>
          <div><dt className="label">Source</dt><dd>{res.source}</dd></div>
          <div><dt className="label">Discount</dt><dd>{Number(res.discount_pct) > 0 ? `${res.discount_pct}% — applied on room charges` : '—'}</dd></div>
          <div><dt className="label">Rooms assigned</dt><dd>{resRooms.length ? resRooms.map((r) => r.rooms?.room_no).join(', ') : 'Not yet assigned'}</dd></div>
          <div><dt className="label">Notes</dt><dd>{res.notes || '—'}</dd></div>
        </dl>
      </div>
      <div className="card p-5">
        <h3 className="font-display font-semibold text-pine mb-3">Pipeline actions</h3>
        <div className="space-y-2">
          {canConfirm && (
            <button className="btn-primary w-full justify-center" onClick={() => {
              if (advance <= 0 && payments.length === 0) { flash('Record the advance payment first (Folio & Payments tab) — booking confirms on advance per your workflow.'); return }
              setStatus('CONFIRMED'); flash('Booking confirmed.')
            }}>
              <CheckCircle2 size={16} /> Confirm booking
            </button>
          )}
          {['QUERY', 'QUOTED', 'CONFIRMED'].includes(res.status) && (
            <button className="btn-ghost w-full justify-center text-red-600" onClick={() => setStatus('CANCELLED')}><Ban size={15} /> Cancel reservation</button>
          )}
          {['CHECKED_OUT', 'SETTLED'].includes(res.status) && (
            isAdmin ? (
              <button className="btn-amber w-full justify-center" onClick={async () => {
                const reason = window.prompt('Re-check-in will VOID the issued invoices (new ones generate at next check-out). Reason:', 'Guest stay extended')
                if (reason === null) return
                await supabase.from('invoices').update({ is_void: true, void_reason: reason || 'Re-check-in', voided_by: userName, voided_at: new Date().toISOString() })
                  .eq('reservation_id', res.id).not('is_void', 'is', true)
                await supabase.from('audit_log').insert({ actor: userName, action: 'RE_CHECKIN', entity: 'reservation', entity_id: res.res_no, details: { reason } })
                await setStatus('CHECKED_IN', { checked_out_at: null })
                flash('Guest re-checked-in. Previous invoices voided; folio is editable again.')
              }}>
                <LogIn size={15} /> Re-check-in guest (admin)
              </button>
            ) : (
              <p className="text-xs text-pine/50">Re-check-in requires administrator access.</p>
            )
          )}
          <p className="text-xs text-pine/50 pt-2">
            Advance received: <span className="money font-semibold">{fmtBDT(advance)}</span>. Per workflow, a booking is confirmed after the guest gives an advance.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---------------- QUOTATION (req. 2) ---------------- */
function QuotationTab({ res, guest, nights, taxConfig, company, reload, flash, userName, resRooms = [], setPrintDoc }) {
  const [roomRate, setRoomRate] = useState(res.room_rate || resRooms[0]?.rate || resRooms[0]?.rooms?.base_rate || 0)
  const [roomCount, setRoomCount] = useState(resRooms.length || 1)
  const [disc, setDisc] = useState(Number(res.discount_pct) || 0)
  const [validDays, setValidDays] = useState(7)
  const [quotes, setQuotes] = useState([])
  const [terms, setTerms] = useState(res.terms_conditions || company?.terms_conditions || '')
  const rate = rateFor(taxConfig, 'ROOM', todayISO())

  useEffect(() => { setTerms(res.terms_conditions || company?.terms_conditions || '') }, [res.id, company?.terms_conditions])

  const saveTerms = async () => { await supabase.from('reservations').update({ terms_conditions: terms }).eq('id', res.id); flash('Terms & Conditions saved to this quotation.') }
  const printQuote = () => setPrintDoc && setPrintDoc({ type: 'QUOTE', terms, roomRate, roomCount, discountPct: disc, validDays })

  const saveDisc = async () => {
    await supabase.from('reservations').update({ discount_pct: +disc || 0 }).eq('id', res.id)
    reload()
  }

  const perNight = computeCharge(Number(roomRate) * Number(roomCount), disc, rate)
  const total = +(perNight.total * nights).toFixed(2)

  const loadQuotes = async () => {
    const { data } = await supabase.from('quotations').select('*').eq('reservation_id', res.id).order('created_at', { ascending: false })
    setQuotes(data || [])
  }
  useEffect(() => { loadQuotes() }, [res.id])

  const message = useMemo(() => (
    `Dear ${guest?.full_name || 'Guest'},\n\nGreetings from ${company?.name || 'Novem Eco Resort'}, Sreemangal!\n\nQuotation for your stay:\n• Check-in: ${fmtDate(res.check_in)}\n• Check-out: ${fmtDate(res.check_out)} (${nights} night${nights !== 1 ? 's' : ''})\n• Rooms: ${roomCount} × ${fmtBDT(roomRate)}/night${disc > 0 ? `\n• Special discount: ${disc}%` : ''}\n• Service charge ${rate.service_charge_pct}% & VAT ${rate.vat_pct}% included\n• Total: ${fmtBDT(total)}\n\nAn advance payment confirms your booking. This quotation is valid for ${validDays} days.\n\nWarm regards,\n${company?.name || 'Novem Eco Resort'}\n${company?.phone || ''}`
  ), [guest, res, nights, roomCount, roomRate, disc, total, validDays, rate, company])

  const record = async (via) => {
    const validUntil = new Date(Date.now() + validDays * 86400000).toISOString().slice(0, 10)
    await supabase.from('quotations').insert({
      reservation_id: res.id, total_amount: total, valid_until: validUntil,
      status: 'SENT', sent_via: via, sent_at: new Date().toISOString(), message,
    })
    if (['QUERY'].includes(res.status)) await supabase.from('reservations').update({ status: 'QUOTED', room_rate: roomRate, discount_pct: +disc || 0 }).eq('id', res.id)
    else await supabase.from('reservations').update({ room_rate: roomRate, discount_pct: +disc || 0 }).eq('id', res.id)
    await reload(); await loadQuotes(); flash(`Quotation recorded as sent via ${via}.`)
  }

  const sendWhatsApp = () => {
    const phone = (guest?.phone || '').replace(/[^0-9]/g, '')
    const intl = phone.startsWith('880') ? phone : phone.startsWith('0') ? '88' + phone : '880' + phone
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(message)}`, '_blank')
    record('WhatsApp')
  }
  const sendEmail = () => {
    window.open(`mailto:${guest?.email || ''}?subject=${encodeURIComponent(`Quotation — ${company?.name || 'Novem Eco Resort'} (${res.res_no})`)}&body=${encodeURIComponent(message)}`, '_blank')
    record('Email')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card p-5">
        <h3 className="font-display font-semibold text-pine mb-3">Build quotation</h3>
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div><label className="label">Rate / room / night</label><input type="number" className="input money" value={roomRate} onChange={(e) => setRoomRate(e.target.value)} /></div>
          <div><label className="label">Rooms</label><input type="number" min="1" className="input money" value={roomCount} onChange={(e) => setRoomCount(e.target.value)} /></div>
          <div><label className="label">Discount %</label><input type="number" min="0" max="100" className="input money" value={disc} onChange={(e) => setDisc(e.target.value)} onBlur={saveDisc} /></div>
          <div><label className="label">Valid (days)</label><input type="number" min="1" className="input money" value={validDays} onChange={(e) => setValidDays(e.target.value)} /></div>
        </div>
        <div className="bg-leaf/40 rounded-lg p-4 text-sm space-y-1 money">
          <Row k={`Room charge × ${nights} night(s)`} v={fmtBDT(perNight.base_amount * nights)} />
          {disc > 0 && <Row k={`Discount ${disc}%`} v={'− ' + fmtBDT(perNight.discount * nights)} />}
          <Row k={`Service charge ${rate.service_charge_pct}%`} v={fmtBDT(perNight.service_charge * nights)} />
          {rate.sd_pct > 0 && <Row k={`SD ${rate.sd_pct}%`} v={fmtBDT(perNight.sd * nights)} />}
          <Row k={`VAT ${rate.vat_pct}%`} v={fmtBDT(perNight.vat * nights)} />
          <div className="border-t border-pine/20 pt-1 font-bold"><Row k="Total" v={fmtBDT(total)} /></div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary flex-1 justify-center" onClick={sendWhatsApp} disabled={!guest?.phone}><MessageCircle size={16} /> Send via WhatsApp</button>
          <button className="btn-ghost flex-1 justify-center" onClick={sendEmail}><Mail size={16} /> Send via Email</button>
          <button className="btn-amber justify-center" onClick={printQuote}><Printer size={16} /> PDF</button>
        </div>
        {!guest?.phone && <p className="text-xs text-amber mt-2">Add the guest's phone number to enable WhatsApp.</p>}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label className="label !mb-0">Terms &amp; Conditions (printed on the quotation PDF)</label>
            <button className="btn-ghost !py-1 text-xs" onClick={saveTerms}>Save T&amp;C</button>
          </div>
          <textarea className="input mt-1" rows={6} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Enter the terms & conditions to print on the quotation…" />
          <p className="text-xs text-pine/50 mt-1">Default comes from Settings → company profile; edits here apply to this reservation only.</p>
        </div>
      </div>
      <div className="card p-5">
        <h3 className="font-display font-semibold text-pine mb-3">Message preview</h3>
        <pre className="text-xs whitespace-pre-wrap bg-paper border border-leaf rounded-lg p-3">{message}</pre>
        <h4 className="label mt-4">Sent quotations</h4>
        {quotes.length === 0 && <p className="text-sm text-pine/50">None yet.</p>}
        {quotes.map((q) => (
          <div key={q.id} className="flex justify-between text-sm py-1.5 border-b border-leaf/60 money">
            <span>{q.quote_no} · {q.sent_via}</span>
            <span>{fmtBDT(q.total_amount)} · valid till {fmtDate(q.valid_until)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const Row = ({ k, v }) => <div className="flex justify-between"><span>{k}</span><span>{v}</span></div>

/* ---------------- CHECK-IN (req. 4) ---------------- */
function CheckInTab({ res, guest, resGuests, resRooms, rooms, reload, setStatus, userName, openCard, payments, flash, isAdmin }) {
  // req 5: after check-in only an administrator can change room assignment / guest info.
  // req 7: rooms can still be added during QUERY→CONFIRMED (incl. after booking confirm).
  const locked = !isAdmin && ['CHECKED_IN', 'CHECKED_OUT', 'SETTLED'].includes(res.status)
  const [f, setF] = useState({
    id_type: guest?.id_type || 'NID', id_number: guest?.id_number || '',
    extra_pax: res.extra_pax, extra_pax_rate: res.extra_pax_rate,
    driver_accommodation: res.driver_accommodation, driver_count: res.driver_count, driver_rate: res.driver_rate,
    special_instructions: res.special_instructions || '',
  })
  const [newGuest, setNewGuest] = useState('')
  const [roomSel, setRoomSel] = useState('')
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  useEffect(() => { if (guest) setF((p) => ({ ...p, id_type: guest.id_type || 'NID', id_number: guest.id_number || '' })) }, [guest])

  const assignRoom = async () => {
    if (locked) { flash('After check-in, only an administrator can change room assignment.'); return }
    if (!roomSel) return
    const room = rooms.find((r) => r.id === roomSel)
    await supabase.from('reservation_rooms').insert({ reservation_id: res.id, room_id: room.id, rate: res.room_rate || room.base_rate, from_date: res.check_in, to_date: res.check_out })
    setRoomSel(''); await reload()
  }
  const removeRoom = async (rrId) => { if (locked) { flash('Administrator access required after check-in.'); return } await supabase.from('reservation_rooms').delete().eq('id', rrId); await reload() }
  const updateRoomRate = async (rrId, rate) => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    if (rate === '' || isNaN(+rate)) return
    await supabase.from('reservation_rooms').update({ rate: +rate }).eq('id', rrId)
    await reload()
  }
  const updateRoomDates = async (rrId, field, val) => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    if (!val) return
    await supabase.from('reservation_rooms').update({ [field]: val }).eq('id', rrId)
    await reload()
  }
  const addGuest = async () => {
    if (locked) { flash('Administrator access required after check-in.'); return }
    if (!newGuest.trim()) return
    await supabase.from('reservation_guests').insert({ reservation_id: res.id, guest_name: newGuest.trim() })
    setNewGuest(''); await reload()
  }
  const removeGuest = async (gid) => { if (locked) { flash('Administrator access required after check-in.'); return } await supabase.from('reservation_guests').delete().eq('id', gid); await reload() }

  const doCheckIn = async () => {
    if (resRooms.length === 0) { flash('Assign at least one room before check-in.'); return }
    await supabase.from('guests').update({ id_type: f.id_type, id_number: f.id_number }).eq('id', res.primary_guest_id)
    await setStatus('CHECKED_IN', {
      extra_pax: +f.extra_pax, extra_pax_rate: +f.extra_pax_rate,
      driver_accommodation: f.driver_accommodation, driver_count: +f.driver_count, driver_rate: +f.driver_rate,
      special_instructions: f.special_instructions,
      checked_in_at: new Date().toISOString(), checkin_by: userName,
    })
    flash('Guest checked in. Print the Registration Card for signatures.')
  }

  const assignedIds = new Set(resRooms.map((r) => r.room_id))

  return (
    <>
    {locked && <div className="mb-4 px-4 py-2 rounded-lg bg-amber/10 text-amber text-sm font-medium">This reservation is checked in — room assignment and guest details are locked. Only an administrator can change them.</div>}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card p-5 space-y-4">
        <h3 className="font-display font-semibold text-pine">Room assignment</h3>
        <div className="flex gap-2">
          <select className="input flex-1" value={roomSel} onChange={(e) => setRoomSel(e.target.value)}>
            <option value="">Select room…</option>
            {rooms.filter((r) => !assignedIds.has(r.id)).map((r) => (
              <option key={r.id} value={r.id}>{r.room_no}{r.room_name ? ` — ${r.room_name}` : ''} · {r.room_type} ({fmtBDT(r.base_rate)})</option>
            ))}
          </select>
          <button className="btn-primary" onClick={assignRoom}><BedDouble size={15} /> Assign</button>
        </div>
        {resRooms.map((rr) => (
          <div key={rr.id} className="text-sm border border-leaf rounded-lg px-3 py-2 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Room {rr.rooms?.room_no}{rr.rooms?.room_name ? ` · ${rr.rooms.room_name}` : ''} <span className="text-pine/50 font-normal">· {rr.rooms?.room_type}</span></span>
              <span className="flex items-center gap-2 money">
                {locked ? (
                  <>{fmtBDT(rr.rate)}/night</>
                ) : (
                  <><input type="number" defaultValue={rr.rate} onBlur={(e) => updateRoomRate(rr.id, e.target.value)} className="input !w-28 !py-1 money text-right" title="Edit rate — then Repost room charges in Folio" />/night
                  <button onClick={() => removeRoom(rr.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button></>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-pine/60">
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
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Photo ID type</label>
            <select className="input" value={f.id_type} onChange={(e) => set('id_type', e.target.value)}>
              {['NID', 'Smart ID', 'Passport', 'Driving License', 'Birth Certificate'].map((t) => <option key={t}>{t}</option>)}
            </select></div>
          <div><label className="label">ID number</label><input className="input money" value={f.id_number} onChange={(e) => set('id_number', e.target.value)} /></div>
          <div><label className="label">Extra pax</label><input type="number" min="0" className="input money" value={f.extra_pax} onChange={(e) => set('extra_pax', e.target.value)} /></div>
          <div><label className="label">Extra pax rate / night</label><input type="number" className="input money" value={f.extra_pax_rate} onChange={(e) => set('extra_pax_rate', e.target.value)} /></div>
          <div className="col-span-2 flex items-center gap-2 pt-1">
            <input type="checkbox" id="drv" checked={f.driver_accommodation} onChange={(e) => set('driver_accommodation', e.target.checked)} />
            <label htmlFor="drv" className="text-sm font-medium">Driver accommodation needed</label>
          </div>
          {f.driver_accommodation && (<>
            <div><label className="label">No. of drivers</label><input type="number" min="0" className="input money" value={f.driver_count} onChange={(e) => set('driver_count', e.target.value)} /></div>
            <div><label className="label">Driver rate / night</label><input type="number" className="input money" value={f.driver_rate} onChange={(e) => set('driver_rate', e.target.value)} /></div>
          </>)}
          <div className="col-span-2"><label className="label">Notes / special instructions</label>
            <textarea className="input" rows={2} value={f.special_instructions} onChange={(e) => set('special_instructions', e.target.value)} /></div>
        </div>
        <div className="flex gap-2 pt-1">
          {res.status !== 'CHECKED_IN' && res.status !== 'CHECKED_OUT' && res.status !== 'SETTLED' ? (
            <button className="btn-primary flex-1 justify-center" onClick={doCheckIn}><LogIn size={16} /> Check in guest</button>
          ) : (
            <div className="text-sm text-forest font-semibold flex items-center gap-2"><BadgeCheck size={16} /> Checked in {res.checked_in_at && `· ${fmtDate(res.checked_in_at)}`} {res.checkin_by && `by ${res.checkin_by}`}</div>
          )}
          <button className="btn-amber flex-1 justify-center" onClick={openCard}><Printer size={16} /> Registration Card</button>
        </div>
        <p className="text-xs text-pine/50">Advance on record: <span className="money font-semibold">{fmtBDT(payments.filter((p) => p.payment_class === 'ADVANCE').reduce((a, p) => a + +p.amount, 0))}</span> — shown on the card.</p>
      </div>
    </div>
    </>
  )
}

/* ---------------- FOLIO & PAYMENTS (req. 5–8) ---------------- */
function FolioTab({ res, charges, payments, resRooms, taxConfig, reload, userName, totals, paid, due, flash, isAdmin }) {
  const editable = isAdmin || ['QUERY', 'QUOTED', 'CONFIRMED'].includes(res.status)
  const [c, setC] = useState({ charge_type: 'OTHER', description: '', base_amount: '', discount_pct: 0, charge_date: todayISO() })
  const [discAmt, setDiscAmt] = useState('')
  const [discReason, setDiscReason] = useState('')
  const [discType, setDiscType] = useState('ROOM')
  const [p, setP] = useState({ amount: '', method: 'CASH', reference: '', received_date: todayISO(), received_by: userName })

  // Build ROOM folio lines. Each room is billed over its OWN date range (from_date/to_date)
  // when set, otherwise the whole reservation window. Extra-pax & driver charges follow the
  // overall reservation window.
  const buildRoomRows = () => {
    const rows = []
    for (const rr of resRooms) {
      const ci = rr.from_date || res.check_in
      const co = rr.to_date || res.check_out
      for (const night of eachNight(ci, co)) {
        const rate = rateFor(taxConfig, 'ROOM', night)
        rows.push({ reservation_id: res.id, charge_date: night, charge_type: 'ROOM', description: `Room ${rr.rooms?.room_no}${rr.rooms?.room_name ? ` (${rr.rooms.room_name})` : ''} — Night of ${fmtDate(night)}`, ...computeCharge(rr.rate, res.discount_pct, rate), created_by: userName })
      }
    }
    for (const night of eachNight(res.check_in, res.check_out)) {
      const rate = rateFor(taxConfig, 'ROOM', night)
      if (res.extra_pax > 0 && res.extra_pax_rate > 0)
        rows.push({ reservation_id: res.id, charge_date: night, charge_type: 'ROOM', description: `Extra pax × ${res.extra_pax} — ${fmtDate(night)}`, ...computeCharge(res.extra_pax * res.extra_pax_rate, res.discount_pct, rate), created_by: userName })
      if (res.driver_accommodation && res.driver_count > 0 && res.driver_rate > 0)
        rows.push({ reservation_id: res.id, charge_date: night, charge_type: 'ROOM', description: `Driver accommodation × ${res.driver_count} — ${fmtDate(night)}`, ...computeCharge(res.driver_count * res.driver_rate, res.discount_pct, rate), created_by: userName })
    }
    return rows
  }

  const postRoomCharges = async () => {
    if (resRooms.length === 0) { flash('Assign rooms first (Check-In tab).'); return }
    if (charges.some((ch) => ch.charge_type === 'ROOM')) { flash('Room charges already posted — use "Repost" to replace them with current rates.'); return }
    const rows = buildRoomRows()
    const { error } = await supabase.from('folio_charges').insert(rows)
    if (error) flash(error.message); else { await reload(); flash(`${rows.length} room charge line(s) posted.`) }
  }

  // Room bill stays editable from quotation until check-out: replace ROOM lines with current rates/discount
  const repostRoomCharges = async () => {
    if (!editable) { flash('Room bill can only be edited before check-out (administrator override available).'); return }
    if (resRooms.length === 0) { flash('Assign rooms first (Check-In tab).'); return }
    const { error: de } = await supabase.from('folio_charges').delete().eq('reservation_id', res.id).eq('charge_type', 'ROOM')
    if (de) { flash(de.message); return }
    const rows = buildRoomRows()
    const { error } = await supabase.from('folio_charges').insert(rows)
    if (error) flash(error.message); else { await reload(); flash(`Room bill reposted — ${rows.length} line(s) at current rates and ${res.discount_pct}% discount.`) }
  }

  const delPayment = async (pm) => {
    const { error } = await supabase.from('payments').delete().eq('id', pm.id)
    if (error) flash('Administrator access required to delete payments.')
    else { await reload(); flash('Payment deleted — invoice Paid/Due re-synced automatically.') }
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

  const addPayment = async () => {
    if (!p.amount || +p.amount <= 0) return
    const { error } = await supabase.from('payments').insert({ reservation_id: res.id, ...p, amount: +p.amount })
    if (error) flash(error.message)
    else { setP({ amount: '', method: 'CASH', reference: '', received_date: todayISO(), received_by: userName }); await reload(); flash('Payment recorded — class set automatically.') }
  }

  const toggleStatus = async (ch) => {
    await supabase.from('folio_charges').update({ status: ch.status === 'PAID' ? 'DUE' : 'PAID' }).eq('id', ch.id)
    await reload()
  }
  const delCharge = async (chId) => { await supabase.from('folio_charges').delete().eq('id', chId); await reload() }

  // Additional / discretionary discount (admin) — recorded as a negative charge so SC, SD & VAT
  // reverse proportionally at the chosen tax rate, keeping the Mushak 6.2 register consistent.
  const addDiscount = async () => {
    const amt = +discAmt
    if (!amt || amt <= 0) { flash('Enter a positive discount amount.'); return }
    const rate = rateFor(taxConfig, discType, todayISO())
    const calc = computeCharge(-amt, 0, rate)
    const { error } = await supabase.from('folio_charges').insert({
      reservation_id: res.id, charge_date: todayISO(), charge_type: 'DISCOUNT', status: 'PAID',
      description: `Additional discount (${discType})${discReason ? ' — ' + discReason : ''}`,
      ...calc, created_by: userName,
    })
    if (error) { flash(error.message); return }
    await supabase.from('audit_log').insert({ actor: userName, action: 'ADD_DISCOUNT', entity: 'reservation', entity_id: res.res_no, details: { amount: amt, type: discType, reason: discReason } })
    setDiscAmt(''); setDiscReason(''); await reload(); flash(`Additional discount of ${fmtBDT(amt)} applied.`)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-pine">Add charge</h3>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={postRoomCharges}><BedDouble size={15} /> Post room charges ({nightsBetween(res.check_in, res.check_out)} nights)</button>
              {charges.some((ch) => ch.charge_type === 'ROOM') && editable && (
                <button className="btn-amber !py-2" onClick={repostRoomCharges} title="Replace ROOM lines with current rates & discount">Repost</button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-6 gap-2">
            <select className="input" value={c.charge_type} onChange={(e) => setC({ ...c, charge_type: e.target.value })}>
              {['ROOM', 'RESTAURANT', 'LAUNDRY', 'TEA', 'PICKLE', 'SPORTS', 'OTHER'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <input className="input col-span-2" placeholder="Description" value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} />
            <input type="number" className="input money" placeholder="Base ৳" value={c.base_amount} onChange={(e) => setC({ ...c, base_amount: e.target.value })} />
            <input type="number" min="0" max="100" className="input money" placeholder="Disc %" value={c.discount_pct} onChange={(e) => setC({ ...c, discount_pct: e.target.value })} />
            <button className="btn-primary justify-center" onClick={addCharge}><Plus size={15} /> Add</button>
          </div>
          <p className="text-xs text-pine/50 mt-2">SC, SD & VAT are computed automatically from the Settings rates for the charge type. Restaurant orders for room guests post here as <b>RESTAURANT — Due</b> when not paid instantly.</p>
        </div>
        <div className="card p-4">
          <h3 className="font-display font-semibold text-pine mb-3">Record payment</h3>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" className="input money" placeholder="Amount ৳" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} />
            <select className="input" value={p.method} onChange={(e) => setP({ ...p, method: e.target.value })}>
              {['CASH', 'BKASH', 'NAGAD', 'CARD', 'BANK', 'OTHER'].map((m) => <option key={m}>{m}</option>)}
            </select>
            <input type="date" className="input" value={p.received_date} onChange={(e) => setP({ ...p, received_date: e.target.value })} />
            <input className="input" placeholder="Reference" value={p.reference} onChange={(e) => setP({ ...p, reference: e.target.value })} />
          </div>
          <button className="btn-primary w-full justify-center mt-2" onClick={addPayment}><Receipt size={15} /> Save payment</button>
          <p className="text-xs text-pine/50 mt-2">Before {fmtDate(res.check_in)} → <b>ADVANCE</b>; from check-in day → <b>REGULAR</b>. Set automatically.</p>
        </div>
      </div>

      {isAdmin && (
        <div className="card p-4 border-amber/40">
          <h3 className="font-display font-semibold text-pine flex items-center gap-2 mb-3"><BadgePercent size={16} className="text-amber" /> Additional discount (admin)</h3>
          <div className="grid grid-cols-6 gap-2">
            <input type="number" min="0" className="input money" placeholder="Discount ৳" value={discAmt} onChange={(e) => setDiscAmt(e.target.value)} />
            <select className="input" value={discType} onChange={(e) => setDiscType(e.target.value)} title="Tax category the discount applies against">
              {['ROOM', 'RESTAURANT', 'LAUNDRY', 'TEA', 'PICKLE', 'SPORTS', 'OTHER'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <input className="input col-span-2" placeholder="Reason (loyal guest, goodwill, complaint…)" value={discReason} onChange={(e) => setDiscReason(e.target.value)} />
            <button className="btn-amber justify-center col-span-2" onClick={addDiscount}><BadgePercent size={15} /> Apply discount</button>
          </div>
          <p className="text-xs text-pine/50 mt-2">Posts a discount line that proportionally reduces service charge, SD & VAT at the selected category's tax rate, lowers the balance due, and is logged in the audit trail. Remove it like any other line if entered by mistake.</p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-leaf font-display font-semibold text-pine">Guest Total Billing History</div>
        <table className="w-full">
          <thead><tr>
            <th className="th">Date</th><th className="th">Type</th><th className="th">Description</th>
            <th className="th text-right">Base</th><th className="th text-right">Disc.</th><th className="th text-right">SC</th>
            <th className="th text-right">SD</th><th className="th text-right">VAT</th><th className="th text-right">Total</th>
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
                <td className="td money text-right">{Number(ch.sd).toFixed(2)}</td>
                <td className="td money text-right">{Number(ch.vat).toFixed(2)}</td>
                <td className="td money text-right font-semibold">{Number(ch.total).toFixed(2)}</td>
                <td className="td">
                  <button onClick={() => editable ? toggleStatus(ch) : flash('Editing a checked-out folio requires administrator access.')} className={`status-chip ${ch.status === 'PAID' ? 'bg-forest/15 text-forest' : 'bg-red-100 text-red-600'} ${!editable ? 'opacity-60' : ''}`}>{ch.status}</button>
                </td>
                <td className="td">{editable && <button onClick={() => delCharge(ch.id)} className="text-red-300 hover:text-red-600"><Trash2 size={13} /></button>}</td>
              </tr>
            ))}
            {charges.length === 0 && <tr><td className="td text-pine/50" colSpan={11}>No charges yet — post room charges or add a line.</td></tr>}
          </tbody>
          {charges.length > 0 && (
            <tfoot><tr className="bg-leaf/40 font-bold money">
              <td className="td" colSpan={3}>Totals</td>
              <td className="td text-right">{totals.base.toFixed(2)}</td>
              <td className="td text-right">{totals.discount.toFixed(2)}</td>
              <td className="td text-right">{totals.service_charge.toFixed(2)}</td>
              <td className="td text-right">{totals.sd.toFixed(2)}</td>
              <td className="td text-right">{totals.vat.toFixed(2)}</td>
              <td className="td text-right">{(totals.grand_total_raw ?? totals.grand_total).toFixed(2)}</td>
              <td className="td" colSpan={2}></td>
            </tr></tfoot>
          )}
        </table>
        {charges.length > 0 && (
          <div className="px-4 py-3 border-t border-leaf flex justify-end">
            <div className="w-72 text-sm money space-y-1">
              <div className="flex justify-between text-pine/70"><span>Subtotal</span><span>{fmtBDT(totals.grand_total_raw ?? totals.grand_total)}</span></div>
              {!!totals.rounding && <div className="flex justify-between text-pine/70"><span>Rounding adjustment</span><span>{totals.rounding > 0 ? '+ ' : '− '}{fmtBDT(Math.abs(totals.rounding))}</span></div>}
              <div className="flex justify-between font-bold text-pine border-t border-leaf pt-1"><span>Grand total (payable)</span><span>{fmtBDT(totals.grand_total)}</span></div>
              <div className="flex justify-between text-forest"><span>Paid</span><span>{fmtBDT(paid)}</span></div>
              <div className={`flex justify-between font-bold ${due > 0 ? 'text-red-600' : 'text-forest'}`}><span>Balance due</span><span>{fmtBDT(due)}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-leaf font-display font-semibold text-pine">Payments</div>
        <table className="w-full">
          <thead><tr><th className="th">Date</th><th className="th">Class</th><th className="th">Method</th><th className="th">Reference</th><th className="th">Received by</th><th className="th text-right">Amount</th></tr></thead>
          <tbody>
            {payments.map((pm) => (
              <tr key={pm.id}>
                <td className="td money text-xs">{fmtDate(pm.received_date)}{isAdmin && <button title="Delete payment (admin)" onClick={() => delPayment(pm)} className="ml-2 text-red-300 hover:text-red-600 align-middle"><Trash2 size={12} /></button>}</td>
                <td className="td"><span className={`status-chip ${pm.payment_class === 'ADVANCE' ? 'bg-amber/20 text-amber' : 'bg-forest/15 text-forest'}`}>{pm.payment_class}</span></td>
                <td className="td text-sm">{pm.method}</td>
                <td className="td text-xs">{pm.reference || '—'}</td>
                <td className="td text-xs">{pm.received_by || '—'}</td>
                <td className="td money text-right font-semibold">{Number(pm.amount).toFixed(2)}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td className="td text-pine/50" colSpan={6}>No payments recorded.</td></tr>}
          </tbody>
          <tfoot><tr className="bg-leaf/40 font-bold money">
            <td className="td" colSpan={5}>Paid {fmtBDT(paid)} · Balance due</td>
            <td className={`td text-right ${due > 0 ? 'text-red-600' : 'text-forest'}`}>{fmtBDT(due)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  )
}

/* ---------------- INVOICES & CHECK-OUT (req. 9) ---------------- */
function InvoicesTab({ res, charges, totals, paid, due, company, reload, setStatus, setPrintDoc }) {
  const canCheckout = res.status === 'CHECKED_IN';

  // লাইভ ডাটা প্রিন্ট ফাংশন
  const printLiveInvoice = (type) => {
    setPrintDoc({ 
      type: type, 
      // এখন আর 'invoices' টেবিলের ডাটা নয়, সরাসরি folio-র লাইভ ভেরিয়েবলগুলো পাঠানো হচ্ছে
      invoice: { 
        totals, 
        charges, 
        paid, 
        due, 
        issued_at: new Date().toISOString(),
        invoice_no: `INV-${res.res_no}` 
      } 
    });
  };

  return (
    <div className="space-y-4">
      <div className="card p-5 flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-pine">Guest Billing (Live)</h3>
          <p className="text-sm text-pine/60">System updates directly from Folio charges.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => printLiveInvoice('BILL')}>
            <Printer size={16} /> Guest Bill
          </button>
          <button className="btn-primary" onClick={() => printLiveInvoice('MUSHAK')}>
            <Receipt size={16} /> Mushak 6.3
          </button>
          {canCheckout && (
            <button className="btn-amber" onClick={async () => { await setStatus('CHECKED_OUT'); await reload(); }}>
              Check Out
            </button>
          )}
        </div>
      </div>
      
      {/* ব্যালেন্স কার্ড */}
      <div className="card p-5 text-sm money">
        <div className="flex justify-between font-bold text-lg">
          <span>Balance Due</span>
          <span className={due > 0 ? 'text-red-600' : 'text-forest'}>{fmtBDT(due)}</span>
        </div>
      </div>
    </div>
  )
}
