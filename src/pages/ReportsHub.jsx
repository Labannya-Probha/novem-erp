import { useEffect, useState, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { fmtBDT, todayISO, exportXLSX, nightsBetween } from '../lib/helpers'
import ReceiptPaymentModal from './ReceiptPaymentModal'
import {
  BarChart3, FileDown, AlertCircle, TrendingUp, ShoppingBag, Banknote,
  Scale, BookOpen, PieChart, Activity, Landmark, CreditCard, BookMarked,
  Printer, Users, Building2, FileText, LayoutDashboard,
  ChevronDown, ChevronRight, Plus, Minus, RefreshCw, ShieldCheck,
  Search, ArrowLeft, FolderOpen, Filter
} from 'lucide-react'

/* ══════════════════════════════════════════════════════════════════════
   ENTERPRISE REPORT DEFINITIONS
══════════════════════════════════════════════════════════════════════ */
const TABS = [
  // Overview
  { id: 'dashboard',         label: 'Management Dashboard',    desc: 'High-level KPI overview across all modules', icon: LayoutDashboard, group: 'Overview' },
  { id: 'owner_statement',   label: 'Owner Statement',         desc: 'Unified revenue, expenses, and net profit', icon: Users,           group: 'Overview' },
  
  // Operations
  { id: 'sales',             label: 'Sales & Revenue',         desc: 'Detailed breakdown of sales and reservations', icon: TrendingUp,      group: 'Operations' },
  { id: 'occupancy',         label: 'Occupancy & RevPAR',      desc: 'Room occupancy rates and revenue per available room', icon: Building2,       group: 'Operations' },
  { id: 'guest_ledger',      label: 'Guest Ledger',            desc: 'In-house guest outstanding balances', icon: FileText,        group: 'Operations' },
  { id: 'city_ledger',       label: 'City Ledger',             desc: 'Corporate and agency receivables', icon: Building2,       group: 'Operations' },
  { id: 'agency_commission', label: 'Agency Commission',       desc: 'Commission payouts for OTAs and agents', icon: Banknote,        group: 'Operations' },
  { id: 'shareholder',       label: 'Shareholder Entitlement', desc: 'Dividend and free-stay tracking', icon: Users,           group: 'Operations' },
  { id: 'audit_trail',       label: 'Audit Trail & Logs',      desc: 'System-wide user activity and modification logs', icon: ShieldCheck,     group: 'Operations' },
  
  // Restaurant
  { id: 'pos',               label: 'POS Sales Summary',       desc: 'Outlet-wise POS transaction summary', icon: ShoppingBag,     group: 'Restaurant' },
  { id: 'kot',               label: 'KOT Register',            desc: 'Kitchen Order Ticket logs and status', icon: FileText,        group: 'Restaurant' },
  { id: 'fnb_revenue',       label: 'F&B Daily Revenue',       desc: 'Daily food & beverage revenue consolidation', icon: PieChart,        group: 'Restaurant' },
  
  // Accounting & Financials
  { id: 'receipt_payment',   label: 'Receipt & Payment',       desc: 'Summary of cash/bank receipts and payments', icon: Activity,        group: 'Accounting' }, // NEW REPORT
  { id: 'pl',                label: 'Profit & Loss',           desc: 'Income statement (IAS 1 compliant)', icon: PieChart,        group: 'Accounting' },
  { id: 'balance_sheet',     label: 'Balance Sheet',           desc: 'Statement of financial position', icon: Landmark,        group: 'Accounting' },
  { id: 'cashflow',          label: 'Cash Flow Statement',     desc: 'Inflows and outflows by operating/investing/financing', icon: Activity,        group: 'Accounting' },
  { id: 'trial_balance',     label: 'Trial Balance',           desc: 'Debit and credit balances for all accounts', icon: Scale,           group: 'Accounting' },
  { id: 'ledger',            label: 'General Ledger',          desc: 'Detailed transaction logs per account', icon: BookOpen,        group: 'Accounting' },
  { id: 'bank_book',         label: 'Bank Book',               desc: 'Bank and digital wallet transactions', icon: BookMarked,      group: 'Accounting' },
  { id: 'cash_book',         label: 'Cash Book',               desc: 'Petty cash and main cash transactions', icon: BookMarked,      group: 'Accounting' },
  { id: 'bank_recon',        label: 'Bank Reconciliation',     desc: 'Match system books with bank statements', icon: CreditCard,      group: 'Accounting' },
  { id: 'retained_earnings', label: 'Retained Earnings',       desc: 'Accumulated profits and dividend distributions', icon: Banknote,        group: 'Accounting' },
  { id: 'nav',               label: 'NAV / Equity Report',     desc: 'Net asset value calculation per share', icon: TrendingUp,      group: 'Accounting' },
  { id: 'ap_aging',          label: 'AP Aging',                desc: 'Accounts payable duration analysis', icon: AlertCircle,     group: 'Accounting' },
  { id: 'ar_aging',          label: 'AR Aging',                desc: 'Accounts receivable duration analysis', icon: AlertCircle,     group: 'Accounting' },
  
  // Statutory
  { id: 'vat_sales',         label: 'VAT Sales (Mushak 6.1)',  desc: 'Statutory VAT output register', icon: FileText,        group: 'Statutory'  },
  { id: 'vat_purchase',      label: 'VAT Purchase Register',   desc: 'Statutory VAT input and rebate register', icon: FileText,        group: 'Statutory'  },
  { id: 'ait',               label: 'AIT Deduction Register',  desc: 'Tax deducted at source (TDS) under Section 52', icon: FileText,        group: 'Statutory'  },
]

const GROUPS = ['All', 'Overview', 'Operations', 'Restaurant', 'Accounting', 'Statutory']
const firstOfMonth = () => todayISO().slice(0, 8) + '01'
const firstOfYear  = () => todayISO().slice(0, 4) + '-01-01'

/* ══════════════════════════════════════════════════════════════════════
   SHARED UI COMPONENTS (Kept from previous standard)
══════════════════════════════════════════════════════════════════════ */
const DateRange = ({ from, to, setFrom, setTo, onRun, data, onExport, onPrint }) => (
  <div className="flex items-end gap-3 flex-wrap bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
    <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">From Date</label><input type="date" className="input !w-40" value={from} onChange={e => setFrom(e.target.value)} /></div>
    <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">To Date</label><input type="date" className="input !w-40" value={to} onChange={e => setTo(e.target.value)} /></div>
    <button className="bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-700 transition" onClick={onRun}>Generate Report</button>
    <div className="flex-1"></div>
    {data && onExport && <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-green-700 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition" onClick={onExport}><FileDown size={16} /> Export Excel</button>}
    {data && onPrint  && <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition" onClick={onPrint}><Printer size={16} /> Print PDF</button>}
  </div>
)

function Loading() { return <div className="text-slate-400 py-16 flex flex-col items-center justify-center gap-3 font-medium"><RefreshCw size={24} className="animate-spin" /> Processing data...</div> }
function Err({ msg }) { return <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 font-medium border border-red-200 mb-4"><AlertCircle size={18} />{msg}</div> }

/* ══════════════════════════════════════════════════════════════════════
   NEW: RECEIPT & PAYMENT STATEMENT
══════════════════════════════════════════════════════════════════════ */
function ReceiptPaymentStatementTab() {
  const [from, setFrom] = useState(firstOfMonth()); const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState(null)

  const run = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      // In a real ERP, opening balance is calculated by summing all previous transactions before 'from' date.
      // Mocking fetch logic for structural demonstration
      const openingCash = 150000; const openingBank = 450000;
      
      const receipts = [
        { name: 'Room Sales Collection', val: 520000 },
        { name: 'Restaurant Sales (Cash/Bank)', val: 180000 },
        { name: 'Advance Bookings', val: 95000 },
        { name: 'Sale of Scrap', val: 12000 }
      ];
      
      const payments = [
        { name: 'Raw Material Purchases', val: 210000 },
        { name: 'Salary & Wages', val: 185000 },
        { name: 'Utility Bills', val: 45000 },
        { name: 'Vendor Payments (AP)', val: 130000 },
        { name: 'Asset Purchase (AC Units)', val: 80000 }
      ];

      const totalReceipts = receipts.reduce((a, b) => a + b.val, 0);
      const totalPayments = payments.reduce((a, b) => a + b.val, 0);
      
      const closingCash = 120000;
      const closingBank = (openingCash + openingBank + totalReceipts) - totalPayments - closingCash;

      setData({ openingCash, openingBank, receipts, payments, totalReceipts, totalPayments, closingCash, closingBank })
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [from, to])
  
  useEffect(() => { run() }, [])

  return (
    <div className="animate-in fade-in duration-300">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} />
      {err && <Err msg={err} />}{loading && <Loading />}
      
      {data && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center py-6 border-b border-slate-200 bg-slate-50">
            <h2 className="text-xl font-bold text-slate-800 uppercase tracking-widest">Receipt & Payment Statement</h2>
            <p className="text-sm text-slate-500 mt-1">For the period {from} to {to}</p>
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-200">
            {/* RECEIPTS SIDE (LEFT) */}
            <div className="p-0">
              <div className="bg-slate-100/50 py-2 px-4 border-b border-slate-200 flex justify-between font-bold text-slate-700 text-sm">
                <span>RECEIPTS</span><span>AMOUNT (৳)</span>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Opening Balance */}
                <div>
                  <h4 className="font-bold text-sm text-slate-800 mb-2 border-b border-slate-100 pb-1">Opening Balances</h4>
                  <div className="flex justify-between text-sm text-slate-600 py-1"><span>Cash in Hand</span><span className="money">{fmtBDT(data.openingCash)}</span></div>
                  <div className="flex justify-between text-sm text-slate-600 py-1"><span>Cash at Bank</span><span className="money">{fmtBDT(data.openingBank)}</span></div>
                  <div className="flex justify-between text-sm font-bold text-slate-800 mt-2"><span>Total Opening Balance</span><span className="money">{fmtBDT(data.openingCash + data.openingBank)}</span></div>
                </div>

                {/* Receipts List */}
                <div>
                  <h4 className="font-bold text-sm text-slate-800 mb-2 border-b border-slate-100 pb-1">Revenue & Capital Receipts</h4>
                  {data.receipts.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm text-slate-600 py-1"><span>{r.name}</span><span className="money">{fmtBDT(r.val)}</span></div>
                  ))}
                  <div className="flex justify-between text-sm font-bold text-slate-800 mt-2"><span>Total Receipts</span><span className="money">{fmtBDT(data.totalReceipts)}</span></div>
                </div>
              </div>
            </div>

            {/* PAYMENTS SIDE (RIGHT) */}
            <div className="p-0 flex flex-col h-full">
              <div className="bg-slate-100/50 py-2 px-4 border-b border-slate-200 flex justify-between font-bold text-slate-700 text-sm">
                <span>PAYMENTS</span><span>AMOUNT (৳)</span>
              </div>
              
              <div className="p-4 flex-1">
                <h4 className="font-bold text-sm text-slate-800 mb-2 border-b border-slate-100 pb-1">Revenue & Capital Payments</h4>
                {data.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm text-slate-600 py-1"><span>{p.name}</span><span className="money">{fmtBDT(p.val)}</span></div>
                ))}
                <div className="flex justify-between text-sm font-bold text-slate-800 mt-2"><span>Total Payments</span><span className="money">{fmtBDT(data.totalPayments)}</span></div>
              </div>

              {/* Closing Balances placed at the bottom to balance */}
              <div className="p-4 border-t border-slate-100 mt-auto">
                <h4 className="font-bold text-sm text-slate-800 mb-2 border-b border-slate-100 pb-1">Closing Balances</h4>
                <div className="flex justify-between text-sm text-slate-600 py-1"><span>Cash in Hand</span><span className="money">{fmtBDT(data.closingCash)}</span></div>
                <div className="flex justify-between text-sm text-slate-600 py-1"><span>Cash at Bank</span><span className="money">{fmtBDT(data.closingBank)}</span></div>
                <div className="flex justify-between text-sm font-bold text-slate-800 mt-2"><span>Total Closing Balance</span><span className="money">{fmtBDT(data.closingCash + data.closingBank)}</span></div>
              </div>
            </div>
          </div>

          {/* Footer Totals (Must match) */}
          <div className="grid grid-cols-2 divide-x divide-slate-300 border-t-2 border-slate-300 bg-slate-100">
            <div className="py-3 px-4 flex justify-between font-bold text-slate-800 text-lg">
              <span>TOTAL</span><span className="money">{fmtBDT(data.openingCash + data.openingBank + data.totalReceipts)}</span>
            </div>
            <div className="py-3 px-4 flex justify-between font-bold text-slate-800 text-lg">
              <span>TOTAL</span><span className="money">{fmtBDT(data.totalPayments + data.closingCash + data.closingBank)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* Mock placeholders for other tabs to prevent errors */
function PlaceholderTab({ name }) { return <div className="p-16 text-center text-slate-400 border border-slate-200 border-dashed rounded-xl bg-slate-50">Module <b>{name}</b> is active. Ready for data integration.</div> }

/* ══════════════════════════════════════════════════════════════════════
   ENTERPRISE REPORT HUB WRAPPER (Redesigned)
══════════════════════════════════════════════════════════════════════ */
export default function ReportsHub() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeReportId, setActiveReportId] = useState(null) // null = show dashboard, string = show specific report

  // Filter logic for the dashboard grid
  const filteredReports = useMemo(() => {
    return TABS.filter(tab => {
      const matchCat = activeCategory === 'All' || tab.group === activeCategory;
      const matchSearch = tab.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          tab.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    })
  }, [activeCategory, searchQuery])

  // Get active report object
  const activeReport = TABS.find(t => t.id === activeReportId)

  // Render proper component based on ID
  const renderActiveReport = () => {
    switch(activeReportId) {
      case 'receipt_payment': return <ReceiptPaymentStatementTab />
      // add specific cases like: case 'pl': return <PLTab /> 
      default: return <PlaceholderTab name={activeReport?.label} />
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex">
      
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-10 hidden md:flex">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-display font-bold text-white flex items-center gap-2"><BarChart3 className="text-blue-500" /> ERP Reports</h1>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 px-2">Report Modules</div>
          <nav className="space-y-1">
            {GROUPS.map(group => (
              <button
                key={group}
                onClick={() => { setActiveCategory(group); setActiveReportId(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeCategory === group && !activeReportId ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}
              >
                {group === 'All' ? <FolderOpen size={18} /> : <Filter size={18} />}
                {group}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* TOP NAVBAR */}
        <header className="bg-white h-16 border-b border-slate-200 flex items-center px-8 shadow-sm shrink-0">
          {activeReportId ? (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setActiveReportId(null)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition font-semibold text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md"
              >
                <ArrowLeft size={16} /> Back to Repository
              </button>
              <div className="h-6 w-px bg-slate-300"></div>
              <div className="flex items-center gap-2 text-slate-800">
                {activeReport?.icon && <activeReport.icon size={18} className="text-blue-600" />}
                <h2 className="font-bold text-lg">{activeReport?.label}</h2>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">{activeReport?.group}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <h2 className="text-lg font-bold text-slate-800">Report Repository</h2>
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search reports (e.g. VAT, Ledger, Aging)..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>
            </div>
          )}
        </header>

        {/* WORKSPACE CONTENT */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {activeReportId ? (
            // RENDER SPECIFIC REPORT
            renderActiveReport()
          ) : (
            // RENDER DASHBOARD GRID
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-slate-500 font-semibold">{activeCategory === 'All' ? 'All Available Reports' : `${activeCategory} Reports`}</h3>
                <span className="text-sm text-slate-400">{filteredReports.length} reports found</span>
              </div>

              {filteredReports.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <FolderOpen size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No reports matched your search criteria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredReports.map(tab => {
                    const Icon = tab.icon;
                    return (
                      <div 
                        key={tab.id}
                        onClick={() => setActiveReportId(tab.id)}
                        className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all group flex flex-col h-full"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="p-2.5 bg-blue-50 rounded-lg group-hover:bg-blue-600 transition-colors">
                            <Icon size={22} className="text-blue-600 group-hover:text-white transition-colors" />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded">{tab.group}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-base mb-1 group-hover:text-blue-600 transition-colors">{tab.label}</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mt-auto">{tab.desc}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
