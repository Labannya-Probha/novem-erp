import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO } from '../lib/helpers'
import {
  Boxes, Plus, Trash2, Check, X, Truck, PackageCheck, ArrowLeftRight,
  Undo2, Pencil, Save, RotateCcw, Search, ChevronRight, FileText,
} from 'lucide-react'
import VendorPaymentTab from '../components/VendorPaymentTab.jsx'
import KPICards from '../components/KPICards.jsx'

const TABS = ['Items & Stock', 'Vendors', 'Requisitions', 'Purchase Orders', 'Goods Receipt', 'Transfers', 'Returns', 'Vendor Payments']

/* ─── shared helpers ─────────────────────────────────────────────────────── */
function flash_fn(setMsg) {
  return (m, type = 'ok') => {
    setMsg({ text: m, type })
    setTimeout(() => setMsg(null), 5000)
  }
}

function FlashBar({ msg }) {
  if (!msg) return null
  const bg = msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-forest/10 text-forest'
  return <div className={`px-4 py-3 rounded-lg text-sm font-medium ${bg}`}>{msg.text}</div>
}

/* ─── main component ─────────────────────────────────────────────────────── */
export default function InventoryHub({ userName, role, isAdmin }) {
  const [tab, setTab] = useState('Items & Stock')
  const [msg, setMsg] = useState(null)
  const flash = flash_fn(setMsg)
  const canApprove = isAdmin || role === 'MANAGER'

  // Cross-tab navigation: Requisitions can push user to PO or Transfer tab
  // with a pre-selected requisition
  const [navReq, setNavReq] = useState(null) // { id, req_no, type: 'PO'|'TRF' }
  const goCreatePO = (req) => { setNavReq({ ...req, type: 'PO' }); setTab('Purchase Orders') }
  const goCreateTRF = (req) => { setNavReq({ ...req, type: 'TRF' }); setTab('Transfers') }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2">
          <Boxes className="text-forest" /> Inventory & Procurement
        </h1>
        <p className="text-sm text-pine/60">
          Requisition → Purchase Order / Transfer → Goods Receipt — fully integrated procurement workflow.
        </p>
      </div>
      <FlashBar msg={msg} />
      <div className="flex gap-1 border-b border-leaf flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); if (t !== 'Purchase Orders' && t !== 'Transfers') setNavReq(null) }}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg whitespace-nowrap ${tab === t ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Items & Stock'     && <ItemsTab flash={flash} isAdmin={isAdmin} />}
      {tab === 'Vendors'           && <VendorsTab flash={flash} isAdmin={isAdmin} />}
      {tab === 'Requisitions'      && <RequisitionsTab flash={flash} userName={userName} canApprove={canApprove} onCreatePO={goCreatePO} onCreateTRF={goCreateTRF} />}
      {tab === 'Purchase Orders'   && <POTab flash={flash} userName={userName} navReq={navReq} clearNav={() => setNavReq(null)} />}
      {tab === 'Goods Receipt'     && <GRNTab flash={flash} userName={userName} />}
      {tab === 'Transfers'         && <TransfersTab flash={flash} userName={userName} navReq={navReq} clearNav={() => setNavReq(null)} />}
      {tab === 'Returns'           && <ReturnsTab flash={flash} userName={userName} />}
      {tab === 'Vendor Payments'   && <VendorPaymentTab role={role} />}
    </div>
  )
}

/* ─── useLocations hook ──────────────────────────────────────────────────── */
function useLocations() {
  const [locs, setLocs] = useState([])
  useEffect(() => {
    supabase.from('store_locations').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => setLocs(data || []))
  }, [])
  return locs
}

/* ─── Items & Stock ──────────────────────────────────────────────────────── */
function ItemsTab({ flash, isAdmin }) {
  const [items, setItems] = useState([])
  const [stock, setStock] = useState([])
  const [search, setSearch] = useState('')
  const [f, setF] = useState({ code: '', name: '', unit: 'pc', category: 'GENERAL', reorder_level: 0 })
  const [editId, setEditId] = useState(null)

  const load = async () => {
    const [{ data: it }, { data: sb }] = await Promise.all([
      supabase.from('inv_items').select('*').order('name'),
      supabase.from('v_stock_balance').select('*'),
    ])
    setItems(it || []); setStock(sb || [])
  }
  useEffect(() => { load() }, [])

  const onHand = (id) => +(stock.find((s) => s.id === id)?.on_hand ?? 0)

  const save = async () => {
    if (!f.name.trim()) return
    if (editId) {
      const { error } = await supabase.from('inv_items').update({ ...f, reorder_level: +f.reorder_level }).eq('id', editId)
      if (error) { flash(error.message, 'error'); return }
      setEditId(null)
    } else {
      const { error } = await supabase.from('inv_items').insert({ ...f, reorder_level: +f.reorder_level })
      if (error) { flash(error.message, 'error'); return }
    }
    setF({ code: '', name: '', unit: 'pc', category: 'GENERAL', reorder_level: 0 })
    load()
  }

  const startEdit = (it) => { setEditId(it.id); setF({ code: it.code || '', name: it.name, unit: it.unit, category: it.category, reorder_level: it.reorder_level }) }
  const del = async (id) => {
    const { error } = await supabase.from('inv_items').delete().eq('id', id)
    if (error) flash('Cannot delete — item may be in use.', 'error'); else load()
  }

  const filtered = items.filter((it) => !search || it.name.toLowerCase().includes(search.toLowerCase()) || (it.code || '').toLowerCase().includes(search.toLowerCase()))
  const lowStock = items.filter((it) => it.reorder_level > 0 && onHand(it.id) <= it.reorder_level).length

  return (
    <div className="space-y-4">
      {lowStock > 0 && (
        <div className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          ⚠ {lowStock} item{lowStock > 1 ? 's' : ''} at or below reorder level
        </div>
      )}
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-pine text-sm">{editId ? '✏ Edit item' : '+ New item'}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          <input className="input" placeholder="Code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
          <input className="input sm:col-span-2" placeholder="Item name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input" placeholder="Unit" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
          <input className="input" placeholder="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          <input type="number" className="input money" placeholder="Reorder level" value={f.reorder_level} onChange={(e) => setF({ ...f, reorder_level: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={save}>{editId ? <><Save size={15} /> Update</> : <><Plus size={15} /> Add item</>}</button>
          {editId && <button className="btn-ghost" onClick={() => { setEditId(null); setF({ code: '', name: '', unit: 'pc', category: 'GENERAL', reorder_level: 0 }) }}>Cancel</button>}
        </div>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-pine/30" />
        <input className="input pl-9" placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Code</th><th className="th">Item</th><th className="th">Unit</th>
              <th className="th">Category</th><th className="th text-right">Reorder</th>
              <th className="th text-right">On Hand</th><th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => {
              const oh = onHand(it.id)
              const low = it.reorder_level > 0 && oh <= it.reorder_level
              return (
                <tr key={it.id} className={low ? 'bg-red-50' : 'hover:bg-leaf/20'}>
                  <td className="td money text-xs">{it.code || '—'}</td>
                  <td className="td text-sm font-medium">{it.name}</td>
                  <td className="td text-sm">{it.unit}</td>
                  <td className="td text-xs">{it.category}</td>
                  <td className="td money text-right">{Number(it.reorder_level)}</td>
                  <td className={`td money text-right font-bold ${low ? 'text-red-600' : ''}`}>{oh}</td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(it)} className="text-pine/40 hover:text-forest"><Pencil size={13} /></button>
                      {isAdmin && <button onClick={() => del(it.id)} className="text-red-300 hover:text-red-600"><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && <tr><td className="td text-pine/40 text-center py-6" colSpan={7}>No items found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Vendors ────────────────────────────────────────────────────────────── */
function VendorsTab({ flash, isAdmin }) {
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ name: '', bin: '', phone: '', address: '' })
  const [editId, setEditId] = useState(null)

  const load = async () => { const { data } = await supabase.from('vendors').select('*').order('name'); setRows(data || []) }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!f.name.trim()) return
    const { error } = editId
      ? await supabase.from('vendors').update(f).eq('id', editId)
      : await supabase.from('vendors').insert(f)
    if (error) { flash(error.message, 'error'); return }
    setF({ name: '', bin: '', phone: '', address: '' }); setEditId(null); load()
  }

  const del = async (id) => {
    const { error } = await supabase.from('vendors').delete().eq('id', id)
    if (error) flash('Cannot delete — vendor may be in use.', 'error'); else load()
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-pine text-sm">{editId ? '✏ Edit vendor' : '+ New vendor'}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input className="input sm:col-span-2" placeholder="Vendor name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input money" placeholder="BIN" value={f.bin} onChange={(e) => setF({ ...f, bin: e.target.value })} />
          <input className="input" placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <input className="input sm:col-span-4" placeholder="Address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={save}>{editId ? <><Save size={15} /> Update</> : <><Plus size={15} /> Add vendor</>}</button>
          {editId && <button className="btn-ghost" onClick={() => { setEditId(null); setF({ name: '', bin: '', phone: '', address: '' }) }}>Cancel</button>}
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Vendor</th><th className="th">BIN</th><th className="th">Phone</th><th className="th">Address</th><th className="th text-right">Actions</th></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="hover:bg-leaf/20">
                <td className="td text-sm font-medium">{v.name}</td>
                <td className="td money text-xs">{v.bin || '—'}</td>
                <td className="td text-sm">{v.phone || '—'}</td>
                <td className="td text-xs">{v.address || '—'}</td>
                <td className="td text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setEditId(v.id); setF({ name: v.name, bin: v.bin || '', phone: v.phone || '', address: v.address || '' }) }} className="text-pine/40 hover:text-forest"><Pencil size={13} /></button>
                    {isAdmin && <button onClick={() => del(v.id)} className="text-red-300 hover:text-red-600"><Trash2 size={13} /></button>}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-pine/40 text-center py-6" colSpan={5}>No vendors.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── shared LineEditor ──────────────────────────────────────────────────── */
function LineEditor({ items, lines, setLines, withCost = false, readOnly = false }) {
  const add = () => setLines([...lines, { item_id: '', item_name: '', qty: 1, unit_cost: 0, vat_pct: 0, unit: '' }])
  const upd = (i, k, v) => {
    const n = [...lines]; n[i] = { ...n[i], [k]: v }
    if (k === 'item_id') { const it = items.find((x) => x.id === v); n[i].item_name = it?.name || ''; n[i].unit = it?.unit || '' }
    setLines(n)
  }
  const del = (i) => setLines(lines.filter((_, idx) => idx !== i))

  if (lines.length === 0 && readOnly) return <p className="text-sm text-pine/40">No items.</p>

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-1 text-xs text-pine/50 font-semibold px-1">
        <span className="col-span-5">Item</span>
        <span className="col-span-2 text-right">Qty</span>
        {withCost && <><span className="col-span-2 text-right">Unit cost</span><span className="col-span-2 text-right">VAT (Tk)</span></>}
      </div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-12 gap-1 items-center">
          {readOnly ? (
            <span className="col-span-5 text-sm">{l.item_name || '—'} <span className="text-xs text-pine/40">({l.unit})</span></span>
          ) : (
            <select className="input col-span-5 text-sm" value={l.item_id} onChange={(e) => upd(i, 'item_id', e.target.value)}>
              <option value="">Select item…</option>
              {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>)}
            </select>
          )}
          <input type="number" readOnly={readOnly} className={`input col-span-2 money text-right text-sm ${readOnly ? 'bg-leaf/20' : ''}`} value={l.qty} onChange={(e) => upd(i, 'qty', e.target.value)} />
          {withCost && (
            <>
              <input type="number" readOnly={readOnly} className={`input col-span-2 money text-right text-sm ${readOnly ? 'bg-leaf/20' : ''}`} value={l.unit_cost} onChange={(e) => upd(i, 'unit_cost', e.target.value)} />
              <input type="number" readOnly={readOnly} className={`input col-span-2 money text-right text-sm ${readOnly ? 'bg-leaf/20' : ''}`} value={l.vat_pct} onChange={(e) => upd(i, 'vat_pct', e.target.value)} />
            </>
          )}
          {!readOnly && <button className="text-red-300 hover:text-red-600 col-span-1 flex justify-center" onClick={() => del(i)}><Trash2 size={14} /></button>}
        </div>
      ))}
      {!readOnly && <button className="btn-ghost !py-1 text-sm" onClick={add}><Plus size={13} /> Add line</button>}
    </div>
  )
}

/* ─── Requisitions ───────────────────────────────────────────────────────── */
function RequisitionsTab({ flash, userName, canApprove, onCreatePO, onCreateTRF }) {
  const [items, setItems] = useState([])
  const [rows, setRows] = useState([])
  const [dept, setDept] = useState('GENERAL')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([])
  const [expanded, setExpanded] = useState(null)

  const load = async () => {
    const [{ data: it }, { data: rq }] = await Promise.all([
      supabase.from('inv_items').select('*').order('name'),
      supabase.from('requisitions').select('*, requisition_items(*), purchase_orders(id,po_no,status), stock_transfers(id,trf_no)').order('created_at', { ascending: false }),
    ])
    setItems(it || []); setRows(rq || [])
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (lines.length === 0) { flash('অন্তত একটা item যোগ করুন।', 'error'); return }
    if (lines.some((l) => !l.item_id)) { flash('সব line-এ item বেছে নিন।', 'error'); return }
    const { data: r, error } = await supabase.from('requisitions').insert({ department: dept, requested_by: userName, notes: notes || null }).select().single()
    if (error) { flash(error.message, 'error'); return }
    await supabase.from('requisition_items').insert(lines.map((l) => ({ requisition_id: r.id, item_id: l.item_id, item_name: l.item_name, qty: +l.qty, notes: l.notes || null })))
    setLines([]); setNotes(''); load()
    flash(`✓ ${r.req_no} তৈরি হয়েছে — Approve করলে PO বা Transfer তৈরি করা যাবে।`)
  }

  const setStatus = async (id, status) => {
    await supabase.from('requisitions').update({ status, approved_by: userName, approved_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const statusChip = (s) => ({ PENDING: 'bg-amber/20 text-amber', APPROVED: 'bg-forest/15 text-forest', REJECTED: 'bg-red-100 text-red-600', CLOSED: 'bg-stone-200 text-stone-500' }[s] || 'bg-stone-100 text-stone-500')

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <h3 className="font-display font-semibold text-pine">New Requisition</h3>
        <div className="flex gap-3 flex-wrap">
          <div><label className="label">Department</label>
            <input className="input !w-48" value={dept} onChange={(e) => setDept(e.target.value)} placeholder="e.g. KITCHEN, HK" />
          </div>
          <div className="flex-1"><label className="label">Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
        <LineEditor items={items} lines={lines} setLines={setLines} withCost={false} />
        <button className="btn-primary" onClick={create}><Plus size={15} /> Create requisition</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Req No</th><th className="th">Date</th><th className="th">Dept</th>
              <th className="th">By</th><th className="th">Items</th><th className="th">Status</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const hasPO = (r.purchase_orders || []).length > 0
              const hasTRF = (r.stock_transfers || []).length > 0
              return (
                <>
                  <tr key={r.id} className="hover:bg-leaf/20">
                    <td className="td money font-semibold">
                      <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="flex items-center gap-1 hover:text-forest">
                        {r.req_no} <ChevronRight size={13} className={`transition-transform ${expanded === r.id ? 'rotate-90' : ''}`} />
                      </button>
                    </td>
                    <td className="td text-xs">{fmtDate(r.req_date)}</td>
                    <td className="td text-xs font-medium">{r.department}</td>
                    <td className="td text-xs">{r.requested_by}</td>
                    <td className="td text-xs text-pine/60">{(r.requisition_items || []).length} items</td>
                    <td className="td"><span className={`status-chip ${statusChip(r.status)}`}>{r.status}</span></td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {r.status === 'PENDING' && canApprove && (
                          <>
                            <button className="btn-ghost !py-0.5 !px-2 text-forest text-xs" onClick={() => setStatus(r.id, 'APPROVED')}><Check size={13} /> Approve</button>
                            <button className="btn-ghost !py-0.5 !px-2 text-red-500 text-xs" onClick={() => setStatus(r.id, 'REJECTED')}><X size={13} /> Reject</button>
                          </>
                        )}
                        {r.status === 'APPROVED' && (
                          <>
                            {!hasPO && <button className="btn-ghost !py-0.5 !px-2 text-forest text-xs" onClick={() => onCreatePO({ id: r.id, req_no: r.req_no, items: r.requisition_items })}><Truck size={13} /> Create PO</button>}
                            {!hasTRF && <button className="btn-ghost !py-0.5 !px-2 text-pine text-xs" onClick={() => onCreateTRF({ id: r.id, req_no: r.req_no, items: r.requisition_items })}><ArrowLeftRight size={13} /> Create Transfer</button>}
                            {(hasPO || hasTRF) && <button className="btn-ghost !py-0.5 !px-2 text-stone-500 text-xs" onClick={() => setStatus(r.id, 'CLOSED')}>Close</button>}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === r.id && (
                    <tr key={`${r.id}-detail`}>
                      <td colSpan={7} className="px-6 pb-3 bg-leaf/20">
                        <div className="text-xs space-y-1 pt-2">
                          <div className="font-semibold text-pine mb-1">Items:</div>
                          {(r.requisition_items || []).map((it) => (
                            <div key={it.id} className="flex gap-4 text-pine/70">
                              <span className="font-medium">{it.item_name}</span>
                              <span>Qty: {it.qty}</span>
                              {it.notes && <span className="text-pine/40">{it.notes}</span>}
                            </div>
                          ))}
                          {hasPO && <div className="mt-2 text-forest font-medium">PO: {(r.purchase_orders || []).map((p) => `${p.po_no} (${p.status})`).join(', ')}</div>}
                          {hasTRF && <div className="mt-1 text-pine font-medium">Transfer: {(r.stock_transfers || []).map((t) => t.trf_no).join(', ')}</div>}
                          {r.notes && <div className="text-pine/50 mt-1">Notes: {r.notes}</div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
            {rows.length === 0 && <tr><td className="td text-pine/40 text-center py-6" colSpan={7}>No requisitions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Purchase Orders ────────────────────────────────────────────────────── */
function POTab({ flash, userName, navReq, clearNav }) {
  const [items, setItems] = useState([])
  const [vendors, setVendors] = useState([])
  const [rows, setRows] = useState([])
  const [vendor, setVendor] = useState('')
  const [reqNo, setReqNo] = useState('')
  const [reqId, setReqId] = useState(null)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([])
  const [expanded, setExpanded] = useState(null)

  const load = async () => {
    const [{ data: it }, { data: v }, { data: po }] = await Promise.all([
      supabase.from('inv_items').select('*').order('name'),
      supabase.from('vendors').select('*').eq('is_active', true).order('name'),
      supabase.from('purchase_orders').select('*, vendors(name), po_items(*), requisitions(req_no)').order('created_at', { ascending: false }),
    ])
    setItems(it || []); setVendors(v || []); setRows(po || [])
  }
  useEffect(() => { load() }, [])

  // Pre-fill from requisition nav
  useEffect(() => {
    if (!navReq || navReq.type !== 'PO') return
    setReqId(navReq.id); setReqNo(navReq.req_no)
    setLines((navReq.items || []).map((it) => ({ item_id: it.item_id || '', item_name: it.item_name, qty: it.qty, unit_cost: 0, vat_pct: 0, unit: '' })))
    clearNav()
  }, [navReq])

  const create = async () => {
    if (!vendor) { flash('Vendor বেছে নিন।', 'error'); return }
    if (lines.length === 0) { flash('অন্তত একটা item যোগ করুন।', 'error'); return }
    if (lines.some((l) => !l.item_id)) { flash('সব line-এ item বেছে নিন।', 'error'); return }
    const { data: po, error } = await supabase.from('purchase_orders').insert({ vendor_id: vendor, requisition_id: reqId || null, notes: notes || null, created_by: userName }).select().single()
    if (error) { flash(error.message, 'error'); return }
    await supabase.from('po_items').insert(lines.map((l) => ({ po_id: po.id, item_id: l.item_id, item_name: l.item_name, qty: +l.qty, unit_cost: +l.unit_cost, vat_pct: +l.vat_pct })))
    setLines([]); setVendor(''); setReqId(null); setReqNo(''); setNotes(''); load()
    flash(`✓ ${po.po_no} তৈরি হয়েছে${reqNo ? ` (REQ: ${reqNo})` : ''}.`)
  }

  const setStatus = async (id, status) => { await supabase.from('purchase_orders').update({ status }).eq('id', id); load() }
  const poTotal = (po) => (po.po_items || []).reduce((a, l) => a + +l.qty * +l.unit_cost, 0)
  const statusChip = (s) => ({ OPEN: 'bg-amber/20 text-amber', PARTIAL: 'bg-sky-100 text-sky-700', RECEIVED: 'bg-forest/15 text-forest', CANCELLED: 'bg-red-100 text-red-600' }[s] || 'bg-stone-100 text-stone-500')

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <h3 className="font-display font-semibold text-pine flex items-center gap-2">
          <Truck size={18} /> New Purchase Order
          {reqNo && <span className="text-sm font-normal text-forest bg-forest/10 px-2 py-0.5 rounded-full">REQ: {reqNo}</span>}
        </h3>
        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="label">Vendor *</label>
            <select className="input !w-56" value={vendor} onChange={(e) => setVendor(e.target.value)}>
              <option value="">Select vendor…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="label">Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <p className="text-xs text-pine/40">Unit cost (৳) + VAT amount (৳) per line — feeds the Mushak-6.1 purchase register.</p>
        <LineEditor items={items} lines={lines} setLines={setLines} withCost={true} />
        <button className="btn-primary" onClick={create}><Truck size={15} /> Create PO</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">PO No</th><th className="th">Date</th><th className="th">Vendor</th>
              <th className="th">REQ</th><th className="th text-right">Value</th>
              <th className="th">Status</th><th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((po) => (
              <>
                <tr key={po.id} className="hover:bg-leaf/20">
                  <td className="td money font-semibold">
                    <button onClick={() => setExpanded(expanded === po.id ? null : po.id)} className="flex items-center gap-1 hover:text-forest">
                      {po.po_no} <ChevronRight size={13} className={`transition-transform ${expanded === po.id ? 'rotate-90' : ''}`} />
                    </button>
                  </td>
                  <td className="td text-xs">{fmtDate(po.po_date)}</td>
                  <td className="td text-sm">{po.vendors?.name}</td>
                  <td className="td text-xs text-forest">{po.requisitions?.req_no || '—'}</td>
                  <td className="td money text-right font-semibold">{fmtBDT(poTotal(po))}</td>
                  <td className="td"><span className={`status-chip ${statusChip(po.status)}`}>{po.status}</span></td>
                  <td className="td text-right">
                    {['OPEN', 'PARTIAL'].includes(po.status) && (
                      <button className="btn-ghost !py-0.5 !px-2 text-red-500 text-xs" onClick={() => setStatus(po.id, 'CANCELLED')}>Cancel</button>
                    )}
                  </td>
                </tr>
                {expanded === po.id && (
                  <tr key={`${po.id}-d`}>
                    <td colSpan={7} className="px-6 pb-3 bg-leaf/20">
                      <div className="text-xs space-y-1 pt-2">
                        {(po.po_items || []).map((it) => (
                          <div key={it.id} className="flex gap-4 text-pine/70">
                            <span className="font-medium w-40">{it.item_name}</span>
                            <span>Qty: {it.qty}</span>
                            <span>Rate: {fmtBDT(it.unit_cost)}</span>
                            <span>VAT: {fmtBDT(it.vat_pct)}</span>
                            <span className="font-semibold">Total: {fmtBDT(+it.qty * +it.unit_cost)}</span>
                          </div>
                        ))}
                        {po.notes && <div className="text-pine/40 mt-1">Notes: {po.notes}</div>}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {rows.length === 0 && <tr><td className="td text-pine/40 text-center py-6" colSpan={7}>No purchase orders.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Goods Receipt ──────────────────────────────────────────────────────── */
function GRNTab({ flash, userName }) {
  const [items, setItems] = useState([])
  const [vendors, setVendors] = useState([])
  const [pos, setPos] = useState([])
  const [rows, setRows] = useState([])
  const [h, setH] = useState({ vendor_id: '', po_id: '', vendor_invoice_no: '', vendor_invoice_date: todayISO(), rebateable: true, notes: '' })
  const [lines, setLines] = useState([])
  const [expanded, setExpanded] = useState(null)

  const load = async () => {
    const [{ data: it }, { data: v }, { data: po }, { data: grn }] = await Promise.all([
      supabase.from('inv_items').select('*').order('name'),
      supabase.from('vendors').select('*').eq('is_active', true).order('name'),
      supabase.from('purchase_orders').select('id, po_no, vendor_id, po_items(*)').in('status', ['OPEN', 'PARTIAL']),
      supabase.from('goods_receipts').select('*, vendors(name), grn_items(*), purchase_orders(po_no)').order('created_at', { ascending: false }),
    ])
    setItems(it || []); setVendors(v || []); setPos(po || []); setRows(grn || [])
  }
  useEffect(() => { load() }, [])

  // When PO is selected, auto-fill vendor + lines
  const onPOSelect = (poId) => {
    setH((prev) => ({ ...prev, po_id: poId }))
    if (!poId) return
    const po = pos.find((p) => p.id === poId)
    if (!po) return
    setH((prev) => ({ ...prev, po_id: poId, vendor_id: po.vendor_id }))
    setLines((po.po_items || []).map((it) => ({
      item_id: it.item_id, item_name: it.item_name, qty: it.qty,
      unit_cost: it.unit_cost, vat_pct: it.vat_pct, unit: '',
    })))
  }

  const create = async () => {
    if (!h.vendor_id) { flash('Vendor বেছে নিন।', 'error'); return }
    if (lines.length === 0) { flash('অন্তত একটা item যোগ করুন।', 'error'); return }
    const { data: grn, error } = await supabase.from('goods_receipts').insert({
      vendor_id: h.vendor_id, po_id: h.po_id || null,
      vendor_invoice_no: h.vendor_invoice_no || null, vendor_invoice_date: h.vendor_invoice_date,
      rebateable: h.rebateable, notes: h.notes || null, created_by: userName,
    }).select().single()
    if (error) { flash(error.message, 'error'); return }
    await supabase.from('grn_items').insert(lines.map((l) => ({
      grn_id: grn.id, item_id: l.item_id, item_name: l.item_name,
      qty: +l.qty, unit_cost: +l.unit_cost, vat_amount: +l.vat_pct,
    })))
    if (h.po_id) await supabase.from('purchase_orders').update({ status: 'RECEIVED' }).eq('id', h.po_id)
    setLines([]); setH({ vendor_id: '', po_id: '', vendor_invoice_no: '', vendor_invoice_date: todayISO(), rebateable: true, notes: '' })
    load(); flash(`✓ ${grn.grn_no} — stock updated, VAT-6.1 purchase register posted${h.rebateable ? ' (rebateable)' : ''}.`)
  }

  const grnTotal = (g) => (g.grn_items || []).reduce((a, l) => a + +l.qty * +l.unit_cost, 0)

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <h3 className="font-display font-semibold text-pine flex items-center gap-2"><PackageCheck size={18} /> Goods Receipt (GRN)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="label">PO (auto-fill items)</label>
            <select className="input" value={h.po_id} onChange={(e) => onPOSelect(e.target.value)}>
              <option value="">Select PO (optional)…</option>
              {pos.map((p) => <option key={p.id} value={p.id}>{p.po_no}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Vendor *</label>
            <select className="input" value={h.vendor_id} onChange={(e) => setH({ ...h, vendor_id: e.target.value })}>
              <option value="">Select vendor…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div><label className="label">Vendor invoice no</label>
            <input className="input money" placeholder="Invoice number" value={h.vendor_invoice_no} onChange={(e) => setH({ ...h, vendor_invoice_no: e.target.value })} />
          </div>
          <div><label className="label">Invoice date</label>
            <input type="date" className="input" value={h.vendor_invoice_date} onChange={(e) => setH({ ...h, vendor_invoice_date: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="accent-forest" checked={h.rebateable} onChange={(e) => setH({ ...h, rebateable: e.target.checked })} />
            Input VAT is rebateable (valid Mushak-6.3 received from vendor)
          </label>
        </div>
        <p className="text-xs text-pine/40">VAT column = VAT amount in Tk per line. Auto-posts to Mushak-6.1 purchase register.</p>
        <LineEditor items={items} lines={lines} setLines={setLines} withCost={true} />
        <button className="btn-primary" onClick={create}><PackageCheck size={15} /> Receive goods</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">GRN No</th><th className="th">Date</th><th className="th">Vendor</th>
              <th className="th">PO</th><th className="th">Invoice</th>
              <th className="th text-right">Value</th><th className="th">Rebate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <>
                <tr key={g.id} className="hover:bg-leaf/20">
                  <td className="td money font-semibold">
                    <button onClick={() => setExpanded(expanded === g.id ? null : g.id)} className="flex items-center gap-1 hover:text-forest">
                      {g.grn_no} <ChevronRight size={13} className={`transition-transform ${expanded === g.id ? 'rotate-90' : ''}`} />
                    </button>
                  </td>
                  <td className="td text-xs">{fmtDate(g.grn_date)}</td>
                  <td className="td text-sm">{g.vendors?.name}</td>
                  <td className="td text-xs text-forest">{g.purchase_orders?.po_no || '—'}</td>
                  <td className="td text-xs">{g.vendor_invoice_no || '—'}</td>
                  <td className="td money text-right font-semibold">{fmtBDT(grnTotal(g))}</td>
                  <td className="td text-xs">{g.rebateable ? <span className="text-forest font-medium">Yes</span> : 'No'}</td>
                </tr>
                {expanded === g.id && (
                  <tr key={`${g.id}-d`}>
                    <td colSpan={7} className="px-6 pb-3 bg-leaf/20">
                      <div className="text-xs space-y-1 pt-2">
                        {(g.grn_items || []).map((it) => (
                          <div key={it.id} className="flex gap-4 text-pine/70">
                            <span className="font-medium w-40">{it.item_name}</span>
                            <span>Qty: {it.qty}</span>
                            <span>Rate: {fmtBDT(it.unit_cost)}</span>
                            <span>VAT: {fmtBDT(it.vat_amount)}</span>
                            <span className="font-semibold">Total: {fmtBDT(+it.qty * +it.unit_cost)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {rows.length === 0 && <tr><td className="td text-pine/40 text-center py-6" colSpan={7}>No goods receipts.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Transfers ──────────────────────────────────────────────────────────── */
function TransfersTab({ flash, userName, navReq, clearNav }) {
  const [items, setItems] = useState([])
  const [rows, setRows] = useState([])
  const locs = useLocations()
  const [h, setH] = useState({ from_location: '', to_location: '', notes: '' })
  const [lines, setLines] = useState([])
  const [reqNo, setReqNo] = useState('')
  const [reqId, setReqId] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const load = async () => {
    const [{ data: it }, { data: tr }] = await Promise.all([
      supabase.from('inv_items').select('*').order('name'),
      supabase.from('stock_transfers').select('*, transfer_items(*), requisitions(req_no)').order('created_at', { ascending: false }),
    ])
    setItems(it || []); setRows(tr || [])
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!navReq || navReq.type !== 'TRF') return
    setReqId(navReq.id); setReqNo(navReq.req_no)
    setLines((navReq.items || []).map((it) => ({ item_id: it.item_id || '', item_name: it.item_name, qty: it.qty, unit_cost: 0, vat_pct: 0, unit: '' })))
    clearNav()
  }, [navReq])

  const create = async () => {
    if (!h.from_location || !h.to_location) { flash('From / To location দিন।', 'error'); return }
    if (lines.length === 0) { flash('অন্তত একটা item যোগ করুন।', 'error'); return }
    const { data: tr, error } = await supabase.from('stock_transfers').insert({
      from_location: h.from_location, to_location: h.to_location,
      requisition_id: reqId || null, notes: h.notes || null, created_by: userName,
    }).select().single()
    if (error) { flash(error.message, 'error'); return }
    await supabase.from('transfer_items').insert(lines.map((l) => ({ transfer_id: tr.id, item_id: l.item_id, item_name: l.item_name, qty: +l.qty })))
    setLines([]); setH({ from_location: '', to_location: '', notes: '' }); setReqId(null); setReqNo('')
    load(); flash(`✓ ${tr.trf_no} — stock moved from ${h.from_location} to ${h.to_location}${reqNo ? ` (REQ: ${reqNo})` : ''}.`)
  }

  const locOptions = locs.length > 0
    ? locs.map((l) => <option key={l.id} value={l.code}>{l.name} ({l.code})</option>)
    : null

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <h3 className="font-display font-semibold text-pine flex items-center gap-2">
          <ArrowLeftRight size={18} /> Stock Transfer
          {reqNo && <span className="text-sm font-normal text-forest bg-forest/10 px-2 py-0.5 rounded-full">REQ: {reqNo}</span>}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div>
            <label className="label">From location *</label>
            <select className="input" value={h.from_location} onChange={(e) => setH({ ...h, from_location: e.target.value })}>
              <option value="">Select…</option>
              {locOptions}
            </select>
          </div>
          <div>
            <label className="label">To location *</label>
            <select className="input" value={h.to_location} onChange={(e) => setH({ ...h, to_location: e.target.value })}>
              <option value="">Select…</option>
              {locOptions}
              <option value="CONSUMED">CONSUMED (consumption write-off)</option>
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={h.notes} placeholder="Optional" onChange={(e) => setH({ ...h, notes: e.target.value })} />
          </div>
        </div>
        <LineEditor items={items} lines={lines} setLines={setLines} withCost={false} />
        <button className="btn-primary" onClick={create}><ArrowLeftRight size={15} /> Post transfer</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">TRF No</th><th className="th">Date</th>
              <th className="th">From → To</th><th className="th">REQ</th>
              <th className="th">Items</th><th className="th">By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <>
                <tr key={t.id} className="hover:bg-leaf/20">
                  <td className="td money font-semibold">
                    <button onClick={() => setExpanded(expanded === t.id ? null : t.id)} className="flex items-center gap-1 hover:text-forest">
                      {t.trf_no} <ChevronRight size={13} className={`transition-transform ${expanded === t.id ? 'rotate-90' : ''}`} />
                    </button>
                  </td>
                  <td className="td text-xs">{fmtDate(t.trf_date)}</td>
                  <td className="td text-sm">{t.from_location} <span className="text-pine/40">→</span> {t.to_location}</td>
                  <td className="td text-xs text-forest">{t.requisitions?.req_no || '—'}</td>
                  <td className="td text-xs">{(t.transfer_items || []).length} items</td>
                  <td className="td text-xs text-pine/50">{t.created_by}</td>
                </tr>
                {expanded === t.id && (
                  <tr key={`${t.id}-d`}>
                    <td colSpan={6} className="px-6 pb-3 bg-leaf/20">
                      <div className="text-xs space-y-1 pt-2">
                        {(t.transfer_items || []).map((it) => (
                          <div key={it.id} className="flex gap-4 text-pine/70">
                            <span className="font-medium">{it.item_name}</span>
                            <span>Qty: {it.qty}</span>
                          </div>
                        ))}
                        {t.notes && <div className="text-pine/40 mt-1">Notes: {t.notes}</div>}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {rows.length === 0 && <tr><td className="td text-pine/40 text-center py-6" colSpan={6}>No transfers.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Returns ────────────────────────────────────────────────────────────── */
function ReturnsTab({ flash, userName }) {
  const [items, setItems] = useState([])
  const [vendors, setVendors] = useState([])
  const [rows, setRows] = useState([])
  const locs = useLocations()
  const [h, setH] = useState({ return_type: 'TO_STORE', vendor_id: '', from_location: '' })
  const [lines, setLines] = useState([])
  const [expanded, setExpanded] = useState(null)

  const load = async () => {
    const [{ data: it }, { data: v }, { data: rt }] = await Promise.all([
      supabase.from('inv_items').select('*').order('name'),
      supabase.from('vendors').select('*').eq('is_active', true).order('name'),
      supabase.from('stock_returns').select('*, vendors(name), return_items(*)').order('created_at', { ascending: false }),
    ])
    setItems(it || []); setVendors(v || []); setRows(rt || [])
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (lines.length === 0) { flash('অন্তত একটা item যোগ করুন।', 'error'); return }
    const { data: rt, error } = await supabase.from('stock_returns').insert({
      return_type: h.return_type,
      vendor_id: h.return_type === 'TO_VENDOR' ? (h.vendor_id || null) : null,
      from_location: h.from_location || null, created_by: userName,
    }).select().single()
    if (error) { flash(error.message, 'error'); return }
    await supabase.from('return_items').insert(lines.map((l) => ({ return_id: rt.id, item_id: l.item_id, item_name: l.item_name, qty: +l.qty })))
    setLines([]); load(); flash(`✓ ${rt.ret_no} posted.`)
  }

  const locOptions = locs.map((l) => <option key={l.id} value={l.code}>{l.name} ({l.code})</option>)

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <h3 className="font-display font-semibold text-pine flex items-center gap-2"><Undo2 size={18} /> Stock Return</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div>
            <label className="label">Return type</label>
            <select className="input" value={h.return_type} onChange={(e) => setH({ ...h, return_type: e.target.value })}>
              <option value="TO_STORE">Return to Store (back in stock)</option>
              <option value="TO_VENDOR">Return to Vendor (out of stock)</option>
            </select>
          </div>
          {h.return_type === 'TO_VENDOR' && (
            <div>
              <label className="label">Vendor</label>
              <select className="input" value={h.vendor_id} onChange={(e) => setH({ ...h, vendor_id: e.target.value })}>
                <option value="">Select vendor…</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">From location</label>
            <select className="input" value={h.from_location} onChange={(e) => setH({ ...h, from_location: e.target.value })}>
              <option value="">Select…</option>
              {locOptions}
            </select>
          </div>
        </div>
        <LineEditor items={items} lines={lines} setLines={setLines} withCost={false} />
        <button className="btn-primary" onClick={create}><Undo2 size={15} /> Post return</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr><th className="th">RET No</th><th className="th">Date</th><th className="th">Type</th><th className="th">Vendor</th><th className="th">From</th><th className="th">Items</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <>
                <tr key={r.id} className="hover:bg-leaf/20">
                  <td className="td money font-semibold">
                    <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="flex items-center gap-1 hover:text-forest">
                      {r.ret_no} <ChevronRight size={13} className={`transition-transform ${expanded === r.id ? 'rotate-90' : ''}`} />
                    </button>
                  </td>
                  <td className="td text-xs">{fmtDate(r.ret_date)}</td>
                  <td className="td text-xs"><span className={`status-chip ${r.return_type === 'TO_STORE' ? 'bg-forest/10 text-forest' : 'bg-amber/20 text-amber'}`}>{r.return_type}</span></td>
                  <td className="td text-sm">{r.vendors?.name || '—'}</td>
                  <td className="td text-xs">{r.from_location || '—'}</td>
                  <td className="td text-xs">{(r.return_items || []).length} items</td>
                </tr>
                {expanded === r.id && (
                  <tr key={`${r.id}-d`}>
                    <td colSpan={6} className="px-6 pb-3 bg-leaf/20">
                      <div className="text-xs space-y-1 pt-2">
                        {(r.return_items || []).map((it) => (
                          <div key={it.id} className="flex gap-4 text-pine/70">
                            <span className="font-medium">{it.item_name}</span>
                            <span>Qty: {it.qty}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {rows.length === 0 && <tr><td className="td text-pine/40 text-center py-6" colSpan={6}>No returns.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
