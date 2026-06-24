import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, rateFor, computeCharge } from '../lib/helpers'
import KPICards from '../components/KPICards.jsx'
import PrintPortal from '../components/PrintPortal.jsx'
import GuestPicker from '../components/GuestPicker.jsx'
import { PosReceipt } from '../components/print/PosDocs.jsx'
import Mushak63 from '../components/print/Mushak63.jsx'
import { Plus, Minus, Trash2, Banknote, BedDouble, Leaf, Printer } from 'lucide-react'

const TABS = ['New Sale', 'Sales', 'Items']

export default function Facilities({ userName, isAdmin }) {
  const [tab, setTab] = useState('New Sale')
  const [items, setItems] = useState([])
  const [taxConfig, setTaxConfig] = useState([])
  const [company, setCompany] = useState(null)
  const [printDoc, setPrintDoc] = useState(null)
  const [msg, setMsg] = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4500) }

  const load = async () => {
    const [{ data: it }, { data: tc }, { data: co }] = await Promise.all([
      supabase.from('facility_items').select('*').order('category').order('name'),
      supabase.from('tax_config').select('*'),
      supabase.from('company_settings').select('*').eq('id', 1).single(),
    ])
    setItems(it || []); setTaxConfig(tc || []); setCompany(co)
  }
  useEffect(() => { load() }, [])

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-pine mb-1">Facilities & Shop</h1>
      <p className="text-sm text-pine/60 mb-4">Tea sale · Pickle sale · Sports items rental — prices editable at the counter; charge to room or settle on the spot.</p>
      <KPICards module="facilities" />

      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}

      <div className="flex gap-1 border-b border-leaf mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${tab === t ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'New Sale' && <NewSale items={items} taxConfig={taxConfig} userName={userName} flash={flash}
        onDone={(doc) => { if (doc) setPrintDoc(doc); setTab('Sales') }} />}
      {tab === 'Sales' && <SalesList setPrintDoc={setPrintDoc} isAdmin={isAdmin} flash={flash} />}
      {tab === 'Items' && <ItemsManager items={items} reload={load} isAdmin={isAdmin} />}

      {printDoc?.type === 'RECEIPT' && (
        <PrintPortal title={`${printDoc.order.outlet} — ${printDoc.order.order_no}`} onClose={() => setPrintDoc(null)} primaryColor={company?.primary_color || company?.brand_primary} accentColor={company?.accent_color || company?.brand_accent}>
          <PosReceipt order={printDoc.order} items={printDoc.items} company={company} mushakNo={printDoc.mushakNo} />
        </PrintPortal>
      )}
      {printDoc?.type === 'MUSHAK' && (
        <PrintPortal title={`Mushak-6.3 — ${printDoc.invoice.invoice_no}`} onClose={() => setPrintDoc(null)} primaryColor={company?.primary_color || company?.brand_primary} accentColor={company?.accent_color || company?.brand_accent}>
          <Mushak63 invoice={printDoc.invoice} res={null} company={company} refNo={printDoc.refNo} />
        </PrintPortal>
      )}
    </div>
  )
}

/* ================= NEW SALE ================= */
function NewSale({ items, taxConfig, userName, flash, onDone }) {
  const cat = 'OTHER'
  const [cart, setCart] = useState([]) // {facility_item_id, item_name, unit, qty, unit_price}
  const [link, setLink] = useState({ reservation_id: null, guest_name: '', room_no: '' })
  const [payMethod, setPayMethod] = useState('CASH')
  const [issueMushak, setIssueMushak] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [busy, setBusy] = useState(false)

  const catMeta = { outlet: 'Facilities & Shop' }
  const rate = rateFor(taxConfig, 'OTHER', todayISO())
    || rateFor(taxConfig, 'FOOD', todayISO())
    || { vat_pct: 0, service_charge_pct: 0 }
  const subtotal = cart.reduce((a, c) => a + c.qty * c.unit_price, 0)
  const t = computeCharge(subtotal, 0, rate)
  const addItem = (fi) => setCart((prev) => {
    const f = prev.find((c) => c.facility_item_id === fi.id)
    if (f) return prev.map((c) => (c.facility_item_id === fi.id ? { ...c, qty: c.qty + 1 } : c))
    return [...prev, { facility_item_id: fi.id, item_name: `${fi.name} (${fi.unit})`, unit: fi.unit, qty: 1, unit_price: Number(fi.default_price) }]
  })
  const addCustom = () => setCart((prev) => [...prev, { facility_item_id: null, item_name: 'Custom item', unit: 'pc', qty: 1, unit_price: 0 }])
  const bump = (i, d) => setCart((prev) => prev.map((c, x) => (x === i ? { ...c, qty: Math.max(0, c.qty + d) } : c)).filter((c) => c.qty > 0))
  const setPrice = (i, v) => setCart((prev) => prev.map((c, x) => (x === i ? { ...c, unit_price: Number(v) || 0 } : c)))
  const setName = (i, v) => setCart((prev) => prev.map((c, x) => (x === i ? { ...c, item_name: v } : c)))
  const removeLine = (i) => setCart((prev) => prev.filter((_, x) => x !== i))

  const persist = async (statusFields) => {
    const payload = {
      outlet: catMeta.outlet, order_type: 'TAKEAWAY', table_no: null,
      reservation_id: link.reservation_id, guest_name: link.guest_name || null, room_no: link.room_no || null,
      discount_pct: 0, base_amount: t.base_amount, discount: t.discount,
      service_charge: t.service_charge, vat: t.vat, total: t.total,
      created_by: userName, ...statusFields,
    }
    const { data: order, error } = await supabase.from('pos_orders').insert(payload).select().single()
    if (error) throw error
    const lineRows = cart.map((c) => ({
      order_id: order.id, menu_item_id: null, item_name: c.item_name,
      qty: c.qty, unit_price: c.unit_price, line_total: +(c.qty * c.unit_price).toFixed(2),
    }))
    const { data: savedItems, error: ie } = await supabase.from('pos_order_items').insert(lineRows).select()
    if (ie) throw ie
    return { order, items: savedItems }
  }

  const snapshot = () => {
    const lines = cart.map((c) => ({ ...c, line_total: +(c.qty * c.unit_price).toFixed(2) }))
    const keys = ['discount', 'service_charge', 'vat']
    const out = lines.map((l) => {
      const ratio = subtotal > 0 ? l.line_total / subtotal : 0
      const o = { charge_date: todayISO(), charge_type: cat, description: `${l.item_name} × ${l.qty}`, base_amount: l.line_total, status: 'PAID' }
      keys.forEach((k) => { o[k] = +(t[k] * ratio).toFixed(2) })
      return o
    })
    if (out.length) keys.forEach((k) => {
      const sum = out.reduce((a, o) => a + o[k], 0)
      out[out.length - 1][k] = +(out[out.length - 1][k] + (t[k] - sum)).toFixed(2)
    })
    out.forEach((o) => { o.total = +(o.base_amount - o.discount + o.service_charge + o.vat).toFixed(2) })
    return out
  }

  const payNow = async () => {
    if (cart.length === 0) { flash('Add at least one item.'); return }
    setBusy(true)
    try {
      const { order, items: oi } = await persist({ status: 'SETTLED', payment_method: payMethod, settled_at: new Date().toISOString() })
      let mushakNo = null
      if (order.reservation_id) {
        const { data: fc, error: fe } = await supabase.from('folio_charges').insert({
          reservation_id: order.reservation_id, charge_date: todayISO(), charge_type: 'OTHER',
          description: `${catMeta.outlet} ${order.order_no}`,
          base_amount: t.base_amount, discount: t.discount, service_charge: t.service_charge,
          vat: t.vat, total: t.total, status: 'PAID', created_by: userName,
        }).select().single()
        if (fe) throw fe
        await supabase.from('payments').insert({
          reservation_id: order.reservation_id, received_date: todayISO(), amount: t.total,
          method: payMethod, reference: order.order_no, received_by: userName, notes: catMeta.outlet,
        })
        await supabase.from('pos_orders').update({ folio_charge_id: fc.id }).eq('id', order.id)
      } else if (issueMushak) {
        const { data: inv, error: ve } = await supabase.from('invoices').insert({
          invoice_type: 'MUSHAK_63', pos_order_id: order.id,
          buyer_name: order.guest_name || 'Walk-in Customer', buyer_address: '', buyer_bin: '',
          totals: { base: t.base_amount, discount: t.discount, taxable_value: +(t.base_amount - t.discount).toFixed(2), service_charge: t.service_charge, vat: t.vat, grand_total: t.total, paid: t.total, due: 0 },
          line_snapshot: snapshot(), created_by: userName,
        }).select().single()
        if (ve) throw ve
        mushakNo = inv.invoice_no
        await supabase.from('pos_orders').update({ invoice_id: inv.id }).eq('id', order.id)
      }
      setCart([]); setLink({ reservation_id: null, guest_name: '', room_no: '' })
      onDone({ type: 'RECEIPT', order: { ...order, status: 'SETTLED', payment_method: payMethod }, items: oi, mushakNo })
      flash(`${order.order_no} settled — ${payMethod}.${mushakNo ? ` Mushak-6.3 ${mushakNo} issued.` : ''}`)
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  const chargeToRoom = async () => {
    if (cart.length === 0) { flash('Add at least one item.'); return }
    if (!link.reservation_id) { flash('Link an in-house guest first.'); return }
    setBusy(true)
    try {
      const { order, items: oi } = await persist({ status: 'CHARGED_TO_ROOM' })
      const { data: fc, error: fe } = await supabase.from('folio_charges').insert({
        reservation_id: order.reservation_id, charge_date: todayISO(), charge_type: cat,
        description: `${catMeta.outlet} ${order.order_no}`,
        base_amount: t.base_amount, discount: t.discount, service_charge: t.service_charge,
        vat: t.vat, total: t.total, status: 'DUE', created_by: userName,
      }).select().single()
      if (fe) throw fe
      await supabase.from('pos_orders').update({ folio_charge_id: fc.id }).eq('id', order.id)
      setCart([]); setLink({ reservation_id: null, guest_name: '', room_no: '' })
      onDone({ type: 'RECEIPT', order: { ...order, status: 'CHARGED_TO_ROOM' }, items: oi })
      flash(`${order.order_no} charged to Room ${order.room_no} as DUE.`)
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  const visible = items.filter((i) => i.is_active)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      <div className="xl:col-span-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {visible.map((fi) => (
            <button key={fi.id} onClick={() => addItem(fi)}
              className="card p-3 text-left hover:border-forest hover:shadow transition-all active:scale-[0.98]">
              <div className="font-semibold text-sm leading-tight">{fi.name}</div>
              <div className="money text-forest text-sm mt-1">{fmtBDT(fi.default_price)} <span className="text-pine/40">/ {fi.unit}</span></div>
            </button>
          ))}
          <button onClick={addCustom} className="card p-3 text-left border-dashed hover:border-forest text-pine/60">
            <Plus size={15} className="mb-1" /><div className="text-sm font-semibold">Custom item / price</div>
          </button>
        </div>
        {rate && (
          <p className="text-xs text-pine/50 mt-3">VAT {rate.vat_pct}% · SC {rate.service_charge_pct}% (Settings → Tax Policy)</p>
        )}
      </div>

      <div className="xl:col-span-2 space-y-3">
        <div className="card p-4">
          <h3 className="font-display font-semibold text-pine mb-2">Facilities & Shop — current sale</h3>
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
              <div key={i} className="py-2 space-y-1">
                <div className="flex items-center gap-2">
                  <input className="input flex-1 !py-1 text-sm" value={c.item_name} onChange={(e) => setName(i, e.target.value)} />
                  <button className="text-red-300 hover:text-red-600" onClick={() => removeLine(i)}><Trash2 size={14} /></button>
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-6 h-6 rounded bg-leaf text-pine" onClick={() => bump(i, -1)}><Minus size={13} className="mx-auto" /></button>
                  <span className="money w-7 text-center font-semibold">{c.qty}</span>
                  <button className="w-6 h-6 rounded bg-forest text-white" onClick={() => bump(i, 1)}><Plus size={13} className="mx-auto" /></button>
                  <span className="text-xs text-pine/50">×</span>
                  <input type="number" className="input !w-28 !py-1 money text-right" value={c.unit_price} onChange={(e) => setPrice(i, e.target.value)} title="Editable price" />
                  <span className="money flex-1 text-right text-sm font-semibold">{(c.qty * c.unit_price).toFixed(2)}</span>
                </div>
              </div>
            ))}
            {cart.length === 0 && <p className="text-sm text-pine/50 py-4 text-center">Tap items to add — every price stays editable.</p>}
          </div>
          <div className="border-t border-leaf mt-2 pt-2 text-sm space-y-1 money">
            <div className="flex justify-between"><span>Subtotal</span><span>{t.base_amount.toFixed(2)}</span></div>
            {rate.service_charge_pct > 0 && <div className="flex justify-between"><span>Service charge {rate.service_charge_pct}%</span><span>{t.service_charge.toFixed(2)}</span></div>}
            <div className="flex justify-between"><span>VAT {rate.vat_pct}%</span><span>{t.vat.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-pine/20 pt-1"><span>Total</span><span>{fmtBDT(t.total)}</span></div>
          </div>
        </div>

        <div className="card p-4 space-y-2">
          <div className="flex gap-2">
            <select className="input !w-32" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {['CASH', 'BKASH', 'NAGAD', 'CARD', 'BANK', 'OTHER'].map((m) => <option key={m}>{m}</option>)}
            </select>
            <button className="btn-primary flex-1 justify-center" onClick={payNow} disabled={busy}><Banknote size={16} /> Pay now</button>
          </div>
          {!link.reservation_id && (
            <label className="flex items-center gap-2 text-xs text-pine/70">
              <input type="checkbox" checked={issueMushak} onChange={(e) => setIssueMushak(e.target.checked)} />
              Issue Mushak-6.3 for this walk-in sale (feeds the 6.2 register)
            </label>
          )}
          <button className="btn-amber w-full justify-center" onClick={chargeToRoom} disabled={busy || !link.reservation_id}>
            <BedDouble size={16} /> Charge to room (DUE — settles at check-out)
          </button>
        </div>
      </div>

      {showPicker && <GuestPicker close={() => setShowPicker(false)} pick={(g) => { setLink(g); setShowPicker(false) }} />}
    </div>
  )
}

/* ================= SALES LIST ================= */
function SalesList({ setPrintDoc, isAdmin, flash }) {
  const [rows, setRows] = useState([])
  const load = async () => {
    const { data } = await supabase.from('pos_orders').select('*')
      .neq('outlet', 'Restaurant').order('created_at', { ascending: false }).limit(150)
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const withItems = async (o) => (await supabase.from('pos_order_items').select('*').eq('order_id', o.id)).data || []
  const printReceipt = async (o) => setPrintDoc({ type: 'RECEIPT', order: o, items: await withItems(o), mushakNo: null })
  const printMushak = async (o) => {
    const { data: inv } = await supabase.from('invoices').select('*').eq('id', o.invoice_id).single()
    if (inv) setPrintDoc({ type: 'MUSHAK', invoice: inv, refNo: o.order_no })
  }
  const voidSale = async (o) => {
    if (o.folio_charge_id) await supabase.from('folio_charges').delete().eq('id', o.folio_charge_id)
    if (o.reservation_id) await supabase.from('payments').delete().eq('reservation_id', o.reservation_id).eq('reference', o.order_no)
    if (o.invoice_id) await supabase.from('invoices').delete().eq('id', o.invoice_id)
    await supabase.from('pos_orders').update({ status: 'CANCELLED', notes: '[VOIDED by admin]' }).eq('id', o.id)
    flash(`${o.order_no} voided & reversed.`); load()
  }

  const chip = { SETTLED: 'bg-forest/15 text-forest', CHARGED_TO_ROOM: 'bg-pine/15 text-pine', CANCELLED: 'bg-red-100 text-red-600', OPEN: 'bg-amber/20 text-amber' }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead><tr>
          <th className="th">Sale</th><th className="th">Outlet</th><th className="th">Date</th>
          <th className="th">Guest / Room</th><th className="th text-right">Total</th><th className="th">Status</th><th className="th text-right">Actions</th>
        </tr></thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="hover:bg-leaf/20">
              <td className="td money font-semibold">{o.order_no}</td>
              <td className="td text-xs">{o.outlet}</td>
              <td className="td money text-xs">{fmtDate(o.created_at)}</td>
              <td className="td text-sm">{o.guest_name || 'Walk-in'}{o.room_no ? <span className="text-xs text-pine/50"> · Rm {o.room_no}</span> : ''}</td>
              <td className="td money text-right font-semibold">{Number(o.total).toFixed(2)}</td>
              <td className="td"><span className={`status-chip ${chip[o.status]}`}>{o.status.replace(/_/g, ' ')}</span></td>
              <td className="td">
                <div className="flex justify-end gap-1.5">
                  <button className="btn-ghost !py-1 !px-2" title="Bill" onClick={() => printReceipt(o)}><Printer size={13} /></button>
                  {o.invoice_id && <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => printMushak(o)}>6.3</button>}
                  {isAdmin && ['SETTLED', 'CHARGED_TO_ROOM'].includes(o.status) && <button className="btn-ghost !py-1 !px-2 text-red-500 text-xs" onClick={() => voidSale(o)}>Void</button>}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="td text-pine/50" colSpan={7}>No facility sales yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

/* ================= ITEMS MANAGER ================= */
function ItemsManager({ items, reload, isAdmin }) {
 const add = async () => {
    if (!n.name.trim() || n.default_price === '') return
    await supabase.from('facility_items').insert({ ...n, default_price: +n.default_price, category: 'OTHER' })
    setN({ name: '', unit: 'pc', default_price: '' }); reload()
  }
  const updatePrice = async (it, price) => {
    if (price === '' || +price === +it.default_price) return
    await supabase.from('facility_items').update({ default_price: +price }).eq('id', it.id); reload()
  }
  const toggle = async (it) => { await supabase.from('facility_items').update({ is_active: !it.is_active }).eq('id', it.id); reload() }
  const del = async (it) => { await supabase.from('facility_items').delete().eq('id', it.id); reload() }

  return (
    <div className="card p-5">
      <h3 className="font-display font-semibold text-pine mb-1 flex items-center gap-2"><Leaf size={17} /> Facility items (default prices)</h3>
      <p className="text-xs text-pine/50 mb-3">Defaults only — the price stays editable on every sale. {!isAdmin && 'Changing the catalog requires administrator access.'}</p>
      {isAdmin && (
        <div className="grid grid-cols-4 gap-2 mb-4 items-end">
          <div><label className="label">Item name</label><input className="input" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></div>
          <div><label className="label">Unit</label>
            <select className="input" value={n.unit} onChange={(e) => setN({ ...n, unit: e.target.value })}>
              {['pc', 'pkt', 'jar', 'kg', 'hour', 'day'].map((u) => <option key={u}>{u}</option>)}
            </select></div>
          <div><label className="label">Default price ৳</label><input type="number" className="input money" value={n.default_price} onChange={(e) => setN({ ...n, default_price: e.target.value })} /></div>
          <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Add item</button>
        </div>
      )}
      <table className="w-full">
        <thead><tr><th className="th">Item</th><th className="th">Unit</th><th className="th text-right">Default price</th><th className="th">Status</th><th className="th"></th></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td className="td font-medium text-sm">{it.name}</td>
              <td className="td text-xs">{it.unit}</td>
              <td className="td text-right">
                {isAdmin ? (
                  <input type="number" defaultValue={it.default_price} onBlur={(e) => updatePrice(it, e.target.value)} className="input !w-28 !py-1 money text-right inline-block" />
                ) : (<span className="money">{Number(it.default_price).toFixed(2)}</span>)}
              </td>
              <td className="td">
                <button onClick={() => isAdmin && toggle(it)} disabled={!isAdmin} className={`status-chip ${it.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-600'} ${!isAdmin ? 'cursor-default' : ''}`}>
                  {it.is_active ? 'ACTIVE' : 'OFF'}
                </button>
              </td>
              <td className="td text-right">{isAdmin && <button onClick={() => del(it)} className="text-red-300 hover:text-red-600"><Trash2 size={14} /></button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
