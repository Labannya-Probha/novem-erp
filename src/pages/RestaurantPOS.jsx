import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, rateFor, computeCharge, applyRounding } from '../lib/helpers'
import PrintPortal from '../components/PrintPortal.jsx'
import { PosReceipt, KitchenTicket } from '../components/print/PosDocs.jsx'
import Mushak63 from '../components/print/Mushak63.jsx'
import GuestPicker from '../components/GuestPicker.jsx'
import { Plus, Minus, Trash2, Printer, ChefHat, Banknote, BedDouble, Search, Save, XCircle, RotateCcw, Receipt, Clock, FileText } from 'lucide-react'

const TABS = ['New Order', 'Orders', 'Menu', 'Day Close']
const PAYMENT_METHODS = ['CASH', 'BKASH', 'NAGAD', 'CARD', 'BANK', 'OTHER']

// Cash rounding logic: >= 0.50 round up, < 0.50 round down
const applyCashRounding = (amount) => {
  const decimal = amount % 1
  if (decimal === 0) return { rounded: amount, rounding: 0 }
  if (decimal >= 0.50) {
    const rounded = Math.ceil(amount)
    return { rounded, rounding: rounded - amount }
  } else {
    const rounded = Math.floor(amount)
    return { rounded, rounding: rounded - amount }
  }
}

export default function RestaurantPOS({ userName, isAdmin }) {
  const [tab, setTab] = useState('New Order')
  const [taxConfig, setTaxConfig] = useState([])
  const [company, setCompany] = useState(null)
  const [cats, setCats] = useState([])
  const [items, setItems] = useState([])
  const [editOrder, setEditOrder] = useState(null)
  const [printDoc, setPrintDoc] = useState(null)
  const [msg, setMsg] = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const loadMenu = async () => {
    const [{ data: c }, { data: it }, { data: tc }, { data: co }] = await Promise.all([
      supabase.from('menu_categories').select('*').order('sort_order'),
      supabase.from('menu_items').select('*').order('sort_order').order('name'),
      supabase.from('tax_config').select('*'),
      supabase.from('company_settings').select('*').eq('id', 1).single(),
    ])
    setCats(c || []); setItems(it || []); setTaxConfig(tc || []); setCompany(co)
  }
  useEffect(() => { loadMenu() }, [])

  const resumeOrder = async (order) => {
    const { data: oi } = await supabase.from('pos_order_items').select('*').eq('order_id', order.id)
    setEditOrder({ order, items: oi || [] })
    setTab('New Order')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine">Restaurant POS</h1>
          <p className="text-sm text-pine/60">Orders for in-house guests post straight to their billing history — pay now or charge to room.</p>
        </div>
      </div>
      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}
      <div className="flex gap-1 border-b border-leaf mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); if (t !== 'New Order') setEditOrder(null) }} className={`px-4 py-2 text-sm font-semibold rounded-t-lg whitespace-nowrap ${tab === t ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'New Order' && <OrderBuilder key={editOrder?.order?.id || 'new'} cats={cats} items={items} taxConfig={taxConfig} userName={userName} existing={editOrder} flash={flash} setPrintDoc={setPrintDoc} onDone={(doc) => { setEditOrder(null); if (doc) setPrintDoc(doc); setTab('Orders') }} />}
      {tab === 'Orders' && <OrdersList company={company} flash={flash} resumeOrder={resumeOrder} setPrintDoc={setPrintDoc} isAdmin={isAdmin} userName={userName} />}
      {tab === 'Menu' && <MenuManager cats={cats} items={items} reload={loadMenu} isAdmin={isAdmin} />}
      {tab === 'Day Close' && <DayClose flash={flash} isAdmin={isAdmin} userName={userName} />}
      {printDoc?.type === 'RECEIPT' && (<PrintPortal title={`Restaurant Bill — ${printDoc.order.order_no}`} onClose={() => setPrintDoc(null)}><PosReceipt order={printDoc.order} items={printDoc.items} company={company} mushakNo={printDoc.mushakNo} /></PrintPortal>)}
      {printDoc?.type === 'KOT' && (<PrintPortal title={`Kitchen Order — ${printDoc.order.order_no}`} onClose={() => setPrintDoc(null)}><KitchenTicket order={printDoc.order} items={printDoc.items} /></PrintPortal>)}
      {printDoc?.type === 'MUSHAK' && (<PrintPortal title={`Mushak-6.3 — ${printDoc.invoice.invoice_no}`} onClose={() => setPrintDoc(null)}><Mushak63 invoice={printDoc.invoice} res={null} company={company} refNo={printDoc.refNo} /></PrintPortal>)}
    </div>
  )
}

function OrderBuilder({ cats, items, taxConfig, userName, existing, flash, setPrintDoc, onDone }) {
  const [cart, setCart] = useState(existing ? existing.items.map((i) => ({ menu_item_id: i.menu_item_id, item_name: i.item_name, qty: Number(i.qty), unit_price: Number(i.unit_price) })) : [])
  const [meta, setMeta] = useState(existing ? { order_type: existing.order.order_type, table_no: existing.order.table_no || '', discount_type: 'PERCENT', discount_value: 0, notes: existing.order.notes || '' } : { order_type: 'DINE_IN', table_no: '', discount_type: 'PERCENT', discount_value: 0, notes: '' })
  const [link, setLink] = useState(existing ? { reservation_id: existing.order.reservation_id, guest_name: existing.order.guest_name || '', room_no: existing.order.room_no || '' } : { reservation_id: null, guest_name: '', room_no: '' })
  const [activeCat, setActiveCat] = useState('ALL')
  const [payments, setPayments] = useState(PAYMENT_METHODS.reduce((acc, m) => ({ ...acc, [m]: '' }), {}))
  const [showPicker, setShowPicker] = useState(false)
  const [busy, setBusy] = useState(false)

  const rate = rateFor(taxConfig, 'RESTAURANT', todayISO())
  const subtotal = cart.reduce((a, c) => a + c.qty * c.unit_price, 0)
  
  // Calculate discount based on type
  let discountAmount = 0
  let discountPct = 0
  if (meta.discount_type === 'PERCENT') {
    discountPct = Number(meta.discount_value) || 0
    discountAmount = (subtotal * discountPct) / 100
  } else {
    discountAmount = Number(meta.discount_value) || 0
    discountPct = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0
  }

  // Calculate totals with proper rounding
  const rawTotal = computeCharge(subtotal, discountPct, rate)
  const subtotalAfterTax = rawTotal.base_amount - rawTotal.discount + rawTotal.service_charge + rawTotal.sd + rawTotal.vat
  const { rounded: finalTotal, rounding: roundingAmount } = applyCashRounding(subtotalAfterTax)
  const t = { base_amount: rawTotal.base_amount, discount: discountAmount, service_charge: rawTotal.service_charge, sd: rawTotal.sd, vat: rawTotal.vat, total: finalTotal, rounding: roundingAmount }

  const addItem = (mi) => {
    setCart((prev) => {
      const f = prev.find((c) => c.menu_item_id === mi.id)
      if (f) return prev.map((c) => (c.menu_item_id === mi.id ? { ...c, qty: c.qty + 1 } : c))
      return [...prev, { menu_item_id: mi.id, item_name: mi.name, qty: 1, unit_price: Number(mi.price) }]
    })
  }
  const bump = (idx, d) => setCart((prev) => prev.map((c, i) => (i === idx ? { ...c, qty: Math.max(0, c.qty + d) } : c)).filter((c) => c.qty > 0))
  const removeLine = (idx) => setCart((prev) => prev.filter((_, i) => i !== idx))
  const visible = items.filter((i) => i.is_active && (activeCat === 'ALL' || i.category_id === activeCat))

  const allocate = () => {
    const lines = cart.map((c) => ({ ...c, line_total: +(c.qty * c.unit_price).toFixed(2) }))
    const keys = ['discount', 'service_charge', 'sd', 'vat']
    const out = lines.map((l) => {
      const ratio = subtotal > 0 ? l.line_total / subtotal : 0
      const o = { charge_date: todayISO(), charge_type: 'RESTAURANT', description: `${l.item_name} × ${l.qty}`, base_amount: l.line_total, status: 'PAID' }
      keys.forEach((k) => { o[k] = +(t[k] * ratio).toFixed(2) })
      return o
    })
    if (out.length > 0) {
      keys.forEach((k) => {
        const sum = out.reduce((a, o) => a + o[k], 0)
        out[out.length - 1][k] = +(out[out.length - 1][k] + (t[k] - sum)).toFixed(2)
      })
    }
    out.forEach((o) => { o.total = +(o.base_amount - o.discount + o.service_charge + o.sd + o.vat).toFixed(2) })
    return out
  }

  const persist = async (statusFields) => {
    const payload = { order_type: meta.order_type, table_no: meta.table_no || null, notes: meta.notes || null, reservation_id: link.reservation_id, guest_name: link.guest_name || null, room_no: link.room_no || null, discount_pct: discountPct, base_amount: t.base_amount, discount: discountAmount, service_charge: t.service_charge, sd: t.sd, vat: t.vat, total: t.total, created_by: userName, ...statusFields }
    let order
    if (existing) {
      const { data, error } = await supabase.from('pos_orders').update(payload).eq('id', existing.order.id).select().single()
      if (error) throw error
      order = data
      await supabase.from('pos_order_items').delete().eq('order_id', order.id)
    } else {
      const { data, error } = await supabase.from('pos_orders').insert(payload).select().single()
      if (error) throw error
      order = data
    }
    const lineRows = cart.map((c) => ({ order_id: order.id, menu_item_id: c.menu_item_id, item_name: c.item_name, qty: c.qty, unit_price: c.unit_price, line_total: +(c.qty * c.unit_price).toFixed(2) }))
    const { data: savedItems, error: ie } = await supabase.from('pos_order_items').insert(lineRows).select()
    if (ie) throw ie
    return { order, items: savedItems }
  }

  const guard = () => {
    if (cart.length === 0) { flash('Add at least one item to the order.'); return false }
    return true
  }

  const generateKOT = () => {
    if (!guard()) return
    setPrintDoc({ type: 'KOT', order: { order_no: 'TEMP-' + Date.now(), table_no: meta.table_no, order_type: meta.order_type, guest_name: link.guest_name }, items: cart })
  }

  const payNow = async () => {
    if (!guard()) return
    const paidMethods = Object.entries(payments).filter(([m, a]) => Number(a) > 0)
    if (paidMethods.length === 0) { flash('Add at least one payment method.'); return }
    const totalPaid = paidMethods.reduce((a, [m, amt]) => a + Number(amt), 0)
    if (totalPaid < t.total) { flash(`Total payment (${fmtBDT(totalPaid)}) less than bill (${fmtBDT(t.total)})`); return }
    if (totalPaid > t.total) { flash(`Change: ${fmtBDT(totalPaid - t.total)}`); return }
    setBusy(true)
    try {
      const settled = { status: 'SETTLED', payment_method: paidMethods.map(([m, a]) => `${m}:${a}`).join('; '), settled_at: new Date().toISOString() }
      const { order, items: oi } = await persist(settled)
      let mushakNo = null
      if (order.reservation_id) {
        const { data: fc, error: fe } = await supabase.from('folio_charges').insert({ reservation_id: order.reservation_id, charge_date: todayISO(), charge_type: 'RESTAURANT', description: `Restaurant ${order.order_no}${order.table_no ? ' · Table ' + order.table_no : ''}`, base_amount: t.base_amount, discount: discountAmount, service_charge: t.service_charge, sd: t.sd, vat: t.vat, total: t.total, status: 'PAID', created_by: userName }).select().single()
        if (fe) throw fe
        const { error: pe } = await supabase.from('payments').insert({ reservation_id: order.reservation_id, received_date: todayISO(), amount: t.total, method: paidMethods.map(([m]) => m).join(', '), reference: order.order_no, received_by: userName, notes: 'Restaurant POS' })
        if (pe) throw pe
        await supabase.from('pos_orders').update({ folio_charge_id: fc.id }).eq('id', order.id)
      }
      onDone({ type: 'RECEIPT', order: { ...order, status: 'SETTLED', payment_method: paidMethods.map(([m]) => m).join(', ') }, items: oi, mushakNo })
      flash(`${order.order_no} settled — ${paidMethods.map(([m, a]) => `${m}:${fmtBDT(a)}`).join(', ')}`)
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  const chargeToRoom = async () => {
    if (!guard()) return
    if (!link.reservation_id) { flash('Link an in-house guest first to charge to room.'); return }
    setBusy(true)
    try {
      const { order, items: oi } = await persist({ status: 'CHARGED_TO_ROOM' })
      const { data: fc, error: fe } = await supabase.from('folio_charges').insert({ reservation_id: order.reservation_id, charge_date: todayISO(), charge_type: 'RESTAURANT', description: `Restaurant ${order.order_no}${order.table_no ? ' · Table ' + order.table_no : ''}`, base_amount: t.base_amount, discount: discountAmount, service_charge: t.service_charge, sd: t.sd, vat: t.vat, total: t.total, status: 'DUE', created_by: userName }).select().single()
      if (fe) throw fe
      await supabase.from('pos_orders').update({ folio_charge_id: fc.id }).eq('id', order.id)
      onDone({ type: 'RECEIPT', order: { ...order, status: 'CHARGED_TO_ROOM' }, items: oi })
      flash(`${order.order_no} charged to Room ${order.room_no} as DUE — settles at check-out.`)
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      <div className="xl:col-span-3">
        <div className="flex gap-2 mb-3 flex-wrap">
          <button onClick={() => setActiveCat('ALL')} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${activeCat === 'ALL' ? 'bg-pine text-white' : 'bg-white border border-leaf text-pine/70'}`}>All</button>
          {cats.filter((c) => c.is_active).map((c) => (
            <button key={c.id} onClick={() => setActiveCat(c.id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${activeCat === c.id ? 'bg-pine text-white' : 'bg-white border border-leaf text-pine/70'}`}>{c.name}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {visible.map((mi) => (
            <button key={mi.id} onClick={() => addItem(mi)} className="card p-3 text-left hover:border-forest hover:shadow transition-all active:scale-[0.98]">
              <div className="font-semibold text-sm leading-tight">{mi.name}</div>
              <div className="money text-forest text-sm mt-1">{fmtBDT(mi.price)}</div>
            </button>
          ))}
          {visible.length === 0 && (<div className="col-span-full card p-6 text-center text-sm text-pine/50">No menu items yet — add your dishes in the <b>Menu</b> tab.</div>)}
        </div>
      </div>
      <div className="xl:col-span-2 space-y-3">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-semibold text-pine">{existing ? `Editing ${existing.order.order_no}` : 'Current order'}</h3>
            <div className="flex gap-2">
              <select className="input !w-auto !py-1 text-xs" value={meta.order_type} onChange={(e) => setMeta({ ...meta, order_type: e.target.value })}>
                <option value="DINE_IN">Dine-in</option><option value="ROOM_SERVICE">Room service</option><option value="TAKEAWAY">Takeaway</option>
              </select>
              <input className="input !w-20 !py-1 text-xs" placeholder="Table" value={meta.table_no} onChange={(e) => setMeta({ ...meta, table_no: e.target.value })} />
            </div>
          </div>
          {link.reservation_id ? (
            <div className="flex items-center justify-between bg-leaf/50 rounded-lg px-3 py-2 mb-2 text-sm">
              <span><b>{link.guest_name}</b> · Room {link.room_no}</span>
              <button className="text-red-500 text-xs font-semibold" onClick={() => setLink({ reservation_id: null, guest_name: '', room_no: '' })}>Unlink</button>
            </div>
          ) : (
            <div className="flex gap-2 mb-2">
              <button className="btn-ghost flex-1 justify-center !py-1.5 text-xs" onClick={() => setShowPicker(true)}><BedDouble size={14} /> Link in-house guest</button>
              <input className="input flex-1 !py-1.5 text-xs" placeholder="Walk-in name (optional)" value={link.guest_name} onChange={(e) => setLink({ ...link, guest_name: e.target.value })} />
            </div>
          )}
          <div className="max-h-64 overflow-auto divide-y divide-leaf/60">
            {cart.map((c, i) => (
              <div key={i} className="flex items-center gap-2 py-2">
                <div className="flex-1">
                  <div className="text-sm font-medium leading-tight">{c.item_name}</div>
                  <div className="text-xs text-pine/50 money">{fmtBDT(c.unit_price)} each</div>
                </div>
                <button className="w-6 h-6 rounded bg-leaf text-pine font-bold" onClick={() => bump(i, -1)}><Minus size={13} className="mx-auto" /></button>
                <span className="money w-7 text-center font-semibold">{c.qty}</span>
                <button className="w-6 h-6 rounded bg-forest text-white font-bold" onClick={() => bump(i, 1)}><Plus size={13} className="mx-auto" /></button>
                <span className="money w-20 text-right text-sm font-semibold">{(c.qty * c.unit_price).toFixed(2)}</span>
                <button className="text-red-300 hover:text-red-600" onClick={() => removeLine(i)}><Trash2 size={14} /></button>
              </div>
            ))}
            {cart.length === 0 && <p className="text-sm text-pine/50 py-4 text-center">Tap menu items to add them.</p>}
          </div>
          <div className="border-t border-leaf mt-2 pt-2 text-sm space-y-1 money">
            <div className="flex justify-between"><span>Subtotal</span><span>{t.base_amount.toFixed(2)}</span></div>
            <div className="flex justify-between items-center gap-2">
              <span className="flex items-center gap-1">
                <select className="input !w-20 !py-0.5 !px-1.5 text-xs" value={meta.discount_type} onChange={(e) => setMeta({ ...meta, discount_type: e.target.value, discount_value: 0 })}>
                  <option value="PERCENT">Discount %</option>
                  <option value="FIXED">Fixed ৳</option>
                </select>
              </span>
              <input type="number" min="0" step={meta.discount_type === 'PERCENT' ? '1' : '0.01'} className="input !w-20 !py-0.5 !px-2 text-xs" value={meta.discount_value} onChange={(e) => setMeta({ ...meta, discount_value: Number(e.target.value) || 0 })} />
              <span>− {discountAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between"><span>Service charge {rate.service_charge_pct}%</span><span>{t.service_charge.toFixed(2)}</span></div>
            {rate.sd_pct > 0 && <div className="flex justify-between"><span>SD {rate.sd_pct}%</span><span>{t.sd.toFixed(2)}</span></div>}
            <div className="flex justify-between"><span>VAT {rate.vat_pct}%</span><span>{t.vat.toFixed(2)}</span></div>
            {t.rounding !== undefined && t.rounding !== 0 && (<div className="flex justify-between text-xs text-pine/60"><span>Cash rounding {t.rounding > 0 ? '(+)' : '(−)'}</span><span>{t.rounding > 0 ? '+' : ''}{t.rounding.toFixed(2)}</span></div>)}
            <div className="flex justify-between font-bold text-base border-t border-pine/20 pt-1"><span>Total</span><span>{fmtBDT(t.total)}</span></div>
          </div>
          <input className="input mt-2 text-xs" placeholder="Kitchen note (e.g. less spicy)" value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
        </div>
        <div className="card p-4 space-y-2">
          <div className="text-xs font-semibold text-pine mb-3">💳 Payments</div>
          <div className="space-y-2 max-h-48 overflow-auto">
            {PAYMENT_METHODS.map((method) => (
              <div key={method} className="flex gap-2 items-center">
                <label className="text-xs font-medium w-20">{method}</label>
                <input type="number" className="input flex-1 !py-1.5 text-xs money" placeholder="0.00" value={payments[method]} onChange={(e) => setPayments({ ...payments, [method]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="border-t border-leaf pt-2 text-xs font-semibold text-forest">
            Total Paid: {fmtBDT(Object.values(payments).reduce((a, v) => a + (Number(v) || 0), 0))}
          </div>
          <button className="btn-primary w-full justify-center" onClick={payNow} disabled={busy}><Banknote size={16} /> Pay now</button>
          <button className="btn-amber w-full justify-center" onClick={chargeToRoom} disabled={busy || !link.reservation_id}><BedDouble size={16} /> Charge to room</button>
          <button className="btn-ghost w-full justify-center" onClick={generateKOT} disabled={busy}><ChefHat size={16} /> Generate KOT</button>
        </div>
      </div>
      {showPicker && <GuestPicker close={() => setShowPicker(false)} pick={(g) => { setLink(g); setShowPicker(false) }} />}
    </div>
  )
}

function OrdersList({ company, flash, resumeOrder, setPrintDoc, isAdmin, userName }) {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('TODAY')

  const load = async () => {
    let qy = supabase.from('pos_orders').select('*').order('created_at', { ascending: false }).limit(200)
    if (filter === 'TODAY') qy = qy.gte('created_at', `${todayISO()}T00:00:00+06:00`)
    if (filter === 'OPEN') qy = qy.eq('status', 'OPEN')
    const { data } = await qy
    setRows(data || [])
  }
  useEffect(() => { load() }, [filter])

  const sumBy = (st) => rows.filter((r) => r.status === st).reduce((a, r) => a + Number(r.total), 0)
  const canEdit = (order) => { return (isAdmin || userName === 'Manager') ? true : order.status !== 'SETTLED' }
  const printReceipt = async (o) => {
    const { data: oi } = await supabase.from('pos_order_items').select('*').eq('order_id', o.id)
    setPrintDoc({ type: 'RECEIPT', order: o, items: oi || [], mushakNo: null })
  }
  const printKot = async (o) => {
    const { data: oi } = await supabase.from('pos_order_items').select('*').eq('order_id', o.id)
    setPrintDoc({ type: 'KOT', order: o, items: oi || [] })
  }
  const printMushak = async (o) => {
    const { data: inv } = await supabase.from('invoices').select('*').eq('id', o.invoice_id).single()
    if (inv) setPrintDoc({ type: 'MUSHAK', invoice: inv, refNo: o.order_no })
  }
  const cancel = async (o) => {
    await supabase.from('pos_orders').update({ status: 'CANCELLED' }).eq('id', o.id)
    flash(`${o.order_no} cancelled.`); load()
  }
  const voidOrder = async (o) => {
    if (o.folio_charge_id) await supabase.from('folio_charges').delete().eq('id', o.folio_charge_id)
    if (o.reservation_id) await supabase.from('payments').delete().eq('reservation_id', o.reservation_id).eq('reference', o.order_no)
    if (o.invoice_id) await supabase.from('invoices').delete().eq('id', o.invoice_id)
    await supabase.from('pos_orders').update({ status: 'CANCELLED', notes: ((o.notes || '') + ' [VOIDED by admin]').trim() }).eq('id', o.id)
    flash(`${o.order_no} voided — folio charge, payment and Mushak entry reversed.`); load()
  }

  const chip = { OPEN: 'bg-amber/20 text-amber', SETTLED: 'bg-forest/15 text-forest', CHARGED_TO_ROOM: 'bg-pine/15 text-pine', CANCELLED: 'bg-red-100 text-red-600' }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-4"><div className="label">Settled (in view)</div><div className="font-display text-xl font-bold text-forest money">{fmtBDT(sumBy('SETTLED'))}</div></div>
        <div className="card p-4"><div className="label">Charged to rooms</div><div className="font-display text-xl font-bold text-pine money">{fmtBDT(sumBy('CHARGED_TO_ROOM'))}</div></div>
        <div className="card p-4"><div className="label">Open orders</div><div className="font-display text-xl font-bold text-amber money">{rows.filter((r) => r.status === 'OPEN').length}</div></div>
      </div>
      <div className="flex gap-2 mb-3">
        {['TODAY', 'OPEN', 'ALL'].map((f) => (<button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === f ? 'bg-pine text-white' : 'bg-white border border-leaf text-pine/70'}`}>{f}</button>))}
        <button className="btn-ghost !py-1 ml-auto" onClick={load}><RotateCcw size={13} /> Refresh</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Order</th>
              <th className="th">Time</th>
              <th className="th">Total</th>
              <th className="th">Status</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="hover:bg-leaf/20">
                <td className="td font-semibold">{o.order_no}</td>
                <td className="td">{fmtDate(o.created_at)}</td>
                <td className="td money">{Number(o.total).toFixed(2)}</td>
                <td className="td"><span className={`status-chip ${chip[o.status] || 'bg-stone-100 text-stone-600'}`}>{o.status}</span></td>
                <td className="td text-right">
                  <div className="flex justify-end gap-2">
                    <button className="btn-ghost !py-1 !px-2 text-forest" onClick={() => printReceipt(o)} title="Print receipt"><Receipt size={14} /></button>
                    {(o.status === 'OPEN' || o.status === 'CHARGED_TO_ROOM') && (<button className="btn-ghost !py-1 !px-2 text-amber" onClick={() => printKot(o)} title="Print KOT"><ChefHat size={14} /></button>)}
                    {o.invoice_id && (<button className="btn-ghost !py-1 !px-2 text-pine" onClick={() => printMushak(o)} title="Print Mushak-6.3"><FileText size={14} /></button>)}
                    {canEdit(o) && (<button className="btn-ghost !py-1 !px-2 text-forest" onClick={() => resumeOrder(o)} title="Edit order">Edit</button>)}
                    {isAdmin && o.status === 'SETTLED' && (<button className="btn-ghost !py-1 !px-2 text-red-500" onClick={() => voidOrder(o)} title="Void order"><XCircle size={14} /></button>)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MenuManager({ cats, items, reload, isAdmin }) {
  const [nc, setNc] = useState('')
  const [ni, setNi] = useState({ category_id: '', name: '', price: '' })

  const addCat = async () => {
    if (!nc.trim()) return
    await supabase.from('menu_categories').insert({ name: nc.trim(), sort_order: cats.length + 1 })
    setNc(''); reload()
  }
  const toggleCat = async (c) => { await supabase.from('menu_categories').update({ is_active: !c.is_active }).eq('id', c.id); reload() }
  const addItem = async () => {
    if (!ni.name.trim() || ni.price === '' || !ni.category_id) return
    await supabase.from('menu_items').insert({ category_id: ni.category_id, name: ni.name.trim(), price: +ni.price })
    setNi({ category_id: ni.category_id, name: '', price: '' }); reload()
  }
  const updatePrice = async (it, price) => {
    if (price === '' || +price === +it.price) return
    await supabase.from('menu_items').update({ price: +price }).eq('id', it.id); reload()
  }
  const toggleItem = async (it) => { await supabase.from('menu_items').update({ is_active: !it.is_active }).eq('id', it.id); reload() }
  const delItem = async (it) => { await supabase.from('menu_items').delete().eq('id', it.id); reload() }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="card p-5">
        <h3 className="font-display font-semibold text-pine mb-3">Categories</h3>
        {isAdmin ? (
          <div className="flex gap-2 mb-3">
            <input className="input flex-1" placeholder="New category" value={nc} onChange={(e) => setNc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCat()} />
            <button className="btn-primary" onClick={addCat}><Plus size={15} /></button>
          </div>
        ) : (
          <p className="text-xs text-pine/50 mb-3">Menu changes require administrator access.</p>
        )}
        {cats.map((c) => (
          <div key={c.id} className="flex justify-between items-center py-1.5 border-b border-leaf/60 text-sm">
            <span className="font-medium">{c.name}</span>
            <button onClick={() => isAdmin && toggleCat(c)} disabled={!isAdmin} className={`status-chip ${c.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-600'} ${!isAdmin ? 'cursor-default' : ''}`}>{c.is_active ? 'ACTIVE' : 'OFF'}</button>
          </div>
        ))}
      </div>
      <div className="card p-5 lg:col-span-2">
        <h3 className="font-display font-semibold text-pine mb-3">Menu items</h3>
        {!isAdmin && <p className="text-xs text-pine/50 mb-3">Read-only — ask an administrator to change items or prices.</p>}
        {isAdmin && <div className="grid grid-cols-4 gap-2 mb-4 items-end">
          <div><label className="label">Category</label><select className="input" value={ni.category_id} onChange={(e) => setNi({ ...ni, category_id: e.target.value })}><option value="">Select…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="label">Item name</label><input className="input" value={ni.name} onChange={(e) => setNi({ ...ni, name: e.target.value })} /></div>
          <div><label className="label">Price ৳</label><input type="number" className="input money" value={ni.price} onChange={(e) => setNi({ ...ni, price: e.target.value })} /></div>
          <button className="btn-primary justify-center" onClick={addItem}><Plus size={15} /> Add item</button>
        </div>}
        <table className="w-full">
          <thead><tr><th className="th">Item</th><th className="th">Category</th><th className="th text-right">Price (editable)</th><th className="th">Status</th><th className="th"></th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td className="td font-medium text-sm">{it.name}</td>
                <td className="td text-xs text-pine/60">{cats.find((c) => c.id === it.category_id)?.name || '—'}</td>
                <td className="td text-right">{isAdmin ? (<input type="number" defaultValue={it.price} onBlur={(e) => updatePrice(it, e.target.value)} className="input !w-28 !py-1 money text-right inline-block" />) : (<span className="money">{Number(it.price).toFixed(2)}</span>)}</td>
                <td className="td"><button onClick={() => isAdmin && toggleItem(it)} disabled={!isAdmin} className={`status-chip ${it.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-600'} ${!isAdmin ? 'cursor-default' : ''}`}>{it.is_active ? 'ACTIVE' : 'OFF'}</button></td>
                <td className="td text-right">{isAdmin && <button onClick={() => delItem(it)} className="text-red-300 hover:text-red-600"><Trash2 size={14} /></button>}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td className="td text-pine/50" colSpan={5}>No items yet — add your menu above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DayClose({ flash, isAdmin, userName }) {
  const [day, setDay] = useState(todayISO())
  const [restOrders, setRestOrders] = useState([])
  const [resOrders, setResOrders] = useState([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const dayStart = `${day}T00:00:00+06:00`
    const dayEnd = `${day}T23:59:59+06:00`
    const { data: rest } = await supabase.from('pos_orders').select('*').is('reservation_id', true).gte('created_at', dayStart).lte('created_at', dayEnd)
    const { data: res } = await supabase.from('pos_orders').select('*').not('reservation_id', 'is', null).gte('created_at', dayStart).lte('created_at', dayEnd)
    setRestOrders(rest || [])
    setResOrders(res || [])
  }
  useEffect(() => { load() }, [day])

  const calcTotal = (orders, status = null) => {
    return orders.filter((o) => !status || o.status === status).reduce((a, o) => a + Number(o.total), 0)
  }

  const closeDay = async () => {
    if (!isAdmin) { flash('Only administrators can close the day.'); return }
    setBusy(true)
    try {
      const closeData = { close_date: day, closed_by: userName, closed_at: new Date().toISOString() }
      const restTotal = calcTotal(restOrders, 'SETTLED')
      const { error: rError } = await supabase.from('day_closes').insert({ ...closeData, type: 'RESTAURANT', settled_amount: restTotal, settled_orders: restOrders.filter((o) => o.status === 'SETTLED').length })
      if (rError) throw rError
      const resTotal = calcTotal(resOrders, 'CHARGED_TO_ROOM')
      const { error: resError } = await supabase.from('day_closes').insert({ ...closeData, type: 'RESERVATION', charged_amount: resTotal, charged_orders: resOrders.filter((o) => o.status === 'CHARGED_TO_ROOM').length })
      if (resError) throw resError
      flash(`Day closed for ${day} — Restaurant ৳${restTotal.toFixed(2)} + Reservation ৳${resTotal.toFixed(2)}`)
      setShowConfirm(false)
      load()
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <label className="text-sm font-medium">Close date:</label>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="input" />
        <button className="btn-ghost !py-1" onClick={load}><RotateCcw size={14} /> Refresh</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-display font-semibold text-forest mb-3 flex items-center gap-2"><Receipt size={18} /> Restaurant Orders (Walk-in)</h3>
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between"><span>Total settled:</span><span className="font-bold money">{fmtBDT(calcTotal(restOrders, 'SETTLED'))}</span></div>
            <div className="flex justify-between"><span>Settled orders:</span><span>{restOrders.filter((o) => o.status === 'SETTLED').length}</span></div>
            <div className="flex justify-between"><span>Open orders:</span><span className="text-amber">{restOrders.filter((o) => o.status === 'OPEN').length}</span></div>
          </div>
          <div className="max-h-64 overflow-auto space-y-1">
            {restOrders.map((o) => (
              <div key={o.id} className="flex justify-between text-xs py-1 border-b border-leaf/30">
                <span className="font-medium">{o.order_no}</span>
                <span className="money">{Number(o.total).toFixed(2)}</span>
                <span className={`status-chip text-xs ${o.status === 'SETTLED' ? 'bg-forest/15 text-forest' : 'bg-amber/20 text-amber'}`}>{o.status}</span>
              </div>
            ))}
            {restOrders.length === 0 && <p className="text-xs text-pine/50 py-4">No orders for this day.</p>}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-display font-semibold text-pine mb-3 flex items-center gap-2"><BedDouble size={18} /> Reservation Orders (In-house)</h3>
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between"><span>Total charged to room:</span><span className="font-bold money">{fmtBDT(calcTotal(resOrders, 'CHARGED_TO_ROOM'))}</span></div>
            <div className="flex justify-between"><span>Charged orders:</span><span>{resOrders.filter((o) => o.status === 'CHARGED_TO_ROOM').length}</span></div>
            <div className="flex justify-between"><span>Settled (paid instantly):</span><span className="text-forest">{resOrders.filter((o) => o.status === 'SETTLED').length}</span></div>
          </div>
          <div className="max-h-64 overflow-auto space-y-1">
            {resOrders.map((o) => (
              <div key={o.id} className="flex justify-between text-xs py-1 border-b border-leaf/30">
                <span className="font-medium">{o.order_no}</span>
                <span className="money">{Number(o.total).toFixed(2)}</span>
                <span className={`status-chip text-xs ${o.status === 'CHARGED_TO_ROOM' ? 'bg-pine/15 text-pine' : 'bg-forest/15 text-forest'}`}>{o.status}</span>
              </div>
            ))}
            {resOrders.length === 0 && <p className="text-xs text-pine/50 py-4">No orders for this day.</p>}
          </div>
        </div>
      </div>
      {isAdmin && (
        <div className="card p-5 bg-amber/5 border border-amber/20">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-amber">Close Day</h3>
              <p className="text-xs text-pine/60 mt-1">This will create a day close record for both Restaurant and Reservation. Cannot be undone.</p>
            </div>
            <button className="btn-amber" onClick={() => setShowConfirm(true)} disabled={busy}><Clock size={16} /> Close {day}</button>
          </div>
          {showConfirm && (
            <div className="mt-4 p-3 bg-white rounded border border-amber flex gap-3 items-center">
              <p className="text-sm flex-1">
                <span className="font-bold">Restaurant:</span> {fmtBDT(calcTotal(restOrders, 'SETTLED'))} settled<br />
                <span className="font-bold">Reservation:</span> {fmtBDT(calcTotal(resOrders, 'CHARGED_TO_ROOM'))} charged to room
              </p>
              <button className="btn-primary !py-1" onClick={closeDay} disabled={busy}>Confirm</button>
              <button className="btn-ghost !py-1" onClick={() => setShowConfirm(false)} disabled={busy}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
