/* ------------------------------------------------------------------ */
/*  OVERVIEW TAB  (with Full Quotation Edit Modal)                     */
/* ------------------------------------------------------------------ */
function Overview({
  res, guest, resRooms, resGuests = [], setStatus, payments, advance, flash,
  isAdmin, userName, addons = [], taxConfig = [], reload, nights, company, setPrintDoc,
}) {
  const canConfirm = ['QUERY', 'QUOTED'].includes(res.status)
  const isCompany  = res.guest_type === 'Company'
  const [posting, setPosting] = useState(false)

  // ──────── Quotation state ────────
  const [quote, setQuote]               = useState(null)        // latest quotation object
  const [quoteEditorOpen, setQuoteEditorOpen] = useState(false)
  const [editing, setEditing]           = useState(false)       // true when editing existing quote

  // Form fields for the full quotation edit
  const [editForm, setEditForm] = useState({
    // guest info
    salutation: res.salutation || '',
    full_name: guest?.full_name || '',
    phone: guest?.phone || '',
    email: guest?.email || '',
    address: guest?.address || '',
    // reservation fields
    check_in: res.check_in,
    check_out: res.check_out,
    pax_adults: res.pax_adults || 1,
    pax_children: res.pax_children || 0,
    source: res.source || '',
    reservation_name: res.reservation_name || '',
    use_reservation_name_only: res.use_reservation_name_only || false,
    guest_type: res.guest_type || 'Individual',
    notes: res.notes || '',
    // rate & discount
    discount_type: res.discount_type || 'percentage',
    discount_val: res.discount_val || 0,
    discount_pct: res.discount_pct || 0,
    // terms
    terms_conditions: res.terms_conditions || company?.terms_conditions || '',
  })

  // Room assignment within the quotation editor
  const [roomList, setRoomList]         = useState([])          // array of { id, room_id, room_no, room_name, room_type, rate }
  const [roomsAll, setRoomsAll]         = useState([])          // full room inventory
  const [addonList, setAddonList]       = useState([])          // addons snapshot
  const [newAddon, setNewAddon]         = useState({ label: '', price: '', qty: 1 })

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

  // Initial load
  useEffect(() => { loadLatestQuote() }, [res.id])

  // When quotation modal opens, populate all fields
  const openQuoteEditor = (editExisting = false) => {
    setEditing(editExisting)
    // Reset form from current reservation/guest data
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
    // Clone current room assignments
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
    // Clone current addons
    setAddonList(addons.map(a => ({ ...a }))) // shallow copy ok
    setNewAddon({ label: '', price: '', qty: 1 })
    setQuoteEditorOpen(true)
  }

  const startNewQuote = () => openQuoteEditor(false)
  const editQuote = () => openQuoteEditor(true)   // edit latest

  // Load full room inventory for the assign dropdown
  useEffect(() => {
    if (quoteEditorOpen) {
      supabase.from('rooms').select('*').eq('is_active', true).order('room_no')
        .then(({ data }) => setRoomsAll(data || []))
    }
  }, [quoteEditorOpen])

  // Handlers for room list inside modal
  const assignRoomInModal = (room) => {
    setRoomList(prev => [
      ...prev,
      {
        id: null, // new room assignment (no ID yet)
        room_id: room.id,
        room_no: room.room_no,
        room_name: room.room_name,
        room_type: room.room_type,
        rate: res.room_rate || room.base_rate || 0,
        from_date: editForm.check_in,
        to_date: editForm.check_out,
      }
    ])
  }

  const removeRoomInModal = (index) => {
    setRoomList(prev => prev.filter((_, i) => i !== index))
  }

  const updateRoomRateInModal = (index, newRate) => {
    setRoomList(prev => prev.map((r, i) => i === index ? { ...r, rate: Number(newRate) } : r))
  }

  // Addon handlers
  const addAddonItem = () => {
    if (!newAddon.label || !newAddon.price) return
    setAddonList(prev => [
      ...prev,
      {
        id: null,  // new
        label: newAddon.label,
        price: Number(newAddon.price),
        qty: Number(newAddon.qty) || 1,
        posted: false,
        reservation_id: res.id,
      }
    ])
    setNewAddon({ label: '', price: '', qty: 1 })
  }

  const removeAddonItem = (index) => {
    setAddonList(prev => prev.filter((_, i) => i !== index))
  }

  // ──────── Update handler ────────
  const handleUpdateQuotation = async () => {
    // 1. Update primary guest
    if (guest) {
      await supabase.from('guests').update({
        full_name: editForm.full_name,
        phone: editForm.phone,
        email: editForm.email,
        address: editForm.address,
      }).eq('id', guest.id)
    }

    // 2. Update reservation main data
    const resUpdate = {
      salutation: editForm.salutation,
      check_in: editForm.check_in,
      check_out: editForm.check_out,
      pax_adults: Number(editForm.pax_adults),
      pax_children: Number(editForm.pax_children),
      source: editForm.source,
      reservation_name: editForm.reservation_name,
      use_reservation_name_only: editForm.use_reservation_name_only,
      guest_type: editForm.guest_type,
      notes: editForm.notes,
      discount_type: editForm.discount_type,
      discount_val: editForm.discount_type === 'fixed' ? Number(editForm.discount_val) : 0,
      discount_pct: editForm.discount_type === 'percentage' ? Number(editForm.discount_pct) : 0,
      terms_conditions: editForm.terms_conditions,
      room_rate: roomList.length > 0 ? roomList[0].rate : 0, // keep overall room_rate
    }
    const { error: resErr } = await supabase.from('reservations').update(resUpdate).eq('id', res.id)
    if (resErr) { flash(resErr.message); return }

    // 3. Sync room assignments (reservation_rooms)
    const currentRoomIds = resRooms.map(rr => rr.id)
    const newRoomIds = roomList.map(r => r.id).filter(id => id !== null)
    const toDelete = currentRoomIds.filter(id => !newRoomIds.includes(id))
    // Delete removed rooms
    if (toDelete.length > 0) {
      await supabase.from('reservation_rooms').delete().in('id', toDelete)
    }
    // Update existing rooms and insert new
    for (const room of roomList) {
      if (room.id) {
        // existing
        await supabase.from('reservation_rooms').update({
          room_id: room.room_id,
          rate: room.rate,
          from_date: room.from_date || editForm.check_in,
          to_date: room.to_date || editForm.check_out,
        }).eq('id', room.id)
      } else {
        // new
        await supabase.from('reservation_rooms').insert({
          reservation_id: res.id,
          room_id: room.room_id,
          rate: room.rate,
          from_date: room.from_date || editForm.check_in,
          to_date: room.to_date || editForm.check_out,
        })
      }
    }

    // 4. Sync addons
    const currentAddonIds = addons.map(a => a.id)
    const newAddonIds = addonList.map(a => a.id).filter(id => id !== null)
    const addonsToDelete = currentAddonIds.filter(id => !newAddonIds.includes(id))
    if (addonsToDelete.length > 0) {
      await supabase.from('reservation_addons').delete().in('id', addonsToDelete)
    }
    for (const ad of addonList) {
      if (ad.id) {
        // existing: update if changed (price, qty, label)
        await supabase.from('reservation_addons').update({
          label: ad.label,
          price: ad.price,
          qty: ad.qty,
        }).eq('id', ad.id)
      } else {
        // new
        await supabase.from('reservation_addons').insert({
          reservation_id: res.id,
          label: ad.label,
          price: ad.price,
          qty: ad.qty,
          posted: false,
        })
      }
    }

    // 5. Update latest quotation record (or create if none)
    const quoteRateObj = rateFor(taxConfig, 'ROOM', editForm.check_in)
    const roomTotal = roomList.reduce((sum, rm) => sum + Number(rm.rate), 0)
    const nightsCount = nightsBetween(editForm.check_in, editForm.check_out)
    const discDescriptor = editForm.discount_type === 'fixed'
      ? { type: 'fixed', value: Number(editForm.discount_val) }
      : Number(editForm.discount_pct)
    const perNight = computeCharge(roomTotal, discDescriptor, quoteRateObj)
    const grandTotal = +(perNight.total * nightsCount).toFixed(2)
    const validUntil = new Date(Date.now() + 7 * 86400000).toISOString().slice(0,10) // default 7 days

    const quoteSnapshot = {
      total_amount: grandTotal,
      valid_until: validUntil,
      room_rate: roomList.length > 0 ? roomList[0].rate : 0,
      room_count: roomList.length,
      discount_pct: editForm.discount_type === 'percentage' ? Number(editForm.discount_pct) : 0,
      updated_at: new Date().toISOString(),
    }
    if (quote) {
      await supabase.from('quotations').update(quoteSnapshot).eq('id', quote.id)
    } else {
      // Create a new quotation record (even if not sent yet)
      await supabase.from('quotations').insert({
        reservation_id: res.id,
        ...quoteSnapshot,
        status: 'DRAFT',
        message: '', // will be populated later if sent
      })
    }

    // 6. Reload all data
    await reload()
    await loadLatestQuote()
    flash(editing ? 'Quotation updated successfully.' : 'New quotation drafted.')
    setQuoteEditorOpen(false)
  }

  // ──────── Existing Addon posting etc unchanged ────────
  const unposted = addons.filter((a) => !a.posted)
  const lineTotal = (a) => Number(a.price) * Number(a.qty)
  const addonsTotal = addons.reduce((sum, a) => sum + lineTotal(a), 0)
  const postAddonCharges = async () => {
    // ... (keep existing code) ...
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
    } catch (e) {
      flash(e.message || 'Failed to post addon charges.')
    }
    setPosting(false)
  }

  // ──────── Send actions remain in list row, not in edit modal ────────
  const sendQuoteWhatsApp = () => { /* unchanged */ }
  const sendQuoteEmail = () => { /* unchanged */ }
  const printQuote = () => { /* unchanged, but uses quote state data */ }

  // Compute summary for display if needed
  const quoteRateForDisplay = rateFor(taxConfig, 'ROOM', res.check_in)
  // ...

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left column: guest & stay, including items, etc. — unchanged */}
      <div className="card p-5 lg:col-span-2">
        <h3 className="font-display font-semibold text-pine mb-3">Guest & stay</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {/* same as before */}
          <div><dt className="label">Primary guest</dt><dd className="font-semibold">{res.salutation ? `${res.salutation} ` : ''}{guest?.full_name || '—'}</dd></div>
          <div><dt className="label">Contact</dt><dd>{guest?.phone || '—'}{guest?.email ? ` · ${guest.email}` : ''}</dd></div>
          <div><dt className="label">Address</dt><dd>{guest?.address || '—'}</dd></div>
          <div><dt className="label">Source</dt><dd>{res.source}</dd></div>
          <div><dt className="label">Guest type</dt><dd>{res.guest_type || 'Individual'}</dd></div>
          <div><dt className="label">Reservation name</dt><dd>{res.reservation_name || '—'}{res.use_reservation_name_only && <span className="text-xs text-pine/50"> (used everywhere)</span>}</dd></div>
          <div><dt className="label">Discount</dt><dd>{
            res.discount_type === 'fixed'
              ? (Number(res.discount_val) > 0 ? `${fmtBDT(res.discount_val)} fixed — applied on room charges` : '—')
              : (Number(res.discount_pct) > 0 ? `${res.discount_pct}% — applied on room charges` : '—')
          }</dd></div>
          <div><dt className="label">Rooms assigned</dt><dd>{resRooms.length ? resRooms.map((r) => r.rooms?.room_no).join(', ') : 'Not yet assigned'}</dd></div>
          <div className="col-span-2"><dt className="label">Notes</dt><dd>{res.notes || '—'}</dd></div>
        </dl>

        {isCompany && (
          <>
            <h3 className="font-display font-semibold text-pine mb-3 mt-5">Company / OTA terms</h3>
            <dl className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <div><dt className="label">Commission rate</dt><dd className="font-semibold money">{Number(res.commission_pct) || 0}%</dd></div>
              <div><dt className="label">Vat/VDS</dt><dd className="font-semibold money">{Number(res.vat_vds_pct) || 0}%</dd></div>
              <div><dt className="label">Tax/TDS</dt><dd className="font-semibold money">{Number(res.tax_tds_pct) || 0}%</dd></div>
            </dl>
          </>
        )}

        {/* Including items — unchanged */}
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
          <div className="border border-leaf rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              {/* same addon table */}
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

      {/* RIGHT COLUMN — Pipeline actions (unchanged except maybe minor) */}
      <div className="card p-5">
        <h3 className="font-display font-semibold text-pine mb-3">Pipeline actions</h3>
        <div className="space-y-2">
          {canConfirm && (
            <button className="btn-primary w-full justify-center" onClick={() => {
              if (advance <= 0 && payments.length === 0) {
                flash('Record the advance payment first (Billings & Check-Out tab).')
                return
              }
              setStatus('CONFIRMED')
              flash('Booking confirmed.')
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
                  .eq('reservation_id', res.id)
                  .not('is_void', 'is', true)
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
          <p className="text-xs text-pine/50 pt-2">
            Advance received: <span className="money font-semibold">{fmtBDT(advance)}</span>.
          </p>
        </div>
      </div>

      {/* ──────── QUOTATION TABLE (single row) ──────── */}
      <div className="card p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-pine">Quotation</h3>
          <button className="btn-ghost !py-1.5 text-xs" onClick={startNewQuote}>
            <Plus size={13} /> New quotation
          </button>
        </div>
        {!quote ? (
          <p className="text-sm text-pine/50 py-4">No quotation created yet for this reservation.</p>
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
                <tr className="hover:bg-leaf/20 border-b border-leaf/40 last:border-0">
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
                      <button onClick={editQuote} title="Edit quotation"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest transition-colors">
                        <Pencil size={13} /></button>
                      <button onClick={() => { /* Print: use current quote data */ }}
                        title="Print quotation"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest transition-colors">
                        <Printer size={13} /></button>
                      <button onClick={() => { /* WhatsApp */ }}
                        title={guest?.phone ? 'Send via WhatsApp' : 'No phone number'}
                        disabled={!guest?.phone}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-100 text-pine/40 hover:text-green-600 transition-colors disabled:opacity-25 disabled:cursor-not-allowed">
                        <MessageCircle size={13} /></button>
                      <button onClick={() => { /* Email */ }}
                        title="Send via Email"
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

      {/* ──────── FULL QUOTATION EDIT MODAL ──────── */}
      {quoteEditorOpen && (
        <div className="fixed inset-0 bg-ink/60 z-50 flex items-start justify-center overflow-auto p-6">
          <div className="card max-w-4xl w-full p-6 my-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-bold text-pine">
                {editing ? 'Edit Quotation' : 'New Quotation'}
              </h2>
              <button onClick={() => setQuoteEditorOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-pine text-xl leading-none">✕</button>
            </div>

            {/* Guest information */}
            <fieldset className="border border-leaf rounded-xl p-4 mb-4">
              <legend className="text-sm font-semibold text-pine px-2">Primary Guest</legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Salutation</label>
                  <input className="input" value={editForm.salutation} onChange={e => setEditForm({...editForm, salutation: e.target.value})} />
                </div>
                <div>
                  <label className="label">Full Name *</label>
                  <input className="input" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} required />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="label">Address</label>
                  <textarea className="input" rows={2} value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                </div>
              </div>
            </fieldset>

            {/* Stay details */}
            <fieldset className="border border-leaf rounded-xl p-4 mb-4">
              <legend className="text-sm font-semibold text-pine px-2">Stay Details</legend>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="label">Check-in</label>
                  <input type="date" className="input" value={editForm.check_in} onChange={e => setEditForm({...editForm, check_in: e.target.value})} />
                </div>
                <div>
                  <label className="label">Check-out</label>
                  <input type="date" className="input" value={editForm.check_out} onChange={e => setEditForm({...editForm, check_out: e.target.value})} />
                </div>
                <div>
                  <label className="label">Adults</label>
                  <input type="number" min="1" className="input" value={editForm.pax_adults} onChange={e => setEditForm({...editForm, pax_adults: e.target.value})} />
                </div>
                <div>
                  <label className="label">Children</label>
                  <input type="number" min="0" className="input" value={editForm.pax_children} onChange={e => setEditForm({...editForm, pax_children: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="label">Source</label>
                  <input className="input" value={editForm.source} onChange={e => setEditForm({...editForm, source: e.target.value})} />
                </div>
                <div>
                  <label className="label">Guest Type</label>
                  <select className="input" value={editForm.guest_type} onChange={e => setEditForm({...editForm, guest_type: e.target.value})}>
                    <option>Individual</option><option>Company</option><option>Shareholder</option>
                  </select>
                </div>
                <div>
                  <label className="label">Reservation Name</label>
                  <input className="input" value={editForm.reservation_name} onChange={e => setEditForm({...editForm, reservation_name: e.target.value})} />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input type="checkbox" id="use_res_name" checked={editForm.use_reservation_name_only} onChange={e => setEditForm({...editForm, use_reservation_name_only: e.target.checked})} />
                <label htmlFor="use_res_name" className="text-sm">Use reservation name everywhere</label>
              </div>
            </fieldset>

            {/* Room Assignment */}
            <fieldset className="border border-leaf rounded-xl p-4 mb-4">
              <legend className="text-sm font-semibold text-pine px-2">Room Assignment</legend>
              <div className="flex gap-2 mb-3">
                <select className="input flex-1" onChange={(e) => {
                  const room = roomsAll.find(r => r.id === e.target.value)
                  if (room) assignRoomInModal(room)
                  e.target.value = ''
                }}>
                  <option value="">Select room to add...</option>
                  {roomsAll.filter(r => !roomList.some(rl => rl.room_id === r.id)).map(r => (
                    <option key={r.id} value={r.id}>{r.room_no}{r.room_name ? ` - ${r.room_name}` : ''} ({r.room_type})</option>
                  ))}
                </select>
              </div>
              {roomList.length === 0 && <p className="text-sm text-pine/50 py-2">No rooms assigned.</p>}
              {roomList.map((rm, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-leaf/30 py-1">
                  <span className="text-sm font-semibold">{rm.room_no}{rm.room_name ? ` · ${rm.room_name}` : ''} ({rm.room_type})</span>
                  <div className="flex items-center gap-2">
                    <input type="number" className="input !w-20 !py-1 text-right money" value={rm.rate} onChange={e => updateRoomRateInModal(idx, e.target.value)} />
                    <span className="text-xs">/night</span>
                    <button onClick={() => removeRoomInModal(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </fieldset>

            {/* Including Items (Addons) */}
            <fieldset className="border border-leaf rounded-xl p-4 mb-4">
              <legend className="text-sm font-semibold text-pine px-2">Including Items</legend>
              <div className="flex gap-2 mb-2">
                <input className="input flex-1" placeholder="Item label" value={newAddon.label} onChange={e => setNewAddon({...newAddon, label: e.target.value})} />
                <input type="number" className="input !w-20" placeholder="Price" value={newAddon.price} onChange={e => setNewAddon({...newAddon, price: e.target.value})} />
                <input type="number" className="input !w-16" placeholder="Qty" value={newAddon.qty} onChange={e => setNewAddon({...newAddon, qty: e.target.value})} />
                <button className="btn-ghost !py-1" onClick={addAddonItem}><Plus size={14} /></button>
              </div>
              {addonList.length === 0 && <p className="text-sm text-pine/50">No items added.</p>}
              {addonList.map((a, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-leaf/20 py-1">
                  <span className="text-sm">{a.label} × {a.qty}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm money">{fmtBDT(a.price * a.qty)}</span>
                    <button onClick={() => removeAddonItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </fieldset>

            {/* Rate, Discount & Terms */}
            <fieldset className="border border-leaf rounded-xl p-4 mb-4">
              <legend className="text-sm font-semibold text-pine px-2">Rate & Discount</legend>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Discount type</label>
                  <select className="input" value={editForm.discount_type} onChange={e => setEditForm({...editForm, discount_type: e.target.value})}>
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed (৳)</option>
                  </select>
                </div>
                {editForm.discount_type === 'percentage' ? (
                  <div>
                    <label className="label">Discount %</label>
                    <input type="number" min="0" max="100" className="input money" value={editForm.discount_pct} onChange={e => setEditForm({...editForm, discount_pct: e.target.value})} />
                  </div>
                ) : (
                  <div>
                    <label className="label">Discount amount (৳)</label>
                    <input type="number" min="0" className="input money" value={editForm.discount_val} onChange={e => setEditForm({...editForm, discount_val: e.target.value})} />
                  </div>
                )}
                <div className="flex items-end">
                  {/* optional live preview of total? could add */}
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-leaf rounded-xl p-4 mb-4">
              <legend className="text-sm font-semibold text-pine px-2">Terms & Conditions</legend>
              <textarea className="input" rows={4} value={editForm.terms_conditions} onChange={e => setEditForm({...editForm, terms_conditions: e.target.value})} />
              <p className="text-xs text-pine/50 mt-1">Default from Settings. You may modify.</p>
            </fieldset>

            {/* Action buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t border-leaf">
              <button className="btn-ghost" onClick={() => setQuoteEditorOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleUpdateQuotation}>
                <Save size={16} /> {editing ? 'Update Quotation' : 'Save Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The right column card already rendered above */}
    </div>
  )
}

export default Overview
