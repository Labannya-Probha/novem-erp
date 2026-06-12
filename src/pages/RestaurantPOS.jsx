import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, rateFor, computeCharge } from '../lib/helpers'
import PrintPortal from '../components/PrintPortal.jsx'
import { PosReceipt, KitchenTicket } from '../components/print/PosDocs.jsx'
import Mushak63 from '../components/print/Mushak63.jsx'
import {
  Plus, Minus, Trash2, Printer, ChefHat, Banknote, BedDouble,
  Search, Save, XCircle, RotateCcw, Receipt,
} from 'lucide-react'

const TABS = ['New Order', 'Orders', 'Menu']

export default function RestaurantPOS({ userName }) {
  const [tab, setTab] = useState('New Order')
  const [taxConfig, setTaxConfig] = useState([])
  const [company, setCompany] = useState(null)
  const [cats, setCats] = useState([])
  const [items, setItems] = useState([])
  const [editOrder, setEditOrder] = useState(null) // {order, items} when resuming an OPEN order
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

      <div className="flex gap-1 border-b border-leaf mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); if (t !== 'New Order') setEditOrder(null) }}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${tab === t ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'New Order' && (
        <OrderBuilder key={editOrder?.order?.id || 'new'} cats={cats} items={items} taxConfig={taxConfig}
          userName={userName} existing={editOrder} flash={flash}
          onDone={(doc) => { setEditOrder(null); if (doc) setPrintDoc(doc); setTab('Orders') }} />
      )}
      {tab === 'Orders' && <OrdersList company={company} flash={flash} resumeOrder={resumeOrder} setPrintDoc={setPrintDoc} />}
      {tab === 'Menu' && <MenuManager cats={cats} items={items} reload={loadMenu} />}

      {printDoc?.type === 'RECEIPT' && (
        <PrintPortal title={`Restaurant Bill — ${printDoc.order.order_no}`} onClose={() => setPrintDoc(null)}>
          <PosReceipt order={printDoc.order} items={printDoc.items} company={company} mushakNo={printDoc.mushakNo} />
        </PrintPortal>
      )}
      {printDoc?.type === 'KOT' && (
        <PrintPortal title={`Kitchen Order — ${printDoc.order.order_no}`} onClose={() => setPrintDoc(null)}>
          <KitchenTicket order={printDoc.order} items={printDoc.items} />
        </PrintPortal>
      )}
      {printDoc?.type === 'MUSHAK' && (
        <PrintPortal title={`Mushak-6.3 — ${printDoc.invoice.invoice_no}`} onClose={() => setPrintDoc(null)}>
          <Mushak63 invoice={printDoc.invoice} res={null} company={company} refNo={printDoc.refNo} />
        </PrintPortal>
      )}
    </div>
  )
}

/* ================= ORDER BUILDER ================= */
function OrderBuilder({ cats, items, taxConfig, userName, existing, onDone, flash }) {
  const [cart, setCart] = useState(existing ? existing.items.map((i) => ({
    menu_item_id: i.menu_item_id, item_name: i.item_name, qty: Number(i.qty), unit_price: Number(i.unit_price),
  })) : [])
  const [meta, setMeta] = useState(existing ? {
    order_type: existing.order.order_type, table_no: existing.order.table_no || '',
    discount_pct: Number(existing.order.discount_pct), notes: existing.order.notes || '',
  } : { order_type: 'DINE_IN', table_no: '', discount_pct: 0, notes: '' })
  const [link, setLink] = useState(existing ? {
    reservation_id: existing.order.reservation_id, guest_name: existing.order.guest_name || '', room_no: existing.order.room_no || '',
  } : { reservation_id: null, guest_name: '', room_no: '' })
  const [activeCat, setActiveCat] = useState('ALL')
  const [payMethod, setPayMethod] = useState('CASH')
  const [issueMushak, setIssueMushak] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [busy, setBusy] = useState(false)

  const rate = rateFor(taxConfig, 'RESTAURANT', todayISO())
  const subtotal = cart.reduce((a, c) => a + c.qty * c.unit_price, 0)
  const t = computeCharge(subtotal, meta.discount_pct, rate)

  const addItem = (mi) => {
    setCart((prev) => {
      const f = prev.find((c) => c.menu_item_id === mi.id)
      if (f) return prev.map((c) => (c.menu_item_id === mi.id ? { ...c, qty: c.qty + 1 } : c))
      return [...prev, { menu_item_id: mi.id, item_name: mi.name, qty: 1, unit_price: Number(mi.price) }]
    })
  }
  const bump = (idx, d) => setCart((prev) => prev
    .map((c, i) => (i === idx ? { ...c, qty: Math.max(0, c.qty + d) } : c))
    .filter((c) => c.qty > 0))
  const removeLine = (idx) => setCart((prev) => prev.filter((_, i) => i !== idx))

  const visible = items.filter((i) => i.is_active && (activeCat === 'ALL' || i.category_id === activeCat))

  // Proportionally allocate order-level tax components across lines (for the Mushak snapshot)
  const allocate = () => {
    const lines = cart.map((c) => ({ ...c, line_total: +(c.qty * c.unit_price).toFixed(2) }))
    const keys = ['discount', 'service_charge', 'sd', 'vat']
    const out = lines.map((l) => {
      const ratio = subtotal > 0 ? l.line_total / subtotal : 0
      const o = {
        charge_date: todayISO(), charge_type: 'RESTAURANT',
        description: `${l.item_name} × ${l.qty}`, base_amount: l.line_total, status: 'PAID',
      }
      keys.forEach((k) => { o[k] = +(t[k] * ratio).toFixed(2) })
      return o
    })
    // last line absorbs rounding differences
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
    const payload = {
      order_type: meta.order_type, table_no: meta.table_no || null, notes: meta.notes || null,
      reservation_id: link.reservation_id, guest_name: link.guest_name || null, room_no: link.room_no || null,
      discount_pct: +meta.discount_pct,
      base_amount: t.base_amount, discount: t.discount, service_charge: t.service_charge,
      sd: t.sd, vat: t.vat, total: t.total, created_by: userName, ...statusFields,
    }
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
    const lineRows = cart.map((c) => ({
      order_id: order.id, menu_item_id: c.menu_item_id, item_name: c.item_name,
      qty: c.qty, unit_price: c.unit_price, line_total: +(c.qty * c.unit_price).toFixed(2),
    }))
    const { data: savedItems, error: ie } = await supabase.from('pos_order_items').insert(lineRows).select()
    if (ie) throw ie
    return { order, items: savedItems }
  }

  const guard = () => {
    if (cart.length === 0) { flash('Add at least one item to the order.'); return false }
    return true
  }

  const saveOpen = async () => {
    if (!guard()) return
    setBusy(true)
    try {
      const { order, items: oi } = await persist({ status: 'OPEN' })
      onDone({ type: 'KOT', order, items: oi })
      flash(`${order.order_no} saved as open order — KOT ready for the kitchen.`)
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  const payNow = async () => {
    if (!guard()) return
    setBusy(true)
    try {
      const settled = { status: 'SETTLED', payment_method: payMethod, settled_at: new Date().toISOString() }
      const { order, items: oi } = await persist(settled)
      let mushakNo = null
      if (order.reservation_id) {
        // In-house guest paying instantly → billing history line (PAID) + payment record (req. 6 & 7)
        const { data: fc, error: fe } = await supabase.from('folio_charges').insert({
          reservation_id: order.reservation_id, charge_date: todayISO(), charge_type: 'RESTAURANT',
          description: `Restaurant ${order.order_no}${order.table_no ? ' · Table ' + order.table_no : ''}`,
          base_amount: t.base_amount, discount: t.discount, service_charge: t.service_charge,
          sd: t.sd, vat: t.vat, total: t.total, status: 'PAID', created_by: userName,
        }).select().single()
        if (fe) throw fe
        const { error: pe } = await supabase.from('payments').insert({
          reservation_id: order.reservation_id, received_date: todayISO(), amount: t.total,
          method: payMethod, reference: order.order_no, received_by: userName, notes: 'Restaurant POS',
        })
        if (pe) throw pe
        await supabase.from('pos_orders').update({ folio_charge_id: fc.id }).eq('id', order.id)
      } else if (issueMushak) {
        // Walk-in sale → its own Mushak-6.3, enters the 6.2 register now
        const { data: inv, error: ve } = await supabase.from('invoices').insert({
          invoice_type: 'MUSHAK_63', pos_order_id: order.id,
          buyer_name: order.guest_name || 'Walk-in Customer', buyer_address: '', buyer_bin: '',
          totals: {
            base: t.base_amount, discount: t.discount, taxable_value: +(t.base_amount - t.discount).toFixed(2),
            service_charge: t.service_charge, sd: t.sd, vat: t.vat,
            grand_total: t.total, paid: t.total, due: 0,
          },
          line_snapshot: allocate(), created_by: userName,
        }).select().single()
        if (ve) throw ve
        mushakNo = inv.invoice_no
        await supabase.from('pos_orders').update({ invoice_id: inv.id }).eq('id', order.id)
      }
      onDone({ type: 'RECEIPT', order: { ...order, status: 'SETTLED', payment_method: payMethod }, items: oi, mushakNo })
      flash(`${order.order_no} settled — ${payMethod}.${mushakNo ? ` Mushak-6.3 ${mushakNo} issued.` : ''}`)
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  const chargeToRoom = async () => {
    if (!guard()) return
    if (!link.reservation_id) { flash('Link an in-house guest first to charge to room.'); return }
    setBusy(true)
    try {
      const { order, items: oi } = await persist({ status: 'CHARGED_TO_ROOM' })
      const { data: fc, error: fe } = await supabase.from('folio_charges').insert({
        reservation_id: order.reservation_id, charge_date: todayISO(), charge_type: 'RESTAURANT',
        description: `Restaurant ${order.order_no}${order.table_no ? ' · Table ' + order.table_no : ''}`,
        base_amount: t.base_amount, discount: t.discount, service_charge: t.service_charge,
        sd: t.sd, vat: t.vat, total: t.total, status: 'DUE', created_by: userName,
      }).select().single()
      if (fe) throw fe
      await supabase.from('pos_orders').update({ folio_charge_id: fc.id }).eq('id', order.id)
      onDone({ type: 'RECEIPT', order: { ...order, status: 'CHARGED_TO_ROOM' }, items: oi })
      flash(`${order.order_no} charged to Room ${order.room_no} as DUE — settles at check-out.`)
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      {/* Menu grid */}
      <div className="xl:col-span-3">
        <div className="flex gap-2 mb-3 flex-wrap">
          <button onClick={() => setActiveCat('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${activeCat === 'ALL' ? 'bg-pine text-white' : 'bg-white border border-leaf text-pine/70'}`}>All</button>
          {cats.filter((c) => c.is_active).map((c) => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${activeCat === c.id ? 'bg-pine text-white' : 'bg-white border border-leaf text-pine/70'}`}>{c.name}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {visible.map((mi) => (
            <button key={mi.id} onClick={() => addItem(mi)}
              className="card p-3 text-left hover:border-forest hover:shadow transition-all active:scale-[0.98]">
              <div className="font-semibold text-sm leading-tight">{mi.name}</div>
              <div className="money text-forest text-sm mt-1">{fmtBDT(mi.price)}</div>
            </button>
          ))}
          {visible.length === 0 && (
            <div className="col-span-full card p-6 text-center text-sm text-pine/50">
              No menu items yet — add your dishes in the <b>Menu</b> tab.
            </div>
          )}
        </div>
      </div>

      {/* Order ticket */}
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
              <button className="btn-ghost flex-1 justify-center !py-1.5 text-xs" onClick={() => setShowPicker(true)}>
                <BedDouble size={14} /> Link in-house guest
              </button>
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
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">Discount %
                <input type="number" min="0" max="100" className="input !w-16 !py-0.5 !px-2 text-xs" value={meta.discount_pct} onChange={(e) => setMeta({ ...meta, discount_pct: e.target.value })} />
              </span>
              <span>− {t.discount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between"><span>Service charge {rate.service_charge_pct}%</span><span>{t.service_charge.toFixed(2)}</span></div>
            {rate.sd_pct > 0 && <div className="flex justify-between"><span>SD {rate.sd_pct}%</span><span>{t.sd.toFixed(2)}</span></div>}
            <div className="flex justify-between"><span>VAT {rate.vat_pct}%</span><span>{t.vat.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-pine/20 pt-1"><span>Total</span><span>{fmtBDT(t.total)}</span></div>
          </div>

          <input className="input mt-2 text-xs" placeholder="Kitchen note (e.g. less spicy)" value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
        </div>

        <div className="card p-4 space-y-2">
          <div className="flex gap-2">
            <select className="input !w-32" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {['CASH', 'BKASH', 'NAGAD', 'CARD', 'BANK', 'OTHER'].map((m) => <option key={m}>{m}</option>)}
            </select>
            <button className="btn-primary flex-1 justify-center" onClick={payNow} disabled={busy}>
              <Banknote size={16} /> Pay now
            </button>
          </div>
          {!link.reservation_id && (
            <label className="flex items-center gap-2 text-xs text-pine/70">
              <input type="checkbox" checked={issueMushak} onChange={(e) => setIssueMushak(e.target.checked)} />
              Issue Mushak-6.3 for this walk-in sale (recommended — feeds the 6.2 register)
            </label>
          )}
          <button className="btn-amber w-full justify-center" onClick={chargeToRoom} disabled={busy || !link.reservation_id}>
            <BedDouble size={16} /> Charge to room (DUE — settles at check-out)
          </button>
          <button className="btn-ghost w-full justify-center" onClick={saveOpen} disabled={busy}>
            <ChefHat size={16} /> Save open order & print KOT
          </button>
        </div>
      </div>

      {showPicker && <GuestPicker close={() => setShowPicker(false)} pick={(g) => { setLink(g); setShowPicker(false) }} />}
    </div>
  )
}

/* ---------- In-house guest picker ---------- */
function GuestPicker({ close, pick }) {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  useEffect(() => {
    supabase.from('reservations')
      .select('id,res_no,reservation_name, guests:primary_guest_id(full_name), reservation_rooms(rooms(room_no))')
      .eq('status', 'CHECKED_IN')
      .then(({ data }) => setRows(data || []))
  }, [])
  const filtered = rows.filter((r) => {
    const roomStr = (r.reservation_rooms || []).map((x) => x.rooms?.room_no).join(', ')
    return !q || [r.res_no, r.reservation_name, r.guests?.full_name, roomStr].join(' ').toLowerCase().includes(q.toLowerCase())
  })
  return (
    <div className="fixed inset-0 bg-ink/60 z-40 flex items-start justify-center p-6 overflow-auto">
      <div className="card max-w-lg w-full p-5 my-10">
        <h3 className="font-display font-semibold text-pine mb-3">In-house guests (checked-in)</h3>
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-2.5 text-pine/40" />
          <input className="input pl-9" autoFocus placeholder="Search guest or room no…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="max-h-72 overflow-auto space-y-2">
          {filtered.map((r) => {
            const roomStr = (r.reservation_rooms || []).map((x) => x.rooms?.room_no).join(', ')
            const name = r.guests?.full_name || r.reservation_name
            return (
              <button key={r.id} onClick={() => pick({ reservation_id: r.id, guest_name: name, room_no: roomStr })}
                className="w-full flex justify-between items-center p-3 rounded-lg border border-leaf hover:bg-leaf/40 text-left">
                <span className="font-semibold text-sm">{name}</span>
                <span className="text-xs text-pine/60 money">Room {roomStr || '—'} · {r.res_no}</span>
              </button>
            )
          })}
          {filtered.length === 0 && <p className="text-sm text-pine/50 text-center py-4">No checked-in guests found.</p>}
        </div>
        <div className="flex justify-end mt-3"><button className="btn-ghost" onClick={close}>Close</button></div>
      </div>
    </div>
  )
}

/* ================= ORDERS LIST ================= */
function OrdersList({ company, flash, resumeOrder, setPrintDoc }) {
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

  const today = rows.filter((r) => r.created_at >= `${todayISO()}T00:00:00`)
  const sumBy = (st) => rows.filter((r) => r.status === st).reduce((a, r) => a + Number(r.total), 0)

  const withItems = async (order) => {
    const { data } = await supabase.from('pos_order_items').select('*').eq('order_id', order.id)
    return data || []
  }
  const printReceipt = async (o) => setPrintDoc({ type: 'RECEIPT', order: o, items: await withItems(o), mushakNo: null })
  const printKot = async (o) => setPrintDoc({ type: 'KOT', order: o, items: await withItems(o) })
  const printMushak = async (o) => {
    const { data: inv } = await supabase.from('invoices').select('*').eq('id', o.invoice_id).single()
    if (inv) setPrintDoc({ type: 'MUSHAK', invoice: inv, refNo: o.order_no })
  }
  const cancel = async (o) => {
    await supabase.from('pos_orders').update({ status: 'CANCELLED' }).eq('id', o.id)
    flash(`${o.order_no} cancelled.`); load()
  }

  const chip = {
    OPEN: 'bg-amber/20 text-amber', SETTLED: 'bg-forest/15 text-forest',
    CHARGED_TO_ROOM: 'bg-pine/15 text-pine', CANCELLED: 'bg-red-100 text-red-600',
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-4"><div className="label">Settled (in view)</div><div className="font-display text-xl font-bold text-forest money">{fmtBDT(sumBy('SETTLED'))}</div></div>
        <div className="card p-4"><div className="label">Charged to rooms</div><div className="font-display text-xl font-bold text-pine money">{fmtBDT(sumBy('CHARGED_TO_ROOM'))}</div></div>
        <div className="card p-4"><div className="label">Open orders</div><div className="font-display text-xl font-bold text-amber money">{rows.filter((r) => r.status === 'OPEN').length}</div></div>
      </div>

      <div className="flex gap-2 mb-3">
        {['TODAY', 'OPEN', 'ALL'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === f ? 'bg-pine text-white' : 'bg-white border border-leaf text-pine/70'}`}>{f}</button>
        ))}
        <button className="btn-ghost !py-1 ml-auto" onClick={load}><RotateCcw size={13} /> Refresh</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr>
            <th className="th">Order</th><th className="th">Time</th><th className="th">Type / Table</th>
            <th className="th">Guest / Room</th><th className="th text-right">Total</th><th className="th">Status</th><th className="th text-right">Actions</th>
          </tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="hover:bg-leaf/20">
                <td className="td money font-semibold">{o.order_no}</td>
                <td className="td money text-xs">{fmtDate(o.created_at)}</td>
                <td className="td text-xs">{o.order_type.replace('_', ' ')}{o.table_no ? ` · T${o.table_no}` : ''}</td>
                <td className="td text-sm">{o.guest_name || '—'}{o.room_no ? <span className="text-xs text-pine/50"> · Rm {o.room_no}</span> : ''}</td>
                <td className="td money text-right font-semibold">{Number(o.total).toFixed(2)}</td>
                <td className="td"><span className={`status-chip ${chip[o.status]}`}>{o.status.replace(/_/g, ' ')}</span></td>
                <td className="td">
                  <div className="flex justify-end gap-1.5">
                    {o.status === 'OPEN' && <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => resumeOrder(o)}>Resume</button>}
                    <button className="btn-ghost !py-1 !px-2" title="Bill" onClick={() => printReceipt(o)}><Receipt size={13} /></button>
                    <button className="btn-ghost !py-1 !px-2" title="KOT" onClick={() => printKot(o)}><ChefHat size={13} /></button>
                    {o.invoice_id && <button className="btn-ghost !py-1 !px-2" title="Mushak-6.3" onClick={() => printMushak(o)}><Printer size={13} /></button>}
                    {o.status === 'OPEN' && <button className="btn-ghost !py-1 !px-2 text-red-500" title="Cancel" onClick={() => cancel(o)}><XCircle size={13} /></button>}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-pine/50" colSpan={7}>No orders in this view yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ================= MENU MANAGER ================= */
function MenuManager({ cats, items, reload }) {
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
        <div className="flex gap-2 mb-3">
          <input className="input flex-1" placeholder="New category" value={nc} onChange={(e) => setNc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCat()} />
          <button className="btn-primary" onClick={addCat}><Plus size={15} /></button>
        </div>
        {cats.map((c) => (
          <div key={c.id} className="flex justify-between items-center py-1.5 border-b border-leaf/60 text-sm">
            <span className="font-medium">{c.name}</span>
            <button onClick={() => toggleCat(c)} className={`status-chip ${c.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-600'}`}>
              {c.is_active ? 'ACTIVE' : 'OFF'}
            </button>
          </div>
        ))}
      </div>

      <div className="card p-5 lg:col-span-2">
        <h3 className="font-display font-semibold text-pine mb-3">Menu items</h3>
        <div className="grid grid-cols-4 gap-2 mb-4 items-end">
          <div><label className="label">Category</label>
            <select className="input" value={ni.category_id} onChange={(e) => setNi({ ...ni, category_id: e.target.value })}>
              <option value="">Select…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="label">Item name</label><input className="input" value={ni.name} onChange={(e) => setNi({ ...ni, name: e.target.value })} /></div>
          <div><label className="label">Price ৳</label><input type="number" className="input money" value={ni.price} onChange={(e) => setNi({ ...ni, price: e.target.value })} /></div>
          <button className="btn-primary justify-center" onClick={addItem}><Plus size={15} /> Add item</button>
        </div>
        <table className="w-full">
          <thead><tr><th className="th">Item</th><th className="th">Category</th><th className="th text-right">Price (editable)</th><th className="th">Status</th><th className="th"></th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td className="td font-medium text-sm">{it.name}</td>
                <td className="td text-xs text-pine/60">{cats.find((c) => c.id === it.category_id)?.name || '—'}</td>
                <td className="td text-right">
                  <input type="number" defaultValue={it.price} onBlur={(e) => updatePrice(it, e.target.value)}
                    className="input !w-28 !py-1 money text-right inline-block" />
                </td>
                <td className="td">
                  <button onClick={() => toggleItem(it)} className={`status-chip ${it.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-600'}`}>
                    {it.is_active ? 'ACTIVE' : 'OFF'}
                  </button>
                </td>
                <td className="td text-right"><button onClick={() => delItem(it)} className="text-red-300 hover:text-red-600"><Trash2 size={14} /></button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td className="td text-pine/50" colSpan={5}>No items yet — add your menu above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
