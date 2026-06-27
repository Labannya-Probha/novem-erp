import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, todayISO, exportXLSX } from '../lib/helpers'
import {
  BarChart3, FileDown, AlertCircle, TrendingUp, ShoppingBag, Banknote,
  Scale, BookOpen, PieChart, Activity, Landmark, CreditCard, BookMarked,
  Printer, Users, Building2, FileText, LayoutDashboard,
  Search, ArrowLeft, FolderOpen, Filter, RefreshCw
} from 'lucide-react'

/* ══════════════════════════════════════════════════════════════════════
   ENTERPRISE REPORT DEFINITIONS
══════════════════════════════════════════════════════════════════════ */
const TABS = [
  { id: 'dashboard',         label: 'Management Dashboard',    desc: 'High-level KPI overview across all modules', icon: LayoutDashboard, group: 'Overview' },
  { id: 'owner_statement',   label: 'Owner Statement',         desc: 'Unified revenue, expenses, and net profit', icon: Users,           group: 'Overview' },
  { id: 'sales',             label: 'Sales & Revenue',         desc: 'Detailed breakdown of sales and reservations', icon: TrendingUp,      group: 'Operations' },
  { id: 'occupancy',         label: 'Occupancy & RevPAR',      desc: 'Room occupancy rates and revenue per available room', icon: Building2,       group: 'Operations' },
  { id: 'guest_ledger',      label: 'Guest Ledger',            desc: 'In-house guest outstanding balances', icon: FileText,        group: 'Operations' },
  { id: 'city_ledger',       label: 'City Ledger',             desc: 'Corporate and agency receivables', icon: Building2,       group: 'Operations' },
  { id: 'audit_trail',       label: 'Audit Trail & Logs',      desc: 'System-wide user activity and modification logs', icon: ShieldCheck,     group: 'Operations' },
  { id: 'pos',               label: 'POS Sales Summary',       desc: 'Outlet-wise POS transaction summary', icon: ShoppingBag,     group: 'Restaurant' },
  { id: 'receipt_payment',   label: 'Receipt & Payment',       desc: 'Summary of cash/bank receipts and payments', icon: Activity,        group: 'Accounting' },
  { id: 'pl',                label: 'Profit & Loss',           desc: 'Income statement (IAS 1 compliant)', icon: PieChart,        group: 'Accounting' },
  { id: 'balance_sheet',     label: 'Balance Sheet',           desc: 'Statement of financial position', icon: Landmark,        group: 'Accounting' },
  { id: 'trial_balance',     label: 'Trial Balance',           desc: 'Debit and credit balances for all accounts', icon: Scale,           group: 'Accounting' },
  { id: 'ledger',            label: 'General Ledger',          desc: 'Detailed transaction logs per account', icon: BookOpen,        group: 'Accounting' },
  { id: 'vat_sales',         label: 'VAT Sales (Mushak 6.1)',  desc: 'Statutory VAT output register', icon: FileText,        group: 'Statutory'  },
]

const GROUPS = ['All', 'Overview', 'Operations', 'Restaurant', 'Accounting', 'Statutory']
const firstOfMonth = () => todayISO().slice(0, 8) + '01'

/* ══════════════════════════════════════════════════════════════════════
   SHARED UI COMPONENTS
══════════════════════════════════════════════════════════════════════ */
const DateRange = ({ from, to, setFrom, setTo, onRun, data, onExport, onPrint }) => (
  <div className="flex items-end gap-3 flex-wrap bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">From Date</label>
      <input type="date" className="input !w-40 bg-slate-50 border-slate-200" value={from} onChange={e => setFrom(e.target.value)} />
    </div>
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">To Date</label>
      <input type="date" className="input !w-40 bg-slate-50 border-slate-200" value={to} onChange={e => setTo(e.target.value)} />
    </div>
    <button className="bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 transition shadow-sm h-10" onClick={onRun}>
      Generate
    </button>
    <div className="flex-1"></div>
    {data && onExport && (
      <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-green-700 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition h-10" onClick={onExport}>
        <FileDown size={16} /> Export
      </button>
    )}
    {data && onPrint && (
      <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition h-10" onClick={onPrint}>
        <Printer size={16} /> Print
      </button>
    )}
  </div>
)

function Loading() { return <div className="text-slate-400 py-16 flex flex-col items-center justify-center gap-3 font-medium"><RefreshCw size={24} className="animate-spin" /> Fetching real-time data...</div> }
function Err({ msg }) { return <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 font-medium border border-red-200 mb-4 text-sm break-words"><AlertCircle size={18} className="shrink-0" />{msg}</div> }

/* ══════════════════════════════════════════════════════════════════════
   RECEIPT & PAYMENT STATEMENT (MULTI-TENANT REAL DATA PULL)
══════════════════════════════════════════════════════════════════════ */
function ReceiptPaymentStatementTab({ tenantId }) {
  const [from, setFrom] = useState(firstOfMonth()); 
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null); 
  const [loading, setLoading] = useState(false); 
  const [err, setErr] = useState(null)

  const run = useCallback(async () => {
    if (!tenantId) {
      setErr("Tenant ID is missing. Cannot fetch data.");
      return;
    }
    
    setLoading(true); setErr(null)
    try {
      // 1. Calculate Opening Balance (All transactions BEFORE 'from' date)
      // Assuming 'transactions' table has: type ('RECEIPT'/'PAYMENT'), method ('CASH'/'BANK'), amount, date, tenant_id
      const { data: pastTxns, error: pastErr } = await supabase
        .from('transactions')
        .select('type, method, amount')
        .eq('tenant_id', tenantId)
        .lt('date', from);

      if (pastErr) throw pastErr;

      let openingCash = 0; let openingBank = 0;
      (pastTxns || []).forEach(txn => {
        const amt = Number(txn.amount);
        if (txn.method === 'CASH') {
          txn.type === 'RECEIPT' ? (openingCash += amt) : (openingCash -= amt);
        } else {
          txn.type === 'RECEIPT' ? (openingBank += amt) : (openingBank -= amt);
        }
      });

      // 2. Fetch Current Period Transactions
      const { data: currentTxns, error: currErr } = await supabase
        .from('transactions')
        .select('id, type, method, amount, ref, narration, date')
        .eq('tenant_id', tenantId)
        .gte('date', from)
        .lte('date', to);

      if (currErr) throw currErr;

      // Grouping logic for the period
      let receipts = []; let payments = [];
      let totalReceipts = 0; let totalPayments = 0;

      (currentTxns || []).forEach(txn => {
        const amt = Number(txn.amount);
        const item = { 
          name: txn.narration || txn.ref || `${txn.method} Transaction`, 
          val: amt,
          method: txn.method
        };

        if (txn.type === 'RECEIPT') {
          receipts.push(item);
          totalReceipts += amt;
        } else {
          payments.push(item);
          totalPayments += amt;
        }
      });

      // Group identical narrations to prevent massive lists (Optional but recommended for statements)
      const groupData = (arr) => {
        const grouped = {};
        arr.forEach(item => {
          if(!grouped[item.name]) grouped[item.name] = 0;
          grouped[item.name] += item.val;
        });
        return Object.entries(grouped).map(([name, val]) => ({ name, val }));
      };

      const groupedReceipts = groupData(receipts);
      const groupedPayments = groupData(payments);

      // 3. Calculate Closing Balance
      let closingCash = openingCash; let closingBank = openingBank;
      (currentTxns || []).forEach(txn => {
        const amt = Number(txn.amount);
        if (txn.method === 'CASH') {
          txn.type === 'RECEIPT' ? (closingCash += amt) : (closingCash -= amt);
        } else {
          txn.type === 'RECEIPT' ? (closingBank += amt) : (closingBank -= amt);
        }
      });

      setData({ 
        openingCash, openingBank, 
        receipts: groupedReceipts, payments: groupedPayments, 
        totalReceipts, totalPayments, 
        closingCash, closingBank 
      })
    } catch (e) { 
      setErr(e.message) 
    } finally { 
      setLoading(false) 
    }
  }, [from, to, tenantId])
  
  useEffect(() => { run() }, [run])

  return (
    <div className="animate-in fade-in duration-300">
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} data={data} />
      {err && <Err msg={err} />}{loading && <Loading />}
      
      {data && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto w-full">
          <div className="min-w-[700px]">
            {/* Header */}
            <div className="text-center py-5 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 uppercase tracking-widest break-words">Receipt & Payment Statement</h2>
              <p className="text-sm text-slate-500 mt-1">For the period {from} to {to}</p>
            </div>

            <div className="grid grid-cols-2 divide-x divide-slate-200">
              {/* RECEIPTS SIDE */}
              <div className="p-0">
                <div className="bg-slate-100/70 py-2 px-4 border-b border-slate-200 flex justify-between font-bold text-slate-700 text-xs uppercase tracking-wider">
                  <span>Receipts</span><span>Amount (৳)</span>
                </div>
                
                <div className="p-4 space-y-4">
                  <div>
                    <h4 className="font-bold text-xs text-slate-800 mb-2 border-b border-slate-100 pb-1 uppercase">Opening Balances</h4>
                    <div className="flex justify-between text-sm text-slate-600 py-1"><span className="truncate pr-2">Cash in Hand</span><span className="money font-medium whitespace-nowrap">{fmtBDT(data.openingCash)}</span></div>
                    <div className="flex justify-between text-sm text-slate-600 py-1"><span className="truncate pr-2">Cash at Bank</span><span className="money font-medium whitespace-nowrap">{fmtBDT(data.openingBank)}</span></div>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-slate-800 mb-2 border-b border-slate-100 pb-1 uppercase mt-4">Current Receipts</h4>
                    {data.receipts.length === 0 ? <p className="text-xs text-slate-400 italic">No receipts</p> : 
                      data.receipts.map((r, i) => (
                        <div key={i} className="flex justify-between text-sm text-slate-600 py-1">
                          <span className="truncate pr-2" title={r.name}>{r.name}</span>
                          <span className="money whitespace-nowrap">{fmtBDT(r.val)}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>

              {/* PAYMENTS SIDE */}
              <div className="p-0 flex flex-col h-full">
                <div className="bg-slate-100/70 py-2 px-4 border-b border-slate-200 flex justify-between font-bold text-slate-700 text-xs uppercase tracking-wider">
                  <span>Payments</span><span>Amount (৳)</span>
                </div>
                
                <div className="p-4 flex-1">
                  <h4 className="font-bold text-xs text-slate-800 mb-2 border-b border-slate-100 pb-1 uppercase">Current Payments</h4>
                  {data.payments.length === 0 ? <p className="text-xs text-slate-400 italic">No payments</p> : 
                    data.payments.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm text-slate-600 py-1">
                        <span className="truncate pr-2" title={p.name}>{p.name}</span>
                        <span className="money whitespace-nowrap">{fmtBDT(p.val)}</span>
                      </div>
                    ))
                  }
                </div>

                <div className="p-4 border-t border-slate-100 mt-auto bg-slate-50/50">
                  <h4 className="font-bold text-xs text-slate-800 mb-2 border-b border-slate-200 pb-1 uppercase">Closing Balances</h4>
                  <div className="flex justify-between text-sm text-slate-600 py-1"><span className="truncate pr-2">Cash in Hand</span><span className="money font-medium whitespace-nowrap">{fmtBDT(data.closingCash)}</span></div>
                  <div className="flex justify-between text-sm text-slate-600 py-1"><span className="truncate pr-2">Cash at Bank</span><span className="money font-medium whitespace-nowrap">{fmtBDT(data.closingBank)}</span></div>
                </div>
              </div>
            </div>

            {/* TOTALS */}
            <div className="grid grid-cols-2 divide-x divide-slate-300 border-t-2 border-slate-300 bg-slate-100">
              <div className="py-3 px-4 flex justify-between font-bold text-slate-800 text-base">
                <span>TOTAL</span><span className="money whitespace-nowrap">{fmtBDT(data.openingCash + data.openingBank + data.totalReceipts)}</span>
              </div>
              <div className="py-3 px-4 flex justify-between font-bold text-slate-800 text-base">
                <span>TOTAL</span><span className="money whitespace-nowrap">{fmtBDT(data.totalPayments + data.closingCash + data.closingBank)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PlaceholderTab({ name }) { 
  return <div className="p-10 text-center text-slate-400 border border-slate-200 border-dashed rounded-xl bg-white shadow-sm break-words">Module <b className="text-slate-600">{name}</b> is active. Ready for multi-tenant data integration.</div> 
}

/* ══════════════════════════════════════════════════════════════════════
   ENTERPRISE REPORT HUB WRAPPER (No External Sidebar, Full Width)
══════════════════════════════════════════════════════════════════════ */
export default function ReportsHub({ tenantId }) {
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeReportId, setActiveReportId] = useState(null)

  const filteredReports = useMemo(() => {
    return TABS.filter(tab => {
      const matchCat = activeCategory === 'All' || tab.group === activeCategory;
      const matchSearch = tab.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          tab.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    })
  }, [activeCategory, searchQuery])

  const activeReport = TABS.find(t => t.id === activeReportId)

  const renderActiveReport = () => {
    switch(activeReportId) {
      case 'receipt_payment': return <ReceiptPaymentStatementTab tenantId={tenantId} />
      default: return <PlaceholderTab name={activeReport?.label} />
    }
  }

  // If tenantId is missing, warn the user at the top level
  if (!tenantId) {
    return (
      <div className="p-8 w-full">
        <Err msg="Configuration Error: Tenant ID is missing. Multi-tenant features disabled." />
      </div>
    )
  }

  return (
    <div className="w-full bg-slate-50/50 min-h-screen font-sans text-slate-900 flex flex-col">
      
      {/* INTERNAL TOP NAVIGATION / FILTER BAR */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="text-blue-600" /> Reporting Hub
          </h1>
          <p className="text-sm text-slate-500 mt-1">Multi-tenant ERP Standards</p>
        </div>

        {!activeReportId && (
          <div className="relative w-full sm:w-80 lg:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search reports..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition w-full"
            />
          </div>
        )}
      </div>

      {/* CATEGORY CHIPS (Replaces Sidebar) */}
      {!activeReportId && (
        <div className="px-6 pt-4 pb-2 w-full overflow-x-auto whitespace-nowrap no-scrollbar border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            {GROUPS.map(group => (
              <button
                key={group}
                onClick={() => setActiveCategory(group)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shrink-0 border ${
                  activeCategory === group 
                    ? 'bg-slate-800 text-white border-slate-800 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {group === 'All' ? <FolderOpen size={16} /> : <Filter size={16} />}
                {group}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* WORKSPACE CONTENT */}
      <div className="p-4 sm:p-6 lg:p-8 flex-1 w-full overflow-x-hidden">
        
        {activeReportId ? (
          // ACTIVE REPORT VIEW
          <div className="w-full max-w-full">
            <div className="flex items-center gap-4 mb-6">
              <button 
                onClick={() => setActiveReportId(null)}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition font-semibold text-sm bg-white border border-slate-200 shadow-sm hover:bg-slate-50 px-4 py-2 rounded-lg shrink-0"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <div className="h-6 w-px bg-slate-300 hidden sm:block"></div>
              <div className="flex flex-wrap items-center gap-2 text-slate-800 min-w-0">
                {activeReport?.icon && <activeReport.icon size={20} className="text-blue-600 shrink-0 hidden sm:block" />}
                <h2 className="font-bold text-lg sm:text-xl truncate">{activeReport?.label}</h2>
                <span className="ml-2 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100 shrink-0">
                  {activeReport?.group}
                </span>
              </div>
            </div>
            
            <div className="w-full">
              {renderActiveReport()}
            </div>
          </div>
        ) : (
          // DASHBOARD GRID VIEW
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            {filteredReports.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <FolderOpen size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No reports matched your criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-full">
                {filteredReports.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <div 
                      key={tab.id}
                      onClick={() => setActiveReportId(tab.id)}
                      className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all group flex flex-col h-full overflow-hidden"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors border border-slate-100 group-hover:border-blue-100">
                          <Icon size={24} className="text-slate-500 group-hover:text-blue-600 transition-colors" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md shrink-0">
                          {tab.group}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-base mb-1.5 group-hover:text-blue-600 transition-colors truncate">{tab.label}</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mt-auto break-words line-clamp-2" title={tab.desc}>
                        {tab.desc}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
