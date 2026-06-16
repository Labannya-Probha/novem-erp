import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, rateFor, computeCharge, applyRounding } from '../lib/helpers'
import PrintPortal from '../components/PrintPortal.jsx'
import { PosReceipt, KitchenTicket } from '../components/print/PosDocs.jsx'
import Mushak63 from '../components/print/Mushak63.jsx'
import GuestPicker from '../components/GuestPicker.jsx'
import {
  Plus, Minus, Trash2, Printer, ChefHat, Banknote, BedDouble,
  Search, Save, XCircle, RotateCcw, Receipt,
} from 'lucide-react'

const TABS = ['New Order', 'Orders', 'Menu']

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
      {tab === 'Orders' && <OrdersList company={company} flash={flash} resumeOrder={resumeOrder} setPrintDoc={setPrintDoc} isAdmin={isAdmin} userName={userName} />}
      {tab === 'Menu' && <MenuManager cats={cats} items={items} reload={loadMenu} isAdmin={isAdmin} />}

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
  
  // রাউন্ডিং লজিক ও SD রিমুভ (sd: 0) করা হয়েছে
  const rawTotal = computeCharge(subtotal, meta.discount_pct, rate)
  const t = applyRounding({ ...rawTotal, sd: 0 });

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

  const allocate = () => {
    const lines = cart.map((c) => ({ ...c, line_total: +(c.qty * c.unit_price).toFixed(2) }))
    const keys = ['discount', 'service_charge', 'vat'] // SD বাদ
    const out = lines.map((l) => {
      const ratio = subtotal > 0 ? l.line_total / subtotal : 0
      const o = {
        charge_date: todayISO(), charge_type: 'RESTAURANT',
        description: `${l.item_name} × ${l.qty}`, base_amount: l.line_total, status: 'PAID', sd: 0
      }
      keys.forEach((k) => { o[k] = +(t[k] * ratio).toFixed(2) })
      return o
    })
    return out
  }

  const persist = async (statusFields) => {
    const payload = {
      order_type: meta.order_type, table_no: meta.table_no || null, notes: meta.notes || null,
      reservation_id: link.reservation_id, guest_name: link.guest_name || null, room_no: link.room_no || null,
      discount_pct: +meta.discount_pct,
      base_amount: t.base_amount, discount: t.discount, service_charge: t.service_charge,
      sd: 0, vat: t.vat, total: t.total, created_by: userName, ...statusFields,
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
      flash(`${order.order_no} saved — KOT printed.`)
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  const payNow = async () => {
    if (!guard()) return
    setBusy(true)
    try {
      const settled = { status: 'SETTLED', payment_method: payMethod, settled_at: new Date().toISOString() }
      const { order, items: oi } = await persist(settled)
      onDone({ type: 'RECEIPT', order: { ...order, status: 'SETTLED' }, items: oi })
      flash(`${order.order_no} settled.`)
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  const chargeToRoom = async () => {
    if (!guard()) return
    if (!link.reservation_id) { flash('Link an in-house guest first.'); return }
    setBusy(true)
    try {
      const { order, items: oi } = await persist({ status: 'CHARGED_TO_ROOM' })
      onDone({ type: 'RECEIPT', order: { ...order, status: 'CHARGED_TO_ROOM' }, items: oi })
      flash(`${order.order_no} charged to room.`)
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
            <button key={mi.id} onClick={() => addItem(mi)} className="card p-3 text-left hover:border-forest hover:shadow">
              <div className="font-semibold text-sm">{mi.name}</div>
              <div className="money text-forest text-sm">{fmtBDT(mi.price)}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="xl:col-span-2 space-y-3">
        <div className="card p-4">
          <div className="border-t border-leaf mt-2 pt-2 text-sm money">
            <div className="flex justify-between"><span>Subtotal</span><span>{t.base_amount.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>VAT</span><span>{t.vat.toFixed(2)}</span></div>
            {!!t.rounding && (
                <div className="flex justify-between text-pine/60 italic text-xs">
                    <span>Rounding Adj.</span><span>{t.rounding > 0 ? '+' : ''}{t.rounding.toFixed(2)}</span>
                </div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>{fmtBDT(t.total)}</span></div>
          </div>
        </div>
        <div className="card p-4 space-y-2">
            <button className="btn-primary w-full" onClick={payNow}>Pay now</button>
            <button className="btn-ghost w-full" onClick={saveOpen}>Save & Print KOT</button>
        </div>
      </div>
    </div>
  )
}

function OrdersList({ company, flash, resumeOrder, setPrintDoc, isAdmin, userName }) {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('TODAY')

  const load = async () => {
    let qy = supabase.from('pos_orders').select('*').order('created_at', { ascending: false }).limit(200)
    if (filter === 'TODAY') qy = qy.gte('created_at', `${todayISO()}T00:00:00+06:00`)
    const { data } = await qy
    setRows(data || [])
  }
  useEffect(() => { load() }, [filter])

  const withItems = async (order) => {
    const { data } = await supabase.from('pos_order_items').select('*').eq('order_id', order.id)
    return data || []
  }

  const printReceipt = async (o) => setPrintDoc({ type: 'RECEIPT', order: o, items: await withItems(o) })
  const printKot = async (o) => setPrintDoc({ type: 'KOT', order: o, items: await withItems(o) })

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">Order</th><th className="th">Time</th><th className="th">Total</th><th className="th">Status</th><th className="th text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td className="td font-semibold">{o.order_no}</td>
              <td className="td">{fmtDate(o.created_at)}</td>
              <td className="td money">{Number(o.total).toFixed(2)}</td>
              <td className="td">{o.status}</td>
              <td className="td text-right">
                <div className="flex justify-end gap-2">
                    <button className="btn-ghost !py-1 !px-2" onClick={() => printReceipt(o)}><Printer size={14} /></button>
                    <button className="btn-ghost !py-1 !px-2" onClick={() => printKot(o)}><ChefHat size={14} /></button>
                    {(isAdmin || userName === 'Manager') && (
                        <button className="btn-ghost text-forest" onClick={() => resumeOrder(o)}>Edit</button>
                    )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ================= MENU MANAGER ================= */
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
            <button onClick={() => isAdmin && toggleCat(c)} disabled={!isAdmin} className={`status-chip ${c.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-600'} ${!isAdmin ? 'cursor-default' : ''}`}>
              {c.is_active ? 'ACTIVE' : 'OFF'}
            </button>
          </div>
        ))}
      </div>

      <div className="card p-5 lg:col-span-2">
        <h3 className="font-display font-semibold text-pine mb-3">Menu items</h3>
        {!isAdmin && <p className="text-xs text-pine/50 mb-3">Read-only — ask an administrator to change items or prices.</p>}
        {isAdmin && <div className="grid grid-cols-4 gap-2 mb-4 items-end">
          <div><label className="label">Category</label>
            <select className="input" value={ni.category_id} onChange={(e) => setNi({ ...ni, category_id: e.target.value })}>
              <option value="">Select…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
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
                <td className="td text-right">
                  {isAdmin ? (
                    <input type="number" defaultValue={it.price} onBlur={(e) => updatePrice(it, e.target.value)}
                      className="input !w-28 !py-1 money text-right inline-block" />
                  ) : (
                    <span className="money">{Number(it.price).toFixed(2)}</span>
                  )}
                </td>
                <td className="td">
                  <button onClick={() => isAdmin && toggleItem(it)} disabled={!isAdmin} className={`status-chip ${it.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-600'} ${!isAdmin ? 'cursor-default' : ''}`}>
                    {it.is_active ? 'ACTIVE' : 'OFF'}
                  </button>
                </td>
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
