import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, exportXLSX, nightsBetween } from '../lib/helpers'
import { BarChart3, FileDown } from 'lucide-react'

const firstOfMonth = () => todayISO().slice(0, 8) + '01'

export default function ReportsHub() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    const [{ data: ch }, { data: pm }, { data: rooms }, { data: dues }] = await Promise.all([
      supabase.from('folio_charges').select('*').gte('charge_date', from).lte('charge_date', to),
      supabase.from('payments').select('*').gte('received_date', from).lte('received_date', to),
      supabase.from('rooms').select('id').eq('is_active', true),
      supabase.from('reservations').select('*, folio_charges(total), payments(amount)').eq('status', 'CHECKED_OUT'),
    ])
    const revByCat = {}
    for (const c of ch || []) { const k = c.charge_type; revByCat[k] = (revByCat[k] || 0) + +c.total }
    const payByMethod = {}
    for (const p of pm || []) payByMethod[p.method] = (payByMethod[p.method] || 0) + +p.amount
    const roomNights = (ch || []).filter((c) => c.charge_type === 'ROOM').length
    const roomRev = (ch || []).filter((c) => c.charge_type === 'ROOM').reduce((a, c) => a + +c.base_amount - +c.discount, 0)
    const adr = roomNights > 0 ? roomRev / roomNights : 0
    const days = Math.max(1, nightsBetween(from, to) + 1)
    const capacity = (rooms?.length || 0) * days
    const occupancy = capacity > 0 ? (roomNights / capacity) * 100 : 0
    const dueList = (dues || []).map((r) => {
      const billed = (r.folio_charges || []).reduce((a, c) => a + +c.total, 0)
      const paid = (r.payments || []).reduce((a, p) => a + +p.amount, 0)
      return { res_no: r.res_no, name: r.reservation_name, due: +(billed - paid).toFixed(2) }
    }).filter((r) => r.due > 0.009)
    setData({ revByCat, payByMethod, roomNights, adr, occupancy, capacity, dueList, totalRev: Object.values(revByCat).reduce((a, v) => a + v, 0), totalPay: Object.values(payByMethod).reduce((a, v) => a + v, 0) })
    setLoading(false)
  }
  useEffect(() => { run() }, []) // eslint-disable-line

  const exportAll = () => {
    if (!data) return
    exportXLSX(`Reports_${from}_to_${to}.xlsx`, [
      { name: 'Revenue by category', rows: [['Category', 'Total'], ...Object.entries(data.revByCat).map(([k, v]) => [k, v]), ['TOTAL', data.totalRev]] },
      { name: 'Payments by method', rows: [['Method', 'Total'], ...Object.entries(data.payByMethod).map(([k, v]) => [k, v]), ['TOTAL', data.totalPay]] },
      { name: 'Outstanding dues', rows: [['Reservation', 'Guest', 'Due'], ...data.dueList.map((d) => [d.res_no, d.name, d.due])] },
      { name: 'Occupancy', rows: [['Room-nights sold', data.roomNights], ['Capacity (room-nights)', data.capacity], ['Occupancy %', +data.occupancy.toFixed(1)], ['ADR', +data.adr.toFixed(2)]] },
    ])
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2"><BarChart3 className="text-forest" /> Reports</h1>
          <p className="text-sm text-pine/60">Revenue, collections, outstanding dues and occupancy across a date range.</p>
        </div>
        <div className="flex items-end gap-2">
          <div><label className="label">From</label><input type="date" className="input !w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">To</label><input type="date" className="input !w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <button className="btn-primary" onClick={run}>Run</button>
          {data && <button className="btn-ghost" onClick={exportAll}><FileDown size={15} /> Excel</button>}
        </div>
      </div>

      {loading && <div className="text-pine/50">Loading…</div>}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Total revenue (incl. tax)" val={fmtBDT(data.totalRev)} />
            <Stat label="Total collections" val={fmtBDT(data.totalPay)} />
            <Stat label="Occupancy" val={`${data.occupancy.toFixed(1)}%`} sub={`${data.roomNights}/${data.capacity} room-nights`} />
            <Stat label="ADR (avg daily rate)" val={fmtBDT(data.adr)} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Revenue by category">
              {Object.entries(data.revByCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => <Bar key={k} label={k} val={v} max={data.totalRev} />)}
              {Object.keys(data.revByCat).length === 0 && <p className="text-sm text-pine/40">No revenue in range.</p>}
            </Panel>
            <Panel title="Collections by method">
              {Object.entries(data.payByMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => <Bar key={k} label={k} val={v} max={data.totalPay} />)}
              {Object.keys(data.payByMethod).length === 0 && <p className="text-sm text-pine/40">No collections in range.</p>}
            </Panel>
          </div>
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-leaf font-display font-semibold text-pine">Outstanding dues (checked-out, balance &gt; 0)</div>
            <table className="w-full">
              <thead><tr><th className="th">Reservation</th><th className="th">Guest</th><th className="th text-right">Due</th></tr></thead>
              <tbody>
                {data.dueList.map((d) => (<tr key={d.res_no}><td className="td money text-xs">{d.res_no}</td><td className="td text-sm">{d.name}</td><td className="td money text-right text-red-600 font-semibold">{fmtBDT(d.due)}</td></tr>))}
                {data.dueList.length === 0 && <tr><td className="td text-pine/40" colSpan={3}>No outstanding dues — all checked-out guests settled.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const Stat = ({ label, val, sub }) => (<div className="card p-4"><div className="label">{label}</div><div className="font-display text-2xl font-bold text-pine money">{val}</div>{sub && <div className="text-xs text-pine/50 money">{sub}</div>}</div>)
const Panel = ({ title, children }) => (<div className="card p-5"><h3 className="font-display font-semibold text-pine mb-3">{title}</h3><div className="space-y-2">{children}</div></div>)
const Bar = ({ label, val, max }) => (
  <div>
    <div className="flex justify-between text-sm mb-1"><span>{label}</span><span className="money font-semibold">{fmtBDT(val)}</span></div>
    <div className="h-2 rounded-full bg-leaf/50 overflow-hidden"><div className="h-full bg-forest rounded-full" style={{ width: `${max > 0 ? (val / max) * 100 : 0}%` }} /></div>
  </div>
)
