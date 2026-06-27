import { useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { fmtBDT, todayISO, exportXLSX, nightsBetween } from '../lib/helpers'
import ReceiptPaymentModal from './ReceiptPaymentModal'
import {
  BarChart3, FileDown, AlertCircle, TrendingUp, ShoppingBag, Banknote,
  Scale, BookOpen, PieChart, Activity, Landmark, CreditCard, BookMarked,
  Printer, Users, Building2, FileText, LayoutDashboard,
  ChevronDown, ChevronRight, Plus, Minus, RefreshCw,
} from 'lucide-react'

/* ══════════════════════════════════════════════════════════════════════
   TAB DEFINITIONS
══════════════════════════════════════════════════════════════════════ */
const TABS = [
  { id: 'kpi_dashboard',     label: 'Dashboard KPI',           icon: LayoutDashboard, group: 'Overview'   },
  { id: 'dashboard',         label: 'Management Dashboard',    icon: BarChart3,       group: 'Operations' },
  { id: 'sales',             label: 'Sales & Reservations',    icon: TrendingUp,      group: 'Operations' },
  { id: 'occupancy',         label: 'Occupancy & RevPAR',      icon: Building2,       group: 'Operations' },
  { id: 'guest_ledger',      label: 'Guest Ledger',            icon: FileText,        group: 'Operations' },
  { id: 'city_ledger',       label: 'City Ledger',             icon: Building2,       group: 'Operations' },
  { id: 'agency_commission', label: 'Agency Commission',       icon: Banknote,        group: 'Operations' },
  { id: 'shareholder',       label: 'Shareholder Entitlement', icon: Users,           group: 'Operations' },
  { id: 'pos',               label: 'POS Sales Summary',       icon: ShoppingBag,     group: 'Restaurant' },
  { id: 'kot',               label: 'KOT Register',            icon: FileText,        group: 'Restaurant' },
  { id: 'fnb_revenue',       label: 'F&B Daily Revenue',       icon: PieChart,        group: 'Restaurant' },
  { id: 'pl',                label: 'Profit & Loss',           icon: PieChart,        group: 'Accounting' },
  { id: 'balance_sheet',     label: 'Balance Sheet',           icon: Landmark,        group: 'Accounting' },
  { id: 'cashflow',          label: 'Cash Flow Statement',     icon: Activity,        group: 'Accounting' },
  { id: 'trial_balance',     label: 'Trial Balance',           icon: Scale,           group: 'Accounting' },
  { id: 'ledger',            label: 'General Ledger',          icon: BookOpen,        group: 'Accounting' },
  { id: 'bank_book',         label: 'Bank Book',               icon: BookMarked,      group: 'Accounting' },
  { id: 'cash_book',         label: 'Cash Book',               icon: BookMarked,      group: 'Accounting' },
  { id: 'bank_recon',        label: 'Bank Reconciliation',     icon: CreditCard,      group: 'Accounting' },
  { id: 'retained_earnings', label: 'Retained Earnings',       icon: Banknote,        group: 'Accounting' },
  { id: 'nav',               label: 'NAV / Equity Report',     icon: TrendingUp,      group: 'Accounting' },
  { id: 'ap_aging',          label: 'AP Aging',                icon: AlertCircle,     group: 'Accounting' },
  { id: 'ar_aging',          label: 'AR Aging',                icon: AlertCircle,     group: 'Accounting' },
  { id: 'vat_sales',         label: 'VAT Sales Register',      icon: FileText,        group: 'Statutory'  },
  { id: 'vat_purchase',      label: 'VAT Purchase Register',   icon: FileText,        group: 'Statutory'  },
  { id: 'ait',               label: 'AIT Deduction Register',  icon: FileText,        group: 'Statutory'  },
]

const GROUPS = ['Overview', 'Operations', 'Restaurant', 'Accounting', 'Statutory']

const GROUP_STYLES = {
  Overview:   { active: 'border-pine text-pine',           inactive: 'text-pine/50' },
  Operations: { active: 'border-forest text-forest',       inactive: 'text-pine/50' },
  Restaurant: { active: 'border-amber-600 text-amber-700', inactive: 'text-pine/50' },
  Accounting: { active: 'border-blue-600 text-blue-700',   inactive: 'text-pine/50' },
  Statutory:  { active: 'border-red-600 text-red-700',     inactive: 'text-pine/50' },
}

const GROUP_BADGE = {
  Overview:   'bg-pine/10 text-pine',
  Operations: 'bg-forest/10 text-forest',
  Restaurant: 'bg-amber-50 text-amber-700',
  Accounting: 'bg-blue-50 text-blue-700',
  Statutory:  'bg-red-50 text-red-700',
}

const firstOfMonth = () => todayISO().slice(0, 8) + '01'
const firstOfYear  = () => todayISO().slice(0, 4) + '-01-01'

/* ══════════════════════════════════════════════════════════════════════
   PRINT HELPER
══════════════════════════════════════════════════════════════════════ */
function printToPDF(title, htmlContent) {
  const win = window.open('', '_blank', 'width=1000,height=800')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}
  h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:0 0 12px;color:#444}
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
</style></head><body>${htmlContent}
<script>setTimeout(()=>{window.print();window.close();},400);<\/script></body></html>`)
  win.document.close()
}

function companyHeader(company, title, period) {
  return `<h1>${company || 'Aura Stay ERP'}</h1><h2>${title}</h2>
<div class="meta">Period: ${period} &nbsp;|&nbsp; Printed: ${new Date().toLocaleString('en-BD')}</div>`
}

/* ══════════════════════════════════════════════════════════════════════
   SHARED UI COMPONENTS
══════════════════════════════════════════════════════════════════════ */
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
      <span>{label}</span><span className="money font-semibold">{fmtBDT(val)}</span>
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
    {data && onPrint  && <button className="btn-ghost" onClick={onPrint}><Printer size={15} /> PDF</button>}
  </div>
)

const Tbl = ({ heads, rows, footRow }) => (
  <div className="card overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead><tr>{heads.map((h, i) => <th key={i} className={`th ${h.right ? 'text-right' : ''}`}>{h.label}</th>)}</tr></thead>
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
          {rows.length === 0 && <tr><td className="td text-pine/40 text-center py-6" colSpan={heads.length}>No data in selected range.</td></tr>}
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

function Loading() { return <div className="text-pine/50 py-6 flex items-center gap-2"><RefreshCw size={16} className="animate-spin" /> Loading…</div> }
function Err({ msg }) {
  return <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2"><AlertCircle size={18} />{msg}</div>
}

/* ══════════════════════════════════════════════════════════════════════
   RECEIPT / PAYMENT TOOLBAR
   Floats at top of every tab with Quick Add buttons
══════════════════════════════════════════════════════════════════════ */
function ReceiptPaymentBar({ onRefresh }) {
  const [modal, setModal] = useState(null) // 'RECEIPT' | 'PAYMENT' | null

  return (
    <>
      <div className="flex items-center gap-2 p-3 bg-white border border-leaf rounded-xl shadow-sm">
        <span className="text-xs font-semibold text-pine/60 mr-1">Quick Entry:</span>
        <button
          onClick={() => setModal('RECEIPT')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-forest text-white rounded-lg text-xs font-semibold hover:bg-forest/90 transition"
        >
          <Plus size={13} /> Record Receipt
        </button>
        <button
          onClick={() => setModal('PAYMENT')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition"
        >
          <Minus size={13} /> Record Payment
        </button>
      </div>

      {modal && (
        <ReceiptPaymentModal
          type={modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); onRefresh?.() }}
        />
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   DRILL-DOWN ROW COMPONENT
   Click any grouped row to expand sub-lines
══════════════════════════════════════════════════════════════════════ */
function DrillDownSection({ title, total, lines, color = 'text-pine', bgColor = 'bg-leaf/20' }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      {/* Summary row — clickable */}
      <div
        onClick={() => setOpen(o => !o)}
        className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer hover:${bgColor} transition group`}
      >
        <div className="flex items-center gap-1.5">
          {open ? <ChevronDown size={14} className="text-pine/50" /> : <ChevronRight size={14} className="text-pine/50" />}
          <span className={`font-semibold text-sm ${color}`}>{title}</span>
          {lines.length > 0 && (
            <span className="text-[10px] bg-leaf text-pine/60 rounded-full px-1.5 py-0.5 ml-1 group-hover:bg-forest group-hover:text-white transition">
              {lines.length} items
            </span>
          )}
        </div>
        <span className={`money font-bold text-sm ${color}`}>{fmtBDT(total)}</span>
      </div>

      {/* Expanded drill-down lines */}
      {open && (
        <div className="ml-5 mt-1 mb-2 border-l-2 border-leaf pl-3 space-y-0.5">
          {lines.length === 0 ? (
            <div className="text-xs text-pine/40 py-2">No detail lines available.</div>
          ) : (
            lines.map((line, i) => (
              <div key={i} className="flex justify-between py-1 border-b border-leaf/40 text-sm">
                <span className="text-pine/70 truncate max-w-[70%]">{line.name}</span>
                <span className="money text-pine/80">{fmtBDT(line.val)}</span>
              </div>
            ))
          )}
          {/* Subtotal */}
          <div className="flex justify-between py-1.5 font-semibold text-sm">
            <span className="text-pine/60">Subtotal</span>
            <span className={`money ${color}`}>{fmtBDT(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   DASHBOARD KPI
══════════════════════════════════════════════════════════════════════ */
function ReportsDashboardKPI({ co, onRefresh }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo]     = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr]   = useState(null)

  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [
        { data: charges }, { data: payments }, { data: rooms },
        { data: reservations }, { data: posOrders }, { data: jLines },
        { data: assets }, { data: openPOs }, { data: grnData },
      ] = await Promise.all([
        supabase.from('folio_charges').select('charge_type,total,base_amount,discount,vat_amount').gte('charge_date', from).lte('charge_date', to),
        supabase.from('payments').select('method,amount').gte('received_date', from).lte('received_date', to),
        supabase.from('rooms').select('id').eq('is_active', true),
        supabase.from('reservations').select('status,folio_charges(total),payments(amount)').gte('check_in', from).lte('check_in', to),
        supabase.from('pos_orders').select('total,status').gte('created_at', `${from}T00:00:00Z`).lte('created_at', `${to}T23:59:59Z`),
        supabase.from('journal_lines').select('debit,credit,journal_entries(jv_date)').gte('journal_entries.jv_date', from).lte('journal_entries.jv_date', to),
        supabase.from('fixed_assets').select('cost,asset_depreciation(amount)'),
        supabase.from('purchase_orders').select('po_items(qty,unit_cost)').gte('po_date', from).lte('po_date', to).in('status', ['OPEN','PARTIAL','RECEIVED']),
        supabase.from('goods_receipts').select('grn_items(qty,unit_cost,vat_amount)').gte('grn_date', from).lte('grn_date', to),
      ])
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
      const outstanding    = (reservations || []).reduce((a, r) => {
        const b = (r.folio_charges || []).reduce((s, c) => s + +c.total, 0)
        const p = (r.payments || []).reduce((s, p) => s + +p.amount, 0)
        return a + Math.max(0, b - p)
      }, 0)
      const posSales  = (posOrders || []).filter(o => o.status !== 'CANCELLED').reduce((a, o) => a + +o.total, 0)
      const posCount  = (posOrders || []).filter(o => o.status !== 'CANCELLED').length
      const journalDr = (jLines || []).reduce((a, l) => a + +l.debit, 0)
      const journalCr = (jLines || []).reduce((a, l) => a + +l.credit, 0)
      const cashIn    = (payments || []).filter(p => p.method === 'CASH').reduce((a, p) => a + +p.amount, 0)
      const bankIn    = (payments || []).filter(p => ['BANK','BKASH','NAGAD','CARD'].includes(p.method)).reduce((a, p) => a + +p.amount, 0)
      const outputVAT = (charges || []).reduce((a, c) => a + +c.vat_amount, 0)
      const inputVAT  = (grnData || []).reduce((a, g) => a + (g.grn_items || []).reduce((s, i) => s + +i.vat_amount, 0), 0)
      const netVAT    = outputVAT - inputVAT
      const totalAssets   = (assets || []).reduce((a, x) => a + +x.cost, 0)
      const totalAccumDep = (assets || []).reduce((a, x) => a + (x.asset_depreciation || []).reduce((s, d) => s + +d.amount, 0), 0)
      const apTotal = (openPOs || []).reduce((a, p) => a + (p.po_items || []).reduce((s, i) => s + +i.qty * +i.unit_cost, 0), 0)
      const ait = apTotal * 0.07

      // Revenue breakdown by category for drill-down
      const revByCat = {}
      for (const c of charges || []) revByCat[c.charge_type] = (revByCat[c.charge_type] || 0) + +c.total
      const revLines = Object.entries(revByCat).map(([name, val]) => ({ name, val }))

      // Collection breakdown
      const colByMethod = {}
      for (const p of payments || []) colByMethod[p.method] = (colByMethod[p.method] || 0) + +p.amount
      const colLines = Object.entries(colByMethod).map(([name, val]) => ({ name, val }))

      setData({
        totalRevenue, totalCollected, outstanding,
        roomNights, capacity, occupancy, adr, revpar,
        resCount: (reservations || []).length,
        posSales, posCount, journalDr, journalCr, cashIn, bankIn,
        outputVAT, inputVAT, netVAT,
        totalAssets, totalAccumDep, bookValue: totalAssets - totalAccumDep,
        apTotal, ait,
        revLines, colLines,
      })
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }, [from, to])

  useEffect(() => { run() }, [])

  const K = ({ label, val, sub, color = 'text-pine' }) => (
    <div className="card p-3.5 space-y-0.5">
      <div className="text-[11px] text-pine/50 font-medium leading-tight">{label}</div>
      <div className={`font-display text-lg font-bold money ${color}`}>{val}</div>
      {sub && <div className="text-[11px] text-pine/40">{sub}</div>}
    </div>
  )
  const Sec = ({ title, color }) => (
    <div className={`text-[11px] font-bold uppercase tracking-widest pt-1 ${color}`}>{title}</div>
  )

  return (
    <div className="space-y-4">
      <ReceiptPaymentBar onRefresh={run} />
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="label">From</label><input type="date" className="input !w-40" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="label">To</label><input type="date" className="input !w-40" value={to} onChange={e => setTo(e.target.value)} /></div>
        <button className="btn-primary" onClick={run}>Refresh</button>
      </div>
      {err && <Err msg={err} />}
      {loading && <Loading />}
      {data && (
        <div className="space-y-4">
          <Sec title="Operations" color="text-forest" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <K label="Total Revenue"    val={fmtBDT(data.totalRevenue)}   color="text-forest" />
            <K label="Total Collected"  val={fmtBDT(data.totalCollected)} />
            <K label="Outstanding"      val={fmtBDT(data.outstanding)}    color="text-red-600" />
            <K label="Reservations"     val={data.resCount} />
            <K label="Occupancy"        val={`${data.occupancy.toFixed(1)}%`} sub={`${data.roomNights}/${data.capacity} rm-nights`} color="text-forest" />
            <K label="ADR"              val={fmtBDT(data.adr)} />
            <K label="RevPAR"           val={fmtBDT(data.revpar)} />
            <K label="Cash Received"    val={fmtBDT(data.cashIn)} sub="Cash method" />
          </div>

          {/* Drill-down: Revenue + Collection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-4 space-y-1">
              <p className="text-xs font-semibold text-pine/50 mb-2">Revenue by Category — Click to expand</p>
              <DrillDownSection title="Total Revenue" total={data.totalRevenue} lines={data.revLines} color="text-forest" />
            </div>
            <div className="card p-4 space-y-1">
              <p className="text-xs font-semibold text-pine/50 mb-2">Collections by Method — Click to expand</p>
              <DrillDownSection title="Total Collected" total={data.totalCollected} lines={data.colLines} color="text-blue-700" />
            </div>
          </div>

          <Sec title="Restaurant" color="text-amber-700" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <K label="POS Sales"         val={fmtBDT(data.posSales)}  color="text-amber-700" />
            <K label="POS Orders"        val={data.posCount} />
            <K label="Bank / Digital In" val={fmtBDT(data.bankIn)} />
            <K label="Total Collections" val={fmtBDT(data.totalCollected)} />
          </div>

          <Sec title="Accounting" color="text-blue-700" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <K label="Journal Debits"      val={fmtBDT(data.journalDr)}   color="text-blue-700" />
            <K label="Journal Credits"     val={fmtBDT(data.journalCr)}   color="text-blue-700" />
            <K label="Fixed Assets (Cost)" val={fmtBDT(data.totalAssets)} />
            <K label="Net Book Value"      val={fmtBDT(data.bookValue)}   sub={`Dep: ${fmtBDT(data.totalAccumDep)}`} />
            <K label="AP (Open POs)"       val={fmtBDT(data.apTotal)}     color="text-red-600" />
            <K label="AIT Deducted (7%)"   val={fmtBDT(data.ait)} />
            <K label="Cash In"             val={fmtBDT(data.cashIn)} />
            <K label="Bank / Digital In"   val={fmtBDT(data.bankIn)} />
          </div>

          <Sec title="Statutory / VAT" color="text-red-700" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <K label="Output VAT (Sales)"    val={fmtBDT(data.outputVAT)} color="text-red-600" />
            <K label="Input VAT (Purchases)" val={fmtBDT(data.inputVAT)} />
            <K label="Net VAT Payable"       val={fmtBDT(data.netVAT)} color={data.netVAT > 0 ? 'text-red-600' : 'text-forest'} sub="Output − Input" />
            <K label="AIT @ 7%"              val={fmtBDT(data.ait)} />
          </div>

          {/* Bar chart */}
          <div className="card p-4">
            <div className="text-xs font-semibold text-pine mb-3">Revenue · Collected · Outstanding</div>
            <div className="space-y-2.5">
              {[
                { label: 'Revenue',     val: data.totalRevenue,   color: 'bg-forest'   },
                { label: 'Collected',   val: data.totalCollected, color: 'bg-blue-500' },
                { label: 'Outstanding', val: data.outstanding,    color: 'bg-red-400'  },
              ].map(b => {
                const max = Math.max(data.totalRevenue, data.totalCollected, data.outstanding, 1)
                return (
                  <div key={b.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-pine/70">{b.label}</span>
                      <span className="money font-semibold">{fmtBDT(b.val)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-leaf/40 overflow-hidden">
                      <div className={`h-full rounded-full ${b.color}`} style={{ width: `${(b.val / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <p className="text-[11px] text-pine/35 px-1">Period: {from} → {to} · {co || '—'} · BDT (৳)</p>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   OPERATIONS REPORTS
══════════════════════════════════════════════════════════════════════ */
function DashboardTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo]     = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr]   = useState(null)

  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [{ data: ch }, { data: pm }, { data: rooms }, { data: res }] = await Promise.all([
        supabase.from('folio_charges').select('charge_type,total,base_amount,discount').gte('charge_date', from).lte('charge_date', to),
        supabase.from('payments').select('method,amount').gte('received_date', from).lte('received_date', to),
        supabase.from('rooms').select('id').eq('is_active', true),
        supabase.from('reservations').select('status').gte('check_in', from).lte('check_in', to),
      ])
      const revByCat = {}; for (const c of ch || []) revByCat[c.charge_type] = (revByCat[c.charge_type] || 0) + +c.total
      const payByMethod = {}; for (const p of pm || []) payByMethod[p.method] = (payByMethod[p.method] || 0) + +p.amount
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
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])

  useEffect(() => { run() }, [])

  const onPrint = () => {
    if (!data) return
    const rows = Object.entries(data.revByCat).map(([k, v]) => `<tr><td>${k}</td><td class="money">${fmtBDT(v)}</td></tr>`).join('')
    printToPDF('Dashboard', `${companyHeader(co,'Management Dashboard',`${from} to ${to}`)}<div class="kpi-grid"><div class="kpi"><div class="kpi-label">Revenue</div><div class="kpi-val">${fmtBDT(data.totalRev)}</div></div><div class="kpi"><div class="kpi-label">Collections</div><div class="kpi-val">${fmtBDT(data.totalPay)}</div></div><div class="kpi"><div class="kpi-label">Occupancy</div><div class="kpi-val">${data.occupancy.toFixed(1)}%</div></div><div class="kpi"><div class="kpi-label">ADR</div><div class="kpi-val">${fmtBDT(data.adr)}</div></div></div><table><thead><tr><th>Category</th><th class="money">৳</th></tr></thead><tbody>${rows}</tbody></table>`)
  }
  return (
    <div className="space-y-5">
      <ReceiptPaymentBar onRefresh={run} />
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {data && (<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Total Revenue" val={fmtBDT(data.totalRev)} accent />
          <Stat label="Collections" val={fmtBDT(data.totalPay)} />
          <Stat label="Occupancy" val={`${data.occupancy.toFixed(1)}%`} sub={`${data.roomNights}/${data.capacity} room-nights`} />
          <Stat label="ADR" val={fmtBDT(data.adr)} sub={`${data.resCount} reservations`} />
        </div>
        {/* Drill-down panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4">
            <p className="text-xs font-semibold text-pine/50 mb-3">Revenue by Category — Click to expand</p>
            {Object.entries(data.revByCat).sort((a,b)=>b[1]-a[1]).map(([k,v]) => (
              <DrillDownSection key={k} title={k} total={v} lines={[]} color="text-forest" />
            ))}
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold text-pine/50 mb-3">Collections by Method — Click to expand</p>
            {Object.entries(data.payByMethod).sort((a,b)=>b[1]-a[1]).map(([k,v]) => (
              <DrillDownSection key={k} title={k} total={v} lines={[]} color="text-blue-700" />
            ))}
          </div>
        </div>
      </>)}
    </div>
  )
}

function SalesReportsTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)

  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [{ data: ch }, { data: pm }, { data: rooms }, { data: dues }] = await Promise.all([
        supabase.from('folio_charges').select('*').gte('charge_date', from).lte('charge_date', to),
        supabase.from('payments').select('*').gte('received_date', from).lte('received_date', to),
        supabase.from('rooms').select('id').eq('is_active', true),
        supabase.from('reservations').select('res_no,reservation_name,source,check_in,check_out,status,room_type,folio_charges(total,charge_type),payments(amount)').gte('check_in', from).lte('check_in', to),
      ])
      const revByCat = {}; for (const c of ch || []) revByCat[c.charge_type] = (revByCat[c.charge_type] || 0) + +c.total
      const payByMethod = {}; for (const p of pm || []) payByMethod[p.method] = (payByMethod[p.method] || 0) + +p.amount
      const roomNights = (ch || []).filter(c => c.charge_type === 'ROOM').length
      const roomRev = (ch || []).filter(c => c.charge_type === 'ROOM').reduce((a, c) => a + +c.base_amount - +c.discount, 0)
      const days = Math.max(1, nightsBetween(from, to) + 1); const capacity = (rooms?.length || 0) * days
      // Build detailed reservation rows per template: Date, Guest, Room Type, Source, Status, Total, Deposit, Balance
      const resRows = (dues || []).map(r => {
        const total  = (r.folio_charges || []).reduce((a,c) => a + +c.total, 0)
        const paid   = (r.payments || []).reduce((a,p) => a + +p.amount, 0)
        return {
          res_no:  r.res_no,
          name:    r.reservation_name,
          checkin: r.check_in,
          checkout:r.check_out,
          room_type: r.room_type || '—',
          source:  r.source || '—',
          status:  r.status,
          total:   +total.toFixed(2),
          paid:    +paid.toFixed(2),
          balance: +(total - paid).toFixed(2),
        }
      })
      // Revenue drill-down lines (per charge_type)
      const revLines = Object.entries(revByCat).map(([name, val]) => ({ name, val }))
      setData({ revByCat, payByMethod, roomNights, resRows, revLines,
        adr: roomNights>0?roomRev/roomNights:0, occupancy: capacity>0?(roomNights/capacity)*100:0, capacity,
        totalRev: Object.values(revByCat).reduce((a,v)=>a+v,0),
        totalPay: Object.values(payByMethod).reduce((a,v)=>a+v,0),
      })
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])

  useEffect(() => { run() }, [])

  const onExport = () => data && exportXLSX(`Sales_${from}_${to}.xlsx`, [
    { name: 'Revenue', rows: [['Category','Amount'],...Object.entries(data.revByCat).map(([k,v])=>[k,v]),['TOTAL',data.totalRev]] },
    { name: 'Collections', rows: [['Method','Amount'],...Object.entries(data.payByMethod).map(([k,v])=>[k,v]),['TOTAL',data.totalPay]] },
    { name: 'Reservations', rows: [
      ['Res No','Guest','Check-in','Check-out','Room Type','Source','Status','Total ৳','Paid ৳','Balance ৳'],
      ...data.resRows.map(r=>[r.res_no,r.name,r.checkin,r.checkout,r.room_type,r.source,r.status,r.total,r.paid,r.balance]),
    ]},
  ])

  const onPrint = () => {
    if (!data) return
    const revRows = Object.entries(data.revByCat).map(([k,v])=>`<tr><td>${k}</td><td class="money">${fmtBDT(v)}</td></tr>`).join('')
    const resRows = data.resRows.map(r=>`<tr><td>${r.res_no}</td><td>${r.name}</td><td>${r.checkin}</td><td>${r.room_type}</td><td>${r.source}</td><td>${r.status}</td><td class="money">${fmtBDT(r.total)}</td><td class="money">${fmtBDT(r.paid)}</td><td class="money" style="color:${r.balance>0?'#c00':'#000'}">${fmtBDT(r.balance)}</td></tr>`).join('')
    printToPDF('Sales Report', `${companyHeader(co,'Sales & Reservations Report',`${from} to ${to}`)}<div class="section"><b>Revenue by Category</b><table><thead><tr><th>Category</th><th class="money">৳</th></tr></thead><tbody>${revRows}</tbody></table></div><div class="section"><b>Reservations Detail</b><table><thead><tr><th>Res No</th><th>Guest</th><th>Check-in</th><th>Room Type</th><th>Source</th><th>Status</th><th class="money">Total ৳</th><th class="money">Paid ৳</th><th class="money">Balance ৳</th></tr></thead><tbody>${resRows||'<tr><td colspan="9">None</td></tr>'}</tbody></table></div>`)
  }

  return (
    <div className="space-y-5">
      <ReceiptPaymentBar onRefresh={run} />
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {data && (<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Total revenue" val={fmtBDT(data.totalRev)} accent />
          <Stat label="Collections" val={fmtBDT(data.totalPay)} />
          <Stat label="Occupancy" val={`${data.occupancy.toFixed(1)}%`} sub={`${data.roomNights}/${data.capacity} room-nights`} />
          <Stat label="ADR" val={fmtBDT(data.adr)} />
        </div>

        {/* Revenue drill-down */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-pine/50 mb-3">Revenue Breakdown — Click category to expand</p>
          {data.revLines.sort((a,b)=>b.val-a.val).map(l => (
            <DrillDownSection key={l.name} title={l.name} total={l.val} lines={[]} color="text-forest" />
          ))}
          <div className="flex justify-between font-bold text-sm pt-2 border-t border-leaf mt-2">
            <span>Total Revenue</span><span className="money text-forest">{fmtBDT(data.totalRev)}</span>
          </div>
        </div>

        {/* Reservations table per template columns */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                {['Res No','Guest','Check-in','Check-out','Room Type','Source','Status','Total ৳','Paid ৳','Balance ৳'].map(h => (
                  <th key={h} className="th text-xs">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.resRows.map((r,i) => (
                  <tr key={i} className="hover:bg-leaf/20">
                    <td className="td text-xs">{r.res_no}</td>
                    <td className="td text-xs">{r.name}</td>
                    <td className="td text-xs">{r.checkin}</td>
                    <td className="td text-xs">{r.checkout}</td>
                    <td className="td text-xs">{r.room_type}</td>
                    <td className="td text-xs">{r.source}</td>
                    <td className="td text-xs"><span className="px-1.5 py-0.5 rounded text-[10px] bg-leaf/40">{r.status}</span></td>
                    <td className="td text-xs text-right money">{fmtBDT(r.total)}</td>
                    <td className="td text-xs text-right money text-forest">{fmtBDT(r.paid)}</td>
                    <td className={`td text-xs text-right money ${r.balance > 0 ? 'text-red-600' : 'text-forest'}`}>{fmtBDT(r.balance)}</td>
                  </tr>
                ))}
                {data.resRows.length === 0 && <tr><td colSpan={10} className="td text-pine/40 text-center py-6">No reservations in range.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </>)}
    </div>
  )
}

function OccupancyTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [{ data: rooms }, { data: res }, { data: ch }] = await Promise.all([
        supabase.from('rooms').select('id,room_type,base_rate').eq('is_active', true),
        supabase.from('reservations').select('room_type,status,check_in').gte('check_in', from).lte('check_in', to),
        supabase.from('folio_charges').select('charge_type,base_amount,discount,charge_date').gte('charge_date', from).lte('charge_date', to).eq('charge_type', 'ROOM'),
      ])
      const totalRooms = rooms?.length || 0; const days = Math.max(1, nightsBetween(from, to) + 1)
      const roomRev = (ch || []).reduce((a, c) => a + +c.base_amount - +c.discount, 0)
      const roomNights = ch?.length || 0; const adr = roomNights > 0 ? roomRev / roomNights : 0
      const capacity = totalRooms * days; const occupancy = capacity > 0 ? (roomNights / capacity) * 100 : 0
      const revpar = totalRooms > 0 ? roomRev / (totalRooms * days) : 0

      // Per template: Date, Rooms Sold, Total Rooms, Occupancy%, Room Revenue, RevPAR
      const byDay = {}
      for (const c of ch || []) {
        const d = c.charge_date
        if (!byDay[d]) byDay[d] = { date: d, roomsSold: 0, roomRev: 0 }
        byDay[d].roomsSold++
        byDay[d].roomRev += +c.base_amount - +c.discount
      }
      const dayRows = Object.values(byDay).sort((a,b)=>a.date<b.date?-1:1).map(d => ({
        date: d.date,
        rooms_sold: d.roomsSold,
        total_rooms: totalRooms,
        occ_pct: capacity > 0 ? +((d.roomsSold / totalRooms) * 100).toFixed(1) : 0,
        room_rev: +d.roomRev.toFixed(2),
        revpar: totalRooms > 0 ? +(d.roomRev / totalRooms).toFixed(2) : 0,
      }))

      const byType = {}; for (const r of res || []) { if (!byType[r.room_type]) byType[r.room_type] = 0; byType[r.room_type]++ }
      setData({ totalRooms, capacity, roomNights, occupancy, adr, revpar, roomRev, byType, dayRows, resCount: res?.length || 0 })
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])

  const onExport = () => data && exportXLSX(`Occupancy_${from}_${to}.xlsx`, [
    { name: 'KPIs', rows: [['Total Rooms',data.totalRooms],['Room-nights',data.roomNights],['Capacity',data.capacity],['Occupancy %',+data.occupancy.toFixed(1)],['Room Revenue',+data.roomRev.toFixed(2)],['ADR',+data.adr.toFixed(2)],['RevPAR',+data.revpar.toFixed(2)]] },
    { name: 'Daily Detail', rows: [['Date','Rooms Sold','Total Rooms','Occupancy %','Room Revenue ৳','RevPAR ৳'],...data.dayRows.map(d=>[d.date,d.rooms_sold,d.total_rooms,d.occ_pct,d.room_rev,d.revpar])] },
    { name: 'By Room Type', rows: [['Room Type','Reservations'],...Object.entries(data.byType).map(([k,v])=>[k,v])] },
  ])

  const onPrint = () => {
    if (!data) return
    const typeRows = Object.entries(data.byType).map(([k,v])=>`<tr><td>${k}</td><td class="money">${v}</td></tr>`).join('')
    const dayRows = data.dayRows.map(d=>`<tr><td>${d.date}</td><td class="money">${d.rooms_sold}</td><td class="money">${d.total_rooms}</td><td class="money">${d.occ_pct}%</td><td class="money">${fmtBDT(d.room_rev)}</td><td class="money">${fmtBDT(d.revpar)}</td></tr>`).join('')
    printToPDF('Occupancy', `${companyHeader(co,'Occupancy & RevPAR Report',`${from} to ${to}`)}<div class="kpi-grid"><div class="kpi"><div class="kpi-label">Rooms</div><div class="kpi-val">${data.totalRooms}</div></div><div class="kpi"><div class="kpi-label">Occupancy</div><div class="kpi-val">${data.occupancy.toFixed(1)}%</div></div><div class="kpi"><div class="kpi-label">ADR</div><div class="kpi-val">${fmtBDT(data.adr)}</div></div><div class="kpi"><div class="kpi-label">RevPAR</div><div class="kpi-val">${fmtBDT(data.revpar)}</div></div></div><table><thead><tr><th>Date</th><th class="money">Rooms Sold</th><th class="money">Total Rooms</th><th class="money">Occ %</th><th class="money">Room Rev ৳</th><th class="money">RevPAR ৳</th></tr></thead><tbody>${dayRows}</tbody></table><br><table><thead><tr><th>Room Type</th><th class="money">Reservations</th></tr></thead><tbody>${typeRows}</tbody></table>`)
  }
  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {data && (<>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Stat label="Total rooms" val={data.totalRooms} />
          <Stat label="Occupancy" val={`${data.occupancy.toFixed(1)}%`} sub={`${data.roomNights}/${data.capacity}`} accent />
          <Stat label="ADR" val={fmtBDT(data.adr)} />
          <Stat label="RevPAR" val={fmtBDT(data.revpar)} accent />
          <Stat label="Room revenue" val={fmtBDT(data.roomRev)} />
        </div>
        {/* Daily detail table per template */}
        <Tbl
          heads={[
            {label:'Date',key:'date'},
            {label:'Rooms Sold',key:'rooms_sold',right:true},
            {label:'Total Rooms',key:'total_rooms',right:true},
            {label:'Occupancy %',key:'occ_pct',right:true,fmt:v=>`${v}%`},
            {label:'Room Revenue ৳',key:'room_rev',right:true,fmt:fmtBDT},
            {label:'RevPAR ৳',key:'revpar',right:true,fmt:fmtBDT},
          ]}
          rows={data.dayRows}
        />
        <Tbl heads={[{label:'Room Type',key:'type'},{label:'Reservations',key:'count',right:true}]} rows={Object.entries(data.byType).map(([k,v])=>({type:k,count:v}))} />
      </>)}
    </div>
  )
}

function GuestLedgerTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)

  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const { data: res } = await supabase.from('reservations')
        .select('res_no,reservation_name,room_id,check_in,check_out,status,folio_charges(total,charge_type),payments(amount)')
        .in('status', ['CHECKED_IN','CHECKED_OUT','CONFIRMED'])
        .gte('check_in', from).lte('check_in', to)
      setRows((res || []).map(r => {
        const roomCharges = (r.folio_charges||[]).filter(c=>c.charge_type==='ROOM').reduce((a,x)=>a+ +x.total,0)
        const fnbCharges  = (r.folio_charges||[]).filter(c=>c.charge_type==='RESTAURANT').reduce((a,x)=>a+ +x.total,0)
        const otherCharges= (r.folio_charges||[]).filter(c=>!['ROOM','RESTAURANT'].includes(c.charge_type)).reduce((a,x)=>a+ +x.total,0)
        const taxes       = (r.folio_charges||[]).reduce((a,x)=>a+0,0) // VAT in total
        const total       = roomCharges + fnbCharges + otherCharges
        const p           = (r.payments||[]).reduce((a,x)=>a+ +x.amount,0)
        return {
          res_no: r.res_no, name: r.reservation_name,
          checkin: r.check_in, checkout: r.check_out, status: r.status,
          opening: 0, room_charges: +roomCharges.toFixed(2),
          fnb_charges: +fnbCharges.toFixed(2), taxes: +taxes.toFixed(2),
          payments: +p.toFixed(2), closing: +(total - p).toFixed(2),
          _charges: roomCharges + fnbCharges + otherCharges,
        }
      }))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])

  const totals = rows ? {
    room_charges: rows.reduce((a,r)=>a+r.room_charges,0),
    fnb_charges:  rows.reduce((a,r)=>a+r.fnb_charges,0),
    payments:     rows.reduce((a,r)=>a+r.payments,0),
    closing:      rows.reduce((a,r)=>a+r.closing,0),
  } : null

  const onExport = () => rows && exportXLSX(`GuestLedger_${from}_${to}.xlsx`, [{
    name: 'Guest Ledger',
    rows: [
      ['Res No','Guest','Check-in','Check-out','Status','Opening Bal','Room Charges ৳','F&B Charges ৳','Taxes ৳','Payments ৳','Closing Bal ৳'],
      ...rows.map(r=>[r.res_no,r.name,r.checkin,r.checkout,r.status,0,r.room_charges,r.fnb_charges,r.taxes,r.payments,r.closing]),
      ['','','','','','TOTAL',totals?.room_charges,totals?.fnb_charges,'',totals?.payments,totals?.closing],
    ]
  }])

  const onPrint = () => {
    if (!rows) return
    const trs = rows.map(r=>`<tr><td>${r.res_no}</td><td>${r.name}</td><td>${r.checkin}</td><td>${r.status}</td><td class="money">0</td><td class="money">${fmtBDT(r.room_charges)}</td><td class="money">${fmtBDT(r.fnb_charges)}</td><td class="money">${fmtBDT(r.taxes)}</td><td class="money">${fmtBDT(r.payments)}</td><td class="money">${fmtBDT(r.closing)}</td></tr>`).join('')
    printToPDF('Guest Ledger', `${companyHeader(co,'Guest Ledger',`${from} to ${to}`)}<table><thead><tr><th>Res No</th><th>Guest</th><th>Check-in</th><th>Status</th><th class="money">Opening</th><th class="money">Room ৳</th><th class="money">F&B ৳</th><th class="money">Taxes ৳</th><th class="money">Payments ৳</th><th class="money">Closing ৳</th></tr></thead><tbody>${trs}<tr class="total-row"><td colspan="5">TOTAL</td><td class="money">${fmtBDT(totals?.room_charges)}</td><td class="money">${fmtBDT(totals?.fnb_charges)}</td><td></td><td class="money">${fmtBDT(totals?.payments)}</td><td class="money">${fmtBDT(totals?.closing)}</td></tr></tbody></table>`)
  }
  return (
    <div className="space-y-5">
      <ReceiptPaymentBar onRefresh={run} />
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {rows && (<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Room charges" val={fmtBDT(totals.room_charges)} />
          <Stat label="F&B charges" val={fmtBDT(totals.fnb_charges)} />
          <Stat label="Total payments" val={fmtBDT(totals.payments)} />
          <Stat label="Outstanding balance" val={fmtBDT(totals.closing)} accent />
        </div>
        {/* Per template columns */}
        <Tbl
          heads={[
            {label:'Res No',key:'res_no'},
            {label:'Guest',key:'name'},
            {label:'Check-in',key:'checkin'},
            {label:'Check-out',key:'checkout'},
            {label:'Status',key:'status'},
            {label:'Opening Bal',key:'opening',right:true,fmt:()=>'—'},
            {label:'Room Charges',key:'room_charges',right:true,fmt:fmtBDT},
            {label:'F&B Charges',key:'fnb_charges',right:true,fmt:fmtBDT},
            {label:'Taxes',key:'taxes',right:true,fmt:fmtBDT},
            {label:'Payments',key:'payments',right:true,fmt:fmtBDT},
            {label:'Closing Bal',key:'closing',right:true,fmt:fmtBDT,red:true},
          ]}
          rows={rows}
          footRow={totals}
        />
      </>)}
    </div>
  )
}

function CityLedgerTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const { data: agencies } = await supabase.from('agencies').select('id,name')
      const { data: res } = await supabase.from('reservations')
        .select('agency_id,res_no,check_in,check_out,folio_charges(total,charge_type),payments(amount,received_date)')
        .not('agency_id', 'is', null).gte('check_in', from).lte('check_in', to)
      const map = {}; for (const a of agencies || []) map[a.id] = { name: a.name, rows: [] }
      for (const r of res || []) {
        if (!map[r.agency_id]) continue
        const charges = (r.folio_charges||[]).reduce((a,c)=>a+ +c.total,0)
        const paid    = (r.payments||[]).reduce((a,p)=>a+ +p.amount,0)
        const lastPay = (r.payments||[]).sort((a,b)=>a.received_date<b.received_date?1:-1)[0]?.received_date
        const daysOld = lastPay ? Math.floor((new Date()-new Date(lastPay))/86400000) : 999
        map[r.agency_id].rows.push({ res_no: r.res_no, service: 'Accommodation', invoice_date: r.check_in, due_date: r.check_out, charges, paid, balance: charges-paid, daysOld })
      }
      const result = Object.values(map).filter(v=>v.rows.length>0).flatMap(v =>
        v.rows.map(row => ({
          agency: v.name,
          ...row,
          aging_current: row.daysOld <= 30 ? row.balance : 0,
          aging_31_60:   row.daysOld > 30 && row.daysOld <= 60 ? row.balance : 0,
          aging_60plus:  row.daysOld > 60 ? row.balance : 0,
        }))
      )
      setRows(result)
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])
  const totals = rows ? {
    charges: rows.reduce((a,r)=>a+r.charges,0), paid: rows.reduce((a,r)=>a+r.paid,0),
    balance: rows.reduce((a,r)=>a+r.balance,0),
    aging_current: rows.reduce((a,r)=>a+r.aging_current,0),
    aging_31_60: rows.reduce((a,r)=>a+r.aging_31_60,0),
    aging_60plus: rows.reduce((a,r)=>a+r.aging_60plus,0),
  } : null
  const onExport = () => rows && exportXLSX(`CityLedger_${from}_${to}.xlsx`,[{name:'City Ledger',rows:[
    ['Account Name','Res No','Service','Invoice Date','Due Date','Amount ৳','Paid ৳','Balance ৳','0-30 Days','31-60 Days','60+ Days'],
    ...rows.map(r=>[r.agency,r.res_no,r.service,r.invoice_date,r.due_date,r.charges,r.paid,r.balance,r.aging_current,r.aging_31_60,r.aging_60plus]),
    ['TOTAL','','','','',totals?.charges,totals?.paid,totals?.balance,totals?.aging_current,totals?.aging_31_60,totals?.aging_60plus],
  ]}])
  const onPrint = () => { if (!rows) return; const trs=rows.map(r=>`<tr><td>${r.agency}</td><td>${r.res_no}</td><td>${r.service}</td><td>${r.invoice_date}</td><td>${r.due_date}</td><td class="money">${fmtBDT(r.charges)}</td><td class="money">${fmtBDT(r.paid)}</td><td class="money">${fmtBDT(r.balance)}</td><td class="money">${fmtBDT(r.aging_current)}</td><td class="money">${fmtBDT(r.aging_31_60)}</td><td class="money">${fmtBDT(r.aging_60plus)}</td></tr>`).join(''); printToPDF('City Ledger',`${companyHeader(co,'City Ledger — Agency Receivables',`${from} to ${to}`)}<table><thead><tr><th>Agency</th><th>Res No</th><th>Service</th><th>Invoice Date</th><th>Due Date</th><th class="money">Amount ৳</th><th class="money">Paid ৳</th><th class="money">Balance ৳</th><th class="money">0-30</th><th class="money">31-60</th><th class="money">60+</th></tr></thead><tbody>${trs}<tr class="total-row"><td colspan="5">TOTAL</td><td class="money">${fmtBDT(totals?.charges)}</td><td class="money">${fmtBDT(totals?.paid)}</td><td class="money">${fmtBDT(totals?.balance)}</td><td class="money">${fmtBDT(totals?.aging_current)}</td><td class="money">${fmtBDT(totals?.aging_31_60)}</td><td class="money">${fmtBDT(totals?.aging_60plus)}</td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {rows && (<>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Total billed" val={fmtBDT(totals.charges)} />
          <Stat label="Total collected" val={fmtBDT(totals.paid)} />
          <Stat label="Outstanding" val={fmtBDT(totals.balance)} accent />
        </div>
        <Tbl heads={[
          {label:'Account Name',key:'agency'},{label:'Res No',key:'res_no'},{label:'Service',key:'service'},
          {label:'Invoice Date',key:'invoice_date'},{label:'Due Date',key:'due_date'},
          {label:'Amount ৳',key:'charges',right:true,fmt:fmtBDT},{label:'Paid ৳',key:'paid',right:true,fmt:fmtBDT},
          {label:'Balance ৳',key:'balance',right:true,fmt:fmtBDT,red:true},
          {label:'0-30',key:'aging_current',right:true,fmt:fmtBDT},
          {label:'31-60',key:'aging_31_60',right:true,fmt:fmtBDT},
          {label:'60+',key:'aging_60plus',right:true,fmt:fmtBDT},
        ]} rows={rows} footRow={totals} />
      </>)}
    </div>
  )
}

function AgencyCommissionTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const { data: agencies } = await supabase.from('agencies').select('id,name,commission_rate')
      const { data: res } = await supabase.from('reservations')
        .select('agency_id,res_no,reservation_name,check_in,folio_charges(base_amount,discount)')
        .not('agency_id','is',null).gte('check_in',from).lte('check_in',to)
      const map = {}; for (const a of agencies||[]) map[a.id]={name:a.name,rate:+a.commission_rate,resRows:[]}
      for (const r of res||[]) {
        if (!map[r.agency_id]) continue
        const grossRev = (r.folio_charges||[]).reduce((a,c)=>a+ +c.base_amount- +c.discount,0)
        const comm = grossRev * (map[r.agency_id].rate/100)
        map[r.agency_id].resRows.push({ res_no:r.res_no, name:r.reservation_name, date:r.check_in, grossRev, comm, netRev: grossRev-comm })
      }
      setRows(Object.values(map).flatMap(v=>v.resRows.map(row=>({agency:v.name,rate:v.rate,...row}))))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])
  const totals = rows ? {grossRev:rows.reduce((a,r)=>a+r.grossRev,0),comm:rows.reduce((a,r)=>a+r.comm,0),netRev:rows.reduce((a,r)=>a+r.netRev,0)} : null
  const onExport = () => rows && exportXLSX(`AgencyCommission_${from}_${to}.xlsx`,[{name:'Agency Commission',rows:[['Date','Booking Ref','Guest Name','Agency','Comm %','Gross Rev ৳','Comm Amount ৳','Net Revenue ৳'],...rows.map(r=>[r.date,r.res_no,r.name,r.agency,r.rate,r.grossRev,r.comm,r.netRev]),['TOTAL','','','','',totals?.grossRev,totals?.comm,totals?.netRev]]}])
  const onPrint = () => { if (!rows) return; const trs=rows.map(r=>`<tr><td>${r.date}</td><td>${r.res_no}</td><td>${r.name}</td><td>${r.agency}</td><td class="money">${r.rate}%</td><td class="money">${fmtBDT(r.grossRev)}</td><td class="money">${fmtBDT(r.comm)}</td><td class="money">${fmtBDT(r.netRev)}</td></tr>`).join(''); printToPDF('Agency Commission',`${companyHeader(co,'Agency Commission Report',`${from} to ${to}`)}<table><thead><tr><th>Date</th><th>Ref</th><th>Guest</th><th>Agency</th><th class="money">Rate</th><th class="money">Gross Rev ৳</th><th class="money">Commission ৳</th><th class="money">Net Rev ৳</th></tr></thead><tbody>${trs}<tr class="total-row"><td colspan="5">TOTAL</td><td class="money">${fmtBDT(totals?.grossRev)}</td><td class="money">${fmtBDT(totals?.comm)}</td><td class="money">${fmtBDT(totals?.netRev)}</td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {rows && (<>
        <div className="grid grid-cols-3 gap-4"><Stat label="Gross revenue" val={fmtBDT(totals.grossRev)} /><Stat label="Total commission" val={fmtBDT(totals.comm)} accent /><Stat label="Net revenue" val={fmtBDT(totals.netRev)} /></div>
        <Tbl heads={[{label:'Date',key:'date'},{label:'Booking Ref',key:'res_no'},{label:'Guest Name',key:'name'},{label:'Agency',key:'agency'},{label:'Comm %',key:'rate',right:true,fmt:v=>`${v}%`},{label:'Gross Rev ৳',key:'grossRev',right:true,fmt:fmtBDT},{label:'Comm Amount ৳',key:'comm',right:true,fmt:fmtBDT},{label:'Net Revenue ৳',key:'netRev',right:true,fmt:fmtBDT}]} rows={rows} footRow={totals} />
      </>)}
    </div>
  )
}

function ShareholderTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const { data: sh } = await supabase.from('shareholders').select('id,name,commission_rate,free_stay_balance')
      const { data: res } = await supabase.from('reservations').select('shareholder_id,folio_charges(base_amount,discount)').not('shareholder_id','is',null).gte('check_in',from).lte('check_in',to)
      const map = {}; for (const s of sh||[]) map[s.id]={name:s.name,rate:+s.commission_rate,freeStay:+s.free_stay_balance,rev:0}
      for (const r of res||[]) { if (!map[r.shareholder_id]) continue; map[r.shareholder_id].rev+=(r.folio_charges||[]).reduce((a,c)=>a+ +c.base_amount- +c.discount,0) }
      setRows(Object.values(map).map(v=>({name:v.name,rate:v.rate,revenue:+v.rev.toFixed(2),commission:+(v.rev*v.rate/100).toFixed(2),freeStay:v.freeStay,payoutStatus:'Pending'})))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])
  const totComm = rows ? rows.reduce((a,r)=>a+r.commission,0) : 0
  const onExport = () => rows && exportXLSX(`Shareholder_${from}_${to}.xlsx`,[{name:'Shareholder Entitlement',rows:[['Period',`${from} to ${to}`],['Shareholder','Rate %','Revenue ৳','Commission ৳','Free Stay Bal','Payout Status'],...rows.map(r=>[r.name,r.rate,r.revenue,r.commission,r.freeStay,r.payoutStatus]),['TOTAL','','',totComm,'','']]}])
  const onPrint = () => { if (!rows) return; const trs=rows.map(r=>`<tr><td>${r.name}</td><td class="money">${r.rate}%</td><td class="money">${fmtBDT(r.revenue)}</td><td class="money">${fmtBDT(r.commission)}</td><td class="money">${r.freeStay}</td><td>${r.payoutStatus}</td></tr>`).join(''); printToPDF('Shareholder Entitlement',`${companyHeader(co,'Shareholder Entitlement Report',`${from} to ${to}`)}<table><thead><tr><th>Shareholder</th><th class="money">Rate %</th><th class="money">Revenue ৳</th><th class="money">Commission ৳</th><th class="money">Free Stay</th><th>Payout Status</th></tr></thead><tbody>${trs}<tr class="total-row"><td colspan="3">TOTAL</td><td class="money">${fmtBDT(totComm)}</td><td></td><td></td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {rows && (<><Stat label="Total commission entitlement" val={fmtBDT(totComm)} accent />
        <Tbl heads={[{label:'Shareholder',key:'name'},{label:'Period',key:'period',fmt:()=>`${from}–${to}`},{label:'Rate',key:'rate',right:true,fmt:v=>`${v}%`},{label:'Revenue ৳',key:'revenue',right:true,fmt:fmtBDT},{label:'Commission ৳',key:'commission',right:true,fmt:fmtBDT},{label:'Free Stay Bal',key:'freeStay',right:true},{label:'Payout Status',key:'payoutStatus'}]} rows={rows} /></>)}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   RESTAURANT REPORTS
══════════════════════════════════════════════════════════════════════ */
function PosReportsTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [{ data: orders }, { data: items }] = await Promise.all([
        supabase.from('pos_orders').select('*').gte('created_at',`${from}T00:00:00Z`).lte('created_at',`${to}T23:59:59Z`).neq('status','CANCELLED'),
        supabase.from('pos_order_items').select('menu_item_name,qty,unit_price,category').gte('created_at',`${from}T00:00:00Z`).lte('created_at',`${to}T23:59:59Z`),
      ])
      const totalSales=(orders||[]).reduce((a,o)=>a+ +o.total,0)
      const settled=(orders||[]).filter(o=>o.status==='SETTLED').reduce((a,o)=>a+ +o.total,0)
      const room=(orders||[]).filter(o=>o.status==='CHARGED_TO_ROOM').reduce((a,o)=>a+ +o.total,0)
      const discount=(orders||[]).reduce((a,o)=>a+ +(o.discount||0),0)
      const taxes=(orders||[]).reduce((a,o)=>a+ +(o.vat_amount||0),0)
      // Per template: Category, Qty Sold, Gross Sales, Discount, Net Sales, Taxes, Total
      const byCat={}; for (const it of items||[]) {
        const cat=it.category||it.menu_item_name; if (!byCat[cat]) byCat[cat]={cat,qty:0,gross:0}
        byCat[cat].qty+= +it.qty; byCat[cat].gross+= +it.qty* +it.unit_price
      }
      const catRows = Object.values(byCat).map(c=>({
        cat: c.cat, qty: c.qty, gross: +c.gross.toFixed(2),
        discount: 0, net: +c.gross.toFixed(2), taxes: 0, total: +c.gross.toFixed(2),
      }))
      setData({totalSales,settled,room,discount,taxes,orderCount:(orders||[]).length,catRows})
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])
  const onExport = () => data && exportXLSX(`POS_${from}_${to}.xlsx`,[
    {name:'Summary',rows:[['Total Sales',data.totalSales],['Settled',data.settled],['Room Charges',data.room],['Discount',data.discount],['Taxes',data.taxes],['Orders',data.orderCount]]},
    {name:'By Category',rows:[['Category','Qty Sold','Gross Sales ৳','Discount ৳','Net Sales ৳','Taxes ৳','Total ৳'],...data.catRows.map(r=>[r.cat,r.qty,r.gross,r.discount,r.net,r.taxes,r.total])]},
  ])
  const onPrint = () => { if (!data) return; const trs=data.catRows.map(r=>`<tr><td>${r.cat}</td><td class="money">${r.qty}</td><td class="money">${fmtBDT(r.gross)}</td><td class="money">${fmtBDT(r.discount)}</td><td class="money">${fmtBDT(r.net)}</td><td class="money">${fmtBDT(r.taxes)}</td><td class="money">${fmtBDT(r.total)}</td></tr>`).join(''); printToPDF('POS Summary',`${companyHeader(co,'Restaurant POS Sales Summary',`${from} to ${to}`)}<div class="kpi-grid"><div class="kpi"><div class="kpi-label">Total Sales</div><div class="kpi-val">${fmtBDT(data.totalSales)}</div></div><div class="kpi"><div class="kpi-label">Settled</div><div class="kpi-val">${fmtBDT(data.settled)}</div></div><div class="kpi"><div class="kpi-label">Room</div><div class="kpi-val">${fmtBDT(data.room)}</div></div><div class="kpi"><div class="kpi-label">Orders</div><div class="kpi-val">${data.orderCount}</div></div></div><table><thead><tr><th>Category</th><th class="money">Qty</th><th class="money">Gross ৳</th><th class="money">Discount ৳</th><th class="money">Net ৳</th><th class="money">Taxes ৳</th><th class="money">Total ৳</th></tr></thead><tbody>${trs}</tbody></table>`) }
  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {data && (<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Total POS sales" val={fmtBDT(data.totalSales)} accent />
          <Stat label="Settled" val={fmtBDT(data.settled)} />
          <Stat label="Charged to room" val={fmtBDT(data.room)} />
          <Stat label="Orders" val={data.orderCount} />
        </div>
        <Tbl heads={[
          {label:'Category',key:'cat'},{label:'Qty Sold',key:'qty',right:true},
          {label:'Gross Sales ৳',key:'gross',right:true,fmt:fmtBDT},
          {label:'Discount ৳',key:'discount',right:true,fmt:fmtBDT},
          {label:'Net Sales ৳',key:'net',right:true,fmt:fmtBDT},
          {label:'Taxes ৳',key:'taxes',right:true,fmt:fmtBDT},
          {label:'Total ৳',key:'total',right:true,fmt:fmtBDT},
        ]} rows={data.catRows} />
      </>)}
    </div>
  )
}

function KOTTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [{ data: orders }, { data: items }] = await Promise.all([
        supabase.from('pos_orders').select('id,order_no,created_at,status,total,table_no,waiter_name').gte('created_at',`${from}T00:00:00Z`).lte('created_at',`${to}T23:59:59Z`).order('created_at',{ascending:false}),
        supabase.from('pos_order_items').select('order_id,menu_item_name,qty,status').gte('created_at',`${from}T00:00:00Z`).lte('created_at',`${to}T23:59:59Z`),
      ])
      // Per template: Date/Time, KOT No, Table No, Waiter, Item, Qty, Status
      const itemsByOrder = {}; for (const it of items||[]) { if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id]=[]; itemsByOrder[it.order_id].push(it) }
      setRows((orders||[]).map(o=>({ ...o, kotItems: itemsByOrder[o.id]||[] })))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])
  const total = rows ? rows.reduce((a,r)=>a+(r.status!=='CANCELLED'? +r.total:0),0) : 0
  const onExport = () => rows && exportXLSX(`KOT_${from}_${to}.xlsx`,[{name:'KOT Register',rows:[['Date/Time','KOT No.','Table No.','Waiter','Item','Qty','Status (Served/Void)'],...rows.flatMap(r=>r.kotItems.length>0?r.kotItems.map(it=>[new Date(r.created_at).toLocaleString('en-BD'),r.order_no,r.table_no||'—',r.waiter_name||'—',it.menu_item_name,it.qty,it.status||r.status]):[new Date(r.created_at).toLocaleString('en-BD'),r.order_no,r.table_no||'—',r.waiter_name||'—','—','—',r.status])]}])
  const onPrint = () => { if (!rows) return; const trs=rows.map(r=>`<tr><td>${new Date(r.created_at).toLocaleString('en-BD')}</td><td>${r.order_no}</td><td>${r.table_no||'—'}</td><td>${r.waiter_name||'—'}</td><td>${r.kotItems.map(i=>i.menu_item_name).join(', ')||'—'}</td><td class="money">${r.status!=='CANCELLED'?fmtBDT(r.total):'—'}</td></tr>`).join(''); printToPDF('KOT Register',`${companyHeader(co,'KOT Register',`${from} to ${to}`)}<table><thead><tr><th>Date/Time</th><th>KOT No.</th><th>Table</th><th>Waiter</th><th>Items</th><th class="money">Amount ৳</th></tr></thead><tbody>${trs}<tr class="total-row"><td colspan="5">TOTAL</td><td class="money">${fmtBDT(total)}</td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {rows && (<><Stat label="Total F&B revenue" val={fmtBDT(total)} accent />
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                {['Date/Time','KOT No.','Table No.','Waiter','Item','Qty','Status','Amount ৳'].map(h=><th key={h} className="th text-xs">{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.flatMap((r,ri) => {
                  const base = {order_no:r.order_no,created_at:r.created_at,table_no:r.table_no,waiter_name:r.waiter_name,status:r.status,total:r.total}
                  if (r.kotItems.length === 0) return [<tr key={ri} className="hover:bg-leaf/20">{['created_at','order_no','table_no','waiter_name','—','—','status','total'].map((k,ci)=><td key={ci} className="td text-xs text-right money">{k==='created_at'?new Date(r[k]).toLocaleString('en-BD'):k==='total'?fmtBDT(r[k]):r[k]||'—'}</td>)}</tr>]
                  return r.kotItems.map((it,ii)=>(
                    <tr key={`${ri}-${ii}`} className="hover:bg-leaf/20">
                      <td className="td text-xs">{ii===0?new Date(r.created_at).toLocaleString('en-BD'):''}</td>
                      <td className="td text-xs">{ii===0?r.order_no:''}</td>
                      <td className="td text-xs">{r.table_no||'—'}</td>
                      <td className="td text-xs">{r.waiter_name||'—'}</td>
                      <td className="td text-xs">{it.menu_item_name}</td>
                      <td className="td text-xs text-right">{it.qty}</td>
                      <td className="td text-xs">{it.status||r.status}</td>
                      <td className="td text-xs text-right money">{ii===0&&r.status!=='CANCELLED'?fmtBDT(r.total):''}</td>
                    </tr>
                  ))
                })}
                {rows.length===0&&<tr><td colSpan={8} className="td text-pine/40 text-center py-6">No data.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </>)}
    </div>
  )
}

function FnBRevenueTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [{ data: pos }, { data: roomService }, { data: compMeals }] = await Promise.all([
        supabase.from('pos_orders').select('created_at,total,status').neq('status','CANCELLED').gte('created_at',`${from}T00:00:00Z`).lte('created_at',`${to}T23:59:59Z`),
        // Room service = CHARGED_TO_ROOM orders
        supabase.from('pos_orders').select('created_at,total').eq('status','CHARGED_TO_ROOM').gte('created_at',`${from}T00:00:00Z`).lte('created_at',`${to}T23:59:59Z`),
        // Staff meals: no folio_charges equivalent, use 0
        Promise.resolve({ data: [] }),
      ])
      const byDay={}
      for (const o of pos||[]) {
        const day=o.created_at.slice(0,10); if (!byDay[day]) byDay[day]={date:day,pos:0,roomSvc:0,comp:0}; byDay[day].pos+= +o.total
      }
      for (const o of roomService||[]) {
        const day=o.created_at.slice(0,10); if (!byDay[day]) byDay[day]={date:day,pos:0,roomSvc:0,comp:0}; byDay[day].roomSvc+= +o.total
      }
      setRows(Object.values(byDay).sort((a,b)=>a.date<b.date?-1:1).map(d=>({
        date:d.date, pos:+d.pos.toFixed(2), roomSvc:+d.roomSvc.toFixed(2), comp:0,
        net: +(d.pos).toFixed(2),
      })))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])
  const total = rows ? { pos:rows.reduce((a,r)=>a+r.pos,0), roomSvc:rows.reduce((a,r)=>a+r.roomSvc,0), comp:0, net:rows.reduce((a,r)=>a+r.net,0) } : null
  const onExport = () => rows && exportXLSX(`FnB_Daily_${from}_${to}.xlsx`,[{name:'F&B Daily Revenue',rows:[['Date','Total POS Sales ৳','Add: Room Service ৳','Less: Comp/Staff Meals ৳','Net F&B Revenue ৳'],...rows.map(r=>[r.date,r.pos,r.roomSvc,r.comp,r.net]),['TOTAL',total?.pos,total?.roomSvc,0,total?.net]]}])
  const onPrint = () => { if (!rows) return; const trs=rows.map(r=>`<tr><td>${r.date}</td><td class="money">${fmtBDT(r.pos)}</td><td class="money">${fmtBDT(r.roomSvc)}</td><td class="money">—</td><td class="money">${fmtBDT(r.net)}</td></tr>`).join(''); printToPDF('F&B Revenue',`${companyHeader(co,'F&B Daily Revenue Report',`${from} to ${to}`)}<table><thead><tr><th>Date</th><th class="money">POS Sales ৳</th><th class="money">Room Svc ৳</th><th class="money">Comp/Staff ৳</th><th class="money">Net F&B ৳</th></tr></thead><tbody>${trs}<tr class="total-row"><td>TOTAL</td><td class="money">${fmtBDT(total?.pos)}</td><td class="money">${fmtBDT(total?.roomSvc)}</td><td class="money">—</td><td class="money">${fmtBDT(total?.net)}</td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {rows && (<>
        <div className="grid grid-cols-3 gap-4"><Stat label="Total POS Sales" val={fmtBDT(total.pos)} accent /><Stat label="Room Service" val={fmtBDT(total.roomSvc)} /><Stat label="Net F&B Revenue" val={fmtBDT(total.net)} /></div>
        <Tbl heads={[{label:'Date',key:'date'},{label:'Total POS Sales ৳',key:'pos',right:true,fmt:fmtBDT},{label:'Add: Room Service ৳',key:'roomSvc',right:true,fmt:fmtBDT},{label:'Less: Comp/Staff ৳',key:'comp',right:true,fmt:()=>'—'},{label:'Net F&B Revenue ৳',key:'net',right:true,fmt:fmtBDT}]} rows={rows} footRow={total} />
      </>)}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   ACCOUNTING — SHARED FETCH
══════════════════════════════════════════════════════════════════════ */
async function fetchJournalBalances(from, to) {
  const { data: lines } = await supabase.from('journal_lines').select('debit,credit,account_id,journal_entries(jv_date)').gte('journal_entries.jv_date', from).lte('journal_entries.jv_date', to)
  const { data: accounts } = await supabase.from('chart_of_accounts').select('id,code,name,type,normal_side,subtype').eq('is_active', true).order('code')
  const balMap = {}
  for (const l of lines || []) { if (!balMap[l.account_id]) balMap[l.account_id] = { debit: 0, credit: 0 }; balMap[l.account_id].debit += +l.debit; balMap[l.account_id].credit += +l.credit }
  return { accounts: accounts || [], balMap, hasJournals: (lines || []).length > 0 }
}

/* ══════════════════════════════════════════════════════════════════════
   P&L — WITH FULL DRILL-DOWN
══════════════════════════════════════════════════════════════════════ */
function PLTab({ co }) {
  const [from, setFrom] = useState(firstOfYear()); const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)

  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const { accounts, balMap } = await fetchJournalBalances(from, to)
      let income=0,cogs=0,opex=0,interest=0,tax=0
      const incomeLines=[],cogsLines=[],opexLines=[],financeLines=[],taxLines=[]
      for (const a of accounts) {
        const b=balMap[a.id]||{debit:0,credit:0}; if (a.type!=='INCOME'&&a.type!=='EXPENSE') continue
        const net=a.normal_side==='CREDIT'?b.credit-b.debit:b.debit-b.credit; if (net===0) continue
        if (a.type==='INCOME'){income+=net;incomeLines.push({name:a.name,val:net})}
        else if (a.subtype==='COGS'){cogs+=net;cogsLines.push({name:a.name,val:net})}
        else if (a.code?.startsWith('8')){interest+=net;financeLines.push({name:a.name,val:net})}
        else if (a.code?.startsWith('9')){tax+=net;taxLines.push({name:a.name,val:net})}
        else{opex+=net;opexLines.push({name:a.name,val:net})}
      }
      const grossProfit=income-cogs,ebit=grossProfit-opex,ebt=ebit-interest,netProfit=ebt-tax
      setData({income,cogs,grossProfit,opex,ebit,interest,ebt,tax,netProfit,incomeLines,cogsLines,opexLines,financeLines,taxLines})
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])

  const onExport = () => data && exportXLSX(`PL_${from}_${to}.xlsx`,[{name:'P&L Statement',rows:[['Income Statement (IAS 1)',`${from} to ${to}`],['REVENUE',''],...data.incomeLines.map(l=>['  '+l.name,l.val]),['Total Revenue','',data.income],['COGS',''],...data.cogsLines.map(l=>['  '+l.name,l.val]),['Total COGS','',data.cogs],['Gross Profit','',data.grossProfit],['OPEX',''],...data.opexLines.map(l=>['  '+l.name,l.val]),['Total OpEx','',data.opex],['EBIT','',data.ebit],['Finance Cost','',data.interest],['EBT','',data.ebt],['Income Tax','',data.tax],['NET PROFIT / (LOSS)','',data.netProfit]]}])
  const onPrint = () => {
    if (!data) return
    const iR=data.incomeLines.map(l=>`<tr><td>&nbsp;&nbsp;${l.name}</td><td class="money">${fmtBDT(l.val)}</td></tr>`).join('')
    const cR=data.cogsLines.map(l=>`<tr><td>&nbsp;&nbsp;${l.name}</td><td class="money">${fmtBDT(l.val)}</td></tr>`).join('')
    const oR=data.opexLines.map(l=>`<tr><td>&nbsp;&nbsp;${l.name}</td><td class="money">${fmtBDT(l.val)}</td></tr>`).join('')
    printToPDF('P&L',`${companyHeader(co,'Statement of Profit or Loss (IAS 1)',`${from} to ${to}`)}<table><thead><tr><th>Description</th><th class="money">৳</th></tr></thead><tbody><tr class="group-row"><td>REVENUE</td><td></td></tr>${iR}<tr class="total-row"><td>Total Revenue</td><td class="money">${fmtBDT(data.income)}</td></tr><tr class="group-row"><td>COGS</td><td></td></tr>${cR}<tr class="total-row"><td><b>Gross Profit</b></td><td class="money"><b>${fmtBDT(data.grossProfit)}</b></td></tr><tr class="group-row"><td>OPERATING EXPENSES</td><td></td></tr>${oR}<tr class="total-row"><td><b>EBIT</b></td><td class="money"><b>${fmtBDT(data.ebit)}</b></td></tr><tr><td>Finance Cost</td><td class="money">(${fmtBDT(data.interest)})</td></tr><tr><td>Income Tax</td><td class="money">(${fmtBDT(data.tax)})</td></tr><tr class="total-row"><td><b>NET PROFIT / (LOSS)</b></td><td class="money"><b>${fmtBDT(data.netProfit)}</b></td></tr></tbody></table>`)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">IAS 1 — Statement of Profit or Loss · <span className="text-forest font-semibold">Click any section to drill down into individual accounts</span></p>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {data && (<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Revenue" val={fmtBDT(data.income)} />
          <Stat label="Gross profit" val={fmtBDT(data.grossProfit)} />
          <Stat label="EBIT" val={fmtBDT(data.ebit)} />
          <Stat label="Net profit / (loss)" val={fmtBDT(data.netProfit)} accent />
        </div>

        {/* ── DRILL-DOWN P&L STATEMENT ── */}
        <div className="card p-5 space-y-1">
          <p className="text-[11px] text-pine/40 mb-3 font-semibold uppercase tracking-widest">Statement of Profit or Loss — Click section to expand</p>

          {/* REVENUE */}
          <DrillDownSection title="REVENUE" total={data.income} lines={data.incomeLines} color="text-forest" bgColor="bg-forest/5" />
          <div className="pl-2 py-1 border-b border-leaf text-xs text-pine/50 flex justify-between"><span>Total Revenue</span><span className="money font-bold text-forest">{fmtBDT(data.income)}</span></div>

          {/* COGS */}
          <div className="pt-1">
            <DrillDownSection title="COST OF GOODS SOLD (COGS)" total={data.cogs} lines={data.cogsLines} color="text-amber-700" bgColor="bg-amber-50" />
            <div className="pl-2 py-1 border-b border-leaf text-xs text-pine/50 flex justify-between"><span>Total COGS</span><span className="money text-amber-700">{fmtBDT(data.cogs)}</span></div>
          </div>

          {/* GROSS PROFIT */}
          <div className="flex justify-between py-2 px-2 bg-forest/10 rounded-lg font-bold text-sm border border-forest/20">
            <span className="text-forest">GROSS PROFIT</span>
            <span className={`money ${data.grossProfit >= 0 ? 'text-forest' : 'text-red-600'}`}>{fmtBDT(data.grossProfit)}</span>
          </div>

          {/* OPEX */}
          <div className="pt-1">
            <DrillDownSection title="OPERATING EXPENSES" total={data.opex} lines={data.opexLines} color="text-blue-700" bgColor="bg-blue-50" />
            <div className="pl-2 py-1 border-b border-leaf text-xs text-pine/50 flex justify-between"><span>Total OpEx</span><span className="money text-blue-700">{fmtBDT(data.opex)}</span></div>
          </div>

          {/* EBIT */}
          <div className="flex justify-between py-1.5 px-2 bg-blue-50 rounded-lg font-bold text-sm">
            <span className="text-blue-700">OPERATING PROFIT (EBIT)</span>
            <span className={`money ${data.ebit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmtBDT(data.ebit)}</span>
          </div>

          {/* Finance Cost */}
          {data.interest > 0 && (
            <DrillDownSection title="FINANCE COST" total={data.interest} lines={data.financeLines} color="text-orange-600" />
          )}
          <div className="pl-2 py-1 text-xs text-pine/50 flex justify-between"><span>Profit Before Tax (EBT)</span><span className="money font-semibold">{fmtBDT(data.ebt)}</span></div>

          {/* Tax */}
          {data.tax > 0 && (
            <DrillDownSection title="INCOME TAX" total={data.tax} lines={data.taxLines} color="text-red-600" />
          )}

          {/* NET PROFIT */}
          <div className={`flex justify-between py-2.5 px-3 rounded-xl font-bold text-sm border-2 mt-2 ${data.netProfit >= 0 ? 'bg-forest/10 border-forest text-forest' : 'bg-red-50 border-red-300 text-red-600'}`}>
            <span>NET PROFIT / (LOSS)</span>
            <span className="money text-lg">{fmtBDT(data.netProfit)}</span>
          </div>
        </div>
      </>)}
    </div>
  )
}

function BalanceSheetTab({ co }) {
  const [asOf, setAsOf] = useState(todayISO()); const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const { accounts, balMap, hasJournals } = await fetchJournalBalances('2000-01-01', asOf)
      if (!hasJournals) { setErr('No journal entries found. Post transactions from Accounting module first.'); setLoading(false); return }
      const sections={ASSET:[],LIABILITY:[],EQUITY:[]}
      for (const a of accounts) { const b=balMap[a.id]||{debit:0,credit:0}; const net=a.normal_side==='DEBIT'?b.debit-b.credit:b.credit-b.debit; if (net===0||!sections[a.type]) continue; sections[a.type].push({code:a.code,name:a.name,val:+net.toFixed(2),subtype:a.subtype||''}) }
      setData({...sections,totAsset:sections.ASSET.reduce((a,r)=>a+r.val,0),totLiab:sections.LIABILITY.reduce((a,r)=>a+r.val,0),totEq:sections.EQUITY.reduce((a,r)=>a+r.val,0)})
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [asOf])
  useEffect(() => { run() }, [])

  const onExport = () => data && exportXLSX(`BalanceSheet_${asOf}.xlsx`,[{name:'Balance Sheet',rows:[['Balance Sheet (IAS 1)',`As at ${asOf}`],['ASSETS (Current)',''],...data.ASSET.filter(r=>r.subtype==='CURRENT').map(r=>['  '+r.name,r.val]),['ASSETS (Fixed/Non-current)',''],...data.ASSET.filter(r=>r.subtype!=='CURRENT').map(r=>['  '+r.name,r.val]),['Total Assets','',data.totAsset],['LIABILITIES (Current)',''],...data.LIABILITY.filter(r=>r.subtype==='CURRENT').map(r=>['  '+r.name,r.val]),['LIABILITIES (Long-term)',''],...data.LIABILITY.filter(r=>r.subtype!=='CURRENT').map(r=>['  '+r.name,r.val]),['Total Liabilities','',data.totLiab],['EQUITY',''],...data.EQUITY.map(r=>['  '+r.name,r.val]),['Total Equity','',data.totEq],['TOTAL L+E','',data.totLiab+data.totEq]]}])
  const onPrint = () => {
    if (!data) return
    const sec=(arr,title,tot)=>`<tr class="group-row"><td colspan="2">${title}</td></tr>${arr.map(r=>`<tr><td>&nbsp;&nbsp;${r.name}</td><td class="money">${fmtBDT(r.val)}</td></tr>`).join('')}<tr class="total-row"><td>Total ${title}</td><td class="money">${fmtBDT(tot)}</td></tr>`
    printToPDF('Balance Sheet',`${companyHeader(co,'Statement of Financial Position (IAS 1)',`As at ${asOf}`)}<table><thead><tr><th>Description</th><th class="money">৳</th></tr></thead><tbody>${sec(data.ASSET.filter(r=>r.subtype==='CURRENT'),'Current Assets',data.ASSET.filter(r=>r.subtype==='CURRENT').reduce((a,r)=>a+r.val,0))}${sec(data.ASSET.filter(r=>r.subtype!=='CURRENT'),'Non-current Assets',data.ASSET.filter(r=>r.subtype!=='CURRENT').reduce((a,r)=>a+r.val,0))}<tr class="total-row"><td><b>TOTAL ASSETS</b></td><td class="money"><b>${fmtBDT(data.totAsset)}</b></td></tr>${sec(data.LIABILITY.filter(r=>r.subtype==='CURRENT'),'Current Liabilities',data.LIABILITY.filter(r=>r.subtype==='CURRENT').reduce((a,r)=>a+r.val,0))}${sec(data.LIABILITY.filter(r=>r.subtype!=='CURRENT'),'Long-term Liabilities',data.LIABILITY.filter(r=>r.subtype!=='CURRENT').reduce((a,r)=>a+r.val,0))}<tr class="total-row"><td><b>TOTAL LIABILITIES</b></td><td class="money"><b>${fmtBDT(data.totLiab)}</b></td></tr>${sec(data.EQUITY,'EQUITY',data.totEq)}<tr class="total-row"><td><b>TOTAL LIABILITIES + EQUITY</b></td><td class="money"><b>${fmtBDT(data.totLiab+data.totEq)}</b></td></tr></tbody></table>`)
  }
  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">IAS 1 — Statement of Financial Position · <span className="text-forest font-semibold">Click section to drill down</span></p>
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="label">As at date</label><input type="date" className="input !w-40" value={asOf} onChange={e=>setAsOf(e.target.value)} /></div>
        <button className="btn-primary" onClick={run}>Run</button>
        {data && <><button className="btn-ghost" onClick={onExport}><FileDown size={15} /> Excel</button><button className="btn-ghost" onClick={onPrint}><Printer size={15} /> PDF</button></>}
      </div>
      {err && <Err msg={err} />}{loading && <Loading />}
      {data && (<>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Total assets" val={fmtBDT(data.totAsset)} />
          <Stat label="Total liabilities" val={fmtBDT(data.totLiab)} />
          <Stat label="Total equity" val={fmtBDT(data.totEq)} accent />
        </div>

        {/* DRILL-DOWN BALANCE SHEET */}
        <div className="card p-5 space-y-2">
          <p className="text-[11px] text-pine/40 mb-3 font-semibold uppercase tracking-widest">Balance Sheet — Click to expand</p>

          {/* Assets */}
          <div className="space-y-1">
            <p className="text-xs font-bold text-pine uppercase tracking-widest">Assets</p>
            {['CURRENT',''].map(sub => {
              const items = data.ASSET.filter(r => sub === 'CURRENT' ? r.subtype === 'CURRENT' : r.subtype !== 'CURRENT')
              if (items.length === 0) return null
              return <DrillDownSection key={sub||'noncurrent'} title={sub === 'CURRENT' ? 'Current Assets' : 'Non-current / Fixed Assets'} total={items.reduce((a,r)=>a+r.val,0)} lines={items.map(r=>({name:r.name,val:r.val}))} color="text-pine" />
            })}
            <div className="flex justify-between py-1.5 px-2 bg-pine/10 rounded-lg font-bold text-sm"><span>TOTAL ASSETS</span><span className="money">{fmtBDT(data.totAsset)}</span></div>
          </div>

          {/* Liabilities */}
          <div className="space-y-1 pt-2">
            <p className="text-xs font-bold text-red-700 uppercase tracking-widest">Liabilities</p>
            {['CURRENT',''].map(sub => {
              const items = data.LIABILITY.filter(r => sub === 'CURRENT' ? r.subtype === 'CURRENT' : r.subtype !== 'CURRENT')
              if (items.length === 0) return null
              return <DrillDownSection key={sub||'longterm'} title={sub === 'CURRENT' ? 'Current Liabilities' : 'Long-term Liabilities'} total={items.reduce((a,r)=>a+r.val,0)} lines={items.map(r=>({name:r.name,val:r.val}))} color="text-red-600" />
            })}
            <div className="flex justify-between py-1.5 px-2 bg-red-50 rounded-lg font-bold text-sm"><span className="text-red-600">TOTAL LIABILITIES</span><span className="money text-red-600">{fmtBDT(data.totLiab)}</span></div>
          </div>

          {/* Equity */}
          <div className="space-y-1 pt-2">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">Equity</p>
            <DrillDownSection title="Shareholders' Equity" total={data.totEq} lines={data.EQUITY.map(r=>({name:r.name,val:r.val}))} color="text-blue-700" />
            <div className="flex justify-between py-1.5 px-2 bg-blue-50 rounded-lg font-bold text-sm"><span className="text-blue-700">TOTAL EQUITY</span><span className="money text-blue-700">{fmtBDT(data.totEq)}</span></div>
          </div>

          {/* Check */}
          <div className={`flex justify-between py-2 px-3 rounded-xl border-2 font-bold mt-2 ${Math.abs(data.totAsset-(data.totLiab+data.totEq))<1?'border-forest bg-forest/10 text-forest':'border-red-400 bg-red-50 text-red-600'}`}>
            <span>TOTAL LIABILITIES + EQUITY</span>
            <span className="money">{fmtBDT(data.totLiab+data.totEq)}</span>
          </div>
          {Math.abs(data.totAsset-(data.totLiab+data.totEq))<1&&<div className="text-xs text-forest font-semibold text-center">✓ Balance sheet is balanced</div>}
        </div>
      </>)}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   REMAINING ACCOUNTING TABS (unchanged logic, minor refinements)
══════════════════════════════════════════════════════════════════════ */
function CashFlowTab({ co }) {
  const [from, setFrom] = useState(firstOfYear()); const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [{ data: pm }, { data: ch }] = await Promise.all([
        supabase.from('payments').select('amount,method,received_date').gte('received_date',from).lte('received_date',to),
        supabase.from('folio_charges').select('total,charge_type,charge_date').gte('charge_date',from).lte('charge_date',to),
      ])
      const receipts=(pm||[]).reduce((a,p)=>a+ +p.amount,0)
      const roomBilled=(ch||[]).filter(c=>c.charge_type==='ROOM').reduce((a,c)=>a+ +c.total,0)
      const fnbBilled=(ch||[]).filter(c=>c.charge_type==='RESTAURANT').reduce((a,c)=>a+ +c.total,0)
      setData({receipts,roomBilled,fnbBilled,netOps:receipts})
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])
  const onExport = () => data && exportXLSX(`CashFlow_${from}_${to}.xlsx`,[{name:'Cash Flow (IAS 7)',rows:[['A. OPERATING ACTIVITIES',''],['  Cash received from guests',data.receipts],['  Room revenue billed',data.roomBilled],['  F&B revenue billed',data.fnbBilled],['Net Cash from Operations','',data.netOps],['B. INVESTING ACTIVITIES',''],['  Capital expenditure','—'],['C. FINANCING ACTIVITIES',''],['  Loan repayments','—'],['NET CASH INCREASE / (DECREASE)','',data.netOps]]}])
  const onPrint = () => { if (!data) return; printToPDF('Cash Flow',`${companyHeader(co,'Statement of Cash Flows (IAS 7)',`${from} to ${to}`)}<table><thead><tr><th>Description</th><th class="money">৳</th></tr></thead><tbody><tr class="group-row"><td colspan="2">A. OPERATING ACTIVITIES</td></tr><tr><td>&nbsp;&nbsp;Cash received from guests</td><td class="money">${fmtBDT(data.receipts)}</td></tr><tr><td>&nbsp;&nbsp;Room revenue billed</td><td class="money">${fmtBDT(data.roomBilled)}</td></tr><tr><td>&nbsp;&nbsp;F&B revenue billed</td><td class="money">${fmtBDT(data.fnbBilled)}</td></tr><tr class="total-row"><td>Net Cash from Operations</td><td class="money">${fmtBDT(data.netOps)}</td></tr><tr class="group-row"><td colspan="2">B. INVESTING ACTIVITIES</td></tr><tr><td>&nbsp;&nbsp;Capital expenditure</td><td class="money">—</td></tr><tr class="group-row"><td colspan="2">C. FINANCING ACTIVITIES</td></tr><tr><td>&nbsp;&nbsp;Loan repayments</td><td class="money">—</td></tr><tr class="total-row"><td><b>NET CASH INCREASE / (DECREASE)</b></td><td class="money"><b>${fmtBDT(data.netOps)}</b></td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">IAS 7 — Indirect method. Click sections to drill down.</p>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {data && (<>
        <Stat label="Net cash from operating activities" val={fmtBDT(data.netOps)} accent />
        <div className="card p-5 space-y-1">
          <DrillDownSection title="A. Operating Activities" total={data.netOps} lines={[{name:'Cash received from guests',val:data.receipts},{name:'Room revenue billed',val:data.roomBilled},{name:'F&B revenue billed',val:data.fnbBilled}]} color="text-forest" />
          <DrillDownSection title="B. Investing Activities" total={0} lines={[{name:'Capital expenditure',val:0}]} color="text-blue-700" />
          <DrillDownSection title="C. Financing Activities" total={0} lines={[{name:'Loan repayments / proceeds',val:0}]} color="text-amber-700" />
          <div className={`flex justify-between py-2 px-3 rounded-xl border-2 font-bold mt-2 ${data.netOps>=0?'border-forest bg-forest/10 text-forest':'border-red-400 bg-red-50 text-red-600'}`}>
            <span>NET CASH INCREASE / (DECREASE)</span><span className="money">{fmtBDT(data.netOps)}</span>
          </div>
        </div>
      </>)}
    </div>
  )
}

function TrialBalanceTab({ co }) {
  const [from, setFrom] = useState(firstOfYear()); const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const { accounts, balMap, hasJournals } = await fetchJournalBalances(from, to)
      if (!hasJournals) { setErr('No journal entries found in this period.'); setLoading(false); return }
      setRows(accounts.map(a => { const b=balMap[a.id]||{debit:0,credit:0}; const netDr=b.debit-b.credit; return {code:a.code,name:a.name,type:a.type,debit:netDr>0?+netDr.toFixed(2):0,credit:netDr<0?+(-netDr).toFixed(2):0} }).filter(r=>r.debit||r.credit))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])
  const totDr=rows?rows.reduce((a,r)=>a+r.debit,0):0; const totCr=rows?rows.reduce((a,r)=>a+r.credit,0):0
  const onExport = () => rows && exportXLSX(`TrialBalance_${from}_${to}.xlsx`,[{name:'Trial Balance',rows:[['Code','Account','Type','Debit ৳','Credit ৳'],...rows.map(r=>[r.code,r.name,r.type,r.debit,r.credit]),['','TOTAL','',totDr,totCr]]}])
  const onPrint = () => { if (!rows) return; const trs=rows.map(r=>`<tr><td>${r.code}</td><td>${r.name}</td><td>${r.type}</td><td class="money">${r.debit?fmtBDT(r.debit):''}</td><td class="money">${r.credit?fmtBDT(r.credit):''}</td></tr>`).join(''); printToPDF('Trial Balance',`${companyHeader(co,'Trial Balance (IFRS)',`${from} to ${to}`)}<table><thead><tr><th>Code</th><th>Account</th><th>Type</th><th class="money">Debit ৳</th><th class="money">Credit ৳</th></tr></thead><tbody>${trs}<tr class="total-row"><td colspan="3">TOTAL</td><td class="money">${fmtBDT(totDr)}</td><td class="money">${fmtBDT(totCr)}</td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">IAS 1 — Based on posted journal entries.</p>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {rows && (<><div className="grid grid-cols-2 gap-4">
        <Stat label="Total debits" val={fmtBDT(totDr)} />
        <Stat label="Total credits" val={fmtBDT(totCr)} />
      </div>
        {Math.abs(totDr-totCr)<0.01&&<div className="text-xs text-forest font-semibold px-2">✓ Trial balance is balanced</div>}
        <Tbl heads={[{label:'Code',key:'code'},{label:'Account',key:'name'},{label:'Type',key:'type'},{label:'Debit ৳',key:'debit',right:true,fmt:v=>v?fmtBDT(v):''},{label:'Credit ৳',key:'credit',right:true,fmt:v=>v?fmtBDT(v):''}]} rows={rows} footRow={{debit:totDr,credit:totCr}} />
      </>)}
    </div>
  )
}

function LedgerTab({ co }) {
  const [from, setFrom] = useState(firstOfYear()); const [to, setTo] = useState(todayISO())
  const [accounts, setAccounts] = useState([]); const [selAcc, setSelAcc] = useState('')
  const [rows, setRows] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  useEffect(() => { supabase.from('chart_of_accounts').select('id,code,name').eq('is_active',true).order('code').then(({data})=>setAccounts(data||[])) }, [])
  const run = async () => {
    if (!selAcc) { setErr('Select an account.'); return }
    setLoading(true); setErr(null)
    try {
      const { data: lines } = await supabase.from('journal_lines').select('debit,credit,line_note,journal_entries(jv_no,jv_date,narration)').eq('account_id',selAcc).gte('journal_entries.jv_date',from).lte('journal_entries.jv_date',to).order('journal_entries.jv_date')
      let bal=0; setRows((lines||[]).filter(l=>l.journal_entries).map(l=>{bal+= +l.debit- +l.credit; return {jv_no:l.journal_entries.jv_no,date:l.journal_entries.jv_date,narration:l.journal_entries.narration||l.line_note||'—',debit:+l.debit,credit:+l.credit,balance:+bal.toFixed(2)}}))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  const accName=accounts.find(a=>a.id===selAcc)?.name||''
  const onExport = () => rows && exportXLSX(`Ledger_${accName}_${from}_${to}.xlsx`,[{name:'General Ledger',rows:[['Date','Ref/Voucher No.','Description','Account','Debit ৳','Credit ৳','Balance ৳'],...rows.map(r=>[r.date,r.jv_no,r.narration,accName,r.debit,r.credit,r.balance])]}])
  const onPrint = () => { if (!rows) return; const trs=rows.map(r=>`<tr><td>${r.jv_no}</td><td>${r.date}</td><td>${r.narration}</td><td class="money">${fmtBDT(r.debit)}</td><td class="money">${fmtBDT(r.credit)}</td><td class="money">${fmtBDT(r.balance)}</td></tr>`).join(''); printToPDF('General Ledger',`${companyHeader(co,`General Ledger — ${accName}`,`${from} to ${to}`)}<table><thead><tr><th>JV No</th><th>Date</th><th>Narration</th><th class="money">Debit ৳</th><th class="money">Credit ৳</th><th class="money">Balance ৳</th></tr></thead><tbody>${trs}</tbody></table>`) }
  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">IAS 1 — Detailed ledger for a single account. Columns: Date, Ref/Voucher No., Description, Account, Debit, Credit, Balance</p>
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="label">Account</label><select className="input !w-72" value={selAcc} onChange={e=>setSelAcc(e.target.value)}><option value="">Select account…</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></div>
        <div><label className="label">From</label><input type="date" className="input !w-40" value={from} onChange={e=>setFrom(e.target.value)} /></div>
        <div><label className="label">To</label><input type="date" className="input !w-40" value={to} onChange={e=>setTo(e.target.value)} /></div>
        <button className="btn-primary" onClick={run}>Run</button>
        {rows && <><button className="btn-ghost" onClick={onExport}><FileDown size={15} /> Excel</button><button className="btn-ghost" onClick={onPrint}><Printer size={15} /> PDF</button></>}
      </div>
      {err && <Err msg={err} />}{loading && <Loading />}
      {rows && <Tbl heads={[{label:'Date',key:'date'},{label:'Ref/Voucher No.',key:'jv_no'},{label:'Description',key:'narration'},{label:'Account',key:'acc',fmt:()=>accName},{label:'Debit ৳',key:'debit',right:true,fmt:fmtBDT},{label:'Credit ৳',key:'credit',right:true,fmt:fmtBDT},{label:'Balance ৳',key:'balance',right:true,fmt:fmtBDT}]} rows={rows} />}
    </div>
  )
}

function BankBookTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const { data } = await supabase.from('payments').select('received_date,method,amount,reference_no,reservations(reservation_name)').in('method',['BANK','BKASH','NAGAD','CARD']).gte('received_date',from).lte('received_date',to).order('received_date')
      let running=0; setRows((data||[]).map(p=>{running+= +p.amount; return {date:p.received_date,narration:p.reservations?.reservation_name||p.reference_no||'—',chq_no:p.reference_no||'—',method:p.method,deposit:+p.amount,withdrawal:0,balance:+running.toFixed(2)}}))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])
  const total=rows?rows.reduce((a,r)=>a+r.deposit,0):0
  const onExport = () => rows && exportXLSX(`BankBook_${from}_${to}.xlsx`,[{name:'Bank Book',rows:[['Date','Particulars','Chq No.','Deposit ৳','Withdrawal ৳','Bank Balance ৳'],...rows.map(r=>[r.date,r.narration,r.chq_no,r.deposit,r.withdrawal,r.balance]),['','','TOTAL',total,0,'']]}])
  const onPrint = () => { if (!rows) return; const trs=rows.map(r=>`<tr><td>${r.date}</td><td>${r.narration}</td><td>${r.chq_no}</td><td class="money">${fmtBDT(r.deposit)}</td><td class="money">—</td><td class="money">${fmtBDT(r.balance)}</td></tr>`).join(''); printToPDF('Bank Book',`${companyHeader(co,'Bank Book',`${from} to ${to}`)}<table><thead><tr><th>Date</th><th>Particulars</th><th>Chq No.</th><th class="money">Deposit ৳</th><th class="money">Withdrawal ৳</th><th class="money">Bank Balance ৳</th></tr></thead><tbody>${trs}<tr class="total-row"><td colspan="3">TOTAL</td><td class="money">${fmtBDT(total)}</td><td></td><td></td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">Bank, bKash, Nagad, and card transactions.</p>
      <ReceiptPaymentBar onRefresh={run} />
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {rows && (<><Stat label="Total bank receipts" val={fmtBDT(total)} accent />
        <Tbl heads={[{label:'Date',key:'date'},{label:'Particulars',key:'narration'},{label:'Chq No.',key:'chq_no'},{label:'Deposit ৳',key:'deposit',right:true,fmt:fmtBDT},{label:'Withdrawal ৳',key:'withdrawal',right:true,fmt:()=>'—'},{label:'Bank Balance ৳',key:'balance',right:true,fmt:fmtBDT}]} rows={rows} />
      </>)}
    </div>
  )
}

function CashBookTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const { data } = await supabase.from('payments').select('received_date,method,amount,reference_no,reservations(reservation_name)').eq('method','CASH').gte('received_date',from).lte('received_date',to).order('received_date')
      let running=0; setRows((data||[]).map(p=>{running+= +p.amount; return {date:p.received_date,narration:p.reservations?.reservation_name||p.reference_no||'Cash receipt',cash_in:+p.amount,cash_out:0,balance:+running.toFixed(2)}}))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])
  const total=rows?rows.reduce((a,r)=>a+r.cash_in,0):0
  const onExport = () => rows && exportXLSX(`CashBook_${from}_${to}.xlsx`,[{name:'Cash Book',rows:[['Date','Particulars','Cash In ৳','Cash Out ৳','Closing Cash Balance ৳'],...rows.map(r=>[r.date,r.narration,r.cash_in,r.cash_out,r.balance]),['','TOTAL',total,0,'']]}])
  const onPrint = () => { if (!rows) return; const trs=rows.map(r=>`<tr><td>${r.date}</td><td>${r.narration}</td><td class="money">${fmtBDT(r.cash_in)}</td><td class="money">—</td><td class="money">${fmtBDT(r.balance)}</td></tr>`).join(''); printToPDF('Cash Book',`${companyHeader(co,'Cash Book',`${from} to ${to}`)}<table><thead><tr><th>Date</th><th>Particulars</th><th class="money">Cash In ৳</th><th class="money">Cash Out ৳</th><th class="money">Closing Balance ৳</th></tr></thead><tbody>${trs}<tr class="total-row"><td colspan="2">TOTAL</td><td class="money">${fmtBDT(total)}</td><td></td><td></td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">Cash receipts only.</p>
      <ReceiptPaymentBar onRefresh={run} />
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {rows && (<><Stat label="Total cash received" val={fmtBDT(total)} accent />
        <Tbl heads={[{label:'Date',key:'date'},{label:'Particulars',key:'narration'},{label:'Cash In ৳',key:'cash_in',right:true,fmt:fmtBDT},{label:'Cash Out ৳',key:'cash_out',right:true,fmt:()=>'—'},{label:'Closing Balance ৳',key:'balance',right:true,fmt:fmtBDT}]} rows={rows} />
      </>)}
    </div>
  )
}

function BankReconTab({ co }) {
  const [asOf, setAsOf] = useState(todayISO()); const [bankBal, setBankBal] = useState('')
  const [rows, setRows] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data } = await supabase.from('payments').select('received_date,amount,method').in('method',['BANK','BKASH','NAGAD','CARD']).lte('received_date',asOf)
      const bookBal=(data||[]).reduce((a,p)=>a+ +p.amount,0); const diff=(+bankBal||0)-bookBal
      setRows({bookBal:+bookBal.toFixed(2),bankBal:+(+bankBal||0),diff:+diff.toFixed(2),txns:data?.length||0})
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  const onPrint = () => { if (!rows) return; printToPDF('Bank Reconciliation',`${companyHeader(co,'Bank Reconciliation Statement',`As at ${asOf}`)}<table><thead><tr><th>Description</th><th class="money">৳</th></tr></thead><tbody><tr><td>Book Balance (system)</td><td class="money">${fmtBDT(rows.bookBal)}</td></tr><tr><td>Bank Statement Balance</td><td class="money">${fmtBDT(rows.bankBal)}</td></tr><tr class="total-row"><td>Difference (Uncleared items)</td><td class="money">${fmtBDT(rows.diff)}</td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">Compare system book balance with bank statement. Per template: Book Balance, Bank Statement Balance, Uncleared Chqs, Deposits in Transit.</p>
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="label">As at date</label><input type="date" className="input !w-40" value={asOf} onChange={e=>setAsOf(e.target.value)} /></div>
        <div><label className="label">Bank statement balance (৳)</label><input type="number" className="input money !w-44" value={bankBal} onChange={e=>setBankBal(e.target.value)} placeholder="Enter bank balance" /></div>
        <button className="btn-primary" onClick={run}>Run</button>
        {rows && <button className="btn-ghost" onClick={onPrint}><Printer size={15} /> PDF</button>}
      </div>
      {err && <Err msg={err} />}{loading && <Loading />}
      {rows && (
        <div className="card p-5 space-y-3">
          <div className="flex justify-between text-sm py-2 border-b border-leaf"><span>Book Balance (system)</span><span className="money font-semibold">{fmtBDT(rows.bookBal)}</span></div>
          <div className="flex justify-between text-sm py-2 border-b border-leaf"><span>Bank Statement Balance</span><span className="money font-semibold">{fmtBDT(rows.bankBal)}</span></div>
          <div className="flex justify-between text-sm py-2 border-b border-leaf text-pine/60"><span>Uncleared Cheques</span><span className="money">—</span></div>
          <div className="flex justify-between text-sm py-2 border-b border-leaf text-pine/60"><span>Deposits in Transit</span><span className="money">—</span></div>
          <div className={`flex justify-between text-sm py-2 font-bold ${Math.abs(rows.diff)<0.01?'text-forest':'text-red-600'}`}><span>Difference (Unreconciled)</span><span className="money">{fmtBDT(rows.diff)}</span></div>
          {Math.abs(rows.diff)<0.01&&<div className="text-forest text-sm font-semibold">✓ Fully reconciled</div>}
        </div>
      )}
    </div>
  )
}

function RetainedEarningsTab({ co }) {
  const [year, setYear] = useState(todayISO().slice(0,4)); const [openingRE, setOpeningRE] = useState(''); const [dividends, setDividends] = useState('')
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { accounts, balMap } = await fetchJournalBalances(`${year}-01-01`,`${year}-12-31`)
      let netProfit=0
      for (const a of accounts) { if (a.type!=='INCOME'&&a.type!=='EXPENSE') continue; const b=balMap[a.id]||{debit:0,credit:0}; const net=a.normal_side==='CREDIT'?b.credit-b.debit:b.debit-b.credit; if (a.type==='INCOME') netProfit+=net; else netProfit-=net }
      const opening=+(+openingRE||0); const div=+(+dividends||0); const closing=opening+netProfit-div
      setData({opening,netProfit:+netProfit.toFixed(2),div,closing:+closing.toFixed(2)})
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  const onPrint = () => { if (!data) return; printToPDF('Retained Earnings',`${companyHeader(co,'Statement of Retained Earnings (IAS 1)',`Year ${year}`)}<table><thead><tr><th>Description</th><th class="money">৳</th></tr></thead><tbody><tr><td>Opening Retained Earnings (1 Jan ${year})</td><td class="money">${fmtBDT(data.opening)}</td></tr><tr><td>Add: Net Income for the year</td><td class="money">${fmtBDT(data.netProfit)}</td></tr><tr><td>Less: Dividends Paid</td><td class="money">(${fmtBDT(data.div)})</td></tr><tr class="total-row"><td><b>Ending Balance (31 Dec ${year})</b></td><td class="money"><b>${fmtBDT(data.closing)}</b></td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">IAS 1 — Opening Retained Earnings, Net Income, Dividends Paid, Ending Balance.</p>
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="label">Financial year</label><input type="number" className="input !w-28" value={year} onChange={e=>setYear(e.target.value)} min="2020" max="2099" /></div>
        <div><label className="label">Opening RE (৳)</label><input type="number" className="input money !w-40" value={openingRE} onChange={e=>setOpeningRE(e.target.value)} placeholder="0" /></div>
        <div><label className="label">Dividends Paid (৳)</label><input type="number" className="input money !w-40" value={dividends} onChange={e=>setDividends(e.target.value)} placeholder="0" /></div>
        <button className="btn-primary" onClick={run}>Run</button>
        {data&&<button className="btn-ghost" onClick={onPrint}><Printer size={15}/> PDF</button>}
      </div>
      {err&&<Err msg={err}/>}{loading&&<Loading/>}
      {data&&(<div className="card p-5 font-mono text-sm space-y-2">
        {[
          {label:`Opening Retained Earnings (1 Jan ${year})`,val:data.opening},
          {label:'Add: Net Income',val:data.netProfit},
          {label:'Less: Dividends Paid',val:-data.div},
          {label:`Ending Balance (31 Dec ${year})`,val:data.closing,bold:true,sep:true},
        ].map((row,i)=>(
          <div key={i} className={`flex justify-between py-1 ${row.sep?'border-t border-leaf font-bold':''}`}>
            <span>{row.label}</span><span className={row.val<0?'text-red-600':''}>{fmtBDT(row.val)}</span>
          </div>
        ))}
      </div>)}
    </div>
  )
}

function NAVTab({ co }) {
  const [asOf, setAsOf] = useState(todayISO()); const [shares, setShares] = useState('')
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { accounts, balMap } = await fetchJournalBalances('2000-01-01', asOf)
      let totAsset=0,totLiab=0
      for (const a of accounts) { const b=balMap[a.id]||{debit:0,credit:0}; const net=a.normal_side==='DEBIT'?b.debit-b.credit:b.credit-b.debit; if (a.type==='ASSET') totAsset+=net; if (a.type==='LIABILITY') totLiab+=net }
      const nav=totAsset-totLiab; const shareCount=+(+shares||1)
      setData({totAsset:+totAsset.toFixed(2),totLiab:+totLiab.toFixed(2),nav:+nav.toFixed(2),navPerShare:+(nav/shareCount).toFixed(2),shareCount})
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  const onPrint = () => { if (!data) return; printToPDF('NAV Report',`${companyHeader(co,'Net Asset Value (NAV) Report',`As at ${asOf}`)}<table><thead><tr><th>Description</th><th class="money">৳</th></tr></thead><tbody><tr><td>Total Assets</td><td class="money">${fmtBDT(data.totAsset)}</td></tr><tr><td>Less: Total Liabilities</td><td class="money">(${fmtBDT(data.totLiab)})</td></tr><tr class="total-row"><td><b>Net Assets (NAV)</b></td><td class="money"><b>${fmtBDT(data.nav)}</b></td></tr><tr><td>Shares Outstanding</td><td class="money">${data.shareCount.toLocaleString()}</td></tr><tr class="total-row"><td><b>NAV per Share</b></td><td class="money"><b>${fmtBDT(data.navPerShare)}</b></td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">NAV = Total Assets − Total Liabilities · Template: Total Assets, Total Liabilities, Net Assets, Shares Outstanding, NAV per Share.</p>
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="label">As at date</label><input type="date" className="input !w-40" value={asOf} onChange={e=>setAsOf(e.target.value)} /></div>
        <div><label className="label">Shares outstanding</label><input type="number" className="input money !w-40" value={shares} onChange={e=>setShares(e.target.value)} placeholder="e.g. 1000" /></div>
        <button className="btn-primary" onClick={run}>Run</button>
        {data&&<button className="btn-ghost" onClick={onPrint}><Printer size={15}/> PDF</button>}
      </div>
      {err&&<Err msg={err}/>}{loading&&<Loading/>}
      {data&&(<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total assets" val={fmtBDT(data.totAsset)} />
        <Stat label="Total liabilities" val={fmtBDT(data.totLiab)} />
        <Stat label="Net Assets (NAV)" val={fmtBDT(data.nav)} accent />
        <Stat label="NAV per Share" val={fmtBDT(data.navPerShare)} />
      </div>)}
    </div>
  )
}

function APAgingTab({ co }) {
  const [asOf, setAsOf] = useState(todayISO()); const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data: vendors } = await supabase.from('vendors').select('id,name')
      const { data: pos } = await supabase.from('purchase_orders').select('vendor_id,po_date,po_items(qty,unit_cost)').lte('po_date',asOf).in('status',['OPEN','PARTIAL','RECEIVED'])
      const map={}; for (const v of vendors||[]) map[v.id]={name:v.name,current:0,d30:0,d60:0,d90:0}
      const today=new Date(asOf)
      for (const p of pos||[]) { if (!map[p.vendor_id]) continue; const days=Math.floor((today-new Date(p.po_date))/86400000); const amt=(p.po_items||[]).reduce((a,i)=>a+ +i.qty* +i.unit_cost,0); if (days<=30) map[p.vendor_id].current+=amt; else if (days<=60) map[p.vendor_id].d30+=amt; else if (days<=90) map[p.vendor_id].d60+=amt; else map[p.vendor_id].d90+=amt }
      setRows(Object.values(map).filter(v=>v.current+v.d30+v.d60+v.d90>0).map(v=>({vendor:v.name,current:+v.current.toFixed(2),d30:+v.d30.toFixed(2),d60:+v.d60.toFixed(2),d90:+v.d90.toFixed(2),total:+(v.current+v.d30+v.d60+v.d90).toFixed(2)})))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])
  const tot=rows?{current:rows.reduce((a,r)=>a+r.current,0),d30:rows.reduce((a,r)=>a+r.d30,0),d60:rows.reduce((a,r)=>a+r.d60,0),d90:rows.reduce((a,r)=>a+r.d90,0),total:rows.reduce((a,r)=>a+r.total,0)}:null
  const onExport = () => rows && exportXLSX(`APAging_${asOf}.xlsx`,[{name:'AP Aging',rows:[['Vendor Name','Total Due ৳','Current (0-30)','30 Days','60 Days','90+ Days','Total ৳'],...rows.map(r=>[r.vendor,r.total,r.current,r.d30,r.d60,r.d90,r.total]),['TOTAL',tot?.total,tot?.current,tot?.d30,tot?.d60,tot?.d90,tot?.total]]}])
  const onPrint = () => { if (!rows) return; const trs=rows.map(r=>`<tr><td>${r.vendor}</td><td class="money">${fmtBDT(r.total)}</td><td class="money">${fmtBDT(r.current)}</td><td class="money">${fmtBDT(r.d30)}</td><td class="money">${fmtBDT(r.d60)}</td><td class="money">${fmtBDT(r.d90)}</td></tr>`).join(''); printToPDF('AP Aging',`${companyHeader(co,'Accounts Payable Aging Report',`As at ${asOf}`)}<table><thead><tr><th>Vendor Name</th><th class="money">Total Due ৳</th><th class="money">Current</th><th class="money">30 Days</th><th class="money">60 Days</th><th class="money">90+ Days</th></tr></thead><tbody>${trs}<tr class="total-row"><td>TOTAL</td><td class="money">${fmtBDT(tot?.total)}</td><td class="money">${fmtBDT(tot?.current)}</td><td class="money">${fmtBDT(tot?.d30)}</td><td class="money">${fmtBDT(tot?.d60)}</td><td class="money">${fmtBDT(tot?.d90)}</td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <div className="flex items-end gap-2 flex-wrap"><div><label className="label">As at date</label><input type="date" className="input !w-40" value={asOf} onChange={e=>setAsOf(e.target.value)} /></div><button className="btn-primary" onClick={run}>Run</button>{rows&&<><button className="btn-ghost" onClick={onExport}><FileDown size={15}/> Excel</button><button className="btn-ghost" onClick={onPrint}><Printer size={15}/> PDF</button></>}</div>
      {err&&<Err msg={err}/>}{loading&&<Loading/>}
      {rows&&<Tbl heads={[{label:'Vendor Name',key:'vendor'},{label:'Total Due ৳',key:'total',right:true,fmt:fmtBDT},{label:'Current (0-30)',key:'current',right:true,fmt:fmtBDT},{label:'30 Days',key:'d30',right:true,fmt:fmtBDT},{label:'60 Days',key:'d60',right:true,fmt:fmtBDT},{label:'90+ Days',key:'d90',right:true,fmt:fmtBDT}]} rows={rows} footRow={tot}/>}
    </div>
  )
}

function ARAgingTab({ co }) {
  const [asOf, setAsOf] = useState(todayISO()); const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const { data: res } = await supabase.from('reservations').select('reservation_name,check_out,folio_charges(total),payments(amount)').eq('status','CHECKED_OUT').lte('check_out',asOf)
      const today=new Date(asOf)
      const mapped=(res||[]).map(r=>{const b=(r.folio_charges||[]).reduce((a,c)=>a+ +c.total,0);const p=(r.payments||[]).reduce((a,p)=>a+ +p.amount,0);const bal=b-p;if(bal<0.01)return null;const days=Math.floor((today-new Date(r.check_out))/86400000);return{customer:r.reservation_name,invoice_date:r.check_out,total:+b.toFixed(2),due:+bal.toFixed(2),days}}).filter(Boolean)
      setRows(mapped.map(r=>({...r,current:r.days<=30?r.due:0,d30:r.days>30&&r.days<=60?r.due:0,d60:r.days>60&&r.days<=90?r.due:0,d90:r.days>90?r.due:0})))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { run() }, [])
  const tot=rows?{total:rows.reduce((a,r)=>a+r.total,0),due:rows.reduce((a,r)=>a+r.due,0),current:rows.reduce((a,r)=>a+r.current,0),d30:rows.reduce((a,r)=>a+r.d30,0),d60:rows.reduce((a,r)=>a+r.d60,0),d90:rows.reduce((a,r)=>a+r.d90,0)}:null
  const onExport = () => rows && exportXLSX(`ARAging_${asOf}.xlsx`,[{name:'AR Aging',rows:[['Customer Name','Invoice Date','Total ৳','Total Due ৳','Current','30 Days','60 Days','90+ Days'],...rows.map(r=>[r.customer,r.invoice_date,r.total,r.due,r.current,r.d30,r.d60,r.d90]),['TOTAL','',tot?.total,tot?.due,tot?.current,tot?.d30,tot?.d60,tot?.d90]]}])
  const onPrint = () => { if (!rows) return; const trs=rows.map(r=>`<tr><td>${r.customer}</td><td>${r.invoice_date}</td><td class="money">${fmtBDT(r.total)}</td><td class="money">${fmtBDT(r.due)}</td><td class="money">${fmtBDT(r.current)}</td><td class="money">${fmtBDT(r.d30)}</td><td class="money">${fmtBDT(r.d60)}</td><td class="money">${fmtBDT(r.d90)}</td></tr>`).join(''); printToPDF('AR Aging',`${companyHeader(co,'Accounts Receivable Aging Report',`As at ${asOf}`)}<table><thead><tr><th>Customer</th><th>Invoice Date</th><th class="money">Total ৳</th><th class="money">Due ৳</th><th class="money">Current</th><th class="money">30 Days</th><th class="money">60 Days</th><th class="money">90+</th></tr></thead><tbody>${trs}<tr class="total-row"><td colspan="3">TOTAL</td><td class="money">${fmtBDT(tot?.due)}</td><td class="money">${fmtBDT(tot?.current)}</td><td class="money">${fmtBDT(tot?.d30)}</td><td class="money">${fmtBDT(tot?.d60)}</td><td class="money">${fmtBDT(tot?.d90)}</td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <div className="flex items-end gap-2 flex-wrap"><div><label className="label">As at date</label><input type="date" className="input !w-40" value={asOf} onChange={e=>setAsOf(e.target.value)} /></div><button className="btn-primary" onClick={run}>Run</button>{rows&&<><button className="btn-ghost" onClick={onExport}><FileDown size={15}/> Excel</button><button className="btn-ghost" onClick={onPrint}><Printer size={15}/> PDF</button></>}</div>
      {err&&<Err msg={err}/>}{loading&&<Loading/>}
      {rows&&(<><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><Stat label="0–30 days" val={fmtBDT(tot.current)} /><Stat label="31–60 days" val={fmtBDT(tot.d30)} /><Stat label="61–90 days" val={fmtBDT(tot.d60)} /><Stat label="90+ days" val={fmtBDT(tot.d90)} accent /></div>
        <Tbl heads={[{label:'Customer Name',key:'customer'},{label:'Invoice Date',key:'invoice_date'},{label:'Total ৳',key:'total',right:true,fmt:fmtBDT},{label:'Total Due ৳',key:'due',right:true,fmt:fmtBDT,red:true},{label:'Current',key:'current',right:true,fmt:fmtBDT},{label:'30 Days',key:'d30',right:true,fmt:fmtBDT},{label:'60 Days',key:'d60',right:true,fmt:fmtBDT},{label:'90+ Days',key:'d90',right:true,fmt:fmtBDT}]} rows={rows} footRow={tot} /></>)}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   STATUTORY REPORTS
══════════════════════════════════════════════════════════════════════ */
function VATSalesTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const { data } = await supabase.from('folio_charges').select('charge_date,charge_type,base_amount,vat_amount,discount,total,reservations(res_no,reservation_name)').gte('charge_date',from).lte('charge_date',to).order('charge_date')
      setRows((data||[]).map(c=>({date:c.charge_date,res:c.reservations?.res_no||'—',customer:c.reservations?.reservation_name||'—',type:c.charge_type,base:+c.base_amount,discount:+c.discount,taxable:+(+c.base_amount- +c.discount).toFixed(2),vat:+c.vat_amount,total:+c.total})))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])
  const totals=rows?{base:rows.reduce((a,r)=>a+r.base,0),taxable:rows.reduce((a,r)=>a+r.taxable,0),vat:rows.reduce((a,r)=>a+r.vat,0),total:rows.reduce((a,r)=>a+r.total,0)}:null
  const onExport = () => rows && exportXLSX(`VAT_Sales_Mushak61_${from}_${to}.xlsx`,[{name:'Mushak 6.1 — Sales Register',rows:[['Mushak Form 6.1 — Sales Register'],['Period',`${from} to ${to}`],[''],['Date','Res No','Customer','Item Type','Base Value ৳','Discount ৳','Taxable ৳','VAT (15%) ৳','Total ৳'],...rows.map(r=>[r.date,r.res,r.customer,r.type,r.base,r.discount,r.taxable,r.vat,r.total]),['','','','TOTAL',totals?.base,'',totals?.taxable,totals?.vat,totals?.total]]}])
  const onPrint = () => { if (!rows) return; const trs=rows.map(r=>`<tr><td>${r.date}</td><td>${r.res}</td><td>${r.customer}</td><td>${r.type}</td><td class="money">${fmtBDT(r.base)}</td><td class="money">${fmtBDT(r.taxable)}</td><td class="money">${fmtBDT(r.vat)}</td><td class="money">${fmtBDT(r.total)}</td></tr>`).join(''); printToPDF('Mushak 6.1',`${companyHeader(co,'Mushak Form 6.1 — VAT Sales Register',`${from} to ${to}`)}<div style="font-size:10px;color:#666;margin-bottom:8px">NBR Bangladesh — VAT & SD Act 2012 / Rules 2016</div><table><thead><tr><th>Date</th><th>Res No</th><th>Customer</th><th>Type</th><th class="money">Base ৳</th><th class="money">Taxable ৳</th><th class="money">VAT ৳</th><th class="money">Total ৳</th></tr></thead><tbody>${trs}<tr class="total-row"><td colspan="4">TOTAL</td><td class="money">${fmtBDT(totals?.base)}</td><td class="money">${fmtBDT(totals?.taxable)}</td><td class="money">${fmtBDT(totals?.vat)}</td><td class="money">${fmtBDT(totals?.total)}</td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">NBR Mushak Form 6.1 — VAT & SD Act 2012.</p>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err&&<Err msg={err}/>}{loading&&<Loading/>}
      {rows&&(<><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><Stat label="Base value" val={fmtBDT(totals.base)} /><Stat label="Taxable value" val={fmtBDT(totals.taxable)} /><Stat label="Output VAT (15%)" val={fmtBDT(totals.vat)} accent /><Stat label="Total incl. VAT" val={fmtBDT(totals.total)} /></div>
        <Tbl heads={[{label:'Date',key:'date'},{label:'Res No',key:'res'},{label:'Customer',key:'customer'},{label:'Type',key:'type'},{label:'Base ৳',key:'base',right:true,fmt:fmtBDT},{label:'Taxable ৳',key:'taxable',right:true,fmt:fmtBDT},{label:'VAT ৳',key:'vat',right:true,fmt:fmtBDT},{label:'Total ৳',key:'total',right:true,fmt:fmtBDT}]} rows={rows} footRow={totals} /></>)}
    </div>
  )
}

function VATPurchaseTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const { data } = await supabase.from('goods_receipts').select('grn_date,grn_no,vendor_invoice_no,rebateable,vendors(name),grn_items(qty,unit_cost,vat_amount)').gte('grn_date',from).lte('grn_date',to).order('grn_date')
      setRows((data||[]).map(g=>{const base=(g.grn_items||[]).reduce((a,i)=>a+ +i.qty* +i.unit_cost,0);const vat=(g.grn_items||[]).reduce((a,i)=>a+ +i.vat_amount,0);return{date:g.grn_date,grn:g.grn_no,invoice:g.vendor_invoice_no||'—',vendor:g.vendors?.name||'—',base:+base.toFixed(2),vat:+vat.toFixed(2),total:+(base+vat).toFixed(2),rebateable:g.rebateable?'Yes':'No'}}))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])
  const totals=rows?{base:rows.reduce((a,r)=>a+r.base,0),vat:rows.reduce((a,r)=>a+r.vat,0),total:rows.reduce((a,r)=>a+r.total,0)}:null
  const onExport = () => rows && exportXLSX(`VAT_Purchase_${from}_${to}.xlsx`,[{name:'Mushak 6.1 — Purchase Register',rows:[['Mushak Form 6.1 — Purchase Register'],['Period',`${from} to ${to}`],[''],['Date','GRN No','Vendor Invoice','Vendor','Base ৳','Input VAT ৳','Total ৳','Rebateable'],...rows.map(r=>[r.date,r.grn,r.invoice,r.vendor,r.base,r.vat,r.total,r.rebateable]),['','','','TOTAL',totals?.base,totals?.vat,totals?.total,'']]}])
  const onPrint = () => { if (!rows) return; const trs=rows.map(r=>`<tr><td>${r.date}</td><td>${r.grn}</td><td>${r.vendor}</td><td class="money">${fmtBDT(r.base)}</td><td class="money">${fmtBDT(r.vat)}</td><td class="money">${fmtBDT(r.total)}</td><td>${r.rebateable}</td></tr>`).join(''); printToPDF('VAT Purchase',`${companyHeader(co,'Mushak Form 6.1 — VAT Purchase Register',`${from} to ${to}`)}<table><thead><tr><th>Date</th><th>GRN No</th><th>Vendor</th><th class="money">Base ৳</th><th class="money">Input VAT ৳</th><th class="money">Total ৳</th><th>Rebate?</th></tr></thead><tbody>${trs}<tr class="total-row"><td colspan="3">TOTAL</td><td class="money">${fmtBDT(totals?.base)}</td><td class="money">${fmtBDT(totals?.vat)}</td><td class="money">${fmtBDT(totals?.total)}</td><td></td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">NBR Mushak Form 6.1 — Purchase Register. Input VAT rebate tracking.</p>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err&&<Err msg={err}/>}{loading&&<Loading/>}
      {rows&&(<><div className="grid grid-cols-3 gap-4"><Stat label="Total purchase value" val={fmtBDT(totals.base)} /><Stat label="Input VAT" val={fmtBDT(totals.vat)} accent /><Stat label="Total incl. VAT" val={fmtBDT(totals.total)} /></div>
        <Tbl heads={[{label:'Date',key:'date'},{label:'GRN No',key:'grn'},{label:'Vendor',key:'vendor'},{label:'Base ৳',key:'base',right:true,fmt:fmtBDT},{label:'Input VAT ৳',key:'vat',right:true,fmt:fmtBDT},{label:'Total ৳',key:'total',right:true,fmt:fmtBDT},{label:'Rebate',key:'rebateable'}]} rows={rows} footRow={totals} /></>)}
    </div>
  )
}

function AITTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)
  const AIT_RATE = 0.07
  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const { data } = await supabase.from('purchase_orders').select('po_date,po_no,vendors(name),po_items(qty,unit_cost)').gte('po_date',from).lte('po_date',to).in('status',['OPEN','RECEIVED','PARTIAL']).order('po_date')
      setRows((data||[]).map(p=>{const base=(p.po_items||[]).reduce((a,i)=>a+ +i.qty* +i.unit_cost,0);const ait=base*AIT_RATE;return{date:p.po_date,po_no:p.po_no,vendor:p.vendors?.name||'—',base:+base.toFixed(2),ait:+ait.toFixed(2),net:+(base-ait).toFixed(2)}}))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])
  const totals=rows?{base:rows.reduce((a,r)=>a+r.base,0),ait:rows.reduce((a,r)=>a+r.ait,0),net:rows.reduce((a,r)=>a+r.net,0)}:null
  const onExport = () => rows && exportXLSX(`AIT_Register_${from}_${to}.xlsx`,[{name:'AIT Deduction Register',rows:[['AIT (TDS) Deduction Register — Section 52 ITO 1984'],['Period',`${from} to ${to}`],['Rate','7%'],[''],['Date','PO No','Vendor/Contractor','Gross Amount ৳','AIT @ 7% ৳','Net Payable ৳'],...rows.map(r=>[r.date,r.po_no,r.vendor,r.base,r.ait,r.net]),['','','TOTAL',totals?.base,totals?.ait,totals?.net]]}])
  const onPrint = () => { if (!rows) return; const trs=rows.map(r=>`<tr><td>${r.date}</td><td>${r.po_no}</td><td>${r.vendor}</td><td class="money">${fmtBDT(r.base)}</td><td class="money">${fmtBDT(r.ait)}</td><td class="money">${fmtBDT(r.net)}</td></tr>`).join(''); printToPDF('AIT Register',`${companyHeader(co,'AIT (TDS) Deduction Register — Section 52 ITO 1984',`${from} to ${to}`)}<div style="font-size:10px;color:#666;margin-bottom:8px">Rate: 7% | Deducted at source from contractor/vendor payments</div><table><thead><tr><th>Date</th><th>PO No</th><th>Vendor</th><th class="money">Gross ৳</th><th class="money">AIT @ 7% ৳</th><th class="money">Net ৳</th></tr></thead><tbody>${trs}<tr class="total-row"><td colspan="3">TOTAL</td><td class="money">${fmtBDT(totals?.base)}</td><td class="money">${fmtBDT(totals?.ait)}</td><td class="money">${fmtBDT(totals?.net)}</td></tr></tbody></table>`) }
  return (
    <div className="space-y-5">
      <p className="text-xs text-pine/50">Section 52 ITO 1984 — AIT deducted at source. Rate: 7%.</p>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={rows} onExport={onExport} onPrint={onPrint} />
      {err&&<Err msg={err}/>}{loading&&<Loading/>}
      {rows&&(<><div className="grid grid-cols-3 gap-4"><Stat label="Gross payments" val={fmtBDT(totals.base)} /><Stat label="AIT deducted (7%)" val={fmtBDT(totals.ait)} accent /><Stat label="Net payable" val={fmtBDT(totals.net)} /></div>
        <Tbl heads={[{label:'Date',key:'date'},{label:'PO No',key:'po_no'},{label:'Vendor',key:'vendor'},{label:'Gross ৳',key:'base',right:true,fmt:fmtBDT},{label:'AIT @ 7% ৳',key:'ait',right:true,fmt:fmtBDT},{label:'Net ৳',key:'net',right:true,fmt:fmtBDT}]} rows={rows} footRow={totals} /></>)}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   ROOT COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function ReportsHub({ userName, role }) {
  const location = useLocation()
  const co = useCompany()

  const [activeTab, setActiveTab] = useState(() => {
    const t = new URLSearchParams(location.search).get('tab')
    return TABS.find(x => x.id === t) ? t : 'kpi_dashboard'
  })
  const [activeGroup, setActiveGroup] = useState(() => {
    const t = new URLSearchParams(location.search).get('tab')
    const found = TABS.find(x => x.id === t)
    return found ? found.group : 'Overview'
  })

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab')
    if (t && TABS.find(x => x.id === t)) { setActiveTab(t); setActiveGroup(TABS.find(x => x.id === t).group) }
  }, [location.search])

  const handleTabClick = (tabId) => {
    const tab = TABS.find(x => x.id === tabId); if (!tab) return
    setActiveTab(tabId); setActiveGroup(tab.group)
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

      {/* Page header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2">
          <BarChart3 className="text-forest" /> Reports
        </h1>
        <p className="text-sm text-pine/60">
          IFRS / IAS standard reporting centre — {co || 'loading…'}
        </p>
      </div>

      {/* Group tabs Level 1 */}
      <div className="flex gap-1 border-b border-leaf flex-wrap">
        {GROUPS.map(group => {
          const isActive = activeGroup === group
          const st = GROUP_STYLES[group]
          return (
            <button key={group} onClick={() => { setActiveGroup(group); const first = TABS.find(t => t.group === group); if (first) setActiveTab(first.id) }}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${isActive ? `bg-white border border-leaf border-b-white -mb-px ${st.active}` : `${st.inactive} hover:text-pine`}`}>
              {group}
            </button>
          )
        })}
      </div>

      {/* Sub-tabs Level 2 */}
      <div className="flex gap-1 flex-wrap">
        {TABS.filter(t => t.group === activeGroup).map(t => {
          const Icon = t.icon; const isActive = activeTab === t.id
          return (
            <button key={t.id} onClick={() => handleTabClick(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isActive ? 'bg-forest text-white' : 'text-pine/60 hover:bg-leaf/40 hover:text-pine'}`}>
              <Icon size={12} />{t.label}
            </button>
          )
        })}
      </div>

      {/* Active tab header */}
      {activeTabDef && (
        <div className="flex items-center gap-2">
          <activeTabDef.icon size={18} className="text-forest" />
          <h2 className="font-display text-lg font-semibold text-pine">{activeTabDef.label}</h2>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${GROUP_BADGE[activeTabDef.group]}`}>{activeTabDef.group}</span>
        </div>
      )}

      {/* Content */}
      {renderTab()}
    </div>
  )
}
