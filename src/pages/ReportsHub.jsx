import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, exportXLSX, nightsBetween } from '../lib/helpers'
import {
  BarChart3, FileDown, AlertCircle, TrendingUp, ShoppingBag, Banknote,
  Scale, BookOpen, PieChart, Activity, Landmark, CreditCard, BookMarked,
  Printer, Users, Building2, FileText,
} from 'lucide-react'

/* ─── Tab definitions ───────────────────────────────────────────────────── */
const TABS = [
  { id: 'dashboard',         label: 'Dashboard',              icon: BarChart3,   group: 'Operations' },
  { id: 'sales',             label: 'Sales & Reservations',   icon: TrendingUp,  group: 'Operations' },
  { id: 'occupancy',         label: 'Occupancy & RevPAR',     icon: Building2,   group: 'Operations' },
  { id: 'guest_ledger',      label: 'Guest Ledger',           icon: FileText,    group: 'Operations' },
  { id: 'city_ledger',       label: 'City Ledger',            icon: Building2,   group: 'Operations' },
  { id: 'agency_commission', label: 'Agency Commission',      icon: Banknote,    group: 'Operations' },
  { id: 'shareholder',       label: 'Shareholder Entitlement',icon: Users,       group: 'Operations' },
  { id: 'pos',               label: 'POS Sales Summary',      icon: ShoppingBag, group: 'Restaurant' },
  { id: 'kot',               label: 'KOT Register',           icon: FileText,    group: 'Restaurant' },
  { id: 'fnb_revenue',       label: 'F&B Daily Revenue',      icon: PieChart,    group: 'Restaurant' },
  { id: 'pl',                label: 'Profit & Loss',          icon: PieChart,    group: 'Accounting' },
  { id: 'balance_sheet',     label: 'Balance Sheet',          icon: Landmark,    group: 'Accounting' },
  { id: 'cashflow',          label: 'Cash Flow Statement',    icon: Activity,    group: 'Accounting' },
  { id: 'trial_balance',     label: 'Trial Balance',          icon: Scale,       group: 'Accounting' },
  { id: 'ledger',            label: 'General Ledger',         icon: BookOpen,    group: 'Accounting' },
  { id: 'bank_book',         label: 'Bank Book',              icon: BookMarked,  group: 'Accounting' },
  { id: 'cash_book',         label: 'Cash Book',              icon: BookMarked,  group: 'Accounting' },
  { id: 'bank_recon',        label: 'Bank Reconciliation',    icon: CreditCard,  group: 'Accounting' },
  { id: 'retained_earnings', label: 'Retained Earnings',      icon: Banknote,    group: 'Accounting' },
  { id: 'nav',               label: 'NAV / Equity Report',    icon: TrendingUp,  group: 'Accounting' },
  { id: 'ap_aging',          label: 'AP Aging',               icon: AlertCircle, group: 'Accounting' },
  { id: 'ar_aging',          label: 'AR Aging',               icon: AlertCircle, group: 'Accounting' },
  { id: 'vat_sales',         label: 'VAT Sales Register',     icon: FileText,    group: 'Statutory'  },
  { id: 'vat_purchase',      label: 'VAT Purchase Register',  icon: FileText,    group: 'Statutory'  },
  { id: 'ait',               label: 'AIT Deduction Register', icon: FileText,    group: 'Statutory'  },
]

const GROUPS = ['Operations', 'Restaurant', 'Accounting', 'Statutory']
const firstOfMonth = () => todayISO().slice(0, 8) + '01'
const firstOfYear  = () => todayISO().slice(0, 4) + '-01-01'

/* ─── PDF export ────────────────────────────────────────────────────────── */
function printToPDF(title, htmlContent) {
  const win = window.open('', '_blank', 'width=1000,height=800')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}
  h1{font-size:18px;margin:0 0 4px}
  h2{font-size:14px;margin:0 0 12px;color:#444}
  .meta{font-size:11px;color:#666;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#f5f5f0;font-size:11px;font-weight:600;text-align:left;padding:6px 8px;border:0.5px solid #d0d0c0}
  td{font-size:11px;padding:5px 8px;border:0.5px solid #e0e0d0}
  .money{font-family:monospace;text-align:right}
  .total-row td{font-weight:700;background:#f0f0e8}
  .group-row td{font-weight:600;background:#f8f8f4;font-size:12px}
  .section{margin-bottom:24px}
  .kpi-grid{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px}
  .kpi{border:0.5px solid #d0d0c0;border-radius:4px;padding:8px 12px;min-width:140px}
  .kpi-label{font-size:10px;color:#666;margin-bottom:2px}
  .kpi-val{font-size:16px;font-weight:700}
  @media print{@page{margin:15mm;size:A4}}
</style>
</head><body>
${htmlContent}
<script>setTimeout(()=>{window.print();window.close();},400);</script>
</body></html>`)
  win.document.close()
}

function companyHeader(company, title, period) {
  return `<h1>${company || 'Aura Stay ERP'}</h1>
<h2>${title}</h2>
<div class="meta">Period: ${period} &nbsp;|&nbsp; Printed: ${new Date().toLocaleString('en-BD')}</div>`
}

/* ─── Shared UI ─────────────────────────────────────────────────────────── */
const Stat = ({ label, val, sub, accent }) => (
  <div className="card p-4">
    <div className="label">{label}</div>
    <div className={`font-display text-2xl font-bold money ${accent ? 'text-forest' : 'text-pine'}`}>{val}</div>
    {sub && <div className="text-xs text-pine/50 money">{sub}</div>}
  </div>
)

const Panel = ({ title, children }) => (
  <div className="card p-5">
    <h3 className="font-display font-semibold text-pine mb-3">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
)

const Bar = ({ label, val, max }) => (
  <div>
    <div className="flex justify-between text-sm mb-1">
      <span>{label}</span>
      <span className="money font-semibold">{fmtBDT(val)}</span>
    </div>
    <div className="h-2 rounded-full bg-leaf/50 overflow-hidden">
      <div className="h-full bg-forest rounded-full" style={{ width: `${max > 0 ? (val / max) * 100 : 0}%` }} />
    </div>
  </div>
)

const DateRange = ({ from, to, setFrom, setTo, onRun, data, onExport, onPrint }) => (
  <div className="flex items-end gap-2 flex-wrap">
    <div><label className="label">From</label><input type="date" className="input !w-40" value={from} onChange={e => setFrom(e.target.value)} /></div>
    <div><label className="label">To</label><input type="date" className="input !w-40" value={to} onChange={e => setTo(e.target.value)} /></div>
    <button className="btn-primary" onClick={onRun}>Run</button>
    {data && onExport && <button className="btn-ghost" onClick={onExport}><FileDown size={15} /> Excel</button>}
    {data && onPrint && <button className="btn-ghost" onClick={onPrint}><Printer size={15} /> PDF</button>}
  </div>
)

const Tbl = ({ heads, rows, footRow }) => (
  <div className="card overflow-hidden">
    <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr>{heads.map((h, i) => <th key={i} className={`th ${h.right ? 'text-right' : ''}`}>{h.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className={`${r._group ? 'bg-leaf/30 font-semibold' : 'hover:bg-leaf/20'} ${r._total ? 'bg-leaf/50 font-bold' : ''}`}>
            {heads.map((h, ci) => (
              <td key={ci} className={`td text-sm ${h.right ? 'text-right money' : ''} ${h.red && r[h.key] < 0 ? 'text-red-600' : ''}`}>
                {h.fmt ? h.fmt(r[h.key], r) : r[h.key] ?? '—'}
              </td>
            ))}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td className="td text-pine/40 text-center py-6" colSpan={heads.length}>No data in selected range.</td></tr>
        )}
        {footRow && (
          <tr className="bg-leaf/50 font-bold">
            {heads.map((h, i) => (
              <td key={i} className={`td text-sm ${h.right ? 'text-right money' : ''}`}>
                {footRow[h.key] !== undefined ? (h.fmt ? h.fmt(footRow[h.key]) : footRow[h.key]) : (i === 0 ? 'TOTAL' : '')}
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
    </div>
  </div>
)

function useCompany() {
  const [co, setCo] = useState('')
  useEffect(() => {
    supabase.from('company_settings').select('company_name').single()
      .then(({ data }) => { if (data) setCo(data.company_name || '') })
  }, [])
  return co
}

function Loading() { return <div className="text-pine/50 py-6">Loading…</div> }
function Err({ msg }) {
  return <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2"><AlertCircle size={18} />{msg}</div>
}

/* ═══════════════════════════════════════════════════════════════════════════
   OPERATIONS REPORTS
═══════════════════════════════════════════════════════════════════════════ */

/* ── Dashboard ──────────────────────────────────────────────────────────── */
function DashboardTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const [{ data: ch }, { data: pm }, { data: rooms }, { data: res }] = await Promise.all([
        supabase.from('folio_charges').select('charge_type,total,base_amount,discount').gte('charge_date', from).lte('charge_date', to),
        supabase.from('payments').select('method,amount').gte('received_date', from).lte('received_date', to),
        supabase.from('rooms').select('id').eq('is_active', true),
        supabase.from('reservations').select('status').gte('check_in', from).lte('check_in', to),
      ])
      const revByCat = {}
      for (const c of ch || []) revByCat[c.charge_type] = (revByCat[c.charge_type] || 0) + +c.total
      const payByMethod = {}
      for (const p of pm || []) payByMethod[p.method] = (payByMethod[p.method] || 0) + +p.amount
      const roomNights = (ch || []).filter(c => c.charge_type === 'ROOM').length
      const roomRev = (ch || []).filter(c => c.charge_type === 'ROOM').reduce((a, c) => a + +c.base_amount - +c.discount, 0)
      const days = Math.max(1, nightsBetween(from, to) + 1)
      const capacity = (rooms?.length || 0) * days
      setData({
        revByCat, payByMethod, roomNights,
        adr: roomNights > 0 ? roomRev / roomNights : 0,
        occupancy: capacity > 0 ? (roomNights / capacity) * 100 : 0,
        capacity,
        totalRev: Object.values(revByCat).reduce((a, v) => a + v, 0),
        totalPay: Object.values(payByMethod).reduce((a, v) => a + v, 0),
        resCount: (res || []).length,
      })
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const onPrint = () => {
    if (!data) return
    const rows = Object.entries(data.revByCat).map(([k, v]) => `<tr><td>${k}</td><td class="money">${fmtBDT(v)}</td></tr>`).join('')
    printToPDF('Dashboard Report', `
      ${companyHeader(co, 'Management Dashboard', `${from} to ${to}`)}
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-val">${fmtBDT(data.totalRev)}</div></div>
        <div class="kpi"><div class="kpi-label">Collections</div><div class="kpi-val">${fmtBDT(data.totalPay)}</div></div>
        <div class="kpi"><div class="kpi-label">Occupancy</div><div class="kpi-val">${data.occupancy.toFixed(1)}%</div></div>
        <div class="kpi"><div class="kpi-label">ADR</div><div class="kpi-val">${fmtBDT(data.adr)}</div></div>
        <div class="kpi"><div class="kpi-label">Reservations</div><div class="kpi-val">${data.resCount}</div></div>
      </div>
      <div class="section">
        <b>Revenue by Category</b>
        <table><thead><tr><th>Category</th><th class="money">Amount (৳)</th></tr></thead>
        <tbody>${rows}<tr class="total-row"><td>TOTAL</td><td class="money">${fmtBDT(data.totalRev)}</td></tr></tbody></table>
      </div>`)
  }

  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Total Revenue" val={fmtBDT(data.totalRev)} accent />
            <Stat label="Collections" val={fmtBDT(data.totalPay)} />
            <Stat label="Occupancy" val={`${data.occupancy.toFixed(1)}%`} sub={`${data.roomNights}/${data.capacity} room-nights`} />
            <Stat label="ADR" val={fmtBDT(data.adr)} sub={`${data.resCount} reservations`} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Revenue by category">
              {Object.entries(data.revByCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => <Bar key={k} label={k} val={v} max={data.totalRev} />)}
              {!Object.keys(data.revByCat).length && <p className="text-sm text-pine/40">No revenue in range.</p>}
            </Panel>
            <Panel title="Collections by method">
              {Object.entries(data.payByMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => <Bar key={k} label={k} val={v} max={data.totalPay} />)}
              {!Object.keys(data.payByMethod).length && <p className="text-sm text-pine/40">No collections in range.</p>}
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Sales & Reservations ───────────────────────────────────────────────── */
function SalesReportsTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const [{ data: ch }, { data: pm }, { data: rooms }, { data: dues }] = await Promise.all([
        supabase.from('folio_charges').select('*').gte('charge_date', from).lte('charge_date', to),
        supabase.from('payments').select('*').gte('received_date', from).lte('received_date', to),
        supabase.from('rooms').select('id').eq('is_active', true),
        supabase.from('reservations').select('res_no,reservation_name,folio_charges(total),payments(amount)').eq('status', 'CHECKED_OUT'),
      ])
      const revByCat = {}
      for (const c of ch || []) revByCat[c.charge_type] = (revByCat[c.charge_type] || 0) + +c.total
      const payByMethod = {}
      for (const p of pm || []) payByMethod[p.method] = (payByMethod[p.method] || 0) + +p.amount
      const roomNights = (ch || []).filter(c => c.charge_type === 'ROOM').length
      const roomRev = (ch || []).filter(c => c.charge_type === 'ROOM').reduce((a, c) => a + +c.base_amount - +c.discount, 0)
      const days = Math.max(1, nightsBetween(from, to) + 1)
      const capacity = (rooms?.length || 0) * days
      const dueList = (dues || []).map(r => {
        const billed = (r.folio_charges || []).reduce((a, c) => a + +c.total, 0)
        const paid = (r.payments || []).reduce((a, p) => a + +p.amount, 0)
        return { res_no: r.res_no, name: r.reservation_name, due: +(billed - paid).toFixed(2) }
      }).filter(r => r.due > 0.01)
      setData({
        revByCat, payByMethod, roomNights, dueList,
        adr: roomNights > 0 ? roomRev / roomNights : 0,
        occupancy: capacity > 0 ? (roomNights / capacity) * 100 : 0,
        capacity,
        totalRev: Object.values(revByCat).reduce((a, v) => a + v, 0),
        totalPay: Object.values(payByMethod).reduce((a, v) => a + v, 0),
      })
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const onExport = () => {
    if (!data) return
    exportXLSX(`Sales_${from}_${to}.xlsx`, [
      { name: 'Revenue by Category', rows: [['Category','Amount'],...Object.entries(data.revByCat).map(([k,v])=>[k,v]),['TOTAL',data.totalRev]] },
      { name: 'Collections', rows: [['Method','Amount'],...Object.entries(data.payByMethod).map(([k,v])=>[k,v]),['TOTAL',data.totalPay]] },
      { name: 'Outstanding Dues', rows: [['Res No','Guest','Due ৳'],...data.dueList.map(d=>[d.res_no,d.name,d.due])] },
      { name: 'KPIs', rows: [['Room-nights',data.roomNights],['Capacity',data.capacity],['Occupancy %',+data.occupancy.toFixed(1)],['ADR',+data.adr.toFixed(2)]] },
    ])
  }

  const onPrint = () => {
    if (!data) return
    const revRows = Object.entries(data.revByCat).map(([k,v])=>`<tr><td>${k}</td><td class="money">${fmtBDT(v)}</td></tr>`).join('')
    const dueRows = data.dueList.map(d=>`<tr><td>${d.res_no}</td><td>${d.name}</td><td class="money">${fmtBDT(d.due)}</td></tr>`).join('')
    printToPDF('Sales Report', `
      ${companyHeader(co,'Sales & Reservations Report',`${from} to ${to}`)}
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-val">${fmtBDT(data.totalRev)}</div></div>
        <div class="kpi"><div class="kpi-label">Collections</div><div class="kpi-val">${fmtBDT(data.totalPay)}</div></div>
        <div class="kpi"><div class="kpi-label">Occupancy</div><div class="kpi-val">${data.occupancy.toFixed(1)}%</div></div>
        <div class="kpi"><div class="kpi-label">ADR</div><div class="kpi-val">${fmtBDT(data.adr)}</div></div>
      </div>
      <div class="section"><b>Revenue by Category</b>
      <table><thead><tr><th>Category</th><th class="money">৳</th></tr></thead>
      <tbody>${revRows}<tr class="total-row"><td>TOTAL</td><td class="money">${fmtBDT(data.totalRev)}</td></tr></tbody></table></div>
      <div class="section"><b>Outstanding Dues (Checked-out)</b>
      <table><thead><tr><th>Res No</th><th>Guest</th><th class="money">Due ৳</th></tr></thead>
      <tbody>${dueRows || '<tr><td colspan="3">None</td></tr>'}</tbody></table></div>`)
  }

  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Total revenue" val={fmtBDT(data.totalRev)} accent />
            <Stat label="Collections" val={fmtBDT(data.totalPay)} />
            <Stat label="Occupancy" val={`${data.occupancy.toFixed(1)}%`} sub={`${data.roomNights}/${data.capacity} room-nights`} />
            <Stat label="ADR" val={fmtBDT(data.adr)} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Revenue by category">
              {Object.entries(data.revByCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=><Bar key={k} label={k} val={v} max={data.totalRev} />)}
            </Panel>
            <Panel title="Collections by method">
              {Object.entries(data.payByMethod).sort((a,b)=>b[1]-a[1]).map(([k,v])=><Bar key={k} label={k} val={v} max={data.totalPay} />)}
            </Panel>
          </div>
          <Tbl
            heads={[{label:'Res No',key:'res_no'},{label:'Guest',key:'name'},{label:'Due',key:'due',right:true,fmt:fmtBDT,red:true}]}
            rows={data.dueList}
          />
        </>
      )}
    </div>
  )
}

/* ── Occupancy & RevPAR ─────────────────────────────────────────────────── */
function OccupancyTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const [{ data: rooms }, { data: res }, { data: ch }] = await Promise.all([
        supabase.from('rooms').select('id,room_type,base_rate').eq('is_active', true),
        supabase.from('reservations').select('res_no,reservation_name,check_in,check_out,status,room_type').gte('check_in', from).lte('check_in', to),
        supabase.from('folio_charges').select('charge_type,base_amount,discount').gte('charge_date', from).lte('charge_date', to).eq('charge_type', 'ROOM'),
      ])
      const totalRooms = rooms?.length || 0
      const days = Math.max(1, nightsBetween(from, to) + 1)
      const capacity = totalRooms * days
      const occupied = (res || []).filter(r => ['CHECKED_IN','CHECKED_OUT'].includes(r.status)).length
      const roomRev = (ch || []).reduce((a, c) => a + +c.base_amount - +c.discount, 0)
      const roomNights = ch?.length || 0
      const adr = roomNights > 0 ? roomRev / roomNights : 0
      const occupancy = capacity > 0 ? (roomNights / capacity) * 100 : 0
      const revpar = totalRooms > 0 ? roomRev / (totalRooms * days) : 0

      const byType = {}
      for (const r of res || []) {
        if (!byType[r.room_type]) byType[r.room_type] = 0
        byType[r.room_type]++
      }
      setData({ totalRooms, capacity, roomNights, occupancy, adr, revpar, roomRev, occupied, byType, days, resCount: res?.length || 0 })
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const onExport = () => {
    if (!data) return
    exportXLSX(`Occupancy_${from}_${to}.xlsx`, [
      { name: 'Occupancy KPIs', rows: [
        ['Period',`${from} to ${to}`],['Total Rooms',data.totalRooms],['Available Room-nights',data.capacity],
        ['Occupied Room-nights',data.roomNights],['Occupancy %',+data.occupancy.toFixed(1)],
        ['Room Revenue (৳)',+data.roomRev.toFixed(2)],['ADR (৳)',+data.adr.toFixed(2)],['RevPAR (৳)',+data.revpar.toFixed(2)],
      ]},
      { name: 'By Room Type', rows: [['Room Type','Reservations'],...Object.entries(data.byType).map(([k,v])=>[k,v])] },
    ])
  }

  const onPrint = () => {
    if (!data) return
    const typeRows = Object.entries(data.byType).map(([k,v])=>`<tr><td>${k}</td><td class="money">${v}</td></tr>`).join('')
    printToPDF('Occupancy Report', `
      ${companyHeader(co,'Occupancy & RevPAR Report',`${from} to ${to}`)}
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Total Rooms</div><div class="kpi-val">${data.totalRooms}</div></div>
        <div class="kpi"><div class="kpi-label">Occupancy</div><div class="kpi-val">${data.occupancy.toFixed(1)}%</div></div>
        <div class="kpi"><div class="kpi-label">ADR</div><div class="kpi-val">${fmtBDT(data.adr)}</div></div>
        <div class="kpi"><div class="kpi-label">RevPAR</div><div class="kpi-val">${fmtBDT(data.revpar)}</div></div>
        <div class="kpi"><div class="kpi-label">Room Revenue</div><div class="kpi-val">${fmtBDT(data.roomRev)}</div></div>
      </div>
      <div class="section"><b>By Room Type</b>
      <table><thead><tr><th>Room Type</th><th class="money">Reservations</th></tr></thead>
      <tbody>${typeRows}</tbody></table></div>`)
  }

  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Stat label="Total rooms" val={data.totalRooms} />
            <Stat label="Occupancy" val={`${data.occupancy.toFixed(1)}%`} sub={`${data.roomNights}/${data.capacity}`} accent />
            <Stat label="ADR" val={fmtBDT(data.adr)} />
            <Stat label="RevPAR" val={fmtBDT(data.revpar)} accent />
            <Stat label="Room revenue" val={fmtBDT(data.roomRev)} />
          </div>
          <Tbl
            heads={[{label:'Room Type',key:'type'},{label:'Reservations',key:'count',right:true}]}
            rows={Object.entries(data.byType).map(([k,v])=>({type:k,count:v}))}
          />
        </>
      )}
    </div>
  )
}

/* ── Guest Ledger ───────────────────────────────────────────────────────── */
function GuestLedgerTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data: res } = await supabase.from('reservations')
        .select('res_no,reservation_name,check_in,check_out,status,folio_charges(total,charge_type),payments(amount)')
        .in('status', ['CHECKED_IN','CHECKED_OUT','CONFIRMED'])
        .gte('check_in', from).lte('check_in', to)
      const mapped = (res || []).map(r => {
        const charges = (r.folio_charges || []).reduce((a, c) => a + +c.total, 0)
        const paid = (r.payments || []).reduce((a, p) => a + +p.amount, 0)
        return { res_no: r.res_no, name: r.reservation_name, checkin: r.check_in, checkout: r.check_out, status: r.status, charges: +charges.toFixed(2), paid: +paid.toFixed(2), balance: +(charges - paid).toFixed(2) }
      })
      setRows(mapped)
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const totals = rows ? { charges: rows.reduce((a,r)=>a+r.charges,0), paid: rows.reduce((a,r)=>a+r.paid,0), balance: rows.reduce((a,r)=>a+r.balance,0) } : null

  const onExport = () => {
    if (!rows) return
    exportXLSX(`GuestLedger_${from}_${to}.xlsx`, [
      { name: 'Guest Ledger', rows: [['Res No','Guest','Check-in','Check-out','Status','Charges ৳','Paid ৳','Balance ৳'], ...rows.map(r=>[r.res_no,r.name,r.checkin,r.checkout,r.status,r.charges,r.paid,r.balance]), ['','','','','TOTAL',totals?.charges,totals?.paid,totals?.balance]] },
    ])
  }

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.res_no}</td><td>${r.name}</td><td>${r.checkin}</td><td>${r.status}</td><td class="money">${fmtBDT(r.charges)}</td><td class="money">${fmtBDT(r.paid)}</td><td class="money">${fmtBDT(r.balance)}</td></tr>`).join('')
    printToPDF('Guest Ledger', `
      ${companyHeader(co,'Guest Ledger',`${from} to ${to}`)}
      <table><thead><tr><th>Res No</th><th>Guest</th><th>Check-in</th><th>Status</th><th class="money">Charges ৳</th><th class="money">Paid ৳</th><th class="money">Balance ৳</th></tr></thead>
      <tbody>${trs}
      <tr class="total-row"><td colspan="4">TOTAL</td><td class="money">${fmtBDT(totals?.charges)}</td><td class="money">${fmtBDT(totals?.paid)}</td><td class="money">${fmtBDT(totals?.balance)}</td></tr>
      </tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Total charges" val={fmtBDT(totals.charges)} />
            <Stat label="Total paid" val={fmtBDT(totals.paid)} />
            <Stat label="Outstanding balance" val={fmtBDT(totals.balance)} accent />
          </div>
          <Tbl
            heads={[{label:'Res No',key:'res_no'},{label:'Guest',key:'name'},{label:'Check-in',key:'checkin'},{label:'Status',key:'status'},{label:'Charges',key:'charges',right:true,fmt:fmtBDT},{label:'Paid',key:'paid',right:true,fmt:fmtBDT},{label:'Balance',key:'balance',right:true,fmt:fmtBDT,red:true}]}
            rows={rows}
            footRow={totals}
          />
        </>
      )}
    </div>
  )
}

/* ── City Ledger (Agency Receivables) ───────────────────────────────────── */
function CityLedgerTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data: agencies } = await supabase.from('agencies').select('id,name,due_balance')
      const { data: res } = await supabase.from('reservations')
        .select('agency_id,folio_charges(total),payments(amount)')
        .not('agency_id', 'is', null).gte('check_in', from).lte('check_in', to)
      const agencyMap = {}
      for (const a of agencies || []) agencyMap[a.id] = { name: a.name, charges: 0, paid: 0 }
      for (const r of res || []) {
        if (!agencyMap[r.agency_id]) continue
        agencyMap[r.agency_id].charges += (r.folio_charges || []).reduce((a, c) => a + +c.total, 0)
        agencyMap[r.agency_id].paid += (r.payments || []).reduce((a, p) => a + +p.amount, 0)
      }
      setRows(Object.entries(agencyMap).map(([id, v]) => ({ agency: v.name, charges: +v.charges.toFixed(2), paid: +v.paid.toFixed(2), balance: +(v.charges - v.paid).toFixed(2) })))
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const totals = rows ? { charges: rows.reduce((a,r)=>a+r.charges,0), paid: rows.reduce((a,r)=>a+r.paid,0), balance: rows.reduce((a,r)=>a+r.balance,0) } : null

  const onExport = () => rows && exportXLSX(`CityLedger_${from}_${to}.xlsx`, [
    { name: 'City Ledger', rows: [['Agency','Charges ৳','Paid ৳','Balance ৳'],...rows.map(r=>[r.agency,r.charges,r.paid,r.balance]),['TOTAL',totals.charges,totals.paid,totals.balance]] },
  ])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.agency}</td><td class="money">${fmtBDT(r.charges)}</td><td class="money">${fmtBDT(r.paid)}</td><td class="money">${fmtBDT(r.balance)}</td></tr>`).join('')
    printToPDF('City Ledger', `${companyHeader(co,'City Ledger — Agency Receivables',`${from} to ${to}`)}
    <table><thead><tr><th>Agency</th><th class="money">Charges ৳</th><th class="money">Paid ৳</th><th class="money">Balance ৳</th></tr></thead>
    <tbody>${trs}<tr class="total-row"><td>TOTAL</td><td class="money">${fmtBDT(totals?.charges)}</td><td class="money">${fmtBDT(totals?.paid)}</td><td class="money">${fmtBDT(totals?.balance)}</td></tr></tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Total billed" val={fmtBDT(totals.charges)} />
            <Stat label="Total collected" val={fmtBDT(totals.paid)} />
            <Stat label="Outstanding" val={fmtBDT(totals.balance)} accent />
          </div>
          <Tbl heads={[{label:'Agency',key:'agency'},{label:'Billed',key:'charges',right:true,fmt:fmtBDT},{label:'Paid',key:'paid',right:true,fmt:fmtBDT},{label:'Balance',key:'balance',right:true,fmt:fmtBDT,red:true}]} rows={rows} footRow={totals} />
        </>
      )}
    </div>
  )
}

/* ── Agency Commission ──────────────────────────────────────────────────── */
function AgencyCommissionTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data: agencies } = await supabase.from('agencies').select('id,name,commission_rate')
      const { data: res } = await supabase.from('reservations')
        .select('agency_id,folio_charges(base_amount,discount)')
        .not('agency_id', 'is', null).gte('check_in', from).lte('check_in', to)
      const map = {}
      for (const a of agencies || []) map[a.id] = { name: a.name, rate: +a.commission_rate, rev: 0 }
      for (const r of res || []) {
        if (!map[r.agency_id]) continue
        map[r.agency_id].rev += (r.folio_charges || []).reduce((a, c) => a + +c.base_amount - +c.discount, 0)
      }
      setRows(Object.values(map).map(v => ({ agency: v.name, rate: v.rate, revenue: +v.rev.toFixed(2), commission: +(v.rev * v.rate / 100).toFixed(2) })))
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const total = rows ? rows.reduce((a,r)=>a+r.commission,0) : 0

  const onExport = () => rows && exportXLSX(`AgencyCommission_${from}_${to}.xlsx`, [
    { name: 'Agency Commission', rows: [['Agency','Rate %','Revenue ৳','Commission ৳'],...rows.map(r=>[r.agency,r.rate,r.revenue,r.commission]),['TOTAL','','',total]] },
  ])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.agency}</td><td class="money">${r.rate}%</td><td class="money">${fmtBDT(r.revenue)}</td><td class="money">${fmtBDT(r.commission)}</td></tr>`).join('')
    printToPDF('Agency Commission', `${companyHeader(co,'Agency Commission Report',`${from} to ${to}`)}
    <table><thead><tr><th>Agency</th><th class="money">Rate %</th><th class="money">Revenue ৳</th><th class="money">Commission ৳</th></tr></thead>
    <tbody>${trs}<tr class="total-row"><td colspan="3">TOTAL</td><td class="money">${fmtBDT(total)}</td></tr></tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <>
          <Stat label="Total commission due" val={fmtBDT(total)} accent />
          <Tbl heads={[{label:'Agency',key:'agency'},{label:'Rate',key:'rate',right:true,fmt:v=>`${v}%`},{label:'Revenue',key:'revenue',right:true,fmt:fmtBDT},{label:'Commission',key:'commission',right:true,fmt:fmtBDT}]} rows={rows} />
        </>
      )}
    </div>
  )
}

/* ── Shareholder Entitlement ────────────────────────────────────────────── */
function ShareholderTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data: sh } = await supabase.from('shareholders').select('id,name,commission_rate,free_stay_balance')
      const { data: res } = await supabase.from('reservations')
        .select('shareholder_id,folio_charges(base_amount,discount)')
        .not('shareholder_id', 'is', null).gte('check_in', from).lte('check_in', to)
      const map = {}
      for (const s of sh || []) map[s.id] = { name: s.name, rate: +s.commission_rate, freeStay: +s.free_stay_balance, rev: 0 }
      for (const r of res || []) {
        if (!map[r.shareholder_id]) continue
        map[r.shareholder_id].rev += (r.folio_charges || []).reduce((a, c) => a + +c.base_amount - +c.discount, 0)
      }
      setRows(Object.values(map).map(v => ({ name: v.name, rate: v.rate, revenue: +v.rev.toFixed(2), commission: +(v.rev * v.rate / 100).toFixed(2), freeStay: v.freeStay })))
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const totComm = rows ? rows.reduce((a,r)=>a+r.commission,0) : 0

  const onExport = () => rows && exportXLSX(`Shareholder_${from}_${to}.xlsx`, [
    { name: 'Shareholder Entitlement', rows: [['Shareholder','Rate %','Revenue ৳','Commission ৳','Free Stay Balance'],...rows.map(r=>[r.name,r.rate,r.revenue,r.commission,r.freeStay]),['TOTAL','','',totComm,'']] },
  ])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.name}</td><td class="money">${r.rate}%</td><td class="money">${fmtBDT(r.revenue)}</td><td class="money">${fmtBDT(r.commission)}</td><td class="money">${r.freeStay}</td></tr>`).join('')
    printToPDF('Shareholder Report', `${companyHeader(co,'Shareholder Entitlement & Commission Report',`${from} to ${to}`)}
    <table><thead><tr><th>Shareholder</th><th class="money">Rate %</th><th class="money">Revenue ৳</th><th class="money">Commission ৳</th><th class="money">Free Stay Bal</th></tr></thead>
    <tbody>${trs}<tr class="total-row"><td colspan="3">TOTAL</td><td class="money">${fmtBDT(totComm)}</td><td></td></tr></tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <>
          <Stat label="Total commission entitlement" val={fmtBDT(totComm)} accent />
          <Tbl heads={[{label:'Shareholder',key:'name'},{label:'Rate',key:'rate',right:true,fmt:v=>`${v}%`},{label:'Revenue',key:'revenue',right:true,fmt:fmtBDT},{label:'Commission',key:'commission',right:true,fmt:fmtBDT},{label:'Free Stay Bal',key:'freeStay',right:true}]} rows={rows} />
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESTAURANT REPORTS
═══════════════════════════════════════════════════════════════════════════ */

/* ── POS Sales Summary ──────────────────────────────────────────────────── */
function PosReportsTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const [{ data: orders }, { data: items }] = await Promise.all([
        supabase.from('pos_orders').select('*').gte('created_at', `${from}T00:00:00Z`).lte('created_at', `${to}T23:59:59Z`).neq('status', 'CANCELLED'),
        supabase.from('pos_order_items').select('menu_item_name,qty,unit_price').gte('created_at', `${from}T00:00:00Z`).lte('created_at', `${to}T23:59:59Z`),
      ])
      const totalSales = (orders || []).reduce((a, o) => a + +o.total, 0)
      const settled = (orders || []).filter(o => o.status === 'SETTLED').reduce((a, o) => a + +o.total, 0)
      const room = (orders || []).filter(o => o.status === 'CHARGED_TO_ROOM').reduce((a, o) => a + +o.total, 0)
      const byItem = {}
      for (const it of items || []) {
        if (!byItem[it.menu_item_name]) byItem[it.menu_item_name] = { qty: 0, rev: 0 }
        byItem[it.menu_item_name].qty += +it.qty
        byItem[it.menu_item_name].rev += +it.qty * +it.unit_price
      }
      setData({ totalSales, settled, room, orderCount: (orders || []).length, byItem })
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const onExport = () => data && exportXLSX(`POS_${from}_${to}.xlsx`, [
    { name: 'Summary', rows: [['Metric','Value'],['Total Sales',data.totalSales],['Settled',data.settled],['Charged to Room',data.room],['Orders',data.orderCount]] },
    { name: 'Items Sold', rows: [['Item','Qty','Revenue ৳'],...Object.entries(data.byItem).sort((a,b)=>b[1].rev-a[1].rev).map(([k,v])=>[k,v.qty,v.rev])] },
  ])

  const onPrint = () => {
    if (!data) return
    const trs = Object.entries(data.byItem).sort((a,b)=>b[1].rev-a[1].rev).map(([k,v])=>`<tr><td>${k}</td><td class="money">${v.qty}</td><td class="money">${fmtBDT(v.rev)}</td></tr>`).join('')
    printToPDF('POS Report', `${companyHeader(co,'Restaurant POS Sales Summary',`${from} to ${to}`)}
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Total Sales</div><div class="kpi-val">${fmtBDT(data.totalSales)}</div></div>
      <div class="kpi"><div class="kpi-label">Settled</div><div class="kpi-val">${fmtBDT(data.settled)}</div></div>
      <div class="kpi"><div class="kpi-label">Charged to Room</div><div class="kpi-val">${fmtBDT(data.room)}</div></div>
      <div class="kpi"><div class="kpi-label">Orders</div><div class="kpi-val">${data.orderCount}</div></div>
    </div>
    <div class="section"><b>Top Items by Revenue</b>
    <table><thead><tr><th>Item</th><th class="money">Qty</th><th class="money">Revenue ৳</th></tr></thead>
    <tbody>${trs}</tbody></table></div>`)
  }

  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Total POS sales" val={fmtBDT(data.totalSales)} accent />
            <Stat label="Settled" val={fmtBDT(data.settled)} />
            <Stat label="Charged to room" val={fmtBDT(data.room)} />
            <Stat label="Orders" val={data.orderCount} />
          </div>
          <Tbl heads={[{label:'Item',key:'item'},{label:'Qty',key:'qty',right:true},{label:'Revenue',key:'rev',right:true,fmt:fmtBDT}]}
            rows={Object.entries(data.byItem).sort((a,b)=>b[1].rev-a[1].rev).map(([k,v])=>({item:k,qty:v.qty,rev:v.rev}))} />
        </>
      )}
    </div>
  )
}

/* ── KOT Register ───────────────────────────────────────────────────────── */
function KOTTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data } = await supabase.from('pos_orders').select('order_no,created_at,status,total,payment_method,table_no,waiter_name')
        .gte('created_at', `${from}T00:00:00Z`).lte('created_at', `${to}T23:59:59Z`)
        .order('created_at', { ascending: false })
      setRows(data || [])
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const total = rows ? rows.reduce((a,r)=>a+(r.status!=='CANCELLED'?+r.total:0),0) : 0

  const onExport = () => rows && exportXLSX(`KOT_${from}_${to}.xlsx`, [
    { name: 'KOT Register', rows: [['Order No','Date/Time','Table','Waiter','Status','Payment','Amount ৳'],...rows.map(r=>[r.order_no,new Date(r.created_at).toLocaleString('en-BD'),r.table_no||'—',r.waiter_name||'—',r.status,r.payment_method||'—',r.status!=='CANCELLED'?+r.total:0])] },
  ])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.order_no}</td><td>${new Date(r.created_at).toLocaleString('en-BD')}</td><td>${r.table_no||'—'}</td><td>${r.status}</td><td class="money">${r.status!=='CANCELLED'?fmtBDT(r.total):'—'}</td></tr>`).join('')
    printToPDF('KOT Register', `${companyHeader(co,'KOT Register',`${from} to ${to}`)}
    <table><thead><tr><th>Order No</th><th>Date/Time</th><th>Table</th><th>Status</th><th class="money">Amount ৳</th></tr></thead>
    <tbody>${trs}<tr class="total-row"><td colspan="4">TOTAL</td><td class="money">${fmtBDT(total)}</td></tr></tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <>
          <Stat label="Total F&B revenue (non-cancelled)" val={fmtBDT(total)} accent />
          <Tbl heads={[{label:'Order No',key:'order_no'},{label:'Date/Time',key:'created_at',fmt:v=>new Date(v).toLocaleString('en-BD')},{label:'Table',key:'table_no'},{label:'Status',key:'status'},{label:'Amount',key:'total',right:true,fmt:(v,r)=>r.status==='CANCELLED'?'—':fmtBDT(v)}]} rows={rows} />
        </>
      )}
    </div>
  )
}

/* ── F&B Daily Revenue ──────────────────────────────────────────────────── */
function FnBRevenueTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data } = await supabase.from('pos_orders')
        .select('created_at,total,status').neq('status', 'CANCELLED')
        .gte('created_at', `${from}T00:00:00Z`).lte('created_at', `${to}T23:59:59Z`)
      const byDay = {}
      for (const o of data || []) {
        const day = o.created_at.slice(0, 10)
        byDay[day] = (byDay[day] || 0) + +o.total
      }
      setRows(Object.entries(byDay).sort((a,b)=>a[0]<b[0]?-1:1).map(([date, rev]) => ({ date, rev: +rev.toFixed(2) })))
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const total = rows ? rows.reduce((a,r)=>a+r.rev,0) : 0

  const onExport = () => rows && exportXLSX(`FnB_Daily_${from}_${to}.xlsx`, [
    { name: 'F&B Daily Revenue', rows: [['Date','Revenue ৳'],...rows.map(r=>[r.date,r.rev]),['TOTAL','',total]] },
  ])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.date}</td><td class="money">${fmtBDT(r.rev)}</td></tr>`).join('')
    printToPDF('F&B Revenue', `${companyHeader(co,'F&B Daily Revenue Report',`${from} to ${to}`)}
    <table><thead><tr><th>Date</th><th class="money">Revenue ৳</th></tr></thead>
    <tbody>${trs}<tr class="total-row"><td>TOTAL</td><td class="money">${fmtBDT(total)}</td></tr></tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <>
          <Stat label="Total F&B revenue" val={fmtBDT(total)} accent />
          <Tbl heads={[{label:'Date',key:'date'},{label:'Revenue',key:'rev',right:true,fmt:fmtBDT}]} rows={rows} footRow={{rev:total}} />
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACCOUNTING REPORTS (IFRS / IAS)
   Source: journal_lines → journal_entries → chart_of_accounts
   Fallback: folio_charges + payments when no journal entries exist
═══════════════════════════════════════════════════════════════════════════ */

async function fetchJournalBalances(from, to) {
  const { data: lines } = await supabase
    .from('journal_lines')
    .select('debit,credit,account_id,journal_entries(jv_date)')
    .gte('journal_entries.jv_date', from)
    .lte('journal_entries.jv_date', to)
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('id,code,name,type,normal_side,subtype')
    .eq('is_active', true)
    .order('code')
  const balMap = {}
  for (const l of lines || []) {
    if (!balMap[l.account_id]) balMap[l.account_id] = { debit: 0, credit: 0 }
    balMap[l.account_id].debit += +l.debit
    balMap[l.account_id].credit += +l.credit
  }
  return { accounts: accounts || [], balMap, hasJournals: (lines || []).length > 0 }
}

/* ── Trial Balance ──────────────────────────────────────────────────────── */
function TrialBalanceTab({ co }) {
  const [from, setFrom] = useState(firstOfYear())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { accounts, balMap, hasJournals } = await fetchJournalBalances(from, to)
      if (!hasJournals) { setErr('No journal entries found in this period. Post transactions from the Accounting module first.'); setLoading(false); return }
      const mapped = accounts.map(a => {
        const b = balMap[a.id] || { debit: 0, credit: 0 }
        const netDr = b.debit - b.credit
        return { code: a.code, name: a.name, type: a.type, debit: netDr > 0 ? +netDr.toFixed(2) : 0, credit: netDr < 0 ? +(-netDr).toFixed(2) : 0 }
      }).filter(r => r.debit || r.credit)
      setRows(mapped)
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const totDr = rows ? rows.reduce((a,r)=>a+r.debit,0) : 0
  const totCr = rows ? rows.reduce((a,r)=>a+r.credit,0) : 0

  const onExport = () => rows && exportXLSX(`TrialBalance_${from}_${to}.xlsx`, [
    { name: 'Trial Balance', rows: [['Code','Account','Type','Debit ৳','Credit ৳'],...rows.map(r=>[r.code,r.name,r.type,r.debit,r.credit]),['','TOTAL','',totDr,totCr]] },
  ])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.code}</td><td>${r.name}</td><td>${r.type}</td><td class="money">${r.debit?fmtBDT(r.debit):''}</td><td class="money">${r.credit?fmtBDT(r.credit):''}</td></tr>`).join('')
    printToPDF('Trial Balance', `${companyHeader(co,'Trial Balance (IFRS)',`${from} to ${to}`)}
    <table><thead><tr><th>Code</th><th>Account</th><th>Type</th><th class="money">Debit ৳</th><th class="money">Credit ৳</th></tr></thead>
    <tbody>${trs}<tr class="total-row"><td colspan="3">TOTAL</td><td class="money">${fmtBDT(totDr)}</td><td class="money">${fmtBDT(totCr)}</td></tr></tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">IAS 1 — Based on posted journal entries.</p>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Total debits" val={fmtBDT(totDr)} />
            <Stat label="Total credits" val={fmtBDT(totCr)} />
          </div>
          <Tbl heads={[{label:'Code',key:'code'},{label:'Account',key:'name'},{label:'Type',key:'type'},{label:'Debit ৳',key:'debit',right:true,fmt:v=>v?fmtBDT(v):''},{label:'Credit ৳',key:'credit',right:true,fmt:v=>v?fmtBDT(v):''}]} rows={rows} footRow={{debit:totDr,credit:totCr}} />
        </>
      )}
    </div>
  )
}

/* ── General Ledger ─────────────────────────────────────────────────────── */
function LedgerTab({ co }) {
  const [from, setFrom] = useState(firstOfYear())
  const [to, setTo] = useState(todayISO())
  const [accounts, setAccounts] = useState([])
  const [selAcc, setSelAcc] = useState('')
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    supabase.from('chart_of_accounts').select('id,code,name').eq('is_active', true).order('code')
      .then(({ data }) => setAccounts(data || []))
  }, [])

  const run = async () => {
    if (!selAcc) { setErr('Select an account.'); return }
    setLoading(true); setErr(null)
    try {
      const { data: lines } = await supabase.from('journal_lines')
        .select('debit,credit,line_note,journal_entries(jv_no,jv_date,narration)')
        .eq('account_id', selAcc)
        .gte('journal_entries.jv_date', from)
        .lte('journal_entries.jv_date', to)
        .order('journal_entries.jv_date')
      let bal = 0
      const mapped = (lines || []).filter(l => l.journal_entries).map(l => {
        bal += +l.debit - +l.credit
        return { jv_no: l.journal_entries.jv_no, date: l.journal_entries.jv_date, narration: l.journal_entries.narration || l.line_note || '—', debit: +l.debit, credit: +l.credit, balance: +bal.toFixed(2) }
      })
      setRows(mapped)
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const accName = accounts.find(a => a.id === selAcc)?.name || ''
  const onExport = () => rows && exportXLSX(`Ledger_${accName}_${from}_${to}.xlsx`, [
    { name: 'General Ledger', rows: [['JV No','Date','Narration','Debit ৳','Credit ৳','Balance ৳'],...rows.map(r=>[r.jv_no,r.date,r.narration,r.debit,r.credit,r.balance])] },
  ])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.jv_no}</td><td>${r.date}</td><td>${r.narration}</td><td class="money">${fmtBDT(r.debit)}</td><td class="money">${fmtBDT(r.credit)}</td><td class="money">${fmtBDT(r.balance)}</td></tr>`).join('')
    printToPDF('General Ledger', `${companyHeader(co,`General Ledger — ${accName}`,`${from} to ${to}`)}
    <table><thead><tr><th>JV No</th><th>Date</th><th>Narration</th><th class="money">Debit ৳</th><th class="money">Credit ৳</th><th class="money">Balance ৳</th></tr></thead>
    <tbody>${trs}</tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">IAS 1 — Detailed ledger for a single account.</p>
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="label">Account</label>
          <select className="input !w-72" value={selAcc} onChange={e => setSelAcc(e.target.value)}>
            <option value="">Select account…</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </div>
        <div><label className="label">From</label><input type="date" className="input !w-40" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="label">To</label><input type="date" className="input !w-40" value={to} onChange={e => setTo(e.target.value)} /></div>
        <button className="btn-primary" onClick={run}>Run</button>
        {rows && <button className="btn-ghost" onClick={onExport}><FileDown size={15} /> Excel</button>}
        {rows && <button className="btn-ghost" onClick={onPrint}><Printer size={15} /> PDF</button>}
      </div>
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <Tbl heads={[{label:'JV No',key:'jv_no'},{label:'Date',key:'date'},{label:'Narration',key:'narration'},{label:'Debit',key:'debit',right:true,fmt:fmtBDT},{label:'Credit',key:'credit',right:true,fmt:fmtBDT},{label:'Balance',key:'balance',right:true,fmt:fmtBDT}]} rows={rows} />
      )}
    </div>
  )
}

/* ── P&L (Income Statement) — IAS 1 ────────────────────────────────────── */
function PLTab({ co }) {
  const [from, setFrom] = useState(firstOfYear())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { accounts, balMap, hasJournals } = await fetchJournalBalances(from, to)
      let income = 0, cogs = 0, opex = 0, interest = 0, tax = 0
      const incomeLines = [], cogsLines = [], opexLines = []
      for (const a of accounts) {
        const b = balMap[a.id] || { debit: 0, credit: 0 }
        if (a.type !== 'INCOME' && a.type !== 'EXPENSE') continue
        const net = a.normal_side === 'CREDIT' ? b.credit - b.debit : b.debit - b.credit
        if (net === 0) continue
        if (a.type === 'INCOME') { income += net; incomeLines.push({ name: a.name, val: net }) }
        else if (a.subtype === 'COGS') { cogs += net; cogsLines.push({ name: a.name, val: net }) }
        else if (a.code?.startsWith('8')) { interest += net }
        else if (a.code?.startsWith('9')) { tax += net }
        else { opex += net; opexLines.push({ name: a.name, val: net }) }
      }
      const grossProfit = income - cogs
      const ebit = grossProfit - opex
      const ebt = ebit - interest
      const netProfit = ebt - tax
      setData({ income, cogs, grossProfit, opex, ebit, interest, ebt, tax, netProfit, incomeLines, cogsLines, opexLines, hasJournals })
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const onExport = () => data && exportXLSX(`PL_${from}_${to}.xlsx`, [
    { name: 'P&L Statement', rows: [
      ['Income Statement (IAS 1)',`${from} to ${to}`],[''],
      ['REVENUE',''],
      ...data.incomeLines.map(l=>['  '+l.name,l.val]),
      ['Total Revenue','',data.income],[''],
      ['COST OF GOODS SOLD',''],
      ...data.cogsLines.map(l=>['  '+l.name,l.val]),
      ['Total COGS','',data.cogs],
      ['Gross Profit','',data.grossProfit],[''],
      ['OPERATING EXPENSES',''],
      ...data.opexLines.map(l=>['  '+l.name,l.val]),
      ['Total OpEx','',data.opex],
      ['EBIT (Operating Profit)','',data.ebit],[''],
      ['Finance Cost (Interest)','',data.interest],
      ['EBT (Profit before Tax)','',data.ebt],
      ['Income Tax','',data.tax],
      ['NET PROFIT / (LOSS)','',data.netProfit],
    ]},
  ])

  const onPrint = () => {
    if (!data) return
    const incRows = data.incomeLines.map(l=>`<tr><td>&nbsp;&nbsp;${l.name}</td><td class="money">${fmtBDT(l.val)}</td></tr>`).join('')
    const cogsRows = data.cogsLines.map(l=>`<tr><td>&nbsp;&nbsp;${l.name}</td><td class="money">${fmtBDT(l.val)}</td></tr>`).join('')
    const opexRows = data.opexLines.map(l=>`<tr><td>&nbsp;&nbsp;${l.name}</td><td class="money">${fmtBDT(l.val)}</td></tr>`).join('')
    printToPDF('P&L Statement', `${companyHeader(co,'Statement of Profit or Loss (IAS 1)',`${from} to ${to}`)}
    <table>
      <thead><tr><th>Description</th><th class="money">৳</th></tr></thead>
      <tbody>
        <tr class="group-row"><td>REVENUE</td><td></td></tr>${incRows}
        <tr class="total-row"><td>Total Revenue</td><td class="money">${fmtBDT(data.income)}</td></tr>
        <tr class="group-row"><td>COST OF GOODS SOLD</td><td></td></tr>${cogsRows}
        <tr class="total-row"><td>Total COGS</td><td class="money">${fmtBDT(data.cogs)}</td></tr>
        <tr class="total-row"><td><b>Gross Profit</b></td><td class="money"><b>${fmtBDT(data.grossProfit)}</b></td></tr>
        <tr class="group-row"><td>OPERATING EXPENSES</td><td></td></tr>${opexRows}
        <tr class="total-row"><td>Total Operating Expenses</td><td class="money">${fmtBDT(data.opex)}</td></tr>
        <tr class="total-row"><td><b>Operating Profit (EBIT)</b></td><td class="money"><b>${fmtBDT(data.ebit)}</b></td></tr>
        <tr><td>Finance Cost (Interest)</td><td class="money">(${fmtBDT(data.interest)})</td></tr>
        <tr class="total-row"><td>Profit before Tax (EBT)</td><td class="money">${fmtBDT(data.ebt)}</td></tr>
        <tr><td>Income Tax</td><td class="money">(${fmtBDT(data.tax)})</td></tr>
        <tr class="total-row"><td><b>NET PROFIT / (LOSS)</b></td><td class="money"><b>${fmtBDT(data.netProfit)}</b></td></tr>
      </tbody>
    </table>`)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">IAS 1 — Statement of Profit or Loss based on posted journal entries.</p>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Revenue" val={fmtBDT(data.income)} />
            <Stat label="Gross profit" val={fmtBDT(data.grossProfit)} />
            <Stat label="EBIT" val={fmtBDT(data.ebit)} />
            <Stat label="Net profit / (loss)" val={fmtBDT(data.netProfit)} accent />
          </div>
          <div className="card p-5 space-y-1 font-mono text-sm">
            {[
              { label: 'REVENUE', val: data.income, bold: true, indent: false },
              ...data.incomeLines.map(l=>({label: l.name, val: l.val, indent: true})),
              { label: 'COST OF GOODS SOLD', val: null, bold: true, sep: true },
              ...data.cogsLines.map(l=>({label: l.name, val: l.val, indent: true})),
              { label: 'Gross Profit', val: data.grossProfit, bold: true, sep: true },
              { label: 'OPERATING EXPENSES', val: null, bold: true, sep: true },
              ...data.opexLines.map(l=>({label: l.name, val: l.val, indent: true})),
              { label: 'Operating Profit (EBIT)', val: data.ebit, bold: true, sep: true },
              { label: 'Finance Cost', val: -data.interest, indent: true },
              { label: 'Profit before Tax', val: data.ebt, bold: true },
              { label: 'Income Tax', val: -data.tax, indent: true },
              { label: 'NET PROFIT / (LOSS)', val: data.netProfit, bold: true, sep: true },
            ].map((row, i) => (
              <div key={i} className={`flex justify-between py-0.5 ${row.sep ? 'border-t border-leaf mt-1 pt-1' : ''} ${row.bold ? 'font-bold' : ''}`}>
                <span className={row.indent ? 'pl-4 text-pine/70 font-normal' : 'text-pine'}>{row.label}</span>
                {row.val !== null && row.val !== undefined && (
                  <span className={row.val < 0 ? 'text-red-600' : ''}>{fmtBDT(row.val)}</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Balance Sheet — IAS 1 ──────────────────────────────────────────────── */
function BalanceSheetTab({ co }) {
  const [asOf, setAsOf] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { accounts, balMap, hasJournals } = await fetchJournalBalances('2000-01-01', asOf)
      if (!hasJournals) { setErr('No journal entries found. Post transactions from Accounting module first.'); setLoading(false); return }
      const sections = { ASSET: [], LIABILITY: [], EQUITY: [] }
      for (const a of accounts) {
        const b = balMap[a.id] || { debit: 0, credit: 0 }
        const net = a.normal_side === 'DEBIT' ? b.debit - b.credit : b.credit - b.debit
        if (net === 0 || !sections[a.type]) continue
        sections[a.type].push({ code: a.code, name: a.name, subtype: a.subtype, val: +net.toFixed(2) })
      }
      const totAsset = sections.ASSET.reduce((a, r) => a + r.val, 0)
      const totLiab = sections.LIABILITY.reduce((a, r) => a + r.val, 0)
      const totEq = sections.EQUITY.reduce((a, r) => a + r.val, 0)
      setData({ ...sections, totAsset, totLiab, totEq })
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const onExport = () => data && exportXLSX(`BalanceSheet_${asOf}.xlsx`, [
    { name: 'Balance Sheet', rows: [
      ['Balance Sheet (IAS 1)',`As at ${asOf}`],[''],
      ['ASSETS',''],
      ...data.ASSET.map(r=>['  '+r.name,r.val]),
      ['Total Assets','',data.totAsset],[''],
      ['LIABILITIES',''],
      ...data.LIABILITY.map(r=>['  '+r.name,r.val]),
      ['Total Liabilities','',data.totLiab],[''],
      ['EQUITY',''],
      ...data.EQUITY.map(r=>['  '+r.name,r.val]),
      ['Total Equity','',data.totEq],[''],
      ['TOTAL LIABILITIES + EQUITY','',data.totLiab+data.totEq],
    ]},
  ])

  const onPrint = () => {
    if (!data) return
    const sec = (arr, title, tot) => `
      <tr class="group-row"><td colspan="2">${title}</td></tr>
      ${arr.map(r=>`<tr><td>&nbsp;&nbsp;${r.name}</td><td class="money">${fmtBDT(r.val)}</td></tr>`).join('')}
      <tr class="total-row"><td>Total ${title}</td><td class="money">${fmtBDT(tot)}</td></tr>`
    printToPDF('Balance Sheet', `${companyHeader(co,'Statement of Financial Position (IAS 1)',`As at ${asOf}`)}
    <table><thead><tr><th>Description</th><th class="money">৳</th></tr></thead>
    <tbody>
      ${sec(data.ASSET,'ASSETS',data.totAsset)}
      ${sec(data.LIABILITY,'LIABILITIES',data.totLiab)}
      ${sec(data.EQUITY,'EQUITY',data.totEq)}
      <tr class="total-row"><td><b>TOTAL LIABILITIES + EQUITY</b></td><td class="money"><b>${fmtBDT(data.totLiab+data.totEq)}</b></td></tr>
    </tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">IAS 1 — Statement of Financial Position as at a specific date.</p>
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="label">As at date</label><input type="date" className="input !w-40" value={asOf} onChange={e => setAsOf(e.target.value)} /></div>
        <button className="btn-primary" onClick={run}>Run</button>
        {data && <button className="btn-ghost" onClick={onExport}><FileDown size={15} /> Excel</button>}
        {data && <button className="btn-ghost" onClick={onPrint}><Printer size={15} /> PDF</button>}
      </div>
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {data && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Total assets" val={fmtBDT(data.totAsset)} />
            <Stat label="Total liabilities" val={fmtBDT(data.totLiab)} />
            <Stat label="Total equity" val={fmtBDT(data.totEq)} accent />
          </div>
          {['ASSET','LIABILITY','EQUITY'].map(type => (
            <div key={type} className="card p-4">
              <h4 className="font-semibold text-pine mb-2">{type === 'ASSET' ? 'Assets' : type === 'LIABILITY' ? 'Liabilities' : 'Equity'}</h4>
              {data[type].map((r, i) => (
                <div key={i} className="flex justify-between py-1 border-b border-leaf/50 text-sm">
                  <span className="pl-2 text-pine/80">{r.name}</span>
                  <span className="money">{fmtBDT(r.val)}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 font-bold text-sm mt-1">
                <span>Total</span>
                <span className="money">{fmtBDT(type==='ASSET'?data.totAsset:type==='LIABILITY'?data.totLiab:data.totEq)}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

/* ── Cash Flow Statement — IAS 7 ────────────────────────────────────────── */
function CashFlowTab({ co }) {
  const [from, setFrom] = useState(firstOfYear())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const [{ data: pm }, { data: ch }] = await Promise.all([
        supabase.from('payments').select('amount,method,received_date').gte('received_date', from).lte('received_date', to),
        supabase.from('folio_charges').select('total,charge_type,charge_date').gte('charge_date', from).lte('charge_date', to),
      ])
      const receipts = (pm || []).reduce((a, p) => a + +p.amount, 0)
      const billed = (ch || []).reduce((a, c) => a + +c.total, 0)
      const roomBilled = (ch || []).filter(c => c.charge_type === 'ROOM').reduce((a, c) => a + +c.total, 0)
      const fnbBilled = (ch || []).filter(c => c.charge_type === 'RESTAURANT').reduce((a, c) => a + +c.total, 0)
      setData({ receipts, billed, roomBilled, fnbBilled, netOps: receipts })
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const onPrint = () => {
    if (!data) return
    printToPDF('Cash Flow', `${companyHeader(co,'Statement of Cash Flows (IAS 7)',`${from} to ${to}`)}
    <div style="font-size:11px;color:#666;margin-bottom:8px">Indirect method — Operating activities based on actual receipts</div>
    <table><thead><tr><th>Description</th><th class="money">৳</th></tr></thead>
    <tbody>
      <tr class="group-row"><td colspan="2">A. OPERATING ACTIVITIES</td></tr>
      <tr><td>&nbsp;&nbsp;Cash received from guests</td><td class="money">${fmtBDT(data.receipts)}</td></tr>
      <tr><td>&nbsp;&nbsp;Room revenue billed</td><td class="money">${fmtBDT(data.roomBilled)}</td></tr>
      <tr><td>&nbsp;&nbsp;F&B revenue billed</td><td class="money">${fmtBDT(data.fnbBilled)}</td></tr>
      <tr class="total-row"><td>Net Cash from Operations</td><td class="money">${fmtBDT(data.netOps)}</td></tr>
      <tr class="group-row"><td colspan="2">B. INVESTING ACTIVITIES</td></tr>
      <tr><td>&nbsp;&nbsp;Capital expenditure</td><td class="money">—</td></tr>
      <tr class="group-row"><td colspan="2">C. FINANCING ACTIVITIES</td></tr>
      <tr><td>&nbsp;&nbsp;Loan repayments / proceeds</td><td class="money">—</td></tr>
      <tr class="total-row"><td><b>Net Cash Increase / (Decrease)</b></td><td class="money"><b>${fmtBDT(data.netOps)}</b></td></tr>
    </tbody></table>
    <div style="margin-top:8px;font-size:10px;color:#888">Note: Investing and financing activities require journal entries to populate.</div>`)
  }

  const onExport = () => data && exportXLSX(`CashFlow_${from}_${to}.xlsx`, [
    { name: 'Cash Flow (IAS 7)', rows: [
      ['Cash Flow Statement',`${from} to ${to}`],[''],
      ['A. OPERATING ACTIVITIES',''],
      ['  Cash received from guests',data.receipts],
      ['  Room revenue billed',data.roomBilled],
      ['  F&B revenue billed',data.fnbBilled],
      ['Net Cash from Operations','',data.netOps],[''],
      ['B. INVESTING ACTIVITIES',''],['  Capital expenditure (from journals)','—'],[''],
      ['C. FINANCING ACTIVITIES',''],['  Loan repayments / proceeds (from journals)','—'],[''],
      ['NET CASH INCREASE / (DECREASE)','',data.netOps],
    ]},
  ])

  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">IAS 7 — Indirect method. Investing & financing sections populated from journal entries.</p>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {data && (
        <>
          <Stat label="Net cash from operating activities" val={fmtBDT(data.netOps)} accent />
          <div className="card p-5 space-y-1 font-mono text-sm">
            {[
              { label: 'A. OPERATING ACTIVITIES', group: true },
              { label: 'Cash received from guests', val: data.receipts, indent: true },
              { label: 'Room revenue billed', val: data.roomBilled, indent: true },
              { label: 'F&B revenue billed', val: data.fnbBilled, indent: true },
              { label: 'Net cash from operations', val: data.netOps, bold: true, sep: true },
              { label: 'B. INVESTING ACTIVITIES', group: true },
              { label: 'Capital expenditure (journal entries)', val: 0, indent: true },
              { label: 'C. FINANCING ACTIVITIES', group: true },
              { label: 'Loan repayments / proceeds', val: 0, indent: true },
              { label: 'NET CASH INCREASE / (DECREASE)', val: data.netOps, bold: true, sep: true },
            ].map((row, i) => (
              <div key={i} className={`flex justify-between py-0.5 ${row.sep ? 'border-t border-leaf mt-1 pt-1' : ''} ${row.group ? 'font-bold mt-2' : ''}`}>
                <span className={row.indent ? 'pl-4 text-pine/70' : 'text-pine'}>{row.label}</span>
                {row.val !== undefined && <span className={row.bold ? 'font-bold' : ''}>{fmtBDT(row.val)}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Bank Book ──────────────────────────────────────────────────────────── */
function BankBookTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data } = await supabase.from('payments')
        .select('received_date,method,amount,reference_no,reservation_id,reservations(reservation_name)')
        .in('method', ['BANK','BKASH','NAGAD','CARD'])
        .gte('received_date', from).lte('received_date', to)
        .order('received_date')
      let running = 0
      const mapped = (data || []).map(p => {
        running += +p.amount
        return { date: p.received_date, narration: p.reservations?.reservation_name || p.reference_no || '—', method: p.method, debit: +p.amount, credit: 0, balance: +running.toFixed(2) }
      })
      setRows(mapped)
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const total = rows ? rows.reduce((a, r) => a + r.debit, 0) : 0

  const onExport = () => rows && exportXLSX(`BankBook_${from}_${to}.xlsx`, [
    { name: 'Bank Book', rows: [['Date','Narration','Method','Debit ৳','Credit ৳','Balance ৳'],...rows.map(r=>[r.date,r.narration,r.method,r.debit,r.credit,r.balance]),['','','TOTAL',total,'','']] },
  ])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.date}</td><td>${r.narration}</td><td>${r.method}</td><td class="money">${fmtBDT(r.debit)}</td><td class="money">—</td><td class="money">${fmtBDT(r.balance)}</td></tr>`).join('')
    printToPDF('Bank Book', `${companyHeader(co,'Bank Book',`${from} to ${to}`)}
    <table><thead><tr><th>Date</th><th>Narration</th><th>Method</th><th class="money">Debit ৳</th><th class="money">Credit ৳</th><th class="money">Balance ৳</th></tr></thead>
    <tbody>${trs}<tr class="total-row"><td colspan="3">TOTAL</td><td class="money">${fmtBDT(total)}</td><td></td><td></td></tr></tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">Bank, bKash, Nagad, and card transactions.</p>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <>
          <Stat label="Total bank receipts" val={fmtBDT(total)} accent />
          <Tbl heads={[{label:'Date',key:'date'},{label:'Narration',key:'narration'},{label:'Method',key:'method'},{label:'Debit',key:'debit',right:true,fmt:fmtBDT},{label:'Balance',key:'balance',right:true,fmt:fmtBDT}]} rows={rows} />
        </>
      )}
    </div>
  )
}

/* ── Cash Book ──────────────────────────────────────────────────────────── */
function CashBookTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data } = await supabase.from('payments')
        .select('received_date,method,amount,reference_no,reservations(reservation_name)')
        .eq('method', 'CASH')
        .gte('received_date', from).lte('received_date', to)
        .order('received_date')
      let running = 0
      const mapped = (data || []).map(p => {
        running += +p.amount
        return { date: p.received_date, narration: p.reservations?.reservation_name || p.reference_no || 'Cash receipt', debit: +p.amount, balance: +running.toFixed(2) }
      })
      setRows(mapped)
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const total = rows ? rows.reduce((a, r) => a + r.debit, 0) : 0

  const onExport = () => rows && exportXLSX(`CashBook_${from}_${to}.xlsx`, [
    { name: 'Cash Book', rows: [['Date','Narration','Cash In ৳','Balance ৳'],...rows.map(r=>[r.date,r.narration,r.debit,r.balance]),['','TOTAL',total,'']] },
  ])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.date}</td><td>${r.narration}</td><td class="money">${fmtBDT(r.debit)}</td><td class="money">${fmtBDT(r.balance)}</td></tr>`).join('')
    printToPDF('Cash Book', `${companyHeader(co,'Cash Book',`${from} to ${to}`)}
    <table><thead><tr><th>Date</th><th>Narration</th><th class="money">Cash In ৳</th><th class="money">Balance ৳</th></tr></thead>
    <tbody>${trs}<tr class="total-row"><td colspan="2">TOTAL</td><td class="money">${fmtBDT(total)}</td><td></td></tr></tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">Cash receipts only.</p>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <>
          <Stat label="Total cash received" val={fmtBDT(total)} accent />
          <Tbl heads={[{label:'Date',key:'date'},{label:'Narration',key:'narration'},{label:'Cash In',key:'debit',right:true,fmt:fmtBDT},{label:'Balance',key:'balance',right:true,fmt:fmtBDT}]} rows={rows} />
        </>
      )}
    </div>
  )
}

/* ── Bank Reconciliation ────────────────────────────────────────────────── */
function BankReconTab({ co }) {
  const [asOf, setAsOf] = useState(todayISO())
  const [bankBal, setBankBal] = useState('')
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data } = await supabase.from('payments')
        .select('received_date,amount,method,reference_no')
        .in('method', ['BANK','BKASH','NAGAD','CARD'])
        .lte('received_date', asOf)
      const bookBal = (data || []).reduce((a, p) => a + +p.amount, 0)
      const diff = (+bankBal || 0) - bookBal
      setRows({ bookBal: +bookBal.toFixed(2), bankBal: +(+bankBal||0), diff: +diff.toFixed(2), txns: data?.length || 0 })
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const onPrint = () => {
    if (!rows) return
    printToPDF('Bank Reconciliation', `${companyHeader(co,'Bank Reconciliation Statement',`As at ${asOf}`)}
    <table><thead><tr><th>Description</th><th class="money">৳</th></tr></thead>
    <tbody>
      <tr><td>Book Balance (system)</td><td class="money">${fmtBDT(rows.bookBal)}</td></tr>
      <tr><td>Bank Statement Balance (entered)</td><td class="money">${fmtBDT(rows.bankBal)}</td></tr>
      <tr class="total-row"><td>Difference (unreconciled)</td><td class="money">${fmtBDT(rows.diff)}</td></tr>
    </tbody></table>
    <div style="margin-top:12px;font-size:10px;color:#888">Transactions counted: ${rows.txns}</div>`)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">Compare system book balance with bank statement.</p>
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="label">As at date</label><input type="date" className="input !w-40" value={asOf} onChange={e => setAsOf(e.target.value)} /></div>
        <div><label className="label">Bank statement balance (৳)</label><input type="number" className="input money !w-44" value={bankBal} onChange={e => setBankBal(e.target.value)} placeholder="Enter bank balance" /></div>
        <button className="btn-primary" onClick={run}>Run</button>
        {rows && <button className="btn-ghost" onClick={onPrint}><Printer size={15} /> PDF</button>}
      </div>
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <div className="card p-5 space-y-3">
          <div className="flex justify-between text-sm py-2 border-b border-leaf"><span>Book balance (system)</span><span className="money font-semibold">{fmtBDT(rows.bookBal)}</span></div>
          <div className="flex justify-between text-sm py-2 border-b border-leaf"><span>Bank statement balance</span><span className="money font-semibold">{fmtBDT(rows.bankBal)}</span></div>
          <div className={`flex justify-between text-sm py-2 font-bold ${Math.abs(rows.diff) < 0.01 ? 'text-forest' : 'text-red-600'}`}>
            <span>Difference (unreconciled)</span><span className="money">{fmtBDT(rows.diff)}</span>
          </div>
          {Math.abs(rows.diff) < 0.01 && <div className="text-forest text-sm font-semibold">✓ Fully reconciled</div>}
        </div>
      )}
    </div>
  )
}

/* ── Retained Earnings ──────────────────────────────────────────────────── */
function RetainedEarningsTab({ co }) {
  const [year, setYear] = useState(todayISO().slice(0, 4))
  const [openingRE, setOpeningRE] = useState('')
  const [dividends, setDividends] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { accounts, balMap } = await fetchJournalBalances(`${year}-01-01`, `${year}-12-31`)
      let netProfit = 0
      for (const a of accounts) {
        if (a.type !== 'INCOME' && a.type !== 'EXPENSE') continue
        const b = balMap[a.id] || { debit: 0, credit: 0 }
        const net = a.normal_side === 'CREDIT' ? b.credit - b.debit : b.debit - b.credit
        if (a.type === 'INCOME') netProfit += net
        else netProfit -= net
      }
      const opening = +(+openingRE || 0)
      const div = +(+dividends || 0)
      const closing = opening + netProfit - div
      setData({ opening, netProfit: +netProfit.toFixed(2), div, closing: +closing.toFixed(2) })
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const onPrint = () => {
    if (!data) return
    printToPDF('Retained Earnings', `${companyHeader(co,'Statement of Retained Earnings (IAS 1)',`Year ${year}`)}
    <table><thead><tr><th>Description</th><th class="money">৳</th></tr></thead>
    <tbody>
      <tr><td>Opening retained earnings (1 Jan ${year})</td><td class="money">${fmtBDT(data.opening)}</td></tr>
      <tr><td>Add: Net profit for the year</td><td class="money">${fmtBDT(data.netProfit)}</td></tr>
      <tr><td>Less: Dividends declared</td><td class="money">(${fmtBDT(data.div)})</td></tr>
      <tr class="total-row"><td><b>Closing retained earnings (31 Dec ${year})</b></td><td class="money"><b>${fmtBDT(data.closing)}</b></td></tr>
    </tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">IAS 1 — Statement of changes in retained earnings.</p>
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="label">Financial year</label><input type="number" className="input !w-28" value={year} onChange={e => setYear(e.target.value)} min="2020" max="2099" /></div>
        <div><label className="label">Opening RE (৳)</label><input type="number" className="input money !w-40" value={openingRE} onChange={e => setOpeningRE(e.target.value)} placeholder="0" /></div>
        <div><label className="label">Dividends declared (৳)</label><input type="number" className="input money !w-40" value={dividends} onChange={e => setDividends(e.target.value)} placeholder="0" /></div>
        <button className="btn-primary" onClick={run}>Run</button>
        {data && <button className="btn-ghost" onClick={onPrint}><Printer size={15} /> PDF</button>}
      </div>
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {data && (
        <div className="card p-5 font-mono text-sm space-y-2">
          {[
            { label: `Opening retained earnings (1 Jan ${year})`, val: data.opening },
            { label: 'Add: Net profit for the year', val: data.netProfit },
            { label: 'Less: Dividends declared', val: -data.div },
            { label: `Closing retained earnings (31 Dec ${year})`, val: data.closing, bold: true, sep: true },
          ].map((row, i) => (
            <div key={i} className={`flex justify-between py-1 ${row.sep ? 'border-t border-leaf font-bold' : ''}`}>
              <span>{row.label}</span>
              <span className={row.val < 0 ? 'text-red-600' : ''}>{fmtBDT(row.val)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── NAV / Equity Report ────────────────────────────────────────────────── */
function NAVTab({ co }) {
  const [asOf, setAsOf] = useState(todayISO())
  const [shares, setShares] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { accounts, balMap } = await fetchJournalBalances('2000-01-01', asOf)
      let totAsset = 0, totLiab = 0
      for (const a of accounts) {
        const b = balMap[a.id] || { debit: 0, credit: 0 }
        const net = a.normal_side === 'DEBIT' ? b.debit - b.credit : b.credit - b.debit
        if (a.type === 'ASSET') totAsset += net
        if (a.type === 'LIABILITY') totLiab += net
      }
      const nav = totAsset - totLiab
      const shareCount = +(+shares || 1)
      setData({ totAsset: +totAsset.toFixed(2), totLiab: +totLiab.toFixed(2), nav: +nav.toFixed(2), navPerShare: +(nav / shareCount).toFixed(2), shareCount })
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const onPrint = () => {
    if (!data) return
    printToPDF('NAV Report', `${companyHeader(co,'Net Asset Value (NAV) Report',`As at ${asOf}`)}
    <table><thead><tr><th>Description</th><th class="money">৳</th></tr></thead>
    <tbody>
      <tr><td>Total Assets</td><td class="money">${fmtBDT(data.totAsset)}</td></tr>
      <tr><td>Less: Total Liabilities</td><td class="money">(${fmtBDT(data.totLiab)})</td></tr>
      <tr class="total-row"><td><b>Net Asset Value (NAV)</b></td><td class="money"><b>${fmtBDT(data.nav)}</b></td></tr>
      <tr><td>Number of Shares</td><td class="money">${data.shareCount.toLocaleString()}</td></tr>
      <tr class="total-row"><td><b>NAV per Share</b></td><td class="money"><b>${fmtBDT(data.navPerShare)}</b></td></tr>
    </tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">Net Asset Value = Total Assets − Total Liabilities.</p>
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="label">As at date</label><input type="date" className="input !w-40" value={asOf} onChange={e => setAsOf(e.target.value)} /></div>
        <div><label className="label">No. of shares (optional)</label><input type="number" className="input money !w-40" value={shares} onChange={e => setShares(e.target.value)} placeholder="e.g. 1000" /></div>
        <button className="btn-primary" onClick={run}>Run</button>
        {data && <button className="btn-ghost" onClick={onPrint}><Printer size={15} /> PDF</button>}
      </div>
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Total assets" val={fmtBDT(data.totAsset)} />
          <Stat label="Total liabilities" val={fmtBDT(data.totLiab)} />
          <Stat label="NAV" val={fmtBDT(data.nav)} accent />
          <Stat label="NAV per share" val={fmtBDT(data.navPerShare)} />
        </div>
      )}
    </div>
  )
}

/* ── AP Aging ───────────────────────────────────────────────────────────── */
function APAgingTab({ co }) {
  const [asOf, setAsOf] = useState(todayISO())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data: vendors } = await supabase.from('vendors').select('id,name')
      const { data: pos } = await supabase.from('purchase_orders')
        .select('vendor_id,po_date,po_items(qty,unit_cost)')
        .lte('po_date', asOf).in('status', ['OPEN','PARTIAL','RECEIVED'])
      const map = {}
      for (const v of vendors || []) map[v.id] = { name: v.name, current: 0, d30: 0, d60: 0, d90: 0 }
      const today = new Date(asOf)
      for (const p of pos || []) {
        if (!map[p.vendor_id]) continue
        const days = Math.floor((today - new Date(p.po_date)) / 86400000)
        const amt = (p.po_items || []).reduce((a, i) => a + +i.qty * +i.unit_cost, 0)
        if (days <= 30) map[p.vendor_id].current += amt
        else if (days <= 60) map[p.vendor_id].d30 += amt
        else if (days <= 90) map[p.vendor_id].d60 += amt
        else map[p.vendor_id].d90 += amt
      }
      setRows(Object.values(map).filter(v => v.current + v.d30 + v.d60 + v.d90 > 0).map(v => ({
        vendor: v.name,
        current: +v.current.toFixed(2),
        d30: +v.d30.toFixed(2),
        d60: +v.d60.toFixed(2),
        d90: +v.d90.toFixed(2),
        total: +(v.current + v.d30 + v.d60 + v.d90).toFixed(2),
      })))
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const tot = rows ? { current: rows.reduce((a,r)=>a+r.current,0), d30: rows.reduce((a,r)=>a+r.d30,0), d60: rows.reduce((a,r)=>a+r.d60,0), d90: rows.reduce((a,r)=>a+r.d90,0), total: rows.reduce((a,r)=>a+r.total,0) } : null

  const onExport = () => rows && exportXLSX(`APAging_${asOf}.xlsx`, [
    { name: 'AP Aging', rows: [['Vendor','0–30 days','31–60 days','61–90 days','90+ days','Total'],...rows.map(r=>[r.vendor,r.current,r.d30,r.d60,r.d90,r.total]),['TOTAL',tot?.current,tot?.d30,tot?.d60,tot?.d90,tot?.total]] },
  ])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.vendor}</td><td class="money">${fmtBDT(r.current)}</td><td class="money">${fmtBDT(r.d30)}</td><td class="money">${fmtBDT(r.d60)}</td><td class="money">${fmtBDT(r.d90)}</td><td class="money">${fmtBDT(r.total)}</td></tr>`).join('')
    printToPDF('AP Aging', `${companyHeader(co,'Accounts Payable Aging Report',`As at ${asOf}`)}
    <table><thead><tr><th>Vendor</th><th class="money">0–30</th><th class="money">31–60</th><th class="money">61–90</th><th class="money">90+</th><th class="money">Total ৳</th></tr></thead>
    <tbody>${trs}<tr class="total-row"><td>TOTAL</td><td class="money">${fmtBDT(tot?.current)}</td><td class="money">${fmtBDT(tot?.d30)}</td><td class="money">${fmtBDT(tot?.d60)}</td><td class="money">${fmtBDT(tot?.d90)}</td><td class="money">${fmtBDT(tot?.total)}</td></tr></tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="label">As at date</label><input type="date" className="input !w-40" value={asOf} onChange={e => setAsOf(e.target.value)} /></div>
        <button className="btn-primary" onClick={run}>Run</button>
        {rows && <><button className="btn-ghost" onClick={onExport}><FileDown size={15} /> Excel</button><button className="btn-ghost" onClick={onPrint}><Printer size={15} /> PDF</button></>}
      </div>
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && <Tbl heads={[{label:'Vendor',key:'vendor'},{label:'0–30 days',key:'current',right:true,fmt:fmtBDT},{label:'31–60 days',key:'d30',right:true,fmt:fmtBDT},{label:'61–90 days',key:'d60',right:true,fmt:fmtBDT},{label:'90+ days',key:'d90',right:true,fmt:fmtBDT},{label:'Total',key:'total',right:true,fmt:fmtBDT}]} rows={rows} footRow={tot} />}
    </div>
  )
}

/* ── AR Aging ───────────────────────────────────────────────────────────── */
function ARAgingTab({ co }) {
  const [asOf, setAsOf] = useState(todayISO())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data: res } = await supabase.from('reservations')
        .select('reservation_name,check_out,folio_charges(total),payments(amount)')
        .eq('status', 'CHECKED_OUT').lte('check_out', asOf)
      const today = new Date(asOf)
      const mapped = (res || []).map(r => {
        const billed = (r.folio_charges || []).reduce((a, c) => a + +c.total, 0)
        const paid = (r.payments || []).reduce((a, p) => a + +p.amount, 0)
        const bal = billed - paid
        if (bal < 0.01) return null
        const days = Math.floor((today - new Date(r.check_out)) / 86400000)
        return { guest: r.reservation_name, checkOut: r.check_out, days, balance: +bal.toFixed(2) }
      }).filter(Boolean)
      const bucket = arr => ({ current: arr.filter(r=>r.days<=30).reduce((a,r)=>a+r.balance,0), d30: arr.filter(r=>r.days>30&&r.days<=60).reduce((a,r)=>a+r.balance,0), d60: arr.filter(r=>r.days>60&&r.days<=90).reduce((a,r)=>a+r.balance,0), d90: arr.filter(r=>r.days>90).reduce((a,r)=>a+r.balance,0) })
      setRows({ lines: mapped, ...bucket(mapped) })
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const totBal = rows ? rows.lines.reduce((a,r)=>a+r.balance,0) : 0

  const onExport = () => rows && exportXLSX(`ARAging_${asOf}.xlsx`, [
    { name: 'AR Aging', rows: [['Guest','Check-out','Days','Balance ৳'],...rows.lines.map(r=>[r.guest,r.checkOut,r.days,r.balance]),['TOTAL','','',totBal]] },
  ])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.lines.map(r=>`<tr><td>${r.guest}</td><td>${r.checkOut}</td><td class="money">${r.days}</td><td class="money">${fmtBDT(r.balance)}</td></tr>`).join('')
    printToPDF('AR Aging', `${companyHeader(co,'Accounts Receivable Aging Report',`As at ${asOf}`)}
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">0–30 days</div><div class="kpi-val">${fmtBDT(rows.current)}</div></div>
      <div class="kpi"><div class="kpi-label">31–60 days</div><div class="kpi-val">${fmtBDT(rows.d30)}</div></div>
      <div class="kpi"><div class="kpi-label">61–90 days</div><div class="kpi-val">${fmtBDT(rows.d60)}</div></div>
      <div class="kpi"><div class="kpi-label">90+ days</div><div class="kpi-val">${fmtBDT(rows.d90)}</div></div>
    </div>
    <table><thead><tr><th>Guest</th><th>Check-out</th><th class="money">Days</th><th class="money">Balance ৳</th></tr></thead>
    <tbody>${trs}<tr class="total-row"><td colspan="3">TOTAL</td><td class="money">${fmtBDT(totBal)}</td></tr></tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="label">As at date</label><input type="date" className="input !w-40" value={asOf} onChange={e => setAsOf(e.target.value)} /></div>
        <button className="btn-primary" onClick={run}>Run</button>
        {rows && <><button className="btn-ghost" onClick={onExport}><FileDown size={15} /> Excel</button><button className="btn-ghost" onClick={onPrint}><Printer size={15} /> PDF</button></>}
      </div>
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="0–30 days" val={fmtBDT(rows.current)} />
            <Stat label="31–60 days" val={fmtBDT(rows.d30)} />
            <Stat label="61–90 days" val={fmtBDT(rows.d60)} />
            <Stat label="90+ days" val={fmtBDT(rows.d90)} accent />
          </div>
          <Tbl heads={[{label:'Guest',key:'guest'},{label:'Check-out',key:'checkOut'},{label:'Days',key:'days',right:true},{label:'Balance',key:'balance',right:true,fmt:fmtBDT,red:true}]} rows={rows.lines} footRow={{balance:totBal}} />
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATUTORY REPORTS
═══════════════════════════════════════════════════════════════════════════ */

/* ── VAT Sales Register (Mushak 6.1) ────────────────────────────────────── */
function VATSalesTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data } = await supabase.from('folio_charges')
        .select('charge_date,charge_type,base_amount,vat_amount,discount,total,reservations(res_no,reservation_name)')
        .gte('charge_date', from).lte('charge_date', to)
        .order('charge_date')
      setRows((data || []).map(c => ({
        date: c.charge_date,
        res: c.reservations?.res_no || '—',
        customer: c.reservations?.reservation_name || '—',
        type: c.charge_type,
        base: +c.base_amount,
        discount: +c.discount,
        taxable: +(+c.base_amount - +c.discount).toFixed(2),
        vat: +c.vat_amount,
        total: +c.total,
      })))
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const totals = rows ? { base: rows.reduce((a,r)=>a+r.base,0), taxable: rows.reduce((a,r)=>a+r.taxable,0), vat: rows.reduce((a,r)=>a+r.vat,0), total: rows.reduce((a,r)=>a+r.total,0) } : null

  const onExport = () => rows && exportXLSX(`VAT_Sales_Mushak61_${from}_${to}.xlsx`, [
    { name: 'Mushak 6.1 — Sales Register', rows: [
      ['Mushak Form 6.1 — Sales Register'],['Period',`${from} to ${to}`],[''],
      ['Date','Res No','Customer/Guest','Item Type','Base Value ৳','Discount ৳','Taxable Value ৳','VAT (15%) ৳','Total ৳'],
      ...rows.map(r=>[r.date,r.res,r.customer,r.type,r.base,r.discount,r.taxable,r.vat,r.total]),
      ['','','','TOTAL',totals?.base,totals?.taxable-totals?.base,totals?.taxable,totals?.vat,totals?.total],
    ]},
  ])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.date}</td><td>${r.res}</td><td>${r.customer}</td><td>${r.type}</td><td class="money">${fmtBDT(r.base)}</td><td class="money">${fmtBDT(r.taxable)}</td><td class="money">${fmtBDT(r.vat)}</td><td class="money">${fmtBDT(r.total)}</td></tr>`).join('')
    printToPDF('Mushak 6.1', `${companyHeader(co,'Mushak Form 6.1 — VAT Sales Register',`${from} to ${to}`)}
    <div style="font-size:10px;color:#666;margin-bottom:8px">National Board of Revenue, Bangladesh — VAT & SD Act 2012 / Rules 2016</div>
    <table><thead><tr><th>Date</th><th>Res No</th><th>Customer</th><th>Type</th><th class="money">Base ৳</th><th class="money">Taxable ৳</th><th class="money">VAT ৳</th><th class="money">Total ৳</th></tr></thead>
    <tbody>${trs}<tr class="total-row"><td colspan="4">TOTAL</td><td class="money">${fmtBDT(totals?.base)}</td><td class="money">${fmtBDT(totals?.taxable)}</td><td class="money">${fmtBDT(totals?.vat)}</td><td class="money">${fmtBDT(totals?.total)}</td></tr></tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">NBR Mushak Form 6.1 — VAT & SD Act 2012.</p>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Base value" val={fmtBDT(totals.base)} />
            <Stat label="Taxable value" val={fmtBDT(totals.taxable)} />
            <Stat label="Output VAT (15%)" val={fmtBDT(totals.vat)} accent />
            <Stat label="Total incl. VAT" val={fmtBDT(totals.total)} />
          </div>
          <Tbl heads={[{label:'Date',key:'date'},{label:'Res No',key:'res'},{label:'Customer',key:'customer'},{label:'Type',key:'type'},{label:'Base ৳',key:'base',right:true,fmt:fmtBDT},{label:'Taxable ৳',key:'taxable',right:true,fmt:fmtBDT},{label:'VAT ৳',key:'vat',right:true,fmt:fmtBDT},{label:'Total ৳',key:'total',right:true,fmt:fmtBDT}]} rows={rows} footRow={totals} />
        </>
      )}
    </div>
  )
}

/* ── VAT Purchase Register ──────────────────────────────────────────────── */
function VATPurchaseTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data } = await supabase.from('goods_receipts')
        .select('grn_date,grn_no,vendor_invoice_no,rebateable,vendors(name),grn_items(qty,unit_cost,vat_amount)')
        .gte('grn_date', from).lte('grn_date', to)
        .order('grn_date')
      setRows((data || []).map(g => {
        const base = (g.grn_items || []).reduce((a, i) => a + +i.qty * +i.unit_cost, 0)
        const vat = (g.grn_items || []).reduce((a, i) => a + +i.vat_amount, 0)
        return { date: g.grn_date, grn: g.grn_no, invoice: g.vendor_invoice_no || '—', vendor: g.vendors?.name || '—', base: +base.toFixed(2), vat: +vat.toFixed(2), total: +(base + vat).toFixed(2), rebateable: g.rebateable ? 'Yes' : 'No' }
      }))
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const totals = rows ? { base: rows.reduce((a,r)=>a+r.base,0), vat: rows.reduce((a,r)=>a+r.vat,0), total: rows.reduce((a,r)=>a+r.total,0) } : null

  const onExport = () => rows && exportXLSX(`VAT_Purchase_Mushak61_${from}_${to}.xlsx`, [
    { name: 'Mushak 6.1 — Purchase Register', rows: [
      ['Mushak Form 6.1 — Purchase Register'],['Period',`${from} to ${to}`],[''],
      ['Date','GRN No','Vendor Invoice','Vendor','Base Value ৳','Input VAT ৳','Total ৳','Rebateable'],
      ...rows.map(r=>[r.date,r.grn,r.invoice,r.vendor,r.base,r.vat,r.total,r.rebateable]),
      ['','','','TOTAL',totals?.base,totals?.vat,totals?.total,''],
    ]},
  ])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.date}</td><td>${r.grn}</td><td>${r.vendor}</td><td class="money">${fmtBDT(r.base)}</td><td class="money">${fmtBDT(r.vat)}</td><td class="money">${fmtBDT(r.total)}</td><td>${r.rebateable}</td></tr>`).join('')
    printToPDF('VAT Purchase Register', `${companyHeader(co,'Mushak Form 6.1 — VAT Purchase Register',`${from} to ${to}`)}
    <div style="font-size:10px;color:#666;margin-bottom:8px">NBR Bangladesh — Input tax credit eligible items marked "Yes" under Rebateable</div>
    <table><thead><tr><th>Date</th><th>GRN No</th><th>Vendor</th><th class="money">Base ৳</th><th class="money">Input VAT ৳</th><th class="money">Total ৳</th><th>Rebate?</th></tr></thead>
    <tbody>${trs}<tr class="total-row"><td colspan="3">TOTAL</td><td class="money">${fmtBDT(totals?.base)}</td><td class="money">${fmtBDT(totals?.vat)}</td><td class="money">${fmtBDT(totals?.total)}</td><td></td></tr></tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">NBR Mushak Form 6.1 — Purchase Register. Input VAT rebate tracking.</p>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Total purchase value" val={fmtBDT(totals.base)} />
            <Stat label="Input VAT" val={fmtBDT(totals.vat)} accent />
            <Stat label="Total incl. VAT" val={fmtBDT(totals.total)} />
          </div>
          <Tbl heads={[{label:'Date',key:'date'},{label:'GRN No',key:'grn'},{label:'Vendor',key:'vendor'},{label:'Base ৳',key:'base',right:true,fmt:fmtBDT},{label:'Input VAT ৳',key:'vat',right:true,fmt:fmtBDT},{label:'Total ৳',key:'total',right:true,fmt:fmtBDT},{label:'Rebate',key:'rebateable'}]} rows={rows} footRow={totals} />
        </>
      )}
    </div>
  )
}

/* ── AIT Deduction Register ─────────────────────────────────────────────── */
function AITTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const AIT_RATE = 0.07

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data } = await supabase.from('purchase_orders')
        .select('po_date,po_no,vendors(name),po_items(qty,unit_cost)')
        .gte('po_date', from).lte('po_date', to)
        .in('status', ['OPEN','RECEIVED','PARTIAL'])
        .order('po_date')
      setRows((data || []).map(p => {
        const base = (p.po_items || []).reduce((a, i) => a + +i.qty * +i.unit_cost, 0)
        const ait = base * AIT_RATE
        return { date: p.po_date, po_no: p.po_no, vendor: p.vendors?.name || '—', base: +base.toFixed(2), ait: +ait.toFixed(2), net: +(base - ait).toFixed(2) }
      }))
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])

  const totals = rows ? { base: rows.reduce((a,r)=>a+r.base,0), ait: rows.reduce((a,r)=>a+r.ait,0), net: rows.reduce((a,r)=>a+r.net,0) } : null

  const onExport = () => rows && exportXLSX(`AIT_Register_${from}_${to}.xlsx`, [
    { name: 'AIT Deduction Register', rows: [
      ['AIT (TDS) Deduction Register — Section 52 ITO 1984'],['Period',`${from} to ${to}`],['Rate','7%'],[''],
      ['Date','PO No','Vendor/Contractor','Gross Amount ৳','AIT Deducted @ 7% ৳','Net Payable ৳'],
      ...rows.map(r=>[r.date,r.po_no,r.vendor,r.base,r.ait,r.net]),
      ['','','TOTAL',totals?.base,totals?.ait,totals?.net],
    ]},
  ])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.date}</td><td>${r.po_no}</td><td>${r.vendor}</td><td class="money">${fmtBDT(r.base)}</td><td class="money">${fmtBDT(r.ait)}</td><td class="money">${fmtBDT(r.net)}</td></tr>`).join('')
    printToPDF('AIT Register', `${companyHeader(co,'AIT (TDS) Deduction Register — Section 52 ITO 1984',`${from} to ${to}`)}
    <div style="font-size:10px;color:#666;margin-bottom:8px">Rate: 7% | Deducted at source from contractor/vendor payments</div>
    <table><thead><tr><th>Date</th><th>PO No</th><th>Vendor</th><th class="money">Gross ৳</th><th class="money">AIT @ 7% ৳</th><th class="money">Net ৳</th></tr></thead>
    <tbody>${trs}<tr class="total-row"><td colspan="3">TOTAL</td><td class="money">${fmtBDT(totals?.base)}</td><td class="money">${fmtBDT(totals?.ait)}</td><td class="money">${fmtBDT(totals?.net)}</td></tr></tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">Section 52 ITO 1984 — AIT deducted at source from contractor payments. Rate: 7%.</p>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {rows && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Gross payments" val={fmtBDT(totals.base)} />
            <Stat label="AIT deducted (7%)" val={fmtBDT(totals.ait)} accent />
            <Stat label="Net payable" val={fmtBDT(totals.net)} />
          </div>
          <Tbl heads={[{label:'Date',key:'date'},{label:'PO No',key:'po_no'},{label:'Vendor',key:'vendor'},{label:'Gross ৳',key:'base',right:true,fmt:fmtBDT},{label:'AIT @ 7% ৳',key:'ait',right:true,fmt:fmtBDT},{label:'Net ৳',key:'net',right:true,fmt:fmtBDT}]} rows={rows} footRow={totals} />
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function ReportsHub({ userName, role }) {
  const location = useLocation()
  const co = useCompany()
  const [activeTab, setActiveTab] = useState(() => {
    const t = new URLSearchParams(location.search).get('tab')
    return TABS.find(x => x.id === t) ? t : 'dashboard'
  })
  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab')
    if (t && TABS.find(x => x.id === t)) setActiveTab(t)
  }, [location.search])

  const renderTab = () => {
    const props = { co }
    switch (activeTab) {
      case 'dashboard':         return <DashboardTab {...props} />
      case 'sales':             return <SalesReportsTab {...props} />
      case 'occupancy':         return <OccupancyTab {...props} />
      case 'guest_ledger':      return <GuestLedgerTab {...props} />
      case 'city_ledger':       return <CityLedgerTab {...props} />
      case 'agency_commission': return <AgencyCommissionTab {...props} />
      case 'shareholder':       return <ShareholderTab {...props} />
      case 'pos':               return <PosReportsTab {...props} />
      case 'kot':               return <KOTTab {...props} />
      case 'fnb_revenue':       return <FnBRevenueTab {...props} />
      case 'pl':                return <PLTab {...props} />
      case 'balance_sheet':     return <BalanceSheetTab {...props} />
      case 'cashflow':          return <CashFlowTab {...props} />
      case 'trial_balance':     return <TrialBalanceTab {...props} />
      case 'ledger':            return <LedgerTab {...props} />
      case 'bank_book':         return <BankBookTab {...props} />
      case 'cash_book':         return <CashBookTab {...props} />
      case 'bank_recon':        return <BankReconTab {...props} />
      case 'retained_earnings': return <RetainedEarningsTab {...props} />
      case 'nav':               return <NAVTab {...props} />
      case 'ap_aging':          return <APAgingTab {...props} />
      case 'ar_aging':          return <ARAgingTab {...props} />
      case 'vat_sales':         return <VATSalesTab {...props} />
      case 'vat_purchase':      return <VATPurchaseTab {...props} />
      case 'ait':               return <AITTab {...props} />
      default:                  return <DashboardTab {...props} />
    }
  }

  const activeTabDef = TABS.find(t => t.id === activeTab)
  const GROUP_COLORS = { Operations: 'text-forest', Restaurant: 'text-amber-700', Accounting: 'text-blue-700', Statutory: 'text-red-700' }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="text-forest" size={24} />
        <div>
          <h1 className="font-display text-2xl font-bold text-pine">Reports</h1>
          <p className="text-sm text-pine/60">IFRS / IAS standard reporting centre — {co || 'loading…'}</p>
        </div>
      </div>

      {/* Tab navigation — grouped */}
      <div className="card p-2 space-y-2">
        {GROUPS.map(group => (
          <div key={group}>
            <div className={`text-[10px] font-bold uppercase tracking-widest px-2 pb-1 ${GROUP_COLORS[group]}`}>{group}</div>
            <div className="flex flex-wrap gap-0.5">
              {TABS.filter(t => t.group === group).map(t => {
                const Icon = t.icon
                return (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      activeTab === t.id ? 'bg-forest text-white' : 'text-pine/70 hover:bg-leaf/40'
                    }`}>
                    <Icon size={12} />{t.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Active tab header */}
      {activeTabDef && (
        <div className="flex items-center gap-2">
          <activeTabDef.icon size={18} className="text-forest" />
          <h2 className="font-display text-lg font-semibold text-pine">{activeTabDef.label}</h2>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            activeTabDef.group === 'Accounting' ? 'bg-blue-50 text-blue-700' :
            activeTabDef.group === 'Statutory' ? 'bg-red-50 text-red-700' :
            activeTabDef.group === 'Restaurant' ? 'bg-amber-50 text-amber-700' :
            'bg-forest/10 text-forest'
          }`}>{activeTabDef.group}</span>
        </div>
      )}

      {renderTab()}
    </div>
  )
}
