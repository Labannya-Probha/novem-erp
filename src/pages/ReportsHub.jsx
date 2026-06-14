import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, exportXLSX } from '../lib/helpers'
import { BarChart3, FileDown, Printer, CalendarRange, ChevronLeft, Lock, Search } from 'lucide-react'
import PrintPortal from '../components/PrintPortal.jsx'

const CYCLES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'Date Range']
function cycleRange(cycle, anchorISO) {
  const a = new Date((anchorISO || todayISO()) + 'T00:00:00')
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  let from = new Date(a), to = new Date(a)
  switch (cycle) {
    case 'Daily': break
    case 'Weekly': { const dow = (a.getDay() + 6) % 7; from = new Date(a); from.setDate(a.getDate() - dow); to = new Date(from); to.setDate(from.getDate() + 6); break }
    case 'Monthly': from = new Date(a.getFullYear(), a.getMonth(), 1); to = new Date(a.getFullYear(), a.getMonth() + 1, 0); break
    case 'Quarterly': { const q = Math.floor(a.getMonth() / 3); from = new Date(a.getFullYear(), q * 3, 1); to = new Date(a.getFullYear(), q * 3 + 3, 0); break }
    case 'Half-Yearly': { const h = a.getMonth() < 6 ? 0 : 6; from = new Date(a.getFullYear(), h, 1); to = new Date(a.getFullYear(), h + 6, 0); break }
    case 'Yearly': from = new Date(a.getFullYear(), 0, 1); to = new Date(a.getFullYear(), 11, 31); break
    default: break
  }
  return { from: iso(from), to: iso(to) }
}

export default function ReportsHub({ userName }) {
  const [defs, setDefs] = useState([])
  const [company, setCompany] = useState(null)
  const [active, setActive] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    supabase.from('report_definitions').select('*').order('sort_order').then(({ data }) => setDefs(data || []))
    supabase.from('company_settings').select('*').eq('id', 1).single().then(({ data }) => setCompany(data))
  }, [])

  if (active) return <ReportRunner def={active} company={company} back={() => setActive(null)} />

  const filtered = defs.filter((d) => (d.report_name + ' ' + d.department).toLowerCase().includes(q.toLowerCase()))
  const groups = filtered.reduce((acc, d) => { (acc[d.department] = acc[d.department] || []).push(d); return acc }, {})
  const readyCount = defs.filter((d) => d.status === 'READY').length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2"><BarChart3 className="text-forest" /> Report Center</h1>
        <p className="text-sm text-pine/60">{defs.length} reports · {readyCount} ready. Pick a report, choose a cycle, then print or export.</p>
      </div>
      <div className="card p-3 flex items-center gap-2">
        <Search size={16} className="text-pine/40" />
        <input className="input !border-0 !ring-0 flex-1" placeholder="Search reports…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {Object.entries(groups).map(([dept, list]) => (
        <div key={dept} className="space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-pine/40 font-semibold">{dept}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {list.map((d) => (
              <button key={d.id} disabled={d.status !== 'READY'} onClick={() => setActive(d)}
                className={`card p-3 text-left flex items-center justify-between gap-2 ${d.status === 'READY' ? 'hover:border-forest hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}>
                <span className="text-sm font-medium text-pine">{d.report_name}</span>
                {d.status === 'READY'
                  ? <span className="status-chip bg-forest/15 text-forest shrink-0">Open</span>
                  : <span className="status-chip bg-stone-200 text-stone-500 shrink-0 flex items-center gap-1"><Lock size={10} /> Soon</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <p className="text-sm text-pine/40">No report matches.</p>}
    </div>
  )
}

function ReportRunner({ def, company, back }) {
  const [cycle, setCycle] = useState('Monthly')
  const [anchor, setAnchor] = useState(todayISO())
  const [from, setFrom] = useState(cycleRange('Monthly', todayISO()).from)
  const [to, setTo] = useState(cycleRange('Monthly', todayISO()).to)
  const [printing, setPrinting] = useState(false)
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)

  const applyCycle = (c, anc) => { if (c !== 'Date Range') { const r = cycleRange(c, anc); setFrom(r.from); setTo(r.to) } }
  const onCycle = (c) => { setCycle(c); applyCycle(c, anchor) }
  const onAnchor = (v) => { setAnchor(v); applyCycle(cycle, v) }

  const run = async () => { setBusy(true); const res = await fetchReport(def.report_key, from, to); setData(res); setBusy(false) }
  useEffect(() => { run() }, []) // eslint-disable-line

  const xls = () => {
    if (!data) return
    const sheetRows = [[def.report_name, `${from} to ${to}`], [], data.head, ...data.rows]
    if (data.foot) sheetRows.push(data.foot)
    exportXLSX(`${def.report_key}_${from}_${to}.xlsx`, [{ name: def.report_name.slice(0, 28), rows: sheetRows }])
  }

  return (
    <div className="space-y-4">
      <button className="btn-ghost !py-1" onClick={back}><ChevronLeft size={15} /> All reports</button>
      <div>
        <h1 className="font-display text-2xl font-bold text-pine">{def.report_name}</h1>
        <p className="text-sm text-pine/60">{def.department}</p>
      </div>

      <div className="card p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="label">Cycle</label>
          <select className="input !w-44" value={cycle} onChange={(e) => onCycle(e.target.value)}>{CYCLES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        {cycle !== 'Date Range' ? (
          <div><label className="label">Anchor date</label><input type="date" className="input !w-44" value={anchor} onChange={(e) => onAnchor(e.target.value)} /></div>
        ) : (
          <>
            <div><label className="label">From</label><input type="date" className="input !w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="label">To</label><input type="date" className="input !w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </>
        )}
        <button className="btn-primary" onClick={run} disabled={busy}><CalendarRange size={15} /> {busy ? 'Running…' : 'Run'}</button>
        <div className="flex-1" />
        <button className="btn-ghost" onClick={xls} disabled={!data}><FileDown size={14} /> Excel</button>
        <button className="btn-ghost" onClick={() => setPrinting(true)} disabled={!data}><Printer size={14} /> Print</button>
      </div>
      <div className="text-xs text-pine/50">Showing {fmtDate(from)} — {fmtDate(to)}</div>

      {printing && data && (
        <PrintPortal title={def.report_name} onClose={() => setPrinting(false)}>
          <ReportHead company={company} title={def.report_name.toUpperCase()} from={from} to={to} />
          <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 720, margin: '0 auto' }}>
            <thead><tr style={{ background: '#eee' }}>{data.head.map((h, i) => <th key={i} style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5, textAlign: data.align && data.align[i] === 'r' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
            <tbody>{data.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5, textAlign: data.align && data.align[ci] === 'r' ? 'right' : 'left' }}>{c}</td>)}</tr>)}</tbody>
            {data.foot && <tfoot><tr style={{ fontWeight: 700, background: '#f5f5f5' }}>{data.foot.map((c, ci) => <td key={ci} style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5, textAlign: data.align && data.align[ci] === 'r' ? 'right' : 'left' }}>{c}</td>)}</tr></tfoot>}
          </table>
        </PrintPortal>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr>{(data ? data.head : []).map((h, i) => <th key={i} className={`th ${data.align && data.align[i] === 'r' ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>
            {(data ? data.rows : []).map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className={`td ${data.align && data.align[ci] === 'r' ? 'money text-right' : 'text-sm'}`}>{c}</td>)}</tr>)}
            {data && data.rows.length === 0 && <tr><td className="td text-pine/40" colSpan={data.head.length}>No data in this period.</td></tr>}
            {!data && <tr><td className="td text-pine/40" colSpan={6}>Press Run.</td></tr>}
          </tbody>
          {data && data.foot && <tfoot><tr className="bg-leaf/40 font-bold money">{data.foot.map((c, ci) => <td key={ci} className={`td ${data.align && data.align[ci] === 'r' ? 'text-right' : ''}`}>{c}</td>)}</tr></tfoot>}
        </table>
      </div>
    </div>
  )
}

function ReportHead({ company, title, from, to }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#000' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #1B4D2E', paddingBottom: 8, marginBottom: 10 }}>
        {company && company.logo_url && <img src={company.logo_url} alt="" style={{ height: 46, objectFit: 'contain', marginBottom: 4 }} />}
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Fraunces, serif', color: '#1B4D2E' }}>{(company && company.name) || 'Resort'}</div>
        <div style={{ fontSize: 10 }}>{company && company.address}{company && company.bin ? ` · BIN: ${company.bin}` : ''}</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, textDecoration: 'underline' }}>{title}</div>
        <div style={{ fontSize: 10 }}>Period: {fmtDate(from)} — {fmtDate(to)}</div>
      </div>
    </div>
  )
}

const money = (n) => fmtBDT(n)
async function fetchReport(key, from, to) {
  switch (key) {
    case 'acc_trial_balance': {
      const { data } = await supabase.from('v_trial_balance').select('*')
      const rows = (data || []).map((r) => [r.code, r.name, money(r.total_debit), money(r.total_credit), money(r.balance)])
      const t = (data || []).reduce((a, r) => ({ d: a.d + +r.total_debit, c: a.c + +r.total_credit }), { d: 0, c: 0 })
      return { head: ['Code', 'Account', 'Debit', 'Credit', 'Balance'], align: ['l', 'l', 'r', 'r', 'r'], rows, foot: ['', 'TOTAL', money(t.d), money(t.c), ''] }
    }
    case 'acc_ledger': {
      const { data } = await supabase.from('v_ledger').select('*').gte('jv_date', from).lte('jv_date', to).order('jv_date')
      const rows = (data || []).map((r) => [fmtDate(r.jv_date), r.jv_no, `${r.account_code} · ${r.account_name}`, r.line_note || r.narration || '', money(r.debit), money(r.credit)])
      const t = (data || []).reduce((a, r) => ({ d: a.d + +r.debit, c: a.c + +r.credit }), { d: 0, c: 0 })
      return { head: ['Date', 'JV', 'Account', 'Particulars', 'Debit', 'Credit'], align: ['l', 'l', 'l', 'l', 'r', 'r'], rows, foot: ['', '', '', 'TOTAL', money(t.d), money(t.c)] }
    }
    case 'acc_cash_book':
      return ledgerForCodes(['1010'], from, to, 'Cash')
    case 'acc_bank_book':
      return ledgerForCodes(['1030', '1020'], from, to, 'Bank/Wallet')
    case 'acc_vat_collection': {
      const { data } = await supabase.from('vat_sales_register').select('*').eq('is_void', false).gte('issue_date', from).lte('issue_date', to).order('issue_date')
      const rows = (data || []).map((r) => [fmtDate(r.issue_date), r.invoice_no, r.buyer_name || '—', money(r.taxable_value), money(r.sd), money(r.vat), money(r.total)])
      const t = (data || []).reduce((a, r) => ({ tv: a.tv + +r.taxable_value, sd: a.sd + +r.sd, v: a.v + +r.vat, tot: a.tot + +r.total }), { tv: 0, sd: 0, v: 0, tot: 0 })
      return { head: ['Date', 'Invoice', 'Buyer', 'Taxable', 'SD', 'VAT', 'Total'], align: ['l', 'l', 'l', 'r', 'r', 'r', 'r'], rows, foot: ['', '', 'TOTAL', money(t.tv), money(t.sd), money(t.v), money(t.tot)] }
    }
    case 'acc_vat_payment': {
      const { data } = await supabase.from('vat_purchase_register').select('*').gte('entry_date', from).lte('entry_date', to).order('entry_date')
      const rows = (data || []).map((r) => [fmtDate(r.entry_date), r.vendor_name || '—', r.invoice_no || '—', money(r.taxable_value), money(r.vat_amount), money(r.total)])
      const t = (data || []).reduce((a, r) => ({ tv: a.tv + +r.taxable_value, v: a.v + +r.vat_amount, tot: a.tot + +r.total }), { tv: 0, v: 0, tot: 0 })
      return { head: ['Date', 'Vendor', 'Invoice', 'Taxable', 'VAT', 'Total'], align: ['l', 'l', 'l', 'r', 'r', 'r'], rows, foot: ['', '', 'TOTAL', money(t.tv), money(t.v), money(t.tot)] }
    }
        case 'sal_checkin_log': {
      const { data } = await supabase.from('reservations').select('res_no, reservation_name, check_in, check_out, checked_in_at, checkin_by, pax_adults, pax_children').not('checked_in_at', 'is', null).gte('checked_in_at', from + 'T00:00:00').lte('checked_in_at', to + 'T23:59:59').order('checked_in_at')
      const rows = (data || []).map((r) => [fmtDate(r.checked_in_at), r.res_no, r.reservation_name || '—', `${r.pax_adults || 0}+${r.pax_children || 0}`, fmtDate(r.check_out), r.checkin_by || '—'])
      return { head: ['Check-in', 'Res No', 'Guest', 'Pax', 'Check-out', 'By'], align: ['l', 'l', 'l', 'l', 'l', 'l'], rows, foot: ['', '', '', '', 'Total', String(rows.length)] }
    }
    case 'sal_checkout_log': {
      const { data } = await supabase.from('reservations').select('res_no, reservation_name, check_in, checked_out_at').not('checked_out_at', 'is', null).gte('checked_out_at', from + 'T00:00:00').lte('checked_out_at', to + 'T23:59:59').order('checked_out_at')
      const rows = (data || []).map((r) => [fmtDate(r.checked_out_at), r.res_no, r.reservation_name || '—', fmtDate(r.check_in)])
      return { head: ['Check-out', 'Res No', 'Guest', 'Check-in'], align: ['l', 'l', 'l', 'l'], rows, foot: ['', '', 'Total', String(rows.length)] }
    }
    case 'sal_inhouse': {
      const { data } = await supabase.from('reservations').select('res_no, reservation_name, check_in, check_out, pax_adults, pax_children, reservation_rooms(rooms(room_no))').eq('status', 'CHECKED_IN').order('check_in')
      const rows = (data || []).map((r) => [r.res_no, r.reservation_name || '—', (r.reservation_rooms || []).map((x) => x.rooms && x.rooms.room_no).filter(Boolean).join(', '), fmtDate(r.check_in), fmtDate(r.check_out), `${r.pax_adults || 0}+${r.pax_children || 0}`])
      return { head: ['Res No', 'Guest', 'Room(s)', 'Check-in', 'Check-out', 'Pax'], align: ['l', 'l', 'l', 'l', 'l', 'l'], rows, foot: ['', '', '', '', 'In-house', String(rows.length)] }
    }
    case 'sal_guest_advance': {
      const { data } = await supabase.from('payments').select('received_date, amount, method, reference, payment_class, reservations(res_no, reservation_name)').eq('payment_class', 'ADVANCE').gte('received_date', from).lte('received_date', to).order('received_date')
      const rows = (data || []).map((r) => [fmtDate(r.received_date), r.reservations && r.reservations.res_no || '—', r.reservations && r.reservations.reservation_name || '—', r.method, money(r.amount)])
      const t = (data || []).reduce((a, r) => a + +r.amount, 0)
      return { head: ['Date', 'Res No', 'Guest', 'Method', 'Amount'], align: ['l', 'l', 'l', 'l', 'r'], rows, foot: ['', '', '', 'TOTAL', money(t)] }
    }
    case 'sal_payment_txn': {
      const { data } = await supabase.from('payments').select('received_date, amount, method, reference, received_by, reservations(res_no)').gte('received_date', from).lte('received_date', to).order('received_date')
      const rows = (data || []).map((r) => [fmtDate(r.received_date), r.reservations && r.reservations.res_no || '—', r.method, r.reference || '—', r.received_by || '—', money(r.amount)])
      const t = (data || []).reduce((a, r) => a + +r.amount, 0)
      return { head: ['Date', 'Res No', 'Method', 'Reference', 'By', 'Amount'], align: ['l', 'l', 'l', 'l', 'l', 'r'], rows, foot: ['', '', '', '', 'TOTAL', money(t)] }
    }
    case 'sal_sales': {
      const { data } = await supabase.from('folio_charges').select('charge_type, base_amount, discount, service_charge, sd, vat, total').gte('charge_date', from).lte('charge_date', to)
      const agg = {}
      for (const c of data || []) { const r = agg[c.charge_type] || { n: 0, t: 0 }; r.n += (+c.base_amount - +c.discount); r.t += +c.total; agg[c.charge_type] = r }
      const rows = Object.entries(agg).map(([k, v]) => [k, money(v.n), money(v.t)])
      const t = (data || []).reduce((a, c) => ({ n: a.n + (+c.base_amount - +c.discount), t: a.t + +c.total }), { n: 0, t: 0 })
      return { head: ['Revenue head', 'Net', 'Gross total'], align: ['l', 'r', 'r'], rows, foot: ['TOTAL', money(t.n), money(t.t)] }
    }
    case 'sal_component_sales': {
      const { data } = await supabase.from('folio_charges').select('charge_type, base_amount, discount, service_charge, sd, vat, total').gte('charge_date', from).lte('charge_date', to)
      const agg = {}
      const add = (k, c) => { const r = agg[k] || { net: 0, sc: 0, sd: 0, vat: 0, tot: 0 }; r.net += (+c.base_amount - +c.discount); r.sc += +c.service_charge; r.sd += +c.sd; r.vat += +c.vat; r.tot += +c.total; agg[k] = r }
      for (const c of data || []) add(c.charge_type, c)
      const rows = Object.entries(agg).map(([k, v]) => [k, money(v.net), money(v.sc), money(v.sd), money(v.vat), money(v.tot)])
      const t = Object.values(agg).reduce((a, v) => ({ net: a.net + v.net, sc: a.sc + v.sc, sd: a.sd + v.sd, vat: a.vat + v.vat, tot: a.tot + v.tot }), { net: 0, sc: 0, sd: 0, vat: 0, tot: 0 })
      return { head: ['Component', 'Net', 'SC', 'SD', 'VAT', 'Total'], align: ['l', 'r', 'r', 'r', 'r', 'r'], rows, foot: ['TOTAL', money(t.net), money(t.sc), money(t.sd), money(t.vat), money(t.tot)] }
    }
    case 'sal_occupancy': {
      const { data: rooms } = await supabase.from('rooms').select('id').eq('is_active', true)
      const totalRooms = (rooms || []).length
      const { data: na } = await supabase.from('night_audits').select('audit_date, summary').gte('audit_date', from).lte('audit_date', to).order('audit_date')
      const rows = (na || []).map((r) => { const occ = (r.summary && r.summary.inHouseCount) || 0; const pct = totalRooms ? ((occ / totalRooms) * 100).toFixed(1) + '%' : '—'; return [fmtDate(r.audit_date), String(occ), String(totalRooms), pct] })
      return { head: ['Date', 'Occupied', 'Total rooms', 'Occupancy %'], align: ['l', 'r', 'r', 'r'], rows, foot: null }
    }
    case 'sal_adr': {
      const { data } = await supabase.from('folio_charges').select('charge_date, base_amount, discount').eq('charge_type', 'ROOM').gte('charge_date', from).lte('charge_date', to)
      const byDay = {}
      for (const c of data || []) { byDay[c.charge_date] = byDay[c.charge_date] || { rev: 0, n: 0 }; byDay[c.charge_date].rev += (+c.base_amount - +c.discount); byDay[c.charge_date].n += 1 }
      const rows = Object.entries(byDay).sort().map(([d, v]) => [fmtDate(d), String(v.n), money(v.rev), money(v.n ? v.rev / v.n : 0)])
      const tot = Object.values(byDay).reduce((a, v) => ({ rev: a.rev + v.rev, n: a.n + v.n }), { rev: 0, n: 0 })
      return { head: ['Date', 'Rooms sold', 'Room revenue', 'ADR'], align: ['l', 'r', 'r', 'r'], rows, foot: ['', String(tot.n), money(tot.rev), money(tot.n ? tot.rev / tot.n : 0)] }
    }
    case 'sal_night_audit':
    case 'pos_night_audit': {
      const { data } = await supabase.from('night_audits').select('audit_date, performed_by, summary, jv_id').gte('audit_date', from).lte('audit_date', to).order('audit_date')
      const rows = (data || []).map((r) => [fmtDate(r.audit_date), r.performed_by || '—', money(r.summary && r.summary.totals && r.summary.totals.total), money(r.summary && r.summary.recTotal), r.jv_id ? 'Posted' : '—'])
      return { head: ['Date', 'By', 'Revenue', 'Receipts', 'JV'], align: ['l', 'l', 'r', 'r', 'l'], rows, foot: null }
    }
    case 'sal_res_entry_log': {
      const { data } = await supabase.from('reservations').select('res_no, reservation_name, created_by, created_at, status').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59').order('created_at')
      const rows = (data || []).map((r) => [fmtDate(r.created_at), r.res_no, r.reservation_name || '—', r.created_by || '—', r.status])
      return { head: ['Entered', 'Res No', 'Guest', 'Sales person', 'Status'], align: ['l', 'l', 'l', 'l', 'l'], rows, foot: ['', '', '', 'Total', String(rows.length)] }
    }
    case 'sal_noshow_charge': {
      const { data } = await supabase.from('reservations').select('res_no, reservation_name, check_in, room_rate').eq('status', 'NO_SHOW').gte('check_in', from).lte('check_in', to).order('check_in')
      const rows = (data || []).map((r) => [fmtDate(r.check_in), r.res_no, r.reservation_name || '—', money(r.room_rate)])
      const t = (data || []).reduce((a, r) => a + (+r.room_rate || 0), 0)
      return { head: ['Date', 'Res No', 'Guest', 'Charge'], align: ['l', 'l', 'l', 'r'], rows, foot: ['', '', 'TOTAL', money(t)] }
    }
    /* ---------- RESTAURANT / POS ---------- */
    case 'pos_sales': {
      const { data } = await supabase.from('pos_orders').select('order_no, settled_at, outlet, order_type, total, payment_method, status').eq('status', 'SETTLED').gte('settled_at', from + 'T00:00:00').lte('settled_at', to + 'T23:59:59').order('settled_at')
      const rows = (data || []).map((r) => [fmtDate(r.settled_at), r.order_no, r.order_type, r.payment_method || '—', money(r.total)])
      const t = (data || []).reduce((a, r) => a + +r.total, 0)
      return { head: ['Date', 'Order', 'Type', 'Method', 'Total'], align: ['l', 'l', 'l', 'l', 'r'], rows, foot: ['', '', '', 'TOTAL', money(t)] }
    }
    case 'pos_payment_txn': {
      const { data } = await supabase.from('pos_orders').select('settled_at, payment_method, total').eq('status', 'SETTLED').gte('settled_at', from + 'T00:00:00').lte('settled_at', to + 'T23:59:59')
      const agg = {}
      for (const r of data || []) agg[r.payment_method || 'CASH'] = (agg[r.payment_method || 'CASH'] || 0) + +r.total
      const rows = Object.entries(agg).map(([m, v]) => [m, money(v)])
      const t = Object.values(agg).reduce((a, v) => a + v, 0)
      return { head: ['Method', 'Amount'], align: ['l', 'r'], rows, foot: ['TOTAL', money(t)] }
    }
    case 'pos_component_sales': {
      const { data } = await supabase.from('pos_order_items').select('item_name, qty, line_total, pos_orders!inner(settled_at, status)').eq('pos_orders.status', 'SETTLED').gte('pos_orders.settled_at', from + 'T00:00:00').lte('pos_orders.settled_at', to + 'T23:59:59')
      const agg = {}
      for (const r of data || []) { const k = r.item_name; agg[k] = agg[k] || { q: 0, t: 0 }; agg[k].q += +r.qty; agg[k].t += +r.line_total }
      const rows = Object.entries(agg).map(([k, v]) => [k, String(v.q), money(v.t)])
      const t = Object.values(agg).reduce((a, v) => a + v.t, 0)
      return { head: ['Item', 'Qty', 'Amount'], align: ['l', 'r', 'r'], rows, foot: ['', 'TOTAL', money(t)] }
    }
    /* ---------- MIXED ---------- */
    case 'mix_other_items': {
      const { data } = await supabase.from('facility_sales').select('sale_date, item_name, qty, total, status').eq('status', 'SETTLED').gte('sale_date', from).lte('sale_date', to).order('sale_date')
      const rows = (data || []).map((r) => [fmtDate(r.sale_date), r.item_name, String(r.qty), money(r.total)])
      const t = (data || []).reduce((a, r) => a + +r.total, 0)
      return { head: ['Date', 'Item', 'Qty', 'Total'], align: ['l', 'l', 'r', 'r'], rows, foot: ['', '', 'TOTAL', money(t)] }
    }
    case 'inv_purchase': {
      const { data } = await supabase.from('vat_purchase_register').select('entry_date, vendor_name, invoice_no, taxable_value, vat_amount, total').gte('entry_date', from).lte('entry_date', to).order('entry_date')
      const rows = (data || []).map((r) => [fmtDate(r.entry_date), r.vendor_name || '—', r.invoice_no || '—', money(r.taxable_value), money(r.vat_amount), money(r.total)])
      const t = (data || []).reduce((a, r) => ({ tv: a.tv + +r.taxable_value, v: a.v + +r.vat_amount, tot: a.tot + +r.total }), { tv: 0, v: 0, tot: 0 })
      return { head: ['Date', 'Vendor', 'Invoice', 'Taxable', 'VAT', 'Total'], align: ['l', 'l', 'l', 'r', 'r', 'r'], rows, foot: ['', '', 'TOTAL', money(t.tv), money(t.v), money(t.tot)] }
    }
    case 'acc_depreciation': {
      const { data } = await supabase.from('asset_depreciation').select('period, amount, fixed_assets(asset_code, name)').gte('period', from.slice(0,7)).lte('period', to.slice(0,7)).order('period')
      const rows = (data || []).map((r) => [r.period, r.fixed_assets && r.fixed_assets.asset_code || '—', r.fixed_assets && r.fixed_assets.name || '—', money(r.amount)])
      const t = (data || []).reduce((a, r) => a + +r.amount, 0)
      return { head: ['Period', 'Asset code', 'Asset', 'Depreciation'], align: ['l', 'l', 'l', 'r'], rows, foot: ['', '', 'TOTAL', money(t)] }
    }
    default:
      return { head: ['Info'], align: ['l'], rows: [['This report is not wired yet.']], foot: null }
  }
}

async function ledgerForCodes(codes, from, to, label) {
  const { data } = await supabase.from('v_ledger').select('*').in('account_code', codes).gte('jv_date', from).lte('jv_date', to).order('jv_date')
  let bal = 0
  const rows = (data || []).map((r) => { bal += (+r.debit - +r.credit); return [fmtDate(r.jv_date), r.jv_no, r.line_note || r.narration || '', money(r.debit), money(r.credit), money(bal)] })
  const t = (data || []).reduce((a, r) => ({ d: a.d + +r.debit, c: a.c + +r.credit }), { d: 0, c: 0 })
  return { head: ['Date', 'JV', `Particulars (${label})`, 'Debit', 'Credit', 'Balance'], align: ['l', 'l', 'l', 'r', 'r', 'r'], rows, foot: ['', '', 'TOTAL', money(t.d), money(t.c), money(t.d - t.c)] }
}
