import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  fmtBDT, fmtDate, todayISO, nightsBetween, eachNight,
  rateFor, computeCharge, sumCharges, applyRounding, STATUS_COLORS, buildWorkflowDescription,
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
  Users, Handshake, Send,
} from 'lucide-react'
import Quotation from '../components/print/Quotation.jsx'
import SearchableSelect from '../components/SearchableSelect.jsx'
import { Combobox } from '../components/ui/combobox.jsx'
import { logAudit } from '../lib/pms.api.js'
import useReservationDetail from '../hooks/useReservationDetail.js'
import AddonTable from '../components/reservation/AddonTable.jsx'
import BillingsAndCheckOutTab from '../components/reservation/BillingsAndCheckOutTab.jsx'
import CheckInTab from '../components/reservation/CheckInTab.jsx'
import GuestProfileCard from '../components/reservation/GuestProfileCard.jsx'

const TABS = ['Overview', 'Check-In', 'Billings & Check-Out']

export default function ReservationDetail({ id, back, userName, isAdmin }) {
  const {
    res,
    guest,
    guestCompany,
    resGuests,
    guestIds,
    resRooms,
    rooms,
    charges,
    payments,
    invoices,
    addons,
    taxConfig,
    company,
    loadAll,
    totals,
    paid,
    due,
    nights,
  } = useReservationDetail(id)
  const [searchParams] = useSearchParams()
  const initialTab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'Overview'
  const [tab, setTab] = useState(initialTab)
  const [printDoc, setPrintDoc] = useState(null)
  const [msg, setMsg] = useState('')

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="card p-3">
            <div className="text-xs uppercase text-pine/50">Bill Amount</div>
            <div className="font-display text-xl font-bold money text-pine">{fmtBDT(totals.grand_total)}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs uppercase text-pine/50">Paid Amount</div>
            <div className="font-display text-xl font-bold money text-forest">{fmtBDT(paid)}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs uppercase text-pine/50">Due Amount</div>
            <div className={`font-display text-xl font-bold money ${due > 0 ? 'text-red-600' : 'text-forest'}`}>{fmtBDT(due)}</div>
          </div>
        </div>
      )}

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

      {printDoc?.type === 'BILL' && printDoc?.phase !== 'RESORT' && (
        <PrintPortal title="Guest Bill" onClose={() => { if (window.confirm('Resort copy print করবেন?')) { setPrintDoc((prev) => ({ ...prev, phase: 'RESORT' })) } else { setPrintDoc(null) } }}>
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
            copyLabel="Guest Copy"
            singleCopy
          />
        </PrintPortal>
      )}

      {printDoc?.type === 'BILL' && printDoc?.phase === 'RESORT' && (
        <PrintPortal title="Guest Bill (Resort Copy)" onClose={() => setPrintDoc(null)}>
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
            copyLabel="Resort Copy"
            singleCopy
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
/*  OVERVIEW TAB  (with single-quote row and full edit modal)          */
/* ------------------------------------------------------------------ */
function Overview({
  res, guest, resRooms, resGuests = [], setStatus, payments, advance, flash,
  isAdmin, userName, addons = [], taxConfig = [], reload, nights, company, setPrintDoc,
}) {
  const canConfirm = ['QUERY', 'QUOTED'].includes(res.status)
  const isCompany  = res.guest_type === 'Company'
  const [posting, setPosting] = useState(false)
  const [clearanceBusy, setClearanceBusy] = useState(false)

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
    // Calculate total correctly: each room uses its OWN dates & rate
    const discDescriptor = editForm.discount_type === 'fixed'
      ? { type: 'fixed', value: Number(editForm.discount_val) }
      : Number(editForm.discount_pct)

    const grandTotal = +roomList.reduce((sum, rm) => {
      const ci = rm.from_date || editForm.check_in
      const co = rm.to_date   || editForm.check_out
      const roomNights = nightsBetween(ci, co)
      const qRate = rateFor(taxConfig, 'ROOM', ci)
      const calc = computeCharge(Number(rm.rate), discDescriptor, qRate)
      return sum + (calc.total * roomNights)
    }, 0).toFixed(2)
    const validUntil = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const quoteSnapshot = {
      total_amount: grandTotal, valid_until: validUntil,
      // room_rate stores first room's rate (used for WhatsApp preview only)
      room_rate: roomList.length > 0 ? Math.min(...roomList.map(r => Number(r.rate))) : 0,
      room_count: roomList.length,
      discount_pct: editForm.discount_type === 'percentage' ? Number(editForm.discount_pct) : 0,
      updated_at: new Date().toISOString(),
    }
    if (quote) {
      await supabase.from('quotations').update(quoteSnapshot).eq('id', quote.id)
    } else {
      const { data: qSeq } = await supabase.rpc('next_tenant_seq', { p_seq_name: 'quotation' })
      const quoteNo = `Q-${String(qSeq || 1).padStart(4, '0')}`
      await supabase.from('quotations').insert({
        reservation_id: res.id, quote_no: quoteNo, ...quoteSnapshot, status: 'DRAFT', message: '',
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

  const requestRoomClearance = async () => {
    if (!resRooms.length) {
      flash('Assign a room before requesting clearance.')
      return
    }
    setClearanceBusy(true)
    try {
      let created = 0
      for (const rr of resRooms) {
        const roomNo = rr.rooms?.room_no || rr.room_id
        const title = `Checkout clearance request - Room ${roomNo}`
        const { data: existing } = await supabase
          .from('tasks')
          .select('id')
          .eq('source', 'CHECKOUT_CLEARANCE')
          .eq('title', title)
          .in('status', ['OPEN', 'IN_PROGRESS'])
          .limit(1)

        if (existing?.length) continue

        const { error } = await supabase.from('tasks').insert({
          title,
          description: buildWorkflowDescription(
            [
              'Please inspect and clear room for checkout.',
              `Reservation: ${res.res_no || '-'}`,
              `Guest: ${res.reservation_name || guest?.full_name || '-'}`,
              `Mobile: ${guest?.phone || '-'}`,
              `Requested by: ${userName}`,
            ].join('\n'),
            {
              department: 'HOUSEKEEPING',
              stage: 'REQUESTED',
              workflow: ['REQUESTED', 'QUEUED', 'IN_PROGRESS', 'INSPECTED', 'COMPLETED'],
              intent: 'Checkout clearance request',
              reference: `ROOM:${roomNo}`,
            },
          ),
          priority: 'HIGH',
          status: 'OPEN',
          due_date: todayISO(),
          source: 'CHECKOUT_CLEARANCE',
          created_by: userName,
        })
        if (error) throw error
        created += 1
      }
      flash(created > 0 ? `Room clearance request sent for ${created} room(s).` : 'Room clearance request is already pending.')
    } catch (e) {
      flash(e.message || 'Failed to request room clearance.')
    } finally {
      setClearanceBusy(false)
    }
  }

  // WhatsApp / Email / Print
  const buildQuoteMsg = () => {
    if (!quote) return ''
    const qr = rateFor(taxConfig, 'ROOM', res.check_in)
    const pn = computeCharge((quote.room_rate || 0) * (quote.room_count || 0), quote.discount_pct || 0, qr)
    const tot = +(pn.total * nights).toFixed(2)
    return `Dear ${guest?.full_name || 'Guest'},\n\nGreetings from ${company?.name || 'Aura Stay'}!\n\nQuotation for your stay:\n• Check-in: ${fmtDate(res.check_in)}\n• Check-out: ${fmtDate(res.check_out)} (${nights} night${nights !== 1 ? 's' : ''})\n• Rooms: ${quote.room_count} × ${fmtBDT(quote.room_rate)}/night${quote.discount_pct > 0 ? `\n• Discount: ${quote.discount_pct}%` : ''}\n• Total: ${fmtBDT(tot)}\n\nWarm regards,\n${company?.name || 'Aura Stay'}\n${company?.phone || ''}`
  }
  const sendQuoteWhatsApp = () => {
    const phone = (guest?.phone || '').replace(/[^0-9]/g, '')
    const intl = phone.startsWith('880') ? phone : phone.startsWith('0') ? '88' + phone : '880' + phone
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(buildQuoteMsg())}`, '_blank')
    logAudit({
      actor: userName, action: 'SEND_WHATSAPP', entity: 'quotation',
      entity_id: res.res_no,
      details: { channel: 'WHATSAPP', to: phone, reservation_id: res.id },
    })
  }
  const sendQuoteEmail = () => {
    window.open(
      `mailto:${guest?.email || ''}?subject=${encodeURIComponent(`Quotation — ${company?.name || 'Aura Stay'} (${res.res_no})`)}&body=${encodeURIComponent(buildQuoteMsg())}`,
      '_blank'
    )
    logAudit({
      actor: userName, action: 'SEND_EMAIL', entity: 'quotation',
      entity_id: res.res_no,
      details: { channel: 'EMAIL', to: guest?.email || '', reservation_id: res.id },
    })
  }
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
            {res.status === 'CHECKED_IN' && (
              <button className="btn-ghost w-full justify-center" onClick={requestRoomClearance} disabled={clearanceBusy}>
                <Send size={15} /> {clearanceBusy ? 'Sending...' : 'Room Clearance Request'}
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
