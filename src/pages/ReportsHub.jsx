import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, exportXLSX } from '../lib/helpers'
import { BarChart3, FileDown, Printer, CalendarRange } from 'lucide-react'
import PrintPortal from '../components/PrintPortal.jsx'

const TABS = ['Revenue', 'VAT Sales (6.3)', 'VAT Purchase', 'Collections', 'Trial Balance']

function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }

export default function ReportsHub({ userName }) {
  const [tab, setTab] = useState('Revenue')
  const [company, setCompany] = useState(null)
  useEffect(() => { supabase.from('company_settings').select('*').eq('id', 1).single().then(({ data }) => setCompany(data)) }, [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2"><BarChart3 className="text-forest" /> Reports</h1>
        <p className="text-sm text-pine/60">Pick a report, choose a date range, then print to A4 or export to Excel.</p>
      </div>
      <div className="flex gap-1 border-b border-leaf flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${tab === t ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Revenue' && <RevenueReport company={company} />}
      {tab === 'VAT Sales (6.3)' && <VatSalesReport company={company} />}
      {tab === 'VAT Purchase' && <VatPurchaseReport company={company} />}
      {tab === 'Collections' && <CollectionsReport company={company} />}
      {tab === 'Trial Balance' && <TrialBalanceReport company={company} />}
    </div>
  )
}

/* ---- shared range bar ---- */
function RangeBar({ from, to, setFrom, setTo, onRun, onXls, onPrint }) {
  return (
    <div className="card p-4 flex items-end gap-3 flex-wrap">
      <div><label className="label">From</label><input type="date" className="input !w-44" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div><label className="label">To</label><input type="date" className="input !w-44" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      <button className="btn-primary" onClick={onRun}><CalendarRange size={15} /> Run</button>
      <div className="flex-1" />
      {onXls && <button className="btn-ghost" onClick={onXls}><FileDown size={14} /> Excel</button>}
      {onPrint && <button className="btn-ghost" onClick={onPrint}><Printer size={14} /> Print</button>}
    </div>
  )
}

function ReportHead({ company, title, from, to }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#000' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #1B4D2E', paddingBottom: 8, marginBottom: 10 }}>
        {company?.logo_url && <img src={company.logo_url} alt="" style={{ height: 46, objectFit: 'contain', marginBottom: 4 }} />}
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Fraunces, serif', color: '#1B4D2E' }}>{company?.name || 'Resort'}</div>
        <div style={{ fontSize: 10 }}>{company?.address}{company?.bin ? ` · BIN: ${company.bin}` : ''}</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, textDecoration: 'underline' }}>{title}</div>
        <div style={{ fontSize: 10 }}>Period: {fmtDate(from)} — {fmtDate(to)}</div>
      </div>
    </div>
  )
}

/* ---------------- REVENUE (accrual, from folio) ---------------- */
function RevenueReport({ company }) {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState([])
  const [printing, setPrinting] = useState(false)

  const run = async () => {
    const { data: fc } = await supabase.from('folio_charges').select('*').gte('charge_date', from).lte('charge_date', to)
    const agg = {}
    const add = (t, net, sc, sd, vat, total) => { const r = agg[t] || { net: 0, sc: 0, sd: 0, vat: 0, total: 0 }; r.net += net; r.sc += sc; r.sd += sd; r.vat += vat; r.total += total; agg[t] = r }
    for (const c of fc || []) add(c.charge_type, +c.base_amount - +c.discount, +c.service_charge, +c.sd, +c.vat, +c.total)
    setRows(Object.entries(agg).map(([type, v]) => ({ type, ...v })))
  }
  useEffect(() => { run() }, []) // eslint-disable-line

  const tot = rows.reduce((a, r) => ({ net: a.net + r.net, sc: a.sc + r.sc, sd: a.sd + r.sd, vat: a.vat + r.vat, total: a.total + r.total }), { net: 0, sc: 0, sd: 0, vat: 0, total: 0 })
  const xls = () => exportXLSX(`Revenue_${from}_${to}.xlsx`, [{ name: 'Revenue', rows: [['Revenue Report', `${from} to ${to}`], [], ['Head', 'Net', 'Service Charge', 'SD', 'VAT', 'Total'], ...rows.map((r) => [r.type, r.net, r.sc, r.sd, r.vat, r.total]), ['TOTAL', tot.net, tot.sc, tot.sd, tot.vat, tot.total]] }])

  return (
    <div className="space-y-4">
      <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} onXls={xls} onPrint={() => setPrinting(true)} />
      {printing && (
        <PrintPortal title="Revenue Report" onClose={() => setPrinting(false)}>
          <ReportHead company={company} title="REVENUE REPORT (Accrual)" from={from} to={to} />
          <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 720, margin: '0 auto' }}>
            <thead><tr style={{ background: '#eee' }}>{['Head', 'Net', 'SC', 'SD', 'VAT', 'Total'].map((h, i) => <th key={h} style={{ border: '1px solid #000', padding: '5px 8px', fontSize: 11, textAlign: i ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => <tr key={r.type}><td style={{ border: '1px solid #000', padding: '5px 8px', fontSize: 11 }}>{r.type}</td>{['net', 'sc', 'sd', 'vat', 'total'].map((k) => <td key={k} style={{ border: '1px solid #000', padding: '5px 8px', fontSize: 11, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }}>{fmtBDT(r[k])}</td>)}</tr>)}
            </tbody>
            <tfoot><tr style={{ fontWeight: 700, background: '#f5f5f5' }}><td style={{ border: '1px solid #000', padding: '5px 8px', fontSize: 11 }}>TOTAL</td>{['net', 'sc', 'sd', 'vat', 'total'].map((k) => <td key={k} style={{ border: '1px solid #000', padding: '5px 8px', fontSize: 11, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }}>{fmtBDT(tot[k])}</td>)}</tr></tfoot>
          </table>
        </PrintPortal>
      )}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Revenue head</th><th className="th text-right">Net</th><th className="th text-right">SC</th><th className="th text-right">SD</th><th className="th text-right">VAT</th><th className="th text-right">Total</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.type}><td className="td">{r.type}</td><td className="td money text-right">{r.net.toFixed(2)}</td><td className="td money text-right">{r.sc.toFixed(2)}</td><td className="td money text-right">{r.sd.toFixed(2)}</td><td className="td money text-right">{r.vat.toFixed(2)}</td><td className="td money text-right font-semibold">{r.total.toFixed(2)}</td></tr>)}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={6}>No revenue in this period.</td></tr>}
          </tbody>
          <tfoot><tr className="bg-leaf/40 font-bold money"><td className="td">TOTAL</td><td className="td text-right">{tot.net.toFixed(2)}</td><td className="td text-right">{tot.sc.toFixed(2)}</td><td className="td text-right">{tot.sd.toFixed(2)}</td><td className="td text-right">{tot.vat.toFixed(2)}</td><td className="td text-right">{tot.total.toFixed(2)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  )
}

/* ---------------- VAT SALES REGISTER (Mushak 6.3 source) ---------------- */
function VatSalesReport({ company }) {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState([])
  const [printing, setPrinting] = useState(false)
  const run = async () => { const { data } = await supabase.from('vat_sales_register').select('*').eq('is_void', false).gte('issue_date', from).lte('issue_date', to).order('issue_date'); setRows(data || []) }
  useEffect(() => { run() }, []) // eslint-disable-line
  const tot = rows.reduce((a, r) => ({ tv: a.tv + +r.taxable_value, sd: a.sd + +r.sd, vat: a.vat + +r.vat, total: a.total + +r.total }), { tv: 0, sd: 0, vat: 0, total: 0 })
  const xls = () => exportXLSX(`VAT_Sales_${from}_${to}.xlsx`, [{ name: 'VAT Sales', rows: [['VAT Sales Register (Mushak 6.3)', `${from} to ${to}`], [], ['Date', 'Invoice', 'Buyer', 'BIN', 'Taxable', 'SD', 'VAT', 'Total'], ...rows.map((r) => [r.issue_date, r.invoice_no, r.buyer_name, r.buyer_bin, +r.taxable_value, +r.sd, +r.vat, +r.total]), ['', '', '', 'TOTAL', tot.tv, tot.sd, tot.vat, tot.total]] }])
  return (
    <div className="space-y-4">
      <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} onXls={xls} onPrint={() => setPrinting(true)} />
      {printing && (
        <PrintPortal title="VAT Sales Register" onClose={() => setPrinting(false)}>
          <ReportHead company={company} title="VAT SALES REGISTER (মূসক-৬.৩)" from={from} to={to} />
          <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 720, margin: '0 auto' }}>
            <thead><tr style={{ background: '#eee' }}>{['Date', 'Invoice', 'Buyer', 'Taxable', 'SD', 'VAT', 'Total'].map((h, i) => <th key={h} style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: i > 2 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id}><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10 }}>{fmtDate(r.issue_date)}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10 }}>{r.invoice_no}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10 }}>{r.buyer_name || '—'}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>{fmtBDT(r.taxable_value)}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>{fmtBDT(r.sd)}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>{fmtBDT(r.vat)}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>{fmtBDT(r.total)}</td></tr>)}</tbody>
            <tfoot><tr style={{ fontWeight: 700, background: '#f5f5f5' }}><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10 }} colSpan={3}>TOTAL</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>{fmtBDT(tot.tv)}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>{fmtBDT(tot.sd)}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>{fmtBDT(tot.vat)}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>{fmtBDT(tot.total)}</td></tr></tfoot>
          </table>
        </PrintPortal>
      )}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Date</th><th className="th">Invoice</th><th className="th">Buyer</th><th className="th text-right">Taxable</th><th className="th text-right">SD</th><th className="th text-right">VAT</th><th className="th text-right">Total</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.id}><td className="td text-xs">{fmtDate(r.issue_date)}</td><td className="td money text-xs">{r.invoice_no}</td><td className="td text-sm">{r.buyer_name || '—'}</td><td className="td money text-right">{(+r.taxable_value).toFixed(2)}</td><td className="td money text-right">{(+r.sd).toFixed(2)}</td><td className="td money text-right">{(+r.vat).toFixed(2)}</td><td className="td money text-right font-semibold">{(+r.total).toFixed(2)}</td></tr>)}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={7}>No sales in this period.</td></tr>}
          </tbody>
          <tfoot><tr className="bg-leaf/40 font-bold money"><td className="td" colSpan={3}>TOTAL</td><td className="td text-right">{tot.tv.toFixed(2)}</td><td className="td text-right">{tot.sd.toFixed(2)}</td><td className="td text-right">{tot.vat.toFixed(2)}</td><td className="td text-right">{tot.total.toFixed(2)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  )
}

/* ---------------- VAT PURCHASE REGISTER ---------------- */
function VatPurchaseReport({ company }) {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState([])
  const [printing, setPrinting] = useState(false)
  const run = async () => { const { data } = await supabase.from('vat_purchase_register').select('*').gte('entry_date', from).lte('entry_date', to).order('entry_date'); setRows(data || []) }
  useEffect(() => { run() }, []) // eslint-disable-line
  const tot = rows.reduce((a, r) => ({ tv: a.tv + +r.taxable_value, vat: a.vat + +r.vat_amount, total: a.total + +r.total }), { tv: 0, vat: 0, total: 0 })
  const xls = () => exportXLSX(`VAT_Purchase_${from}_${to}.xlsx`, [{ name: 'VAT Purchase', rows: [['VAT Purchase Register', `${from} to ${to}`], [], ['Date', 'Vendor', 'BIN', 'Invoice', 'Taxable', 'VAT', 'Total', 'Rebateable'], ...rows.map((r) => [r.entry_date, r.vendor_name, r.vendor_bin, r.invoice_no, +r.taxable_value, +r.vat_amount, +r.total, r.rebateable ? 'Yes' : 'No']), ['', '', '', 'TOTAL', tot.tv, tot.vat, tot.total, '']] }])
  return (
    <div className="space-y-4">
      <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} onXls={xls} onPrint={() => setPrinting(true)} />
      {printing && (
        <PrintPortal title="VAT Purchase Register" onClose={() => setPrinting(false)}>
          <ReportHead company={company} title="VAT PURCHASE REGISTER" from={from} to={to} />
          <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 720, margin: '0 auto' }}>
            <thead><tr style={{ background: '#eee' }}>{['Date', 'Vendor', 'Invoice', 'Taxable', 'VAT', 'Total'].map((h, i) => <th key={h} style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: i > 2 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id}><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10 }}>{fmtDate(r.entry_date)}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10 }}>{r.vendor_name || '—'}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10 }}>{r.invoice_no || '—'}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>{fmtBDT(r.taxable_value)}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>{fmtBDT(r.vat_amount)}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>{fmtBDT(r.total)}</td></tr>)}</tbody>
            <tfoot><tr style={{ fontWeight: 700, background: '#f5f5f5' }}><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10 }} colSpan={3}>TOTAL</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>{fmtBDT(tot.tv)}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>{fmtBDT(tot.vat)}</td><td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>{fmtBDT(tot.total)}</td></tr></tfoot>
          </table>
        </PrintPortal>
      )}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Date</th><th className="th">Vendor</th><th className="th">Invoice</th><th className="th text-right">Taxable</th><th className="th text-right">VAT</th><th className="th text-right">Total</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.id}><td className="td text-xs">{fmtDate(r.entry_date)}</td><td className="td text-sm">{r.vendor_name || '—'}</td><td className="td money text-xs">{r.invoice_no || '—'}</td><td className="td money text-right">{(+r.taxable_value).toFixed(2)}</td><td className="td money text-right">{(+r.vat_amount).toFixed(2)}</td><td className="td money text-right font-semibold">{(+r.total).toFixed(2)}</td></tr>)}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={6}>No purchases in this period.</td></tr>}
          </tbody>
          <tfoot><tr className="bg-leaf/40 font-bold money"><td className="td" colSpan={3}>TOTAL</td><td className="td text-right">{tot.tv.toFixed(2)}</td><td className="td text-right">{tot.vat.toFixed(2)}</td><td className="td text-right">{tot.total.toFixed(2)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  )
}

/* ---------------- COLLECTIONS (cash basis, by method) ---------------- */
function CollectionsReport({ company }) {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState([])
  const [printing, setPrinting] = useState(false)
  const run = async () => {
    const { data } = await supabase.from('payments').select('*').gte('received_date', from).lte('received_date', to)
    const agg = {}
    for (const p of data || []) agg[p.method] = (agg[p.method] || 0) + +p.amount
    setRows(Object.entries(agg).map(([method, amount]) => ({ method, amount })))
  }
  useEffect(() => { run() }, []) // eslint-disable-line
  const tot = rows.reduce((a, r) => a + r.amount, 0)
  const xls = () => exportXLSX(`Collections_${from}_${to}.xlsx`, [{ name: 'Collections', rows: [['Collections Report', `${from} to ${to}`], [], ['Method', 'Amount'], ...rows.map((r) => [r.method, r.amount]), ['TOTAL', tot]] }])
  return (
    <div className="space-y-4">
      <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} onXls={xls} onPrint={() => setPrinting(true)} />
      {printing && (
        <PrintPortal title="Collections Report" onClose={() => setPrinting(false)}>
          <ReportHead company={company} title="COLLECTIONS REPORT (Cash basis)" from={from} to={to} />
          <table style={{ width: '60%', borderCollapse: 'collapse', margin: '0 auto' }}>
            <thead><tr style={{ background: '#eee' }}><th style={{ border: '1px solid #000', padding: '5px 8px', fontSize: 11, textAlign: 'left' }}>Method</th><th style={{ border: '1px solid #000', padding: '5px 8px', fontSize: 11, textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.method}><td style={{ border: '1px solid #000', padding: '5px 8px', fontSize: 11 }}>{r.method}</td><td style={{ border: '1px solid #000', padding: '5px 8px', fontSize: 11, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }}>{fmtBDT(r.amount)}</td></tr>)}</tbody>
            <tfoot><tr style={{ fontWeight: 700, background: '#f5f5f5' }}><td style={{ border: '1px solid #000', padding: '5px 8px', fontSize: 11 }}>TOTAL</td><td style={{ border: '1px solid #000', padding: '5px 8px', fontSize: 11, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }}>{fmtBDT(tot)}</td></tr></tfoot>
          </table>
        </PrintPortal>
      )}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Method</th><th className="th text-right">Amount</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.method}><td className="td">{r.method}</td><td className="td money text-right font-semibold">{fmtBDT(r.amount)}</td></tr>)}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={2}>No collections in this period.</td></tr>}
          </tbody>
          <tfoot><tr className="bg-leaf/40 font-bold money"><td className="td">TOTAL</td><td className="td text-right">{fmtBDT(tot)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  )
}

/* ---------------- TRIAL BALANCE ---------------- */
function TrialBalanceReport({ company }) {
  const [rows, setRows] = useState([])
  const [printing, setPrinting] = useState(false)
  useEffect(() => { supabase.from('v_trial_balance').select('*').then(({ data }) => setRows(data || [])) }, [])
  const tot = rows.reduce((a, r) => ({ d: a.d + +r.total_debit, c: a.c + +r.total_credit }), { d: 0, c: 0 })
  const xls = () => exportXLSX('Trial_Balance.xlsx', [{ name: 'Trial Balance', rows: [['Trial Balance', fmtDate(todayISO())], [], ['Code', 'Account', 'Type', 'Debit', 'Credit', 'Balance'], ...rows.map((r) => [r.code, r.name, r.type, +r.total_debit, +r.total_credit, +r.balance]), ['', 'TOTAL', '', tot.d, tot.c, '']] }])
  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-end gap-2">
        <button className="btn-ghost" onClick={xls}><FileDown size={14} /> Excel</button>
        <button className="btn-ghost" onClick={() => setPrinting(true)}><Printer size={14} /> Print</button>
      </div>
      {printing && (
        <PrintPortal title="Trial Balance" onClose={() => setPrinting(false)}>
          <ReportHead company={company} title="TRIAL BALANCE" from={todayISO()} to={todayISO()} />
          <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 720, margin: '0 auto' }}>
            <thead><tr style={{ background: '#eee' }}>{['Code', 'Account', 'Debit', 'Credit', 'Balance'].map((h, i) => <th key={h} style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5, textAlign: i > 1 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => <tr key={r.code}><td style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5 }}>{r.code}</td><td style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5 }}>{r.name}</td><td style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5, textAlign: 'right' }}>{fmtBDT(r.total_debit)}</td><td style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5, textAlign: 'right' }}>{fmtBDT(r.total_credit)}</td><td style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5, textAlign: 'right' }}>{fmtBDT(r.balance)}</td></tr>)}</tbody>
            <tfoot><tr style={{ fontWeight: 700, background: '#f5f5f5' }}><td style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5 }} colSpan={2}>TOTAL</td><td style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5, textAlign: 'right' }}>{fmtBDT(tot.d)}</td><td style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5, textAlign: 'right' }}>{fmtBDT(tot.c)}</td><td style={{ border: '1px solid #000', padding: '4px 8px' }}></td></tr></tfoot>
          </table>
        </PrintPortal>
      )}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Code</th><th className="th">Account</th><th className="th">Type</th><th className="th text-right">Debit</th><th className="th text-right">Credit</th><th className="th text-right">Balance</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.code}><td className="td money text-xs">{r.code}</td><td className="td text-sm">{r.name}</td><td className="td text-xs">{r.type}</td><td className="td money text-right">{(+r.total_debit).toFixed(2)}</td><td className="td money text-right">{(+r.total_credit).toFixed(2)}</td><td className="td money text-right font-semibold">{(+r.balance).toFixed(2)}</td></tr>)}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={6}>No postings yet.</td></tr>}
          </tbody>
          <tfoot><tr className="bg-leaf/40 font-bold money"><td className="td" colSpan={3}>TOTAL</td><td className="td text-right">{tot.d.toFixed(2)}</td><td className="td text-right">{tot.c.toFixed(2)}</td><td className="td"></td></tr></tfoot>
        </table>
      </div>
    </div>
  )
}
