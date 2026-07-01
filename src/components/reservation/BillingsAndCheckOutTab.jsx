import { useEffect, useState } from 'react'
import { ArrowLeft, BadgeCheck, Ban, BedDouble, CheckCircle2, FileDown, LogIn, Pencil, Plus, Printer, Receipt, Save, Trash2 } from 'lucide-react'
import SearchableSelect from '../SearchableSelect.jsx'
import { Combobox } from '../ui/combobox.jsx'
import { computeCharge, eachNight, fmtBDT, fmtDate, nightsBetween, rateFor, sumCharges, todayISO } from '../../lib/helpers'
import { logAudit } from '../../lib/pms.api.js'
import { supabase } from '../../supabase'
import AgencySection from './AgencySection.jsx'
import GuestRefundCard from './GuestRefundCard.jsx'
import ShareholderRedemption from './ShareholderRedemption.jsx'
import { generateInvoiceNo, resDiscount } from './utils.js'

export function BillingsAndCheckOutTab({
  res, guest, charges, payments, resRooms, taxConfig, invoices, company,
  reload, userName, setStatus, setPrintDoc, totals, paid, due, flash, isAdmin,
  paymentNumbering = null,
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
    const paymentNo = paymentNumbering ? await paymentNumbering.generate() : null
    const { error } = await supabase.from('payments').insert({
      reservation_id: res.id,
      amount:         +p.amount,
      method:         p.method,
      reference:      paymentNumbering ? paymentNumbering.toRef(paymentNo, p.reference) : p.reference,
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
    await logAudit({
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-2 items-end">
            <div className="sm:col-span-2 xl:col-span-1">
              <Combobox
                items={facilityItems.map(it => ({
                  value: it.id,
                  label: it.name,
                  sublabel: `${fmtBDT(it.default_price)} / ${it.unit}`,
                }))}
                value={facilityItems.find(it => it.name === c.charge_type)?.id || ''}
                onChange={(id, item) => setC(prev => ({
                  ...prev,
                  charge_type: item?.label || 'OTHER',
                  description: prev.description || item?.label || '',
                  base_amount: prev.base_amount || String(
                    facilityItems.find(it => it.id === id)?.default_price ?? ''
                  ),
                }))}
                placeholder="Select service…"
                searchPlaceholder="Search services…"
                emptyText="No services — add in Facility Items"
              />
            </div>
            <div className="sm:col-span-2 xl:col-span-2">
              <input
                className="input w-full"
                placeholder="Description"
                value={c.description}
                onChange={(e) => setC({ ...c, description: e.target.value })}
              />
            </div>
            <div>
              <input
                type="number"
                className="input money w-full"
                placeholder="Base ৳"
                value={c.base_amount}
                onChange={(e) => setC({ ...c, base_amount: e.target.value })}
              />
            </div>
            <div>
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
            <div className="sm:col-span-2 xl:col-span-1">
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
            <div className="sm:col-span-2">
              <label className="label !text-xs">Paid by</label>
              <SearchableSelect
                value={p.paid_by_party || ''}
                onChange={v => setP({ ...p, paid_by_party: v })}
                options={[
                  { value: guest?.full_name || 'Guest', label: `👤 ${guest?.full_name || 'Guest'} (Guest)` },
                  ...(res.agencies ? [{ value: res.agencies.name, label: `🤝 ${res.agencies.name} (Agency)` }] : []),
                  ...(res.shareholders ? [{ value: res.shareholders.name, label: `👥 ${res.shareholders.name} (Shareholder)` }] : []),
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
            <th className="th">Date</th>{paymentNumbering && <th className="th">Payment ID</th>}<th className="th">Paid by</th><th className="th">Class</th><th className="th">Method</th>
            <th className="th">Reference</th><th className="th text-right">Amount</th>
          </tr></thead>
          <tbody>
            {payments.map((pm) => {
              const parsedRef = paymentNumbering ? paymentNumbering.parseRef(pm.reference) : null
              return (
                <tr key={pm.id}>
                  <td className="td money text-xs">
                    {fmtDate(pm.received_date)}
                    {isAdmin && (
                      <button title="Delete payment (admin)" onClick={() => delPayment(pm)} className="ml-2 text-red-300 hover:text-red-600 align-middle">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                  {paymentNumbering && <td className="td text-xs font-mono text-pine/80">{parsedRef?.paymentNo || '—'}</td>}
                  <td className="td text-sm font-medium">{pm.paid_by_party || pm.received_by || '—'}</td>
                  <td className="td">
                    <span className={`status-chip text-xs ${
                      pm.payment_class === 'ADVANCE'    ? 'bg-amber/20 text-amber' :
                      pm.payment_class === 'SETTLEMENT' ? 'bg-forest/15 text-forest' :
                      'bg-sky-50 text-sky-700'
                    }`}>{pm.payment_class || 'SETTLEMENT'}</span>
                  </td>
                  <td className="td text-sm">{pm.method}</td>
                  <td className="td text-xs">{paymentNumbering ? (parsedRef?.reference || '—') : (pm.reference || '—')}</td>
                  <td className="td money text-right font-semibold">{Number(pm.amount).toFixed(2)}</td>
                </tr>
              )
            })}
            {payments.length === 0 && <tr><td className="td text-pine/50" colSpan={paymentNumbering ? 7 : 6}>No payments recorded.</td></tr>}
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

export default BillingsAndCheckOutTab
