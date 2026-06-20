import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, rateFor, computeCharge, exportXLSX } from '../lib/helpers'
import PrintPortal from '../components/PrintPortal.jsx'
import { MoonStar, BedDouble, UserX, CheckCircle2, FileDown, BookOpenCheck, Printer } from 'lucide-react'

const CASH_ACC = { CASH: '1010', BKASH: '1020', NAGAD: '1020', CARD: '1030', BANK: '1030', OTHER: '1030' }
const REV_ACC = { ROOM: '4100', RESTAURANT: '4200', TEA: '4300', PICKLE: '4300', SPORTS: '4300', LAUNDRY: '4400', OTHER: '4400' }

export default function NightAudit({ userName, isAdmin, role }) {
  const canCloseDay = isAdmin || role === 'SUPERUSER'
  const [auditDate, setAuditDate] = useState(todayISO())
  const [inHouse, setInHouse] = useState([])
  const [noShows, setNoShows] = useState([])
  const [postedToday, setPostedToday] = useState([])
  const [taxConfig, setTaxConfig] = useState([])
  const [summary, setSummary] = useState(null)
  const [audits, setAudits] = useState([])
  const [existing, setExisting] = useState(null)
  const [company, setCompany] = useState(null)
  const [printAudit, setPrintAudit] = useState(null)
  const [makeJV, setMakeJV] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 6000) }

  useEffect(() => { supabase.from('company_settings').select('*').eq('id', 1).single().then(({ data }) => setCompany(data)) }, [])

  const loadAll = async () => {
    const [ih, ns, fc, tc, na, ex] = await Promise.all([
      supabase.from('reservations').select('*, reservation_rooms(*, rooms(*))').eq('status', 'CHECKED_IN'),
      supabase.from('reservations').select('*, guests:primary_guest_id(full_name)').eq('status', 'CONFIRMED').lt('check_in', auditDate),
      supabase.from('folio_charges').select('reservation_id, charge_type').eq('charge_date', auditDate).eq('charge_type', 'ROOM'),
      supabase.from('tax_config').select('*'),
      supabase.from('night_audits').select('*').order('audit_date', { ascending: false }).limit(15),
      supabase.from('night_audits').select('*').eq('audit_date', auditDate).maybeSingle(),
    ])
    setInHouse(ih.data || []); setNoShows(ns.data || []); setPostedToday(fc.data || [])
    setTaxConfig(tc.data || []); setAudits(na.data || []); setExisting(ex.data || null)
    await buildSummary()
  }

  const buildSummary = async () => {
    const [fc, pay, posWalk, facWalk] = await Promise.all([
      supabase.from('folio_charges').select('*').eq('charge_date', auditDate),
      supabase.from('payments').select('*').eq('received_date', auditDate),
      supabase.from('pos_orders').select('*').eq('status', 'SETTLED').is('reservation_id', null)
        .gte('settled_at', auditDate + 'T00:00:00').lte('settled_at', auditDate + 'T23:59:59'),
      supabase.from('facility_sales').select('*').eq('status', 'SETTLED').is('reservation_id', null).eq('sale_date', auditDate),
    ])
    const revenue = {}
    const add = (type, net, sc, vat, total) => {
      const r = revenue[type] || { net: 0, sc: 0, vat: 0, total: 0 }
      r.net += net; r.sc += sc; r.vat += vat; r.total += total
      revenue[type] = r
    }
    for (const c of fc.data || []) add(c.charge_type, +c.base_amount - +c.discount, +c.service_charge, +c.vat, +c.total)
    for (const o of posWalk.data || []) add('RESTAURANT', +o.base_amount - +o.discount, +o.service_charge, +o.vat, +o.total)
    for (const f of facWalk.data || []) add(f.item_name?.toUpperCase().includes('TEA') ? 'TEA' : 'OTHER FACILITY', +f.base_amount - +f.discount, +f.service_charge, +f.vat, +f.total)

    const receipts = {}
    for (const p of pay.data || []) receipts[p.method] = (receipts[p.method] || 0) + +p.amount
    for (const o of posWalk.data || []) receipts[o.payment_method || 'CASH'] = (receipts[o.payment_method || 'CASH'] || 0) + +o.total
    for (const f of facWalk.data || []) receipts[f.payment_method || 'CASH'] = (receipts[f.payment_method || 'CASH'] || 0) + +f.total

    const tot = Object.values(revenue).reduce((a, r) => ({ net: a.net + r.net, sc: a.sc + r.sc, vat: a.vat + r.vat, total: a.total + r.total }), { net: 0, sc: 0, vat: 0, total: 0 })
    const recTotal = Object.values(receipts).reduce((a, v) => a + v, 0)
    setSummary({ revenue, totals: tot, receipts, recTotal, inHouseCount: inHouse.length })
  }

  useEffect(() => { loadAll() }, [auditDate]) // eslint-disable-line

  const postRoomCharges = async () => {
    setBusy(true)
    const postedSet = new Set(postedToday.map((p) => p.reservation_id))
    const rows = []
    for (const res of inHouse) {
      if (postedSet.has(res.id)) continue
      const rate = rateFor(taxConfig, 'ROOM', auditDate)
      for (const rr of res.reservation_rooms || []) {
        const ci = rr.from_date || res.check_in
        const co = rr.to_date || res.check_out
        if (auditDate < ci || auditDate >= co) continue
        rows.push({ reservation_id: res.id, charge_date: auditDate, charge_type: 'ROOM', description: `Room ${rr.rooms?.room_no}${rr.rooms?.room_name ? ` (${rr.rooms.room_name})` : ''} — Night of ${fmtDate(auditDate)} (night audit)`, ...computeCharge(rr.rate, res.discount_pct, rate), created_by: userName })
      }
      if (auditDate >= res.check_in && auditDate < res.check_out) {
        if (res.extra_pax > 0 && res.extra_pax_rate > 0)
          rows.push({ reservation_id: res.id, charge_date: auditDate, charge_type: 'ROOM', description: `Extra pax × ${res.extra_pax} — ${fmtDate(auditDate)} (night audit)`, ...computeCharge(res.extra_pax * res.extra_pax_rate, res.discount_pct, rate), created_by: userName })
        if (res.driver_accommodation && res.driver_count > 0 && res.driver_rate > 0)
          rows.push({ reservation_id: res.id, charge_date: auditDate, charge_type: 'ROOM', description: `Driver accommodation × ${res.driver_count} — ${fmtDate(auditDate)} (night audit)`, ...computeCharge(res.driver_count * res.driver_rate, res.discount_pct, rate), created_by: userName })
      }
    }
    if (rows.length === 0) { setBusy(false); flash('Nothing to post — every in-house room already has tonight\'s charge.'); return }
    const { error } = await supabase.from('folio_charges').insert(rows)
    setBusy(false)
    if (error) flash(error.message)
    else { flash(`${rows.length} room charge line(s) posted for ${fmtDate(auditDate)}.`); await loadAll() }
  }

  const markNoShow = async (res) => {
    if (!window.confirm(`Mark ${res.res_no} (${res.reservation_name || res.guests?.full_name || ''}) as NO-SHOW?`)) return
    await supabase.from('reservations').update({ status: 'NO_SHOW' }).eq('id', res.id)
    await supabase.from('audit_log').insert({ actor: userName, action: 'NO_SHOW', entity: 'reservation', entity_id: res.res_no, details: { audit_date: auditDate } })
    await loadAll()
  }

  const closeDay = async () => {
    if (!canCloseDay) { flash('Only Admin or SUPERUSER can close the day.'); return }
    if (!summary) return
    setBusy(true)
    let jvId = null
    try {
      if (makeJV && summary.recTotal + summary.totals.total > 0) {
        const { data: coa } = await supabase.from('chart_of_accounts').select('id, code')
        const acc = Object.fromEntries((coa || []).map((a) => [a.code, a.id]))
        const lines = []
        for (const [m, amt] of Object.entries(summary.receipts))
          if (amt > 0 && acc[CASH_ACC[m] || '1030']) lines.push({ account_id: acc[CASH_ACC[m] || '1030'], debit: +amt.toFixed(2), credit: 0, line_note: `Receipts — ${m}` })
        for (const [t, r] of Object.entries(summary.revenue))
          if (r.net > 0 && acc[REV_ACC[t] || '4400']) lines.push({ account_id: acc[REV_ACC[t] || '4400'], debit: 0, credit: +r.net.toFixed(2), line_note: `Revenue — ${t}` })
        if (summary.totals.vat > 0) lines.push({ account_id: acc['2200'], debit: 0, credit: +summary.totals.vat.toFixed(2), line_note: 'VAT payable' })
        if (summary.totals.sc > 0) lines.push({ account_id: acc['2300'], debit: 0, credit: +summary.totals.sc.toFixed(2), line_note: 'Service charge payable' })
        const dr = lines.reduce((a, l) => a + l.debit, 0), cr = lines.reduce((a, l) => a + l.credit, 0)
        const diff = +(cr - dr).toFixed(2)
        if (diff > 0) lines.push({ account_id: acc['1100'], debit: diff, credit: 0, line_note: 'Charged to folios — receivable' })
        if (diff < 0) lines.push({ account_id: acc['2400'], debit: 0, credit: -diff, line_note: 'Advance / unapplied receipts' })
        if (lines.length > 1) {
          const { data: jv, error: je } = await supabase.from('journal_entries').insert({ jv_date: auditDate, narration: `Night audit — ${fmtDate(auditDate)}`, source: 'NIGHT_AUDIT', posted_by: userName }).select().single()
          if (je) throw je
          const { error: jle } = await supabase.from('journal_lines').insert(lines.map((l) => ({ ...l, entry_id: jv.id })))
          if (jle) throw jle
          jvId = jv.id
        }
      }
      const payload = { audit_date: auditDate, performed_by: userName, summary, jv_id: jvId, notes: makeJV ? 'Auto-JV posted' : null }
      const { error } = existing
        ? await supabase.from('night_audits').update({ ...payload, performed_at: new Date().toISOString() }).eq('id', existing.id)
        : await supabase.from('night_audits').insert(payload)
      if (error) throw error
      await supabase.from('company_settings').update({ last_audit_date: auditDate }).gt('id', 0)
      flash(`Night audit for ${fmtDate(auditDate)} ${existing ? 'updated' : 'closed'}.${jvId ? ' Journal voucher posted.' : ''}`)
      await loadAll()
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  const exportSummary = () => {
    if (!summary) return
    const rows = [
      [`Night Audit — ${fmtDate(auditDate)}`], [`Performed by: ${userName}`], [],
      ['REVENUE (accrual)'], ['Type', 'Net', 'Service Charge', 'VAT', 'Total'],
      ...Object.entries(summary.revenue).map(([t, r]) => [t, r.net, r.sc, r.vat, r.total]),
      ['TOTAL', summary.totals.net, summary.totals.sc, summary.totals.vat, summary.totals.total], [],
      ['RECEIPTS (cash basis)'], ['Method', 'Amount'],
      ...Object.entries(summary.receipts).map(([m, v]) => [m, v]),
      ['TOTAL', summary.recTotal],
    ]
    exportXLSX(`Night_Audit_${auditDate}.xlsx`, [{ name: 'Night Audit', rows }])
  }

  const unposted = inHouse.filter((r) => !postedToday.some((p) => p.reservation_id === r.id) && auditDate >= r.check_in && auditDate < r.check_out)

  return (
    <div className="space-y-5">
      {printAudit && (
        <PrintPortal title={`Night Audit — ${printAudit.audit_date}`} onClose={() => setPrintAudit(null)}>
          <NightAuditReport audit={printAudit} company={company} />
        </PrintPortal>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2"><MoonStar className="text-forest" /> Night Audit</h1>
          <p className="text-sm text-pine/60">End-of-day routine: post room charges, clear no-shows, balance the day and print the report.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="label !mb-0">Audit date</span>
          <input type="date" className="input !w-44" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} />
        </div>
      </div>
      {msg && <div className="px-4 py-3 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}
      {existing && <div className="px-4 py-3 rounded-lg bg-amber/10 text-amber text-sm font-medium">This date was already audited by {existing.performed_by} on {fmtDate(existing.performed_at)}. Closing again will overwrite the saved summary.</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-display font-semibold text-pine flex items-center gap-2 mb-2"><BedDouble size={17} className="text-forest" /> 1 · Post tonight's room charges</h3>
          <p className="text-sm text-pine/60 mb-3">{inHouse.length} guest(s) in house · {unposted.length} still without a charge for {fmtDate(auditDate)}.</p>
          {unposted.length > 0 && (
            <ul className="text-sm mb-3 space-y-1">
              {unposted.map((r) => <li key={r.id} className="flex justify-between"><span>{r.res_no} — {r.reservation_name}</span><span className="text-pine/50">{(r.reservation_rooms || []).map((x) => x.rooms?.room_no).join(', ')}</span></li>)}
            </ul>
          )}
          <button className="btn-primary" disabled={busy || unposted.length === 0} onClick={postRoomCharges}><CheckCircle2 size={15} /> Post room charges ({unposted.length})</button>
        </div>

        <div className="card p-5">
          <h3 className="font-display font-semibold text-pine flex items-center gap-2 mb-2"><UserX size={17} className="text-amber" /> 2 · No-shows</h3>
          <p className="text-sm text-pine/60 mb-3">Confirmed bookings whose check-in date has passed without arrival.</p>
          {noShows.length === 0 ? <p className="text-sm text-pine/40">None — clean slate.</p> : (
            <ul className="text-sm space-y-2">
              {noShows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span>{r.res_no} — {r.reservation_name || r.guests?.full_name} <span className="text-pine/40">(in {fmtDate(r.check_in)})</span></span>
                  <button className="btn-ghost !py-1 text-red-600" onClick={() => markNoShow(r)}>Mark no-show</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {summary && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-display font-semibold text-pine flex items-center gap-2"><BookOpenCheck size={17} className="text-forest" /> 3 · Day summary & close</h3>
            <button className="btn-ghost !py-1.5" onClick={exportSummary}><FileDown size={14} /> Excel</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <div className="label">Revenue posted today (accrual)</div>
              <table className="w-full">
                <thead><tr><th className="th">Type</th><th className="th text-right">Net</th><th className="th text-right">SC</th><th className="th text-right">VAT</th><th className="th text-right">Total</th></tr></thead>
                <tbody>
                  {Object.entries(summary.revenue).map(([t, r]) => (
                    <tr key={t}><td className="td">{t}</td><td className="td money text-right">{r.net.toFixed(2)}</td><td className="td money text-right">{r.sc.toFixed(2)}</td><td className="td money text-right">{r.vat.toFixed(2)}</td><td className="td money text-right font-semibold">{r.total.toFixed(2)}</td></tr>
                  ))}
                  {Object.keys(summary.revenue).length === 0 && <tr><td className="td text-pine/40" colSpan={5}>No charges posted on this date.</td></tr>}
                </tbody>
                <tfoot><tr className="bg-leaf/40 font-bold money"><td className="td">TOTAL</td><td className="td text-right">{summary.totals.net.toFixed(2)}</td><td className="td text-right">{summary.totals.sc.toFixed(2)}</td><td className="td text-right">{summary.totals.vat.toFixed(2)}</td><td className="td text-right">{summary.totals.total.toFixed(2)}</td></tr></tfoot>
              </table>
            </div>
            <div>
              <div className="label">Receipts today (cash basis)</div>
              <table className="w-full">
                <thead><tr><th className="th">Method</th><th className="th text-right">Amount</th></tr></thead>
                <tbody>
                  {Object.entries(summary.receipts).map(([m, v]) => <tr key={m}><td className="td">{m}</td><td className="td money text-right">{fmtBDT(v)}</td></tr>)}
                  {Object.keys(summary.receipts).length === 0 && <tr><td className="td text-pine/40" colSpan={2}>No receipts on this date.</td></tr>}
                </tbody>
                <tfoot><tr className="bg-leaf/40 font-bold money"><td className="td">TOTAL</td><td className="td text-right">{fmtBDT(summary.recTotal)}</td></tr></tfoot>
              </table>
              <label className="flex items-center gap-2 text-sm mt-4 cursor-pointer">
                <input type="checkbox" checked={makeJV} onChange={(e) => setMakeJV(e.target.checked)} className="accent-forest" />
                Also post a balanced journal voucher into Accounting
              </label>
              {canCloseDay ? (
                <button className="btn-primary mt-3" disabled={busy} onClick={closeDay}><MoonStar size={15} /> {existing ? 'Re-close day' : 'Close the day'}</button>
              ) : (
                <p className="text-xs text-pine/50 mt-3">Day-close requires Admin or SUPERUSER access.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 pt-4 pb-2 font-display font-semibold text-pine">Recent audits</div>
        <table className="w-full">
          <thead><tr><th className="th">Date</th><th className="th">By</th><th className="th text-right">Revenue total</th><th className="th text-right">Receipts</th><th className="th">JV</th><th className="th text-right">Report</th></tr></thead>
          <tbody>
            {audits.map((a) => (
              <tr key={a.id}>
                <td className="td money">{fmtDate(a.audit_date)}</td>
                <td className="td text-sm">{a.performed_by}</td>
                <td className="td money text-right">{fmtBDT(a.summary?.totals?.total)}</td>
                <td className="td money text-right">{fmtBDT(a.summary?.recTotal)}</td>
                <td className="td text-xs">{a.jv_id ? 'Posted' : '—'}</td>
                <td className="td text-right"><button className="btn-ghost !py-1" onClick={() => setPrintAudit(a)}><Printer size={13} /> Report</button></td>
              </tr>
            ))}
            {audits.length === 0 && <tr><td className="td text-pine/40" colSpan={6}>No audits yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------------- A4 Night Audit report (print) ---------------- */
function NightAuditReport({ audit, company }) {
  const s = audit?.summary || {}
  const revenue = s.revenue || {}
  const receipts = s.receipts || {}
  const totals = s.totals || { net: 0, sc: 0, vat: 0, total: 0 }
  const recTotal = s.recTotal != null ? s.recTotal : Object.values(receipts).reduce((a, v) => a + (+v || 0), 0)
  const cell = { border: '1px solid #000', padding: '5px 8px', fontSize: 11 }
  const rt = { ...cell, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#000' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid #1B4D2E', paddingBottom: 8, marginBottom: 12 }}>
        {company?.logo_url && <img src={company.logo_url} alt="" style={{ height: 50, width: 50, objectFit: 'contain' }} />}
        <div style={{ flex: 1, textAlign: company?.logo_url ? 'left' : 'center' }}>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: 'Fraunces, serif', color: '#1B4D2E' }}>{company?.name || 'Resort'}</div>
          <div style={{ fontSize: 10.5 }}>{company?.address}{company?.phone ? ` · ${company.phone}` : ''}</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, letterSpacing: 1, marginBottom: 4, textDecoration: 'underline' }}>NIGHT AUDIT — DAY-END REPORT</div>
      <table style={{ width: '100%', fontSize: 11, marginBottom: 10 }}>
        <tbody>
          <tr><td><b>Audit date:</b> {fmtDate(audit.audit_date)}</td><td style={{ textAlign: 'right' }}><b>Performed by:</b> {audit.performed_by || '—'}</td></tr>
          <tr><td><b>In-house at audit:</b> {s.inHouseCount != null ? s.inHouseCount : '—'}</td><td style={{ textAlign: 'right' }}><b>Journal voucher:</b> {audit.jv_id ? 'Posted' : '—'}</td></tr>
        </tbody>
      </table>

      <div style={{ fontSize: 12, fontWeight: 700, margin: '6px 0 4px' }}>A · Revenue posted (accrual)</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: '#eee' }}>
          <th style={cell}>Revenue head</th><th style={{ ...cell, textAlign: 'right' }}>Net</th><th style={{ ...cell, textAlign: 'right' }}>Service charge</th><th style={{ ...cell, textAlign: 'right' }}>VAT</th><th style={{ ...cell, textAlign: 'right' }}>Total</th>
        </tr></thead>
        <tbody>
          {Object.entries(revenue).map(([k, r]) => (
            <tr key={k}><td style={cell}>{k}</td><td style={rt}>{fmtBDT(r.net)}</td><td style={rt}>{fmtBDT(r.sc)}</td><td style={rt}>{fmtBDT(r.vat)}</td><td style={rt}>{fmtBDT(r.total)}</td></tr>
          ))}
          {Object.keys(revenue).length === 0 && <tr><td style={cell} colSpan={5}>No revenue posted on this date.</td></tr>}
        </tbody>
        <tfoot><tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
          <td style={cell}>TOTAL</td><td style={rt}>{fmtBDT(totals.net)}</td><td style={rt}>{fmtBDT(totals.sc)}</td><td style={rt}>{fmtBDT(totals.vat)}</td><td style={rt}>{fmtBDT(totals.total)}</td>
        </tr></tfoot>
      </table>

      <div style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 4px' }}>B · Receipts collected (cash basis)</div>
      <table style={{ width: '60%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: '#eee' }}><th style={cell}>Method</th><th style={{ ...cell, textAlign: 'right' }}>Amount</th></tr></thead>
        <tbody>
          {Object.entries(receipts).map(([m, v]) => <tr key={m}><td style={cell}>{m}</td><td style={rt}>{fmtBDT(v)}</td></tr>)}
          {Object.keys(receipts).length === 0 && <tr><td style={cell} colSpan={2}>No receipts on this date.</td></tr>}
        </tbody>
        <tfoot><tr style={{ fontWeight: 700, background: '#f5f5f5' }}><td style={cell}>TOTAL</td><td style={rt}>{fmtBDT(recTotal)}</td></tr></tfoot>
      </table>

      <div style={{ fontSize: 10, marginTop: 10, color: '#444' }}>Revenue is accrual (charges posted on the date); receipts are cash basis (money received on the date). The two need not match.</div>

      <table style={{ width: '100%', marginTop: 44, fontSize: 11 }}>
        <tbody><tr>
          <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: 6, textAlign: 'center' }}>Night Auditor<br /><span style={{ fontSize: 10 }}>{audit.performed_by || ''}</span></td>
          <td style={{ width: '10%' }}></td>
          <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: 6, textAlign: 'center' }}>Manager / Accounts</td>
        </tr></tbody>
      </table>
    </div>
  )
}
