import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO } from '../lib/helpers'
import { Plus, Trash2, Save, RotateCcw, Search, ClipboardList } from 'lucide-react'
import KPICards from '../components/KPICards.jsx'

const LOCATIONS = ['KITCHEN', 'BAR', 'STORE', 'HOUSEKEEPING', 'MAINTENANCE', 'FRONT_OFFICE', 'OTHER']
const REASONS = ['INTERNAL_USE', 'WASTAGE', 'COMPLIMENTARY', 'STAFF_MEAL', 'BREAKAGE', 'OTHER']

export default function ConsumptionEntry({ userName, isAdmin }) {
  const [invItems, setInvItems] = useState([])
  const [latestCost, setLatestCost] = useState({})
  const [entries, setEntries] = useState([])
  const [historyLoc, setHistoryLoc] = useState('ALL')
  const [form, setForm] = useState({ entry_date: todayISO(), location: 'KITCHEN', reason: 'INTERNAL_USE', reference: '', notes: '' })
  const [lines, setLines] = useState([])
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 5000) }

  const loadAll = async () => {
    const [{ data: inv }, { data: grn }, { data: ce }] = await Promise.all([
      supabase.from('inv_items').select('*').eq('is_active', true).order('name'),
      supabase.from('grn_items').select('item_id, unit_cost, goods_receipts(grn_date)'),
      supabase.from('consumption_entries').select('*, consumption_lines(*)').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(60),
    ])
    setInvItems(inv || [])

    const byItem = {}
    ;(grn || []).forEach((row) => {
      const date = row.goods_receipts?.grn_date
      if (!date || !row.item_id) return
      const cur = byItem[row.item_id]
      if (!cur || date > cur.date) byItem[row.item_id] = { date, cost: Number(row.unit_cost) || 0 }
    })
    const costMap = {}
    Object.entries(byItem).forEach(([id, v]) => { costMap[id] = v.cost })
    setLatestCost(costMap)
    setEntries(ce || [])
  }
  useEffect(() => { loadAll() }, [])

  const filteredInv = invItems.filter((i) =>
    (!search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.code || '').toLowerCase().includes(search.toLowerCase())) &&
    !lines.some((l) => l.item_id === i.id)
  )

  const addLine = (it) => {
    setLines((prev) => [...prev, { item_id: it.id, item_name: it.name, unit: it.unit, qty: 1, unit_cost: latestCost[it.id] || 0 }])
    setSearch('')
  }
  const updateLine = (idx, field, val) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)))
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx))

  const totalCost = lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0)

  const resetForm = () => {
    setLines([])
    setForm((f) => ({ ...f, reference: '', notes: '' }))
  }

  const saveEntry = async () => {
    if (lines.length === 0) { flash('অন্তত একটা item যোগ করুন।'); return }
    if (lines.some((l) => !l.qty || Number(l.qty) <= 0)) { flash('সব item-এর qty শূন্যের চেয়ে বেশি হতে হবে।'); return }
    setBusy(true)
    try {
      const { data: header, error: hErr } = await supabase.from('consumption_entries').insert({
        entry_date: form.entry_date,
        location: form.location,
        reason: form.reason,
        reference: form.reference || null,
        notes: form.notes || null,
        created_by: userName,
      }).select().single()
      if (hErr) throw hErr

      const lineRows = lines.map((l) => ({
        consumption_id: header.id,
        item_id: l.item_id,
        item_name: l.item_name,
        qty: Number(l.qty) || 0,
        unit_cost: Number(l.unit_cost) || 0,
        line_cost: +((Number(l.qty) || 0) * (Number(l.unit_cost) || 0)).toFixed(2),
      }))
      const { error: lErr } = await supabase.from('consumption_lines').insert(lineRows)
      if (lErr) throw lErr

      flash(`${header.entry_no} সেভ হয়েছে — মোট খরচ ${fmtBDT(totalCost)}`)
      resetForm()
      await loadAll()
    } catch (e) {
      flash(e.message)
    }
    setBusy(false)
  }

  const visibleEntries = entries.filter((e) => historyLoc === 'ALL' || e.location === historyLoc)
  const entryTotal = (e) => (e.consumption_lines || []).reduce((s, l) => s + Number(l.line_cost || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine">Consumption Entry</h1>
          <p className="text-sm text-pine/60">Location-wise stock consumption — Kitchen, Bar, Store, Housekeeping ইত্যাদির internal use/wastage এন্ট্রি।</p>
        </div>
      </div>
      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Entry form */}
        <div className="card p-4 lg:col-span-3">
          <h3 className="font-display font-semibold text-pine mb-3 flex items-center gap-2"><ClipboardList size={18} /> New Consumption Entry</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div><label className="label">Date</label>
              <input type="date" className="input" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
            </div>
            <div><label className="label">Location</label>
              <select className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
                {LOCATIONS.map((l) => <option key={l} value={l}>{l.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><label className="label">Reason</label>
              <select className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                {REASONS.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><label className="label">Reference</label>
              <input className="input" placeholder="optional" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
          </div>

          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-pine/30" />
            <input className="input pl-9" placeholder="Search raw material to add…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-leaf rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredInv.length === 0 && <div className="px-3 py-2 text-sm text-pine/40">No matching items.</div>}
                {filteredInv.map((it) => (
                  <button key={it.id} type="button" onClick={() => addLine(it)} className="w-full text-left px-3 py-2 text-sm hover:bg-leaf/40 flex justify-between">
                    <span>{it.name}</span>
                    <span className="text-xs text-pine/40">{it.unit} · {fmtBDT(latestCost[it.id] || 0)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length > 0 ? (
            <div className="space-y-1.5 mb-3">
              {lines.map((l, idx) => (
                <div key={l.item_id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{l.item_name} <span className="text-xs text-pine/40">({l.unit})</span></span>
                  <input type="number" min="0" step="0.01" className="input !w-20 !py-1 money text-right" value={l.qty} onChange={(e) => updateLine(idx, 'qty', e.target.value)} />
                  <span className="text-xs text-pine/40">×</span>
                  <input type="number" min="0" step="0.01" className="input !w-24 !py-1 money text-right" value={l.unit_cost} onChange={(e) => updateLine(idx, 'unit_cost', e.target.value)} />
                  <span className="money w-20 text-right text-sm font-semibold">{fmtBDT((Number(l.qty) || 0) * (Number(l.unit_cost) || 0))}</span>
                  <button onClick={() => removeLine(idx)} className="text-red-300 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-pine/50 py-3 text-center">উপরের search থেকে raw material যোগ করুন।</p>
          )}

          <input className="input text-sm mb-3" placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <div className="border-t border-leaf pt-3 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-pine/60">Total cost: </span>
              <span className="font-bold money text-amber-700">{fmtBDT(totalCost)}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost !py-1.5" onClick={resetForm} disabled={busy}><RotateCcw size={14} /> Reset</button>
              <button className="btn-primary !py-1.5" onClick={saveEntry} disabled={busy}><Save size={15} /> {busy ? 'Saving…' : 'Save entry'}</button>
            </div>
          </div>
        </div>

        {/* Quick tips / cost reference */}
        <div className="card p-4 lg:col-span-2">
          <h3 className="font-display font-semibold text-pine mb-2 text-sm">নোট</h3>
          <ul className="text-xs text-pine/60 space-y-1.5 list-disc pl-4">
            <li>Unit cost auto-fill হয় সবচেয়ে সাম্প্রতিক GRN (Goods Receipt) purchase rate থেকে — প্রয়োজনে হাতে বদলানো যাবে।</li>
            <li>এই entry শুধু consumption রেকর্ড রাখে; stock balance/ledger রিপোর্ট আলাদা একটা future ফিচার হবে।</li>
            <li>Restaurant POS-এ অর্ডার সেটেল হলে এখনো automatic ভাবে recipe থেকে consumption কাটে না — এটা manual entry। চাইলে future-এ auto-deduction যোগ করা যাবে।</li>
          </ul>
        </div>
      </div>

      {/* History */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h3 className="font-display font-semibold text-pine">History</h3>
        <div className="flex gap-1.5 ml-2 flex-wrap">
          <button onClick={() => setHistoryLoc('ALL')} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${historyLoc === 'ALL' ? 'bg-pine text-white' : 'bg-white border border-leaf text-pine/70'}`}>All</button>
          {LOCATIONS.map((l) => (
            <button key={l} onClick={() => setHistoryLoc(l)} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${historyLoc === l ? 'bg-pine text-white' : 'bg-white border border-leaf text-pine/70'}`}>{l.replace('_', ' ')}</button>
          ))}
        </div>
        <button className="btn-ghost !py-1 ml-auto" onClick={loadAll}><RotateCcw size={13} /> Refresh</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Entry No</th>
              <th className="th">Date</th>
              <th className="th">Location</th>
              <th className="th">Reason</th>
              <th className="th">Items</th>
              <th className="th text-right">Total Cost</th>
              <th className="th">By</th>
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((e) => (
              <tr key={e.id} className="hover:bg-leaf/20 align-top">
                <td className="td font-semibold text-sm">{e.entry_no}</td>
                <td className="td text-sm">{fmtDate(e.entry_date)}</td>
                <td className="td"><span className="status-chip bg-pine/10 text-pine">{e.location}</span></td>
                <td className="td text-xs text-pine/60">{e.reason?.replace('_', ' ')}</td>
                <td className="td text-xs text-pine/70">{(e.consumption_lines || []).map((l) => `${l.item_name} (${l.qty})`).join(', ') || '—'}</td>
                <td className="td text-right money font-semibold">{fmtBDT(entryTotal(e))}</td>
                <td className="td text-xs text-pine/50">{e.created_by || '—'}</td>
              </tr>
            ))}
            {visibleEntries.length === 0 && (
              <tr><td className="td text-pine/50 text-center py-6" colSpan={7}>কোনো consumption entry নেই{historyLoc !== 'ALL' ? ` "${historyLoc}" location-এর জন্য` : ''}।</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
