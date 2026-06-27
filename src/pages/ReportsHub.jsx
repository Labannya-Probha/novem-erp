import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, exportXLSX, nightsBetween } from '../lib/helpers'
import {
  BarChart3, FileDown, AlertCircle, TrendingUp, ShoppingBag, Banknote,
  Scale, BookOpen, PieChart, Activity, Landmark, CreditCard, BookMarked,
  Printer, Users, Building2, FileText, LayoutDashboard, ChevronDown,
} from 'lucide-react'

/* ─── Tab definitions ───────────────────────────────────────────────────── */
const TABS = [
  { id: 'kpi_dashboard',     label: 'Dashboard KPI',          icon: LayoutDashboard, group: 'Overview'    },
  { id: 'dashboard',         label: 'Management Dashboard',   icon: BarChart3,       group: 'Operations'  },
  { id: 'sales',             label: 'Sales & Reservations',   icon: TrendingUp,      group: 'Operations'  },
  { id: 'occupancy',         label: 'Occupancy & RevPAR',     icon: Building2,       group: 'Operations'  },
  { id: 'guest_ledger',      label: 'Guest Ledger',           icon: FileText,        group: 'Operations'  },
  { id: 'city_ledger',       label: 'City Ledger',            icon: Building2,       group: 'Operations'  },
  { id: 'agency_commission', label: 'Agency Commission',      icon: Banknote,        group: 'Operations'  },
  { id: 'shareholder',       label: 'Shareholder Entitlement',icon: Users,           group: 'Operations'  },
  { id: 'pos',               label: 'POS Sales Summary',      icon: ShoppingBag,     group: 'Restaurant'  },
  { id: 'kot',               label: 'KOT Register',           icon: FileText,        group: 'Restaurant'  },
  { id: 'fnb_revenue',       label: 'F&B Daily Revenue',      icon: PieChart,        group: 'Restaurant'  },
  { id: 'pl',                label: 'Profit & Loss',          icon: PieChart,        group: 'Accounting'  },
  { id: 'balance_sheet',     label: 'Balance Sheet',          icon: Landmark,        group: 'Accounting'  },
  { id: 'cashflow',          label: 'Cash Flow Statement',    icon: Activity,        group: 'Accounting'  },
  { id: 'trial_balance',     label: 'Trial Balance',          icon: Scale,           group: 'Accounting'  },
  { id: 'ledger',            label: 'General Ledger',         icon: BookOpen,        group: 'Accounting'  },
  { id: 'bank_book',         label: 'Bank Book',              icon: BookMarked,      group: 'Accounting'  },
  { id: 'cash_book',         label: 'Cash Book',              icon: BookMarked,      group: 'Accounting'  },
  { id: 'bank_recon',        label: 'Bank Reconciliation',    icon: CreditCard,      group: 'Accounting'  },
  { id: 'retained_earnings', label: 'Retained Earnings',      icon: Banknote,        group: 'Accounting'  },
  { id: 'nav',               label: 'NAV / Equity Report',    icon: TrendingUp,      group: 'Accounting'  },
  { id: 'ap_aging',          label: 'AP Aging',               icon: AlertCircle,     group: 'Accounting'  },
  { id: 'ar_aging',          label: 'AR Aging',               icon: AlertCircle,     group: 'Accounting'  },
  { id: 'vat_sales',         label: 'VAT Sales Register',     icon: FileText,        group: 'Statutory'   },
  { id: 'vat_purchase',      label: 'VAT Purchase Register',  icon: FileText,        group: 'Statutory'   },
  { id: 'ait',               label: 'AIT Deduction Register', icon: FileText,        group: 'Statutory'   },
]

const GROUPS = ['Overview', 'Operations', 'Restaurant', 'Accounting', 'Statutory']

const GROUP_STYLES = {
  Overview:    { dot: 'bg-pine',       text: 'text-pine',       badge: 'bg-pine/10 text-pine'         },
  Operations:  { dot: 'bg-forest',     text: 'text-forest',     badge: 'bg-forest/10 text-forest'     },
  Restaurant:  { dot: 'bg-amber-600',  text: 'text-amber-700',  badge: 'bg-amber-50 text-amber-700'   },
  Accounting:  { dot: 'bg-blue-600',   text: 'text-blue-700',   badge: 'bg-blue-50 text-blue-700'     },
  Statutory:   { dot: 'bg-red-600',    text: 'text-red-700',    badge: 'bg-red-50 text-red-700'       },
}

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
   DASHBOARD KPI — aggregates all 25 reports into one summary page
═══════════════════════════════════════════════════════════════════════════ */
function ReportsDashboardKPI({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo]     = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr]   = useState(null)

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const [
        { data: charges },
        { data: payments },
        { data: rooms },
        { data: reservations },
        { data: posOrders },
        { data: jLines },
        { data: assets },
        { data: vendors },
        { data: pos2 },
        { data: grnData },
      ] = await Promise.all([
        supabase.from('folio_charges').select('charge_type,total,base_amount,discount,vat_amount').gte('charge_date', from).lte('charge_date', to),
        supabase.from('payments').select('method,amount,received_date').gte('received_date', from).lte('received_date', to),
        supabase.from('rooms').select('id').eq('is_active', true),
        supabase.from('reservations').select('status,check_in,check_out,reservation_name,folio_charges(total),payments(amount)').gte('check_in', from).lte('check_in', to),
        supabase.from('pos_orders').select('total,status').gte('created_at', `${from}T00:00:00Z`).lte('created_at', `${to}T23:59:59Z`),
        supabase.from('journal_lines').select('debit,credit,account_id,journal_entries(jv_date)').gte('journal_entries.jv_date', from).lte('journal_entries.jv_date', to),
        supabase.from('fixed_assets').select('cost,asset_depreciation(amount)'),
        supabase.from('vendors').select('id,name'),
        supabase.from('purchase_orders').select('po_date,po_items(qty,unit_cost)').gte('po_date', from).lte('po_date', to).in('status', ['OPEN','PARTIAL','RECEIVED']),
        supabase.from('goods_receipts').select('grn_items(qty,unit_cost,vat_amount)').gte('grn_date', from).lte('grn_date', to),
      ])

      // ── Operations ──
      const totalRevenue   = (charges || []).reduce((a, c) => a + +c.total, 0)
      const totalCollected = (payments || []).reduce((a, p) => a + +p.amount, 0)
      const roomCharges    = (charges || []).filter(c => c.charge_type === 'ROOM')
      const roomNights     = roomCharges.length
      const roomRev        = roomCharges.reduce((a, c) => a + +c.base_amount - +c.discount, 0)
      const days           = Math.max(1, nightsBetween(from, to) + 1)
      const capacity       = (rooms?.length || 0) * days
      const occupancy      = capacity > 0 ? (roomNights / capacity) * 100 : 0
      const adr            = roomNights > 0 ? roomRev / roomNights : 0
      const revpar         = (rooms?.length || 0) > 0 ? roomRev / ((rooms?.length || 0) * days) : 0

      // Guest ledger — outstanding
      const outstanding = (reservations || []).reduce((a, r) => {
        const billed = (r.folio_charges || []).reduce((s, c) => s + +c.total, 0)
        const paid   = (r.payments || []).reduce((s, p) => s + +p.amount, 0)
        return a + Math.max(0, billed - paid)
      }, 0)

      // ── Restaurant ──
      const posSales = (posOrders || []).filter(o => o.status !== 'CANCELLED').reduce((a, o) => a + +o.total, 0)
      const posCount = (posOrders || []).filter(o => o.status !== 'CANCELLED').length

      // ── Accounting ──
      const outputVAT   = (charges || []).reduce((a, c) => a + +c.vat_amount, 0)
      const inputVAT    = (grnData || []).reduce((a, g) => a + (g.grn_items || []).reduce((s, i) => s + +i.vat_amount, 0), 0)
      const netVAT      = outputVAT - inputVAT

      const totalAssets = (assets || []).reduce((a, x) => a + +x.cost, 0)
      const totalAccumDep = (assets || []).reduce((a, x) => a + (x.asset_depreciation || []).reduce((s, d) => s + +d.amount, 0), 0)

      const apTotal = (pos2 || []).reduce((a, p) => a + (p.po_items || []).reduce((s, i) => s + +i.qty * +i.unit_cost, 0), 0)

      // Journal activity
      const journalDr   = (jLines || []).reduce((a, l) => a + +l.debit, 0)
      const journalCr   = (jLines || []).reduce((a, l) => a + +l.credit, 0)

      // Cash vs bank
      const cashIn = (payments || []).filter(p => p.method === 'CASH').reduce((a, p) => a + +p.amount, 0)
      const bankIn = (payments || []).filter(p => ['BANK','BKASH','NAGAD','CARD'].includes(p.method)).reduce((a, p) => a + +p.amount, 0)

      // AIT
      const aitBase = (pos2 || []).reduce((a, p) => a + (p.po_items || []).reduce((s, i) => s + +i.qty * +i.unit_cost, 0), 0)
      const ait     = aitBase * 0.07

      setData({
        // Operations
        totalRevenue, totalCollected, outstanding,
        roomNights, capacity, occupancy, adr, revpar,
        resCount: (reservations || []).length,
        // Restaurant
        posSales, posCount,
        // Accounting & Finance
        journalDr, journalCr,
        cashIn, bankIn,
        outputVAT, inputVAT, netVAT,
        totalAssets, totalAccumDep, bookValue: totalAssets - totalAccumDep,
        apTotal, ait,
      })
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { run() }, [])

  const KpiCard = ({ label, val, sub, color = 'text-pine' }) => (
    <div className="card p-4 space-y-1">
      <div className="text-xs text-pine/50 font-medium">{label}</div>
      <div className={`font-display text-xl font-bold money ${color}`}>{val}</div>
      {sub && <div className="text-[11px] text-pine/40">{sub}</div>}
    </div>
  )

  const SectionHeader = ({ title, group }) => {
    const st = GROUP_STYLES[group] || GROUP_STYLES.Operations
    return (
      <div className={`flex items-center gap-2 pt-2`}>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.dot}`} />
        <h3 className={`font-display font-bold text-sm uppercase tracking-wide ${st.text}`}>{title}</h3>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="label">From</label><input type="date" className="input !w-40" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="label">To</label><input type="date" className="input !w-40" value={to} onChange={e => setTo(e.target.value)} /></div>
        <button className="btn-primary" onClick={run}>Refresh</button>
      </div>

      {err && <Err msg={err} />}
      {loading && <Loading />}

      {data && (
        <div className="space-y-5">

          {/* ── Operations ── */}
          <SectionHeader title="Operations" group="Operations" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total Revenue" val={fmtBDT(data.totalRevenue)} color="text-forest" />
            <KpiCard label="Total Collected" val={fmtBDT(data.totalCollected)} />
            <KpiCard label="Outstanding Balance" val={fmtBDT(data.outstanding)} color="text-red-600" />
            <KpiCard label="Reservations" val={data.resCount} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Occupancy" val={`${data.occupancy.toFixed(1)}%`} sub={`${data.roomNights} / ${data.capacity} room-nights`} color="text-forest" />
            <KpiCard label="ADR" val={fmtBDT(data.adr)} />
            <KpiCard label="RevPAR" val={fmtBDT(data.revpar)} />
            <KpiCard label="Cash Received" val={fmtBDT(data.cashIn)} sub="Cash method" />
          </div>

          {/* ── Restaurant ── */}
          <SectionHeader title="Restaurant" group="Restaurant" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="POS Sales" val={fmtBDT(data.posSales)} color="text-amber-700" />
            <KpiCard label="POS Orders" val={data.posCount} />
            <KpiCard label="Bank / Digital Receipts" val={fmtBDT(data.bankIn)} />
            <KpiCard label="Total Collections" val={fmtBDT(data.totalCollected)} />
          </div>

          {/* ── Accounting ── */}
          <SectionHeader title="Accounting" group="Accounting" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Journal Debits" val={fmtBDT(data.journalDr)} color="text-blue-700" />
            <KpiCard label="Journal Credits" val={fmtBDT(data.journalCr)} color="text-blue-700" />
            <KpiCard label="Fixed Assets (Cost)" val={fmtBDT(data.totalAssets)} />
            <KpiCard label="Book Value (Net)" val={fmtBDT(data.bookValue)} sub={`Accum. dep: ${fmtBDT(data.totalAccumDep)}`} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="AP Total (Open POs)" val={fmtBDT(data.apTotal)} color="text-red-600" />
            <KpiCard label="AIT Deducted (7%)" val={fmtBDT(data.ait)} />
            <KpiCard label="Cash In" val={fmtBDT(data.cashIn)} />
            <KpiCard label="Bank / Digital In" val={fmtBDT(data.bankIn)} />
          </div>

          {/* ── Statutory / VAT ── */}
          <SectionHeader title="Statutory" group="Statutory" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Output VAT (Sales)" val={fmtBDT(data.outputVAT)} color="text-red-600" />
            <KpiCard label="Input VAT (Purchases)" val={fmtBDT(data.inputVAT)} />
            <KpiCard label="Net VAT Payable" val={fmtBDT(data.netVAT)} color={data.netVAT > 0 ? 'text-red-600' : 'text-forest'} sub="Output − Input" />
            <KpiCard label="AIT Deducted @ 7%" val={fmtBDT(data.ait)} />
          </div>

          {/* ── Summary bar ── */}
          <div className="card p-4">
            <h4 className="font-display font-semibold text-pine text-sm mb-3">Revenue vs Collection vs Outstanding</h4>
            <div className="space-y-3">
              <Bar label="Total Revenue" val={data.totalRevenue} max={Math.max(data.totalRevenue, data.totalCollected, data.outstanding)} />
              <Bar label="Total Collected" val={data.totalCollected} max={Math.max(data.totalRevenue, data.totalCollected, data.outstanding)} />
              <Bar label="Outstanding" val={data.outstanding} max={Math.max(data.totalRevenue, data.totalCollected, data.outstanding)} />
            </div>
          </div>

          <p className="text-[11px] text-pine/40 px-1">
            Period: {from} to {to} · Company: {co || '—'} · All figures in BDT (৳)
          </p>
        </div>
      )}
    </div>
  )
}

/* ─── All existing tab components stay exactly the same below ───────────── */
/* (DashboardTab, SalesReportsTab, OccupancyTab, GuestLedgerTab, CityLedgerTab,
    AgencyCommissionTab, ShareholderTab, PosReportsTab, KOTTab, FnBRevenueTab,
    PLTab, BalanceSheetTab, CashFlowTab, TrialBalanceTab, LedgerTab,
    BankBookTab, CashBookTab, BankReconTab, RetainedEarningsTab, NAVTab,
    APAgingTab, ARAgingTab, VATSalesTab, VATPurchaseTab, AITTab) */

// ... [all existing component code unchanged] ...

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT COMPONENT — AccountingHub-style grouped sidebar layout
═══════════════════════════════════════════════════════════════════════════ */
export default function ReportsHub({ userName, role }) {
  const location = useLocation()
  const co = useCompany()

  const [activeTab, setActiveTab] = useState(() => {
    const t = new URLSearchParams(location.search).get('tab')
    return TABS.find(x => x.id === t) ? t : 'kpi_dashboard'
  })

  // Open groups — Overview always open by default
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = { Overview: true, Operations: false, Restaurant: false, Accounting: false, Statutory: false }
    const t = new URLSearchParams(location.search).get('tab')
    const found = TABS.find(x => x.id === t)
    if (found) { Object.keys(initial).forEach(g => initial[g] = false); initial[found.group] = true }
    return initial
  })

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab')
    if (t && TABS.find(x => x.id === t)) setActiveTab(t)
  }, [location.search])

  // When tab changes, open its group
  const handleTabClick = (tabId) => {
    const tab = TABS.find(x => x.id === tabId)
    if (!tab) return
    setActiveTab(tabId)
    setOpenGroups(prev => ({ ...prev, [tab.group]: true }))
  }

  const toggleGroup = (group) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }))
  }

  const renderTab = () => {
    const props = { co }
    switch (activeTab) {
      case 'kpi_dashboard':     return <ReportsDashboardKPI {...props} />
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
      default:                  return <ReportsDashboardKPI {...props} />
    }
  }

  const activeTabDef = TABS.find(t => t.id === activeTab)

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex items-center gap-2">
        <BarChart3 className="text-forest" size={24} />
        <div>
          <h1 className="font-display text-2xl font-bold text-pine">Reports</h1>
          <p className="text-sm text-pine/60">IFRS / IAS standard reporting centre — {co || 'loading…'}</p>
        </div>
      </div>

      {/* ── Two-column layout: sidebar nav + content ── */}
      <div className="flex gap-5 items-start">

        {/* Left sidebar — grouped accordion nav (AccountingHub style) */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="card p-2 space-y-1 sticky top-4">
            {GROUPS.map(group => {
              const groupTabs = TABS.filter(t => t.group === group)
              const isOpen    = openGroups[group]
              const st        = GROUP_STYLES[group]
              return (
                <div key={group}>
                  <button
                    onClick={() => toggleGroup(group)}
                    className={`w-full px-2.5 py-1.5 flex items-center justify-between rounded-md text-[11px] font-bold uppercase tracking-widest transition-colors ${st.text} hover:bg-leaf/30`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {group}
                    </span>
                    <ChevronDown size={11} className={`transition-transform duration-150 ${isOpen ? '' : '-rotate-90'}`} />
                  </button>
                  {isOpen && (
                    <div className="ml-3 mt-0.5 space-y-0.5 mb-1">
                      {groupTabs.map(t => {
                        const Icon = t.icon
                        const isActive = activeTab === t.id
                        return (
                          <button
                            key={t.id}
                            onClick={() => handleTabClick(t.id)}
                            className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                              isActive
                                ? 'bg-forest text-white font-semibold'
                                : 'text-pine/70 hover:bg-leaf/40 hover:text-pine'
                            }`}
                          >
                            <Icon size={12} className="shrink-0" />
                            <span className="truncate">{t.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </aside>

        {/* Mobile tab picker (flat dropdown style) */}
        <div className="lg:hidden w-full">
          <select
            className="input w-full"
            value={activeTab}
            onChange={e => handleTabClick(e.target.value)}
          >
            {GROUPS.map(group => (
              <optgroup key={group} label={group}>
                {TABS.filter(t => t.group === group).map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Right content panel */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Active tab header */}
          {activeTabDef && (
            <div className="flex items-center gap-2">
              <activeTabDef.icon size={18} className="text-forest shrink-0" />
              <h2 className="font-display text-lg font-semibold text-pine">{activeTabDef.label}</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${GROUP_STYLES[activeTabDef.group]?.badge}`}>
                {activeTabDef.group}
              </span>
            </div>
          )}
          {renderTab()}
        </div>

      </div>
    </div>
  )
}
