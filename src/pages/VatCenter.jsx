import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, exportXLSX } from '../lib/helpers'
import { FileSpreadsheet, Plus, FileDown, Printer, Trash2, Pencil } from 'lucide-react'
import PrintPortal from '../components/PrintPortal.jsx'
import VdsCertificate from '../components/print/VdsCertificate.jsx'
import ChallanForm from '../tax/ChallanForm'
const TABS = ['Sales 6.2', 'Purchase 6.1', 'VDS 6.6', 'Monthly 9.1', 'Over-threshold 6.10']
const monthBounds = (ym) => { const [y, m] = ym.split('-').map(Number); const start = `${ym}-01`; const end = new Date(y, m, 0); return { start, end: `${ym}-${String(end.getDate()).padStart(2, '0')}` } }
const thisMonth = () => todayISO().slice(0, 7)

export default function VatCenter({ userName, company }) {
  const [tab, setTab] = useState('Sales 6.2')
  const [ym, setYm] = useState(thisMonth())
  const [msg, setMsg] = useState('')
  const [printCert, setPrintCert] = useState(null)
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 5000) }
  return (
    <div className="space-y-5">
      {printCert && (
        <PrintPortal title={`Mushak-6.6 — ${printCert.cert_no || 'VDS'}`} onClose={() => setPrintCert(null)}>
          <VdsCertificate cert={printCert} company={company} />
        </PrintPortal>
      )}      
    <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2"><FileSpreadsheet className="text-forest" /> VAT Center</h1>
          <p className="text-sm text-pine/60">NBR Mushak registers: 6.2 sales, 6.1 purchase, 6.6 VDS, and the 9.1 monthly position.</p>
        </div>
        <div className="flex items-center gap-2"><span className="label !mb-0">Month</span><input type="month" className="input !w-44" value={ym} onChange={(e) => setYm(e.target.value)} /></div>
      </div>
      {msg && <div className="px-4 py-3 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}
      <div className="flex gap-1 border-b border-leaf flex-wrap">
        {TABS.map((t) => (<button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${tab === t ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>{t}</button>))}
      </div>
      {tab === 'Sales 6.2' && <SalesReg ym={ym} company={company} />}
      {tab === 'Purchase 6.1' && <PurchaseReg ym={ym} company={company} />}
      {tab === 'VDS 6.6' && <VdsTab ym={ym} userName={userName} flash={flash} onPrint={setPrintCert} />}
      {tab === 'Monthly 9.1' && <Summary91 ym={ym} />}
      {tab === 'Over-threshold 6.10' && <Mushak610 company={company} />}
    </div>
  )
}

function SalesReg({ ym, company }) {
  const [rows, setRows] = useState([])
  useEffect(() => { const { start, end } = monthBounds(ym); supabase.from('vat_sales_register').select('*').gte('issue_date', start).lte('issue_date', end).order('issue_date').then(({ data }) => setRows((data || []).filter((r) => !r.is_void))) }, [ym])
  const tot = rows.reduce((a, r) => ({ tv: a.tv + +r.taxable_value, sd: a.sd + +r.sd, vat: a.vat + +r.vat, total: a.total + +r.total }), { tv: 0, sd: 0, vat: 0, total: 0 })
  const xls = () => exportXLSX(`Mushak_6.2_${ym}.xlsx`, [{ name: '6.2 Sales', rows: [[`${company?.name || ''} — Mushak-6.2 Sales Register`], [`Month: ${ym}`, `BIN: ${company?.bin || ''}`], [], ['Date', 'Invoice', 'Buyer', 'Buyer BIN', 'Taxable Value', 'SD', 'VAT', 'Total'], ...rows.map((r) => [r.issue_date, r.invoice_no, r.buyer_name, r.buyer_bin, +r.taxable_value, +r.sd, +r.vat, +r.total]), [], ['', '', '', 'TOTAL', tot.tv, tot.sd, tot.vat, tot.total]] }])
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-leaf flex items-center justify-between"><span className="font-display font-semibold text-pine">Sales Register (Mushak-6.2) — voided invoices excluded</span><button className="btn-ghost !py-1" onClick={xls}><FileDown size={14} /> Excel</button></div>
      <table className="w-full">
        <thead><tr><th className="th">Date</th><th className="th">Invoice</th><th className="th">Buyer</th><th className="th text-right">Taxable</th><th className="th text-right">SD</th><th className="th text-right">VAT</th><th className="th text-right">Total</th></tr></thead>
        <tbody>
          {rows.map((r) => (<tr key={r.id}><td className="td money text-xs">{fmtDate(r.issue_date)}</td><td className="td money text-xs">{r.invoice_no}</td><td className="td text-sm">{r.buyer_name || '—'}</td><td className="td money text-right">{(+r.taxable_value).toFixed(2)}</td><td className="td money text-right">{(+r.sd).toFixed(2)}</td><td className="td money text-right">{(+r.vat).toFixed(2)}</td><td className="td money text-right font-semibold">{(+r.total).toFixed(2)}</td></tr>))}
          {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={7}>No sales this month.</td></tr>}
        </tbody>
        <tfoot><tr className="bg-leaf/40 font-bold money"><td className="td" colSpan={3}>TOTAL</td><td className="td text-right">{tot.tv.toFixed(2)}</td><td className="td text-right">{tot.sd.toFixed(2)}</td><td className="td text-right">{tot.vat.toFixed(2)}</td><td className="td text-right">{tot.total.toFixed(2)}</td></tr></tfoot>
      </table>
    </div>
  )
}

function PurchaseReg({ ym, company }) {
  const [rows, setRows] = useState([])
  useEffect(() => { const { start, end } = monthBounds(ym); supabase.from('vat_purchase_register').select('*').gte('entry_date', start).lte('entry_date', end).order('entry_date').then(({ data }) => setRows(data || [])) }, [ym])
  const tot = rows.reduce((a, r) => ({ tv: a.tv + +r.taxable_value, vat: a.vat + +r.vat_amount, reb: a.reb + (r.rebateable ? +r.vat_amount : 0), total: a.total + +r.total }), { tv: 0, vat: 0, reb: 0, total: 0 })
  const xls = () => exportXLSX(`Mushak_6.1_${ym}.xlsx`, [{ name: '6.1 Purchase', rows: [[`${company?.name || ''} — Mushak-6.1 Purchase Register`], [`Month: ${ym}`], [], ['Date', 'Vendor', 'Vendor BIN', 'Invoice', 'Taxable Value', 'VAT', 'Rebateable', 'Total'], ...rows.map((r) => [r.entry_date, r.vendor_name, r.vendor_bin, r.invoice_no, +r.taxable_value, +r.vat_amount, r.rebateable ? 'Yes' : 'No', +r.total]), [], ['', '', '', 'TOTAL', tot.tv, tot.vat, `Rebateable ${tot.reb.toFixed(2)}`, tot.total]] }])
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-leaf flex items-center justify-between"><span className="font-display font-semibold text-pine">Purchase Register (Mushak-6.1)</span><button className="btn-ghost !py-1" onClick={xls}><FileDown size={14} /> Excel</button></div>
      <table className="w-full">
        <thead><tr><th className="th">Date</th><th className="th">Vendor</th><th className="th">Invoice</th><th className="th text-right">Taxable</th><th className="th text-right">VAT</th><th className="th">Rebate</th><th className="th text-right">Total</th></tr></thead>
        <tbody>
          {rows.map((r) => (<tr key={r.id}><td className="td money text-xs">{fmtDate(r.entry_date)}</td><td className="td text-sm">{r.vendor_name || '—'}</td><td className="td money text-xs">{r.invoice_no || '—'}</td><td className="td money text-right">{(+r.taxable_value).toFixed(2)}</td><td className="td money text-right">{(+r.vat_amount).toFixed(2)}</td><td className="td text-xs">{r.rebateable ? 'Yes' : 'No'}</td><td className="td money text-right font-semibold">{(+r.total).toFixed(2)}</td></tr>))}
          {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={7}>No purchases this month.</td></tr>}
        </tbody>
        <tfoot><tr className="bg-leaf/40 font-bold money"><td className="td" colSpan={3}>TOTAL · Rebateable VAT {tot.reb.toFixed(2)}</td><td className="td text-right">{tot.tv.toFixed(2)}</td><td className="td text-right">{tot.vat.toFixed(2)}</td><td className="td"></td><td className="td text-right">{tot.total.toFixed(2)}</td></tr></tfoot>
      </table>
    </div>
  )
}

function VdsTab({ ym, userName, flash, onPrint }) {
  const [rows, setRows] = useState([])
  const [editId, setEditId] = useState(null)
  const blank = { direction: 'RECEIVED', cert_no: '', cert_date: todayISO(), party_name: '', party_bin: '', base_amount: '', vds_rate: '', challan_no: '', challan_date: '' }
  const [f, setF] = useState(blank)
  const load = () => { const { start, end } = monthBounds(ym); supabase.from('vds_certificates').select('*').gte('cert_date', start).lte('cert_date', end).order('cert_date', { ascending: false }).then(({ data }) => setRows(data || [])) }
  useEffect(() => { load() }, [ym])

  const save = async () => {
    if (!f.base_amount) { flash('Enter base amount.'); return }
    const vds_amount = +(+f.base_amount * (+f.vds_rate || 0) / 100).toFixed(2)
    const payload = { ...f, base_amount: +f.base_amount, vds_rate: +f.vds_rate || 0, vds_amount, challan_date: f.challan_date || null }
    if (editId) {
      const { error } = await supabase.from('vds_certificates').update(payload).eq('id', editId)
      if (error) { flash(error.message); return }
      flash('VDS certificate updated.')
    } else {
      const { error } = await supabase.from('vds_certificates').insert({ ...payload, created_by: userName })
      if (error) { flash(error.message); return }
    }
    setF(blank); setEditId(null); load()
  }
  const edit = (r) => { setEditId(r.id); setF({ direction: r.direction, cert_no: r.cert_no || '', cert_date: r.cert_date, party_name: r.party_name || '', party_bin: r.party_bin || '', base_amount: r.base_amount, vds_rate: r.vds_rate, challan_no: r.challan_no || '', challan_date: r.challan_date || '' }) }
  const del = async (id) => {
    if (!window.confirm('Delete this VDS certificate? This cannot be undone.')) return
    const { error } = await supabase.from('vds_certificates').delete().eq('id', id)
    if (error) flash(error.message); else { if (editId === id) { setF(blank); setEditId(null) } load() }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-4 gap-2">
        <select className="input" value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}><option value="RECEIVED">VDS Received (we are supplier)</option><option value="ISSUED">VDS Issued (we withheld)</option></select>
        <input className="input money" placeholder="Certificate no" value={f.cert_no} onChange={(e) => setF({ ...f, cert_no: e.target.value })} />
        <input type="date" className="input" value={f.cert_date} onChange={(e) => setF({ ...f, cert_date: e.target.value })} />
        <input className="input" placeholder="Party name" value={f.party_name} onChange={(e) => setF({ ...f, party_name: e.target.value })} />
        <input className="input money" placeholder="Party BIN" value={f.party_bin} onChange={(e) => setF({ ...f, party_bin: e.target.value })} />
        <input type="number" className="input money" placeholder="Base amount" value={f.base_amount} onChange={(e) => setF({ ...f, base_amount: e.target.value })} />
        <input type="number" className="input money" placeholder="VDS rate %" value={f.vds_rate} onChange={(e) => setF({ ...f, vds_rate: e.target.value })} />
        <input className="input money" placeholder="Challan no" value={f.challan_no} onChange={(e) => setF({ ...f, challan_no: e.target.value })} />
        <input type="date" className="input" placeholder="Challan date" value={f.challan_date} onChange={(e) => setF({ ...f, challan_date: e.target.value })} />
        <button className="btn-primary justify-center col-span-3" onClick={save}><Plus size={15} /> {editId ? 'Update certificate' : 'Add VDS certificate'}</button>
        {editId && <button className="btn-ghost justify-center" onClick={() => { setF(blank); setEditId(null) }}>Cancel edit</button>}
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Date</th><th className="th">Dir</th><th className="th">Cert</th><th className="th">Party</th><th className="th text-right">Base</th><th className="th text-right">Rate</th><th className="th text-right">VDS</th><th className="th">Challan</th><th className="th text-right">Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="td money text-xs">{fmtDate(r.cert_date)}</td>
                <td className="td text-xs">{r.direction}</td>
                <td className="td money text-xs">{r.cert_no || '—'}</td>
                <td className="td text-sm">{r.party_name || '—'}</td>
                <td className="td money text-right">{(+r.base_amount).toFixed(2)}</td>
                <td className="td money text-right">{(+r.vds_rate).toFixed(1)}%</td>
                <td className="td money text-right font-semibold">{(+r.vds_amount).toFixed(2)}</td>
                <td className="td money text-xs">{r.challan_no || '—'}</td>
                <td className="td">
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost !py-1" title="Print Mushak-6.6" onClick={() => onPrint(r)}><Printer size={13} /></button>
                    <button className="btn-ghost !py-1" title="Edit" onClick={() => edit(r)}><Pencil size={13} /></button>
                    <button className="btn-ghost !py-1 text-red-600" title="Delete" onClick={() => del(r.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={9}>No VDS certificates this month.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Summary91({ ym }) {
  const [d, setD] = useState(null)
  useEffect(() => {
    const { start, end } = monthBounds(ym)
    Promise.all([
      supabase.from('vat_sales_register').select('vat,sd,is_void').gte('issue_date', start).lte('issue_date', end),
      supabase.from('vat_purchase_register').select('vat_amount,rebateable').gte('entry_date', start).lte('entry_date', end),
      supabase.from('vds_certificates').select('vds_amount,direction').gte('cert_date', start).lte('cert_date', end),
    ]).then(([s, p, v]) => {
      const outVat = (s.data || []).filter((r) => !r.is_void).reduce((a, r) => a + +r.vat, 0)
      const outSd = (s.data || []).filter((r) => !r.is_void).reduce((a, r) => a + +r.sd, 0)
      const inVat = (p.data || []).filter((r) => r.rebateable).reduce((a, r) => a + +r.vat_amount, 0)
      const vdsRecv = (v.data || []).filter((r) => r.direction === 'RECEIVED').reduce((a, r) => a + +r.vds_amount, 0)
      setD({ outVat, outSd, inVat, vdsRecv, net: +(outVat - inVat - vdsRecv).toFixed(2) })
    })
  }, [ym])
  if (!d) return <div className="text-pine/50">Loading…</div>
  const Row = ({ label, val, strong, sign }) => (<div className={`flex justify-between py-2 border-b border-leaf/60 ${strong ? 'font-bold text-base' : 'text-sm'}`}><span>{label}</span><span className={`money ${sign === '-' ? 'text-red-600' : ''}`}>{sign === '-' ? '− ' : ''}{fmtBDT(val)}</span></div>)
  return (
    <div className="card p-6 max-w-xl">
      <h3 className="font-display font-semibold text-pine mb-3">Monthly VAT position (Mushak-9.1 basis) — {ym}</h3>
      <Row label="Output VAT on sales (6.2)" val={d.outVat} />
      <Row label="Rebateable input VAT on purchases (6.1)" val={d.inVat} sign="-" />
      <Row label="VDS received against our supplies (6.6)" val={d.vdsRecv} sign="-" />
      <Row label="Net VAT payable to treasury" val={d.net} strong />
      <p className="text-xs text-pine/50 mt-3">Supplementary Duty collected this month: <span className="money">{fmtBDT(d.outSd)}</span> (payable separately). This is an indicative working — confirm against your filed 9.1 return.</p>
    </div>
  )
}

function Mushak610({ company }) {
  const [rows, setRows] = useState([])
  useEffect(() => { supabase.from('v_mushak_610').select('*').order('issue_date', { ascending: false }).then(({ data }) => setRows((data || []).filter((r) => !r.is_void))) }, [])
  const threshold = company?.mushak610_threshold || 200000
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-leaf font-display font-semibold text-pine">Over-threshold tax invoices (Mushak-6.10 trigger) — ≥ {fmtBDT(threshold)}</div>
      <table className="w-full">
        <thead><tr><th className="th">Date</th><th className="th">Invoice</th><th className="th">Buyer</th><th className="th">Buyer BIN</th><th className="th text-right">Grand total</th></tr></thead>
        <tbody>
          {rows.map((r) => (<tr key={r.id}><td className="td money text-xs">{fmtDate(r.issue_date)}</td><td className="td money text-xs">{r.invoice_no}</td><td className="td text-sm">{r.buyer_name || '—'}</td><td className="td money text-xs">{r.buyer_bin || '—'}</td><td className="td money text-right font-semibold">{fmtBDT(r.grand_total)}</td></tr>))}
          {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={5}>No invoices over the threshold.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
