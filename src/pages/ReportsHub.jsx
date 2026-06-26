import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, exportXLSX, nightsBetween } from '../lib/helpers'
import {
  BarChart3, FileDown, AlertCircle, TrendingUp, ShoppingBag, Banknote,
  Scale, BookOpen, PieChart, Activity, Landmark, CreditCard, BookMarked,
} from 'lucide-react'

/* ── Tab definitions ─────────────────────────────────────────────────────── */
const TABS = [
  { id: 'dashboard',             label: 'Dashboard',                        icon: BarChart3   },
  { id: 'sales',                 label: 'Sales & Reservations Reports',      icon: TrendingUp  },
  { id: 'pos',                   label: 'Restaurant POS Reports',            icon: ShoppingBag },
  { id: 'cashflow',              label: 'Cash Flow Statement',               icon: Activity    },
  { id: 'trial_balance',         label: 'Trial Balance',                     icon: Scale       },
  { id: 'ledger',                label: 'Ledger Report',                     icon: BookOpen    },
  { id: 'pl',                    label: 'Profit & Loss Statement',           icon: PieChart    },
  { id: 'balance_sheet',         label: 'Balance Sheet',                     icon: Landmark    },
  { id: 'nav',                   label: 'NAV Statement',                     icon: TrendingUp  },
  { id: 'retained_earnings',     label: 'Retained Earnings & Owners Equity', icon: Banknote    },
  { id: 'bank_recon',            label: 'Bank Reconciliation',               icon: CreditCard  },
  { id: 'cash_recon',            label: 'Cash Reconciliation',               icon: CreditCard  },
  { id: 'bank_book',             label: 'Bank Book',                         icon: BookMarked  },
  { id: 'cash_book',             label: 'Cash Book',                         icon: BookMarked  },
]

const firstOfMonth = () => todayISO().slice(0, 8) + '01'

/* ── Helper UI components ───────────────────────────────────────────────── */
const Stat = ({ label, val, sub }) => (
  <div className="card p-4">
    <div className="label">{label}</div>
    <div className="font-display text-2xl font-bold text-pine money">{val}</div>
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

const DateRange = ({ from, to, setFrom, setTo, onRun, data, onExport }) => (
  <div className="flex items-end gap-2 flex-wrap">
    <div><label className="label">From</label><input type="date" className="input !w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
    <div><label className="label">To</label><input type="date" className="input !w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
    <button className="btn-primary" onClick={onRun}>Run</button>
    {data && onExport && <button className="btn-ghost" onClick={onExport}><FileDown size={15} /> Excel</button>}
  </div>
)

const ComingSoon = ({ title }) => (
  <div className="card p-10 text-center space-y-3">
    <div className="text-4xl">📊</div>
    <div className="font-display text-lg font-semibold text-pine">{title}</div>
    <p className="text-sm text-pine/50">This report is under development. Data will appear here once the accounting module is configured.</p>
  </div>
)

/* ── Dashboard Tab ──────────────────────────────────────────────────────── */
function DashboardTab() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = async () => {
    setLoading(true); setError(null)
    try {
      const [{ data: ch }, { data: pm }, { data: rooms }, { data: res }] = await Promise.all([
        supabase.from('folio_charges').select('charge_type,total,base_amount,discount').gte('charge_date', from).lte('charge_date', to),
        supabase.from('payments').select('method,amount').gte('received_date', from).lte('received_date', to),
        supabase.from('rooms').select('id').eq('is_active', true),
        supabase.from('reservations').select('status').gte('check_in', from).lte('check_in', to),
      ])
      const revByCat = {}
      for (const c of ch || []) { revByCat[c.charge_type] = (revByCat[c.charge_type] || 0) + +c.total }
      const payByMethod = {}
      for (const p of pm || []) payByMethod[p.method] = (payByMethod[p.method] || 0) + +p.amount
      const roomNights = (ch || []).filter((c) => c.charge_type === 'ROOM').length
      const roomRev = (ch || []).filter((c) => c.charge_type === 'ROOM').reduce((a, c) => a + +c.base_amount - +c.discount, 0)
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
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [from, to])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-pine/60">Key metrics across the selected period.</p>
        <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} />
      </div>
      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2"><AlertCircle size={18} /> {error}</div>}
      {loading && <div className="text-pine/50">Loading…</div>}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Total Revenue" val={fmtBDT(data.totalRev)} />
            <Stat label="Total Collections" val={fmtBDT(data.totalPay)} />
            <Stat label="Occupancy" val={`${data.occupancy.toFixed(1)}%`} sub={`${data.roomNights}/${data.capacity} room-nights`} />
            <Stat label="ADR" val={fmtBDT(data.adr)} sub={`${data.resCount} reservations`} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Revenue by Category">
              {Object.entries(data.revByCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <Bar key={k} label={k} val={v} max={data.totalRev} />
              ))}
              {Object.keys(data.revByCat).length === 0 && <p className="text-sm text-pine/40">No revenue in range.</p>}
            </Panel>
            <Panel title="Collections by Method">
              {Object.entries(data.payByMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <Bar key={k} label={k} val={v} max={data.totalPay} />
              ))}
              {Object.keys(data.payByMethod).length === 0 && <p className="text-sm text-pine/40">No collections in range.</p>}
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Sales & Reservations Reports Tab ──────────────────────────────────── */
function SalesReportsTab() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = async () => {
    setLoading(true); setError(null)
    try {
      const [{ data: ch }, { data: pm }, { data: rooms }, { data: dues }] = await Promise.all([
        supabase.from('folio_charges').select('*').gte('charge_date', from).lte('charge_date', to),
        supabase.from('payments').select('*').gte('received_date', from).lte('received_date', to),
        supabase.from('rooms').select('id').eq('is_active', true),
        supabase.from('reservations').select('*, folio_charges(total), payments(amount)').eq('status', 'CHECKED_OUT'),
      ])
      const revByCat = {}
      for (const c of ch || []) { revByCat[c.charge_type] = (revByCat[c.charge_type] || 0) + +c.total }
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
      setData({
        revByCat, payByMethod, roomNights, adr, occupancy, capacity, dueList,
        totalRev: Object.values(revByCat).reduce((a, v) => a + v, 0),
        totalPay: Object.values(payByMethod).reduce((a, v) => a + v, 0),
      })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [from, to])

  const exportAll = () => {
    if (!data) return
    exportXLSX(`SalesReport_${from}_to_${to}.xlsx`, [
      { name: 'Revenue by category', rows: [['Category', 'Total'], ...Object.entries(data.revByCat).map(([k, v]) => [k, v]), ['TOTAL', data.totalRev]] },
      { name: 'Payments by method', rows: [['Method', 'Total'], ...Object.entries(data.payByMethod).map(([k, v]) => [k, v]), ['TOTAL', data.totalPay]] },
      { name: 'Outstanding dues', rows: [['Reservation', 'Guest', 'Due'], ...data.dueList.map((d) => [d.res_no, d.name, d.due])] },
      { name: 'Occupancy', rows: [['Room-nights sold', data.roomNights], ['Capacity (room-nights)', data.capacity], ['Occupancy %', +data.occupancy.toFixed(1)], ['ADR', +data.adr.toFixed(2)]] },
    ])
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-pine/60">Revenue, collections, outstanding dues and occupancy.</p>
        <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onExport={exportAll} />
      </div>
      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2"><AlertCircle size={18} /> {error}</div>}
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
            <div className="px-4 py-3 border-b border-leaf font-display font-semibold text-pine">
              Outstanding dues (checked-out, balance &gt; 0)
            </div>
            <table className="w-full">
              <thead>
                <tr><th className="th">Reservation</th><th className="th">Guest</th><th className="th text-right">Due</th></tr>
              </thead>
              <tbody>
                {data.dueList.map((d) => (
                  <tr key={d.res_no}>
                    <td className="td money text-xs">{d.res_no}</td>
                    <td className="td text-sm">{d.name}</td>
                    <td className="td money text-right text-red-600 font-semibold">{fmtBDT(d.due)}</td>
                  </tr>
                ))}
                {data.dueList.length === 0 && <tr><td className="td text-pine/40" colSpan={3}>No outstanding dues.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

/* ── POS Reports Tab ────────────────────────────────────────────────────── */
function PosReportsTab() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = async () => {
    setLoading(true); setError(null)
    try {
      const [{ data: orders }, { data: items }] = await Promise.all([
        supabase.from('pos_orders').select('*').gte('created_at', `${from}T00:00:00Z`).lte('created_at', `${to}T23:59:59Z`).neq('status', 'CANCELLED'),
        supabase.from('pos_order_items').select('menu_item_name, qty, unit_price').gte('created_at', `${from}T00:00:00Z`).lte('created_at', `${to}T23:59:59Z`),
      ])
      const totalSales = (orders || []).reduce((a, o) => a + +o.total, 0)
      const settled = (orders || []).filter((o) => o.status === 'SETTLED').reduce((a, o) => a + +o.total, 0)
      const chargedToRoom = (orders || []).filter((o) => o.status === 'CHARGED_TO_ROOM').reduce((a, o) => a + +o.total, 0)
      const byItem = {}
      for (const it of items || []) {
        if (!byItem[it.menu_item_name]) byItem[it.menu_item_name] = { qty: 0, rev: 0 }
        byItem[it.menu_item_name].qty += +it.qty
        byItem[it.menu_item_name].rev += +it.qty * +it.unit_price
      }
      setData({ totalSales, settled, chargedToRoom, orderCount: (orders || []).length, byItem })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { run() }, [from, to])

  const exportAll = () => {
    if (!data) return
    exportXLSX(`POS_Report_${from}_to_${to}.xlsx`, [
      { name: 'Summary', rows: [['Metric', 'Value'], ['Total Sales', data.totalSales], ['Settled (Cash/Card)', data.settled], ['Charged to Room', data.chargedToRoom], ['Order Count', data.orderCount]] },
      { name: 'Items Sold', rows: [['Item', 'Qty Sold', 'Revenue'], ...Object.entries(data.byItem).sort((a, b) => b[1].rev - a[1].rev).map(([k, v]) => [k, v.qty, v.rev])] },
    ])
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-pine/60">Restaurant POS sales summary and item breakdown.</p>
        <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onExport={exportAll} />
      </div>
      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2"><AlertCircle size={18} /> {error}</div>}
      {loading && <div className="text-pine/50">Loading…</div>}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Total POS Sales" val={fmtBDT(data.totalSales)} />
            <Stat label="Settled (Cash/Card)" val={fmtBDT(data.settled)} />
            <Stat label="Charged to Room" val={fmtBDT(data.chargedToRoom)} />
            <Stat label="Orders" val={data.orderCount} />
          </div>
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-leaf font-display font-semibold text-pine">Top Items by Revenue</div>
            <table className="w-full">
              <thead><tr><th className="th">Item</th><th className="th text-right">Qty Sold</th><th className="th text-right">Revenue</th></tr></thead>
              <tbody>
                {Object.entries(data.byItem).sort((a, b) => b[1].rev - a[1].rev).map(([k, v]) => (
                  <tr key={k} className="hover:bg-leaf/20">
                    <td className="td text-sm">{k}</td>
                    <td className="td text-right money">{v.qty}</td>
                    <td className="td text-right money font-semibold">{fmtBDT(v.rev)}</td>
                  </tr>
                ))}
                {Object.keys(data.byItem).length === 0 && <tr><td className="td text-pine/40 text-center" colSpan={3}>No POS orders in range.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────────────────────── */
export default function ReportsHub({ userName, role }) {
  const location = useLocation()
  const tabParam = new URLSearchParams(location.search).get('tab')
  const [activeTab, setActiveTab] = useState(() => {
    const found = TABS.find((t) => t.id === tabParam)
    return found ? found.id : TABS[0].id
  })
  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab')
    if (t && TABS.find((x) => x.id === t)) setActiveTab(t)
  }, [location.search])

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':         return <DashboardTab />
      case 'sales':             return <SalesReportsTab />
      case 'pos':               return <PosReportsTab />
      case 'cashflow':          return <ComingSoon title="Cash Flow Statement" />
      case 'trial_balance':     return <ComingSoon title="Trial Balance" />
      case 'ledger':            return <ComingSoon title="Ledger Report" />
      case 'pl':                return <ComingSoon title="Profit & Loss Statement" />
      case 'balance_sheet':     return <ComingSoon title="Balance Sheet" />
      case 'nav':               return <ComingSoon title="NAV Statement" />
      case 'retained_earnings': return <ComingSoon title="Retained Earnings & Owners Equity Statement" />
      case 'bank_recon':        return <ComingSoon title="Bank Reconciliation" />
      case 'cash_recon':        return <ComingSoon title="Cash Reconciliation" />
      case 'bank_book':         return <ComingSoon title="Bank Book" />
      case 'cash_book':         return <ComingSoon title="Cash Book" />
      default:                  return <DashboardTab />
    }
  }

  const activeTabDef = TABS.find((t) => t.id === activeTab)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="text-forest" size={24} />
        <div>
          <h1 className="font-display text-2xl font-bold text-pine">Reports</h1>
          <p className="text-sm text-pine/60">Financial and operational reporting centre.</p>
        </div>
      </div>

      {/* Tab navigation — scrollable on mobile */}
      <div className="card p-1 overflow-x-auto">
        <div className="flex gap-0.5 min-w-max">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === t.id ? 'bg-forest text-white' : 'text-pine/70 hover:bg-leaf/40'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active tab header */}
      {activeTabDef && (
        <div>
          <h2 className="font-display text-lg font-semibold text-pine flex items-center gap-2">
            <activeTabDef.icon size={18} className="text-forest" /> {activeTabDef.label}
          </h2>
        </div>
      )}

      {/* Tab content */}
      {renderTab()}
    </div>
  )
}
