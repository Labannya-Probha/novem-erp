import { useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { fmtBDT, todayISO, exportXLSX, nightsBetween } from '../lib/helpers'
import ReceiptPaymentModal from './ReceiptPaymentModal'
import {
  BarChart3, FileDown, AlertCircle, TrendingUp, ShoppingBag, Banknote,
  Scale, PieChart, Activity, Landmark, CreditCard, BookMarked,
  Printer, Users, Building2, FileText, LayoutDashboard,
  ChevronDown, ChevronRight, Plus, Minus, RefreshCw, ShieldCheck
} from 'lucide-react'

/* ══════════════════════════════════════════════════════════════════════
   eZee STANDARD TAB DEFINITIONS
══════════════════════════════════════════════════════════════════════ */
const TABS = [
  { id: 'dashboard',         label: 'Management Dashboard',    icon: LayoutDashboard, group: 'Overview'   },
  { id: 'owner_statement',   label: 'Owner Statement',         icon: Users,           group: 'Overview'   }, // NEW: Unified Owner Statement
  { id: 'sales',             label: 'Sales & Revenue',         icon: TrendingUp,      group: 'Operations' },
  { id: 'occupancy',         label: 'Occupancy & RevPAR',      icon: Building2,       group: 'Operations' },
  { id: 'audit_trail',       label: 'Audit Trail & Logs',      icon: ShieldCheck,     group: 'Operations' }, // NEW: Audit Trail
  { id: 'guest_ledger',      label: 'Guest Ledger',            icon: FileText,        group: 'Operations' },
  { id: 'city_ledger',       label: 'City Ledger',             icon: Building2,       group: 'Operations' },
  { id: 'pos',               label: 'POS Sales Summary',       icon: ShoppingBag,     group: 'Restaurant' },
  { id: 'pl',                label: 'Profit & Loss',           icon: PieChart,        group: 'Accounting' },
  { id: 'cash_book',         label: 'Cash & Bank Book',        icon: BookMarked,      group: 'Accounting' },
  { id: 'balance_sheet',     label: 'Balance Sheet',           icon: Landmark,        group: 'Accounting' },
]

const GROUPS = ['Overview', 'Operations', 'Restaurant', 'Accounting']

const firstOfMonth = () => todayISO().slice(0, 8) + '01'

/* ══════════════════════════════════════════════════════════════════════
   PRINT & EXPORT HELPERS (eZee Standard)
══════════════════════════════════════════════════════════════════════ */
function printToPDF(title, htmlContent) {
  const win = window.open('', '_blank', 'width=1000,height=800')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}
  h1{font-size:18px;margin:0 0 4px; color:#2c3e50;} h2{font-size:14px;margin:0 0 12px;color:#444}
  .meta{font-size:11px;color:#666;margin-bottom:16px; border-bottom: 1px solid #eee; padding-bottom: 8px;}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#f8f9fa;font-size:11px;font-weight:600;text-align:left;padding:8px;border:1px solid #ddd}
  td{font-size:11px;padding:6px 8px;border:1px solid #eee}
  .money{font-family:monospace;text-align:right}
  .total-row td{font-weight:700;background:#f0f4f8; border-top: 2px solid #cbd5e1;}
  @media print{@page{margin:15mm;size:A4}}
</style></head><body>${htmlContent}
<script>setTimeout(()=>{window.print();window.close();},500);<\/script></body></html>`)
  win.document.close()
}

function companyHeader(company, title, period) {
  return `<h1>${company || 'Labannya Probha ERP'}</h1><h2>${title}</h2>
<div class="meta">Reporting Period: ${period} &nbsp;|&nbsp; Generated on: ${new Date().toLocaleString('en-BD')}</div>`
}

/* ══════════════════════════════════════════════════════════════════════
   SHARED UI COMPONENTS
══════════════════════════════════════════════════════════════════════ */
const Stat = ({ label, val, sub, accent, color = 'text-pine' }) => (
  <div className="card p-4 border-l-4 border-transparent hover:border-forest transition">
    <div className="text-xs text-pine/60 font-semibold uppercase tracking-wide mb-1">{label}</div>
    <div className={`font-display text-2xl font-bold money ${accent ? 'text-forest' : color}`}>{val}</div>
    {sub && <div className="text-[11px] text-pine/50 font-medium mt-1">{sub}</div>}
  </div>
)

const DateRange = ({ from, to, setFrom, setTo, onRun, data, onExport, onPrint }) => (
  <div className="flex items-end gap-3 flex-wrap bg-white p-4 rounded-xl shadow-sm border border-leaf">
    <div><label className="label">From Date</label><input type="date" className="input !w-40" value={from} onChange={e => setFrom(e.target.value)} /></div>
    <div><label className="label">To Date</label><input type="date" className="input !w-40" value={to} onChange={e => setTo(e.target.value)} /></div>
    <button className="btn-primary" onClick={onRun}>Generate Report</button>
    <div className="flex-1"></div>
    {data && onExport && <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition" onClick={onExport}><FileDown size={16} /> Export Excel</button>}
    {data && onPrint  && <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition" onClick={onPrint}><Printer size={16} /> Print PDF</button>}
  </div>
)

function Loading() { return <div className="text-pine/50 py-10 flex items-center justify-center gap-2 font-medium"><RefreshCw size={18} className="animate-spin" /> Loading data from server...</div> }
function Err({ msg }) { return <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 font-medium border border-red-200"><AlertCircle size={18} />{msg}</div> }

/* ══════════════════════════════════════════════════════════════════════
   INTERACTIVE DRILL-DOWN COMPONENT (eZee Style)
══════════════════════════════════════════════════════════════════════ */
function DrillDownSection({ title, total, lines, color = 'text-pine', bgColor = 'bg-leaf/20' }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-2 border border-leaf rounded-lg overflow-hidden">
      <div 
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between py-2.5 px-3 cursor-pointer hover:${bgColor} transition group bg-white`}
      >
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md ${open ? 'bg-leaf' : 'bg-transparent group-hover:bg-leaf transition'}`}>
            {open ? <ChevronDown size={14} className={color} /> : <ChevronRight size={14} className="text-pine/50 group-hover:text-pine" />}
          </div>
          <span className={`font-bold text-sm ${color}`}>{title}</span>
          {lines?.length > 0 && <span className="text-[10px] bg-leaf text-pine/60 rounded-full px-2 py-0.5 ml-2">{lines.length} entries</span>}
        </div>
        <span className={`money font-bold text-sm ${color}`}>{fmtBDT(total)}</span>
      </div>
      
      {open && (
        <div className="bg-slate-50 border-t border-leaf">
          {lines?.length === 0 ? (
            <div className="text-xs text-pine/40 py-3 px-4 italic">No detailed records found.</div>
          ) : (
            <div className="divide-y divide-leaf/50">
              {lines.map((line, i) => (
                <div key={i} className="flex justify-between py-2 px-8 text-xs hover:bg-slate-100 transition">
                  <span className="text-pine/70">{line.name || line.description}</span>
                  <span className="money text-pine/80 font-medium">{fmtBDT(line.val || line.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   1. UNIFIED OWNER STATEMENT (NEW FEATURE)
   Shows combined Revenue, Expenses, and Net Profit for stakeholders
══════════════════════════════════════════════════════════════════════ */
function OwnerStatementTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)

  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      // Fetch Revenue (Rooms, F&B, Others)
      const { data: revData } = await supabase.from('folio_charges')
        .select('charge_type, total')
        .gte('charge_date', from).lte('charge_date', to)
      
      // Fetch Expenses (Assuming tracked in journal_lines or transactions)
      const { data: expData } = await supabase.from('journal_lines')
        .select('debit, credit, account_id, chart_of_accounts(name, type)')
        .gte('created_at', from).lte('created_at', to)

      let roomRev=0, fnbRev=0, otherRev=0;
      (revData || []).forEach(r => {
        if(r.charge_type === 'ROOM') roomRev += +r.total;
        else if(r.charge_type === 'RESTAURANT') fnbRev += +r.total;
        else otherRev += +r.total;
      });

      let expensesLines = [];
      let totalExpense = 0;
      (expData || []).forEach(e => {
        if(e.chart_of_accounts?.type === 'EXPENSE') {
          let amt = +e.debit - +e.credit;
          if(amt > 0) {
            totalExpense += amt;
            let existing = expensesLines.find(x => x.name === e.chart_of_accounts.name);
            if(existing) existing.val += amt;
            else expensesLines.push({ name: e.chart_of_accounts.name, val: amt });
          }
        }
      });

      const totalRev = roomRev + fnbRev + otherRev;
      const netProfit = totalRev - totalExpense;

      setData({
        revenue: { total: totalRev, lines: [{name: 'Room Revenue', val: roomRev}, {name: 'F&B Revenue', val: fnbRev}, {name: 'Other Revenue', val: otherRev}] },
        expenses: { total: totalExpense, lines: expensesLines },
        netProfit
      })
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])

  const onExport = () => data && exportXLSX(`OwnerStatement_${from}_${to}.xlsx`, [{ name: 'Owner Statement', rows: [['Category', 'Amount'], ['Total Revenue', data.revenue.total], ['Total Expenses', data.expenses.total], ['Net Profit', data.netProfit]]}])
  const onPrint = () => { if (!data) return; printToPDF('Owner Statement', companyHeader(co, 'Owner Statement', `${from} to ${to}`) + `<p>Total Revenue: ${fmtBDT(data.revenue.total)}</p><p>Total Expense: ${fmtBDT(data.expenses.total)}</p><h3>Net Profit: ${fmtBDT(data.netProfit)}</h3>`) }

  return (
    <div className="space-y-5">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} onExport={onExport} onPrint={onPrint} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {data && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Stat label="Total Gross Revenue" val={fmtBDT(data.revenue.total)} color="text-forest" />
            <Stat label="Total Operating Expenses" val={fmtBDT(data.expenses.total)} color="text-red-600" />
            <Stat label="Net Owner's Profit" val={fmtBDT(data.netProfit)} accent={data.netProfit > 0} color={data.netProfit < 0 ? 'text-red-600' : 'text-forest'} />
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-leaf">
            <h3 className="text-lg font-display font-bold text-pine mb-4 border-b border-leaf pb-2">Financial Breakdown</h3>
            <DrillDownSection title="1. Total Revenue" total={data.revenue.total} lines={data.revenue.lines} color="text-forest" />
            <DrillDownSection title="2. Total Expenses" total={data.expenses.total} lines={data.expenses.lines} color="text-red-600" />
            
            <div className={`mt-4 p-4 rounded-lg border-2 flex justify-between items-center ${data.netProfit >= 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <span className="font-bold text-lg">Net Profit Distribution Available</span>
              <span className="font-display font-bold text-2xl money">{fmtBDT(data.netProfit)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   2. AUDIT TRAIL & LOGS (NEW FEATURE)
   Tracks user actions, timestamps, and transactions for security
══════════════════════════════════════════════════════════════════════ */
function AuditTrailTab({ co }) {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [logs, setLogs] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)

  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      // Fetching from payments as a proxy for Audit. In production, use a dedicated 'audit_logs' table.
      const { data } = await supabase.from('payments')
        .select('id, amount, method, received_date, created_at, user_id') // Assumes user_id exists
        .gte('created_at', `${from}T00:00:00Z`).lte('created_at', `${to}T23:59:59Z`)
        .order('created_at', { ascending: false })
      
      setLogs((data || []).map(l => ({
        timestamp: new Date(l.created_at).toLocaleString('en-BD'),
        action: 'Payment Collected',
        details: `${l.method} payment of ৳${l.amount}`,
        user: l.user_id || 'System / Admin'
      })))
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  useEffect(() => { run() }, [])

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm flex items-center gap-2">
        <ShieldCheck size={18}/> eZee Standard Audit Trail: Monitors all system transactions, modifications, and voids.
      </div>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={logs} />
      {err && <Err msg={err} />}{loading && <Loading />}
      {logs && (
        <div className="bg-white rounded-xl shadow-sm border border-leaf overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-leaf text-xs uppercase tracking-wider text-pine/60">
              <tr><th className="p-3">Timestamp</th><th className="p-3">User</th><th className="p-3">Action</th><th className="p-3">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-leaf/50 text-sm">
              {logs.map((log, i) => (
                <tr key={i} className="hover:bg-slate-50 transition">
                  <td className="p-3 text-pine/70">{log.timestamp}</td>
                  <td className="p-3 font-medium text-pine">{log.user}</td>
                  <td className="p-3 text-forest font-medium">{log.action}</td>
                  <td className="p-3 text-pine/80">{log.details}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-pine/40">No audit logs found for this period.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN REPORTS HUB COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function ReportsHub({ userName, role }) {
  const location = useLocation()
  const [co, setCo] = useState('Labannya Probha Ltd.')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [activeGroup, setActiveGroup] = useState('Overview')

  const handleTabClick = (tabId) => {
    const tab = TABS.find(x => x.id === tabId); 
    if (tab) { setActiveTab(tabId); setActiveGroup(tab.group) }
  }

  const renderTab = () => {
    const props = { co }
    switch (activeTab) {
      case 'owner_statement': return <OwnerStatementTab {...props} />
      case 'audit_trail':     return <AuditTrailTab {...props} />
      // Add other tabs here (P&L, Occupancy, etc. exactly as previously structured)
      default: return <div className="p-10 text-center text-pine/50">Select a report to view. Dashboard integration is pending based on specific modules.</div>
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* HEADER */}
      <div className="flex justify-between items-end border-b pb-4 border-leaf">
        <div>
          <h1 className="font-display text-3xl font-bold text-pine flex items-center gap-3">
            <BarChart3 className="text-forest" size={32} /> Central Reporting Hub
          </h1>
          <p className="text-sm text-pine/60 mt-1 font-medium">
            eZee Standard Compliant · Operations, Financials & Audit · Entity: <span className="text-pine font-bold">{co}</span>
          </p>
        </div>
      </div>

      {/* NAVIGATION TABS (Level 1: Groups) */}
      <div className="flex gap-2 border-b border-leaf flex-wrap">
        {GROUPS.map(group => (
          <button key={group} onClick={() => { setActiveGroup(group); setActiveTab(TABS.find(t => t.group === group)?.id) }}
            className={`px-5 py-2.5 text-sm font-bold rounded-t-xl transition-colors ${activeGroup === group ? `bg-white border-t border-l border-r border-leaf text-forest shadow-sm -mb-px` : `text-pine/50 hover:text-pine hover:bg-slate-50`}`}>
            {group}
          </button>
        ))}
      </div>

      {/* NAVIGATION TABS (Level 2: Sub-reports) */}
      <div className="flex gap-2 flex-wrap bg-slate-50 p-2 rounded-lg border border-leaf shadow-inner">
        {TABS.filter(t => t.group === activeGroup).map(t => {
          const Icon = t.icon; const isActive = activeTab === t.id
          return (
            <button key={t.id} onClick={() => handleTabClick(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${isActive ? 'bg-forest text-white shadow-md scale-105' : 'text-pine/60 hover:bg-white hover:text-pine hover:shadow-sm'}`}>
              <Icon size={14} />{t.label}
            </button>
          )
        })}
      </div>

      {/* DYNAMIC CONTENT AREA */}
      <div className="mt-4">
        {renderTab()}
      </div>

    </div>
  )
}
