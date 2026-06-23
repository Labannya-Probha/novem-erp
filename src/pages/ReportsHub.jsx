import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, exportXLSX } from '../lib/helpers'
import KPICards from '../components/KPICards.jsx'
import { BarChart3, FileDown, Printer, CalendarRange, ChevronLeft, Lock, Search, Plus, Trash2, Settings2, GripVertical, EyeOff, Eye, X } from 'lucide-react'
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

export default function ReportsHub({ userName, role }) {
  const canManage = role === 'ADMIN' || role === 'MANAGER'
  const [defs, setDefs] = useState([])
  const [company, setCompany] = useState(null)
  const [active, setActive] = useState(null)
  const [q, setQ] = useState('')
  const [showBuilder, setShowBuilder] = useState(false)
  const loadDefs = () => supabase.from('report_definitions').select('*').order('sort_order').then(({ data }) => setDefs(data || []))

  useEffect(() => {
    loadDefs()
    supabase.from('company_settings').select('*').eq('id', 1).single().then(({ data }) => setCompany(data))
  }, [])

  if (active) return <ReportRunner def={active} company={company} canManage={canManage} back={() => { setActive(null); loadDefs() }} onDeleted={() => { setActive(null); loadDefs() }} />

  const filtered = defs.filter((d) => (d.report_name + ' ' + d.department).toLowerCase().includes(q.toLowerCase()))
  const groups = filtered.reduce((acc, d) => { (acc[d.department] = acc[d.department] || []).push(d); return acc }, {})
  const readyCount = defs.filter((d) => d.status === 'READY').length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2"><BarChart3 className="text-forest" /> Report Center</h1>
        <p className="text-sm text-pine/60">{defs.length} reports · {readyCount} ready. Pick a report, choose a cycle, then print or export.</p>
      </div>
      <KPICards module="reports" />
      {canManage && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => setShowBuilder(true)}><Plus size={15} /> New custom report</button>
        </div>
      )}
      {showBuilder && <ReportBuilder onClose={() => setShowBuilder(false)} onSaved={() => { setShowBuilder(false); loadDefs() }} />}
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

/* ── Column Customizer Panel (Admin/Superuser only) ─────────────────────── */
const FIELD_TYPES = [
  { value: 'text',  label: 'Text' },
  { value: 'money', label: 'Money (৳)' },
  { value: 'date',  label: 'Date' },
  { value: 'num',   label: 'Number' },
]

function ColumnCustomizer({ def, existingHead, onSaved, onClose }) {
  // Load saved overrides
  const saved = def.column_overrides || {}
  const [extraCols, setExtraCols] = useState(saved.extra_columns || []) // [{field, label, type}]
  const [hiddenCols, setHiddenCols] = useState(saved.hidden_columns || []) // [field/label strings]
  const [newField, setNewField] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState('text')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const addExtra = () => {
    if (!newField.trim() || !newLabel.trim()) { setMsg('Field name আর Label দিন।'); return }
    if (extraCols.some(c => c.field === newField.trim())) { setMsg('এই field আগেই যোগ আছে।'); return }
    setExtraCols(prev => [...prev, { field: newField.trim(), label: newLabel.trim(), type: newType }])
    setNewField(''); setNewLabel(''); setNewType('text'); setMsg('')
  }

  const removeExtra = (field) => setExtraCols(prev => prev.filter(c => c.field !== field))

  const toggleHide = (label) => {
    setHiddenCols(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label])
  }

  const save = async () => {
    setBusy(true)
    const overrides = {
      extra_columns: extraCols,
      hidden_columns: hiddenCols,
    }
    const { error } = await supabase.from('report_definitions')
      .update({ column_overrides: overrides })
      .eq('id', def.id)
    setBusy(false)
    if (error) { setMsg(error.message); return }
    onSaved()
    onClose()
  }

  const reset = async () => {
    if (!window.confirm('সব customization মুছে default-এ ফিরে যাবে। Confirm?')) return
    setBusy(true)
    await supabase.from('report_definitions').update({ column_overrides: null }).eq('id', def.id)
    setBusy(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-start justify-center overflow-auto p-4 sm:p-8">
      <div className="card max-w-2xl w-full p-5 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-pine flex items-center gap-2">
            <Settings2 size={18} /> Column Customization
          </h2>
          <button onClick={onClose} className="text-pine/30 hover:text-pine"><X size={18} /></button>
        </div>
        <p className="text-xs text-pine/50 mb-4">
          এই settings শুধু এই property-র Admin/Superuser-দের জন্য। Extra column যোগ করলে report run করার সময় ওই DB field-টা সেই row-তে দেখাবে (যদি source-এ থাকে)।
        </p>
        {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{msg}</div>}

        {/* Hide existing columns */}
        {existingHead.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-pine mb-2">বিদ্যমান columns দেখাবে / লুকাবে</h3>
            <div className="flex flex-wrap gap-2">
              {existingHead.map((h) => {
                const hidden = hiddenCols.includes(h)
                return (
                  <button key={h} onClick={() => toggleHide(h)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${hidden ? 'bg-stone-100 text-stone-400 border-stone-200 line-through' : 'bg-white border-leaf text-pine hover:border-forest'}`}>
                    {hidden ? <EyeOff size={11} /> : <Eye size={11} />} {h}
                  </button>
                )
              })}
            </div>
            {hiddenCols.length > 0 && <p className="text-xs text-pine/40 mt-1">{hiddenCols.length} column লুকানো থাকবে।</p>}
          </div>
        )}

        {/* Add extra columns */}
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-pine mb-2">নতুন column যোগ করুন</h3>
          <p className="text-xs text-pine/40 mb-2">DB field name দিন — report-এর data source table-এ যা আছে। যদি field না থাকে তাহলে "—" দেখাবে।</p>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <label className="label">DB field name</label>
              <input className="input text-sm" placeholder="e.g. created_by" value={newField} onChange={e => setNewField(e.target.value)} />
            </div>
            <div>
              <label className="label">Column label</label>
              <input className="input text-sm" placeholder="e.g. Created By" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input text-sm" value={newType} onChange={e => setNewType(e.target.value)}>
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-ghost !py-1.5 text-sm" onClick={addExtra}><Plus size={14} /> Add column</button>
        </div>

        {/* Extra columns list */}
        {extraCols.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-pine mb-2">যোগ করা columns ({extraCols.length})</h3>
            <div className="space-y-1.5">
              {extraCols.map((c, i) => (
                <div key={c.field} className="flex items-center gap-2 px-3 py-2 bg-leaf/30 rounded-lg text-sm">
                  <GripVertical size={13} className="text-pine/30" />
                  <span className="font-medium flex-1">{c.label}</span>
                  <span className="text-xs text-pine/40 money">{c.field}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-white text-pine/50">{c.type}</span>
                  <button onClick={() => removeExtra(c.field)} className="text-red-300 hover:text-red-600"><X size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-leaf">
          <button className="btn-ghost !py-1.5 text-red-500 text-sm" onClick={reset} disabled={busy}>Reset to default</button>
          <div className="flex gap-2">
            <button className="btn-ghost !py-1.5" onClick={onClose}>Cancel</button>
            <button className="btn-primary !py-1.5" onClick={save} disabled={busy}>
              <Settings2 size={14} /> {busy ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── ReportRunner ────────────────────────────────────────────────────────── */
function ReportRunner({ def: defProp, company, back, canManage, onDeleted }) {
  const [def, setDef] = useState(defProp) // local copy so we can refresh overrides
  const [cycle, setCycle] = useState('Monthly')
  const [anchor, setAnchor] = useState(todayISO())
  const [from, setFrom] = useState(cycleRange('Monthly', todayISO()).from)
  const [to, setTo] = useState(cycleRange('Monthly', todayISO()).to)
  const [printing, setPrinting] = useState(false)
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showCustomizer, setShowCustomizer] = useState(false)

  const applyCycle = (c, anc) => { if (c !== 'Date Range') { const r = cycleRange(c, anc); setFrom(r.from); setTo(r.to) } }
  const onCycle = (c) => { setCycle(c); applyCycle(c, anchor) }
  const onAnchor = (v) => { setAnchor(v); applyCycle(cycle, v) }

  const run = async () => {
    setBusy(true)
    let res = await fetchReport(def, from, to)

    // Apply column_overrides if any
    const overrides = def.column_overrides || {}
    const hidden = overrides.hidden_columns || []
    const extra = overrides.extra_columns || []

    if (hidden.length > 0 && res.head) {
      // Build mask of which indices to keep
      const keepIdx = res.head.map((h, i) => ({ h, i })).filter(({ h }) => !hidden.includes(h)).map(({ i }) => i)
      res = {
        ...res,
        head: keepIdx.map(i => res.head[i]),
        align: res.align ? keepIdx.map(i => res.align[i]) : res.align,
        rows: res.rows.map(r => keepIdx.map(i => r[i])),
        foot: res.foot ? keepIdx.map(i => res.foot[i]) : res.foot,
      }
    }

    // Extra columns: append their label to head + '—' to each row
    // (actual data fetch would require knowing the source table; we show '—' 
    //  unless it's a custom report with config.source, then we re-fetch)
    if (extra.length > 0) {
      if (def.is_custom && def.config && def.config.source) {
        // Re-fetch including extra fields for custom reports
        const allCols = [...(def.config.columns || []), ...extra]
        const extConfig = { ...def.config, columns: allCols }
        const extRes = await runCustomReportForOverride(extConfig, from, to)
        res = extRes
      } else {
        // Built-in reports: just append header + '—' placeholder
        extra.forEach(ec => {
          res.head = [...(res.head || []), ec.label]
          res.align = [...(res.align || []), ec.type === 'money' || ec.type === 'num' ? 'r' : 'l']
          res.rows = (res.rows || []).map(r => [...r, '—'])
          if (res.foot) res.foot = [...res.foot, '']
        })
      }
    }

    setData(res)
    setBusy(false)
  }

  const delCustom = async () => {
    if (!window.confirm('Delete this custom report?')) return
    await supabase.from('report_definitions').delete().eq('id', def.id)
    onDeleted && onDeleted()
  }

  const refreshDef = async () => {
    const { data: updated } = await supabase.from('report_definitions').select('*').eq('id', def.id).single()
    if (updated) setDef(updated)
  }

  useEffect(() => { run() }, []) // eslint-disable-line

  const visibleHead = data?.head || []

  const xls = () => {
    if (!data) return
    const sheetRows = [[def.report_name, `${from} to ${to}`], [], data.head, ...data.rows]
    if (data.foot) sheetRows.push(data.foot)
    exportXLSX(`${def.report_key}_${from}_${to}.xlsx`, [{ name: def.report_name.slice(0, 28), rows: sheetRows }])
  }

  const hasOverrides = !!(def.column_overrides && (
    (def.column_overrides.extra_columns || []).length > 0 ||
    (def.column_overrides.hidden_columns || []).length > 0
  ))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button className="btn-ghost !py-1" onClick={back}><ChevronLeft size={15} /> All reports</button>
        <div className="flex gap-2">
          {canManage && (
            <button
              className={`btn-ghost !py-1 flex items-center gap-1.5 text-sm ${hasOverrides ? 'text-forest border-forest' : ''}`}
              onClick={() => setShowCustomizer(true)}
              title="Customize columns">
              <Settings2 size={14} /> Columns{hasOverrides ? ' ✓' : ''}
            </button>
          )}
          {canManage && def.is_custom && (
            <button className="btn-ghost !py-1 text-red-600" onClick={delCustom}><Trash2 size={14} /> Delete</button>
          )}
        </div>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-pine">{def.report_name}</h1>
        <p className="text-sm text-pine/60">{def.department}
          {hasOverrides && <span className="ml-2 text-xs text-forest bg-forest/10 px-2 py-0.5 rounded-full">Custom columns active</span>}
        </p>
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

      {printing && (
        <PrintPortal title={def.report_name} onClose={() => setPrinting(false)}>
          <ReportHead company={company} title={def.report_name.toUpperCase()} from={from} to={to} />
          <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 720, margin: '0 auto' }}>
            <thead><tr style={{ background: '#eee' }}>{visibleHead.map((h, i) => <th key={i} style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5, textAlign: data.align && data.align[i] === 'r' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
            <tbody>{data.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5, textAlign: data.align && data.align[ci] === 'r' ? 'right' : 'left' }}>{c}</td>)}</tr>)}</tbody>
            {data.foot && <tfoot><tr style={{ fontWeight: 700, background: '#f5f5f5' }}>{data.foot.map((c, ci) => <td key={ci} style={{ border: '1px solid #000', padding: '4px 8px', fontSize: 10.5, textAlign: data.align && data.align[ci] === 'r' ? 'right' : 'left' }}>{c}</td>)}</tr></tfoot>}
          </table>
        </PrintPortal>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr>{visibleHead.map((h, i) => <th key={i} className={`th ${data?.align && data.align[i] === 'r' ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>
            {(data ? data.rows : []).map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className={`td ${data?.align && data.align[ci] === 'r' ? 'money text-right' : 'text-sm'}`}>{c}</td>)}</tr>)}
            {data && data.rows.length === 0 && <tr><td className="td text-pine/40" colSpan={visibleHead.length || 6}>No data in this period.</td></tr>}
            {!data && <tr><td className="td text-pine/40" colSpan={6}>Run করুন।</td></tr>}
          </tbody>
          {data && data.foot && <tfoot><tr className="bg-leaf/40 font-bold money">{data.foot.map((c, ci) => <td key={ci} className={`td ${data?.align && data.align[ci] === 'r' ? 'text-right' : ''}`}>{c}</td>)}</tr></tfoot>}
        </table>
      </div>

      {showCustomizer && (
        <ColumnCustomizer
          def={def}
          existingHead={data?.head || []}
          onSaved={async () => { await refreshDef(); run() }}
          onClose={() => setShowCustomizer(false)}
        />
      )}
    </div>
  )
}

/* Helper: re-run custom report with overridden columns */
async function runCustomReportForOverride(config, from, to) {
  return runCustomReport(config, from, to)
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
async function fetchReport(def, from, to) {
  if (def && def.is_custom && def.config) return runCustomReport(def.config, from, to)
  const key = typeof def === 'string' ? def : def.report_key
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
    case 'acc_pnl': {
      const acc = await periodBalances(from, to)
      const inc = acc.filter((a) => a.type === 'INCOME')
      const exp = acc.filter((a) => a.type === 'EXPENSE')
      const incTot = inc.reduce((s, a) => s + a.credit - a.debit, 0)
      const expTot = exp.reduce((s, a) => s + a.debit - a.credit, 0)
      const rows = []
      rows.push(['INCOME', '', ''])
      inc.forEach((a) => rows.push(['', `${a.code} · ${a.name}`, money(a.credit - a.debit)]))
      rows.push(['Total Income', '', money(incTot)])
      rows.push(['EXPENSE', '', ''])
      exp.forEach((a) => rows.push(['', `${a.code} · ${a.name}`, money(a.debit - a.credit)]))
      rows.push(['Total Expense', '', money(expTot)])
      return { head: ['Section', 'Account', 'Amount'], align: ['l', 'l', 'r'], rows, foot: ['NET PROFIT / (LOSS)', '', money(incTot - expTot)] }
    }
    case 'acc_balance_sheet': {
      const acc = await periodBalances(null, to)
      const assets = acc.filter((a) => a.type === 'ASSET')
      const liab = acc.filter((a) => a.type === 'LIABILITY')
      const eq = acc.filter((a) => a.type === 'EQUITY')
      const aTot = assets.reduce((s, a) => s + a.debit - a.credit, 0)
      const lTot = liab.reduce((s, a) => s + a.credit - a.debit, 0)
      const eTot = eq.reduce((s, a) => s + a.credit - a.debit, 0)
      const inc = acc.filter((a) => a.type === 'INCOME').reduce((s, a) => s + a.credit - a.debit, 0)
      const exp = acc.filter((a) => a.type === 'EXPENSE').reduce((s, a) => s + a.debit - a.credit, 0)
      const retained = inc - exp
      const rows = []
      rows.push(['ASSETS', '', ''])
      assets.forEach((a) => rows.push(['', `${a.code} · ${a.name}`, money(a.debit - a.credit)]))
      rows.push(['Total Assets', '', money(aTot)])
      rows.push(['LIABILITIES', '', ''])
      liab.forEach((a) => rows.push(['', `${a.code} · ${a.name}`, money(a.credit - a.debit)]))
      rows.push(['Total Liabilities', '', money(lTot)])
      rows.push(['EQUITY', '', ''])
      eq.forEach((a) => rows.push(['', `${a.code} · ${a.name}`, money(a.credit - a.debit)]))
      rows.push(['', 'Retained earnings (P&L)', money(retained)])
      rows.push(['Total Equity', '', money(eTot + retained)])
      return { head: ['Section', 'Account', 'Amount'], align: ['l', 'l', 'r'], rows, foot: ['Liabilities + Equity', '', money(lTot + eTot + retained)] }
    }
    case 'acc_nav': {
      const acc = await periodBalances(null, to)
      const aTot = acc.filter((a) => a.type === 'ASSET').reduce((s, a) => s + a.debit - a.credit, 0)
      const lTot = acc.filter((a) => a.type === 'LIABILITY').reduce((s, a) => s + a.credit - a.debit, 0)
      const rows = [['Total Assets', money(aTot)], ['Less: Total Liabilities', money(lTot)]]
      return { head: ['Item', 'Amount'], align: ['l', 'r'], rows, foot: ['NET ASSET VALUE', money(aTot - lTot)] }
    }
    case 'acc_cash_flow': {
      const { data } = await supabase.from('v_ledger').select('*').in('account_code', ['1010', '1020', '1030']).gte('jv_date', from).lte('jv_date', to)
      const agg = {}
      for (const r of data || []) { const k = r.source || 'OTHER'; agg[k] = (agg[k] || 0) + (+r.debit - +r.credit) }
      const rows = Object.entries(agg).map(([k, v]) => [k, money(v)])
      const net = Object.values(agg).reduce((a, v) => a + v, 0)
      return { head: ['Cash flow by source', 'Net movement'], align: ['l', 'r'], rows, foot: ['NET CASH MOVEMENT', money(net)] }
    }
    case 'acc_vat_vs': {
      const { data: s } = await supabase.from('vat_sales_register').select('vat, sd').eq('is_void', false).gte('issue_date', from).lte('issue_date', to)
      const { data: p } = await supabase.from('vat_purchase_register').select('vat_amount').gte('entry_date', from).lte('entry_date', to)
      const outVat = (s || []).reduce((a, r) => a + +r.vat, 0)
      const outSd = (s || []).reduce((a, r) => a + +r.sd, 0)
      const inVat = (p || []).reduce((a, r) => a + +r.vat_amount, 0)
      const rows = [['Output VAT (collected on sales)', money(outVat)], ['Output SD (collected)', money(outSd)], ['Input VAT (rebate on purchase)', money(inVat)]]
      return { head: ['Item', 'Amount'], align: ['l', 'r'], rows, foot: ['NET VAT PAYABLE', money(outVat + outSd - inVat)] }
    }
    case 'acc_due_balance': {
      const { data: ch } = await supabase.from('folio_charges').select('reservation_id, total, reservations(res_no, reservation_name, status)')
      const { data: pay } = await supabase.from('payments').select('reservation_id, amount')
      const paid = {}
      for (const p of pay || []) paid[p.reservation_id] = (paid[p.reservation_id] || 0) + +p.amount
      const charged = {}
      const meta = {}
      for (const c of ch || []) { charged[c.reservation_id] = (charged[c.reservation_id] || 0) + +c.total; if (c.reservations) meta[c.reservation_id] = c.reservations }
      const rows = []
      let tot = 0
      for (const rid of Object.keys(charged)) { const due = charged[rid] - (paid[rid] || 0); if (due > 0.5 && meta[rid] && meta[rid].status !== 'SETTLED') { rows.push([meta[rid].res_no, meta[rid].reservation_name || '—', meta[rid].status, money(charged[rid]), money(paid[rid] || 0), money(due)]); tot += due } }
      return { head: ['Res No', 'Guest', 'Status', 'Charged', 'Paid', 'Due'], align: ['l', 'l', 'l', 'r', 'r', 'r'], rows, foot: ['', '', '', '', 'TOTAL DUE', money(tot)] }
    }
    case 'gst_new_vs_repeat': {
      const { data: allRes } = await supabase.from('reservations').select('primary_guest_id, check_in').not('primary_guest_id', 'is', null)
      const firstStay = {}
      for (const r of allRes || []) {
        if (!firstStay[r.primary_guest_id] || r.check_in < firstStay[r.primary_guest_id]) firstStay[r.primary_guest_id] = r.check_in
      }
      const { data: periodRes } = await supabase.from('reservations').select('primary_guest_id, check_in').not('primary_guest_id', 'is', null).gte('check_in', from).lte('check_in', to)
      const seen = new Set()
      let newG = 0, repeatG = 0
      for (const r of periodRes || []) {
        if (seen.has(r.primary_guest_id)) continue
        seen.add(r.primary_guest_id)
        const fs = firstStay[r.primary_guest_id]
        if (fs >= from && fs <= to) newG++; else repeatG++
      }
      return { head: ['Segment', 'Guests'], align: ['l', 'r'], rows: [['New', String(newG)], ['Repeat', String(repeatG)]], foot: ['TOTAL', String(newG + repeatG)] }
    }
    case 'gst_top_spenders': {
      const { data: res } = await supabase.from('reservations').select('id, primary_guest_id, check_in, guests(full_name, phone)').not('primary_guest_id', 'is', null).gte('check_in', from).lte('check_in', to)
      const resIds = (res || []).map((r) => r.id)
      const { data: pay } = resIds.length ? await supabase.from('payments').select('reservation_id, amount').in('reservation_id', resIds) : { data: [] }
      const paidByRes = {}
      for (const p of pay || []) paidByRes[p.reservation_id] = (paidByRes[p.reservation_id] || 0) + +p.amount
      const agg = {}
      for (const r of res || []) {
        const gid = r.primary_guest_id
        agg[gid] = agg[gid] || { name: (r.guests && r.guests.full_name) || '—', phone: (r.guests && r.guests.phone) || '—', resCount: 0, paid: 0 }
        agg[gid].resCount += 1
        agg[gid].paid += paidByRes[r.id] || 0
      }
      const list = Object.values(agg).sort((a, b) => b.paid - a.paid)
      const rows = list.map((g) => [g.name, g.phone, String(g.resCount), money(g.paid)])
      const t = list.reduce((a, g) => a + g.paid, 0)
      return { head: ['Guest', 'Phone', 'Reservations', 'Total Paid'], align: ['l', 'l', 'r', 'r'], rows, foot: ['', '', 'TOTAL', money(t)] }
    }
    case 'gst_loyalty_points': {
      const { data } = await supabase.from('guests').select('full_name, phone, loyalty_points').gt('loyalty_points', 0).order('loyalty_points', { ascending: false })
      const rows = (data || []).map((g) => [g.full_name, g.phone || '—', String(g.loyalty_points)])
      const t = (data || []).reduce((a, g) => a + (+g.loyalty_points || 0), 0)
      return { head: ['Guest', 'Phone', 'Loyalty Points'], align: ['l', 'l', 'r'], rows, foot: ['', 'TOTAL', String(t)] }
    }
    case 'gst_booking_source': {
      const { data } = await supabase.from('reservations').select('source').gte('check_in', from).lte('check_in', to)
      const agg = {}
      for (const r of data || []) { const k = r.source || 'Unknown'; agg[k] = (agg[k] || 0) + 1 }
      const rows = Object.entries(agg).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)])
      return { head: ['Source', 'Bookings'], align: ['l', 'r'], rows, foot: ['TOTAL', String((data || []).length)] }
    }
    case 'sal_today_arrivals': {
      const { data } = await supabase.from('reservations').select('res_no, reservation_name, check_in, check_out, pax_adults, pax_children, source, reservation_rooms(rooms(room_no))').in('status', ['CONFIRMED', 'QUOTED']).gte('check_in', from).lte('check_in', to).order('check_in')
      const rows = (data || []).map((r) => [r.res_no, r.reservation_name || '—', (r.reservation_rooms || []).map((x) => x.rooms && x.rooms.room_no).filter(Boolean).join(', ') || '—', fmtDate(r.check_in), fmtDate(r.check_out), `${r.pax_adults || 0}+${r.pax_children || 0}`, r.source || '—'])
      return { head: ['Res No', 'Guest', 'Room(s)', 'Arrival', 'Departure', 'Pax', 'Source'], align: ['l', 'l', 'l', 'l', 'l', 'l', 'l'], rows, foot: ['', '', '', '', '', '', `Expected: ${rows.length}`] }
    }
    case 'sal_today_departures': {
      const { data } = await supabase.from('reservations').select('res_no, reservation_name, check_in, check_out, pax_adults, pax_children, reservation_rooms(rooms(room_no))').eq('status', 'CHECKED_IN').gte('check_out', from).lte('check_out', to).order('check_out')
      const rows = (data || []).map((r) => [r.res_no, r.reservation_name || '—', (r.reservation_rooms || []).map((x) => x.rooms && x.rooms.room_no).filter(Boolean).join(', ') || '—', fmtDate(r.check_in), fmtDate(r.check_out), `${r.pax_adults || 0}+${r.pax_children || 0}`])
      return { head: ['Res No', 'Guest', 'Room(s)', 'Arrival', 'Departure', 'Pax'], align: ['l', 'l', 'l', 'l', 'l', 'l'], rows, foot: ['', '', '', '', '', `Expected: ${rows.length}`] }
    }
    case 'sal_discount_void': {
      const { data: fc } = await supabase.from('folio_charges').select('charge_date, charge_type, description, discount, created_by').gt('discount', 0).gte('charge_date', from).lte('charge_date', to).order('charge_date')
      const { data: posVoid } = await supabase.from('pos_orders').select('created_at, order_no, total, created_by').eq('status', 'CANCELLED').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59').order('created_at')
      const { data: invVoid } = await supabase.from('invoices').select('issued_at, invoice_no, totals, void_reason, voided_by').eq('is_void', true).gte('issued_at', from + 'T00:00:00').lte('issued_at', to + 'T23:59:59').order('issued_at')
      const items = []
      for (const r of fc || []) items.push({ date: r.charge_date, type: 'Discount', particulars: `${r.charge_type}${r.description ? ' — ' + r.description : ''}`, by: r.created_by || '—', amt: +r.discount })
      for (const r of posVoid || []) items.push({ date: r.created_at.slice(0, 10), type: 'POS Void', particulars: r.order_no, by: r.created_by || '—', amt: +r.total })
      for (const r of invVoid || []) items.push({ date: r.issued_at.slice(0, 10), type: 'Invoice Void', particulars: `${r.invoice_no}${r.void_reason ? ' — ' + r.void_reason : ''}`, by: r.voided_by || '—', amt: +((r.totals && r.totals.total) || 0) })
      items.sort((a, b) => (a.date < b.date ? -1 : 1))
      const rows = items.map((it) => [fmtDate(it.date), it.type, it.particulars, it.by, money(it.amt)])
      const t = items.reduce((a, it) => a + it.amt, 0)
      return { head: ['Date', 'Type', 'Particulars', 'By', 'Amount'], align: ['l', 'l', 'l', 'l', 'r'], rows, foot: ['', '', '', 'TOTAL', money(t)] }
    }
    case 'hk_room_status_live': {
      const { data } = await supabase.from('rooms').select('room_no, room_type, status, hk_status').eq('is_active', true).order('room_no')
      const rows = (data || []).map((r) => [r.room_no, r.room_type || '—', r.status || '—', r.hk_status || '—'])
      return { head: ['Room', 'Type', 'Room Status', 'Housekeeping Status'], align: ['l', 'l', 'l', 'l'], rows, foot: ['', '', '', `Total: ${rows.length}`] }
    }
    case 'adm_audit_trail': {
      const { data } = await supabase.from('audit_log').select('at, actor, action, entity, entity_id').gte('at', from + 'T00:00:00').lte('at', to + 'T23:59:59').order('at', { ascending: false })
      const rows = (data || []).map((r) => [fmtDate(r.at), r.actor || '—', r.action || '—', r.entity || '—', r.entity_id || '—'])
      return { head: ['Date/Time', 'User', 'Action', 'Entity', 'Entity ID'], align: ['l', 'l', 'l', 'l', 'l'], rows, foot: ['', '', '', 'Total', String(rows.length)] }
    }
    case 'acc_ar_aging': {
      const { data: ch } = await supabase.from('folio_charges').select('reservation_id, charge_date, total, status').eq('status', 'DUE')
      const { data: pay } = await supabase.from('payments').select('reservation_id, amount')
      const { data: res } = await supabase.from('reservations').select('id, res_no, reservation_name')
      const paid = {}
      for (const p of pay || []) paid[p.reservation_id] = (paid[p.reservation_id] || 0) + +p.amount
      const byRes = {}
      for (const c of ch || []) {
        const r = byRes[c.reservation_id] || { charged: 0, oldest: c.charge_date }
        r.charged += +c.total
        if (c.charge_date < r.oldest) r.oldest = c.charge_date
        byRes[c.reservation_id] = r
      }
      const resMeta = {}
      for (const r of res || []) resMeta[r.id] = r
      const today = todayISO()
      const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000)
      const list = []
      for (const rid of Object.keys(byRes)) {
        const due = byRes[rid].charged - (paid[rid] || 0)
        if (due <= 0.5) continue
        const meta = resMeta[rid] || {}
        const age = daysBetween(byRes[rid].oldest, today)
        const bucket = age > 90 ? '90+ days' : age > 60 ? '61-90 days' : age > 30 ? '31-60 days' : age > 0 ? '1-30 days' : 'Current'
        list.push({ resNo: meta.res_no || '—', name: meta.reservation_name || '—', oldest: byRes[rid].oldest, age, bucket, due })
      }
      list.sort((a, b) => b.due - a.due)
      const rows = list.map((r) => [r.resNo, r.name, fmtDate(r.oldest), String(r.age), r.bucket, money(r.due)])
      const total = list.reduce((a, r) => a + r.due, 0)
      return { head: ['Res No', 'Guest', 'Oldest Due', 'Age (days)', 'Bucket', 'Due'], align: ['l', 'l', 'l', 'r', 'l', 'r'], rows, foot: ['', '', '', '', 'TOTAL DUE', money(total)] }
    }
    case 'sal_adr_revpar': {
      const { data: rooms } = await supabase.from('rooms').select('id').eq('is_active', true)
      const totalRooms = (rooms || []).length
      const days = Math.floor((new Date(to) - new Date(from)) / 86400000) + 1
      const availableRoomNights = totalRooms * days
      const { data: rr } = await supabase.from('reservation_rooms').select('rate, from_date, to_date')
      let roomNightsSold = 0, roomRevenue = 0
      for (const r of rr || []) {
        const fd = r.from_date || from; const td = r.to_date || to
        const s = fd > from ? fd : from; const e = td < to ? td : to
        const nights = Math.max(0, Math.floor((new Date(e) - new Date(s)) / 86400000))
        if (nights > 0) { roomNightsSold += nights; roomRevenue += nights * +r.rate }
      }
      const adr = roomNightsSold ? roomRevenue / roomNightsSold : 0
      const revpar = availableRoomNights ? roomRevenue / availableRoomNights : 0
      const occPct = availableRoomNights ? (roomNightsSold / availableRoomNights) * 100 : 0
      const rows = [['Total Rooms', String(totalRooms)], ['Days in Period', String(days)], ['Available Room-Nights', String(availableRoomNights)], ['Room-Nights Sold', String(roomNightsSold)], ['Room Revenue', money(roomRevenue)], ['Occupancy %', occPct.toFixed(1) + '%'], ['ADR (Average Daily Rate)', money(adr)], ['RevPAR (Revenue per Available Room)', money(revpar)]]
      return { head: ['Metric', 'Value'], align: ['l', 'r'], rows, foot: null }
    }
    case 'sal_room_type_sales': {
      const { data: rr } = await supabase.from('reservation_rooms').select('rate, from_date, to_date, rooms(room_type)')
      const agg = {}
      for (const r of rr || []) {
        const fd = r.from_date || from; const td = r.to_date || to
        const s = fd > from ? fd : from; const e = td < to ? td : to
        const nights = Math.max(0, Math.floor((new Date(e) - new Date(s)) / 86400000))
        if (nights <= 0) continue
        const rt = (r.rooms && r.rooms.room_type) || 'Unknown'
        agg[rt] = agg[rt] || { nights: 0, rev: 0 }; agg[rt].nights += nights; agg[rt].rev += nights * +r.rate
      }
      const rows = Object.entries(agg).sort((a, b) => b[1].rev - a[1].rev).map(([rt, v]) => [rt, String(v.nights), money(v.nights ? v.rev / v.nights : 0), money(v.rev)])
      const t = Object.values(agg).reduce((a, v) => ({ n: a.n + v.nights, r: a.r + v.rev }), { n: 0, r: 0 })
      return { head: ['Room Type', 'Room-Nights', 'Avg Rate', 'Revenue'], align: ['l', 'r', 'r', 'r'], rows, foot: ['TOTAL', String(t.n), '', money(t.r)] }
    }
    case 'sal_booking_pace': {
      const { data } = await supabase.from('reservations').select('res_no, reservation_name, check_in, created_at, status, room_rate').in('status', ['CONFIRMED', 'QUOTED', 'CHECKED_IN']).gte('check_in', from).lte('check_in', to)
      const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000)
      const buckets = [{ label: '0-3 days', min: 0, max: 3, n: 0, rev: 0 }, { label: '4-7 days', min: 4, max: 7, n: 0, rev: 0 }, { label: '8-14 days', min: 8, max: 14, n: 0, rev: 0 }, { label: '15-30 days', min: 15, max: 30, n: 0, rev: 0 }, { label: '31-60 days', min: 31, max: 60, n: 0, rev: 0 }, { label: '60+ days', min: 61, max: Infinity, n: 0, rev: 0 }]
      for (const r of data || []) {
        const lead = daysBetween((r.created_at || '').slice(0, 10), r.check_in)
        const b = buckets.find((x) => lead >= x.min && lead <= x.max) || buckets[buckets.length - 1]
        b.n += 1; b.rev += +(r.room_rate || 0)
      }
      const rows = buckets.map((b) => [b.label, String(b.n), money(b.rev)])
      const t = buckets.reduce((a, b) => ({ n: a.n + b.n, rev: a.rev + b.rev }), { n: 0, rev: 0 })
      return { head: ['Lead Time', 'Bookings', 'Room Rate Value'], align: ['l', 'r', 'r'], rows, foot: ['TOTAL', String(t.n), money(t.rev)] }
    }
    case 'sal_source_revenue': {
      const { data: res } = await supabase.from('reservations').select('id, source').gte('check_in', from).lte('check_in', to)
      const resIds = (res || []).map((r) => r.id)
      const { data: rr } = resIds.length ? await supabase.from('reservation_rooms').select('reservation_id, rate, from_date, to_date').in('reservation_id', resIds) : { data: [] }
      const revByRes = {}
      for (const r of rr || []) {
        const fd = r.from_date || from; const td = r.to_date || to
        const s = fd > from ? fd : from; const e = td < to ? td : to
        const nights = Math.max(0, Math.floor((new Date(e) - new Date(s)) / 86400000))
        revByRes[r.reservation_id] = (revByRes[r.reservation_id] || 0) + nights * +r.rate
      }
      const agg = {}
      for (const r of res || []) { const k = r.source || 'Unknown'; agg[k] = agg[k] || { n: 0, rev: 0 }; agg[k].n += 1; agg[k].rev += revByRes[r.id] || 0 }
      const rows = Object.entries(agg).sort((a, b) => b[1].rev - a[1].rev).map(([k, v]) => [k, String(v.n), money(v.rev)])
      const t = Object.values(agg).reduce((a, v) => ({ n: a.n + v.n, rev: a.rev + v.rev }), { n: 0, rev: 0 })
      return { head: ['Source', 'Bookings', 'Room Revenue'], align: ['l', 'r', 'r'], rows, foot: ['TOTAL', String(t.n), money(t.rev)] }
    }
    case 'pos_table_sales': {
      const { data } = await supabase.from('pos_orders').select('outlet, table_no, total').eq('status', 'SETTLED').gte('settled_at', from + 'T00:00:00').lte('settled_at', to + 'T23:59:59')
      const agg = {}
      for (const r of data || []) { const k = `${r.outlet || 'Restaurant'} — ${r.table_no || 'N/A'}`; agg[k] = (agg[k] || 0) + +r.total }
      const rows = Object.entries(agg).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, money(v)])
      const t = Object.values(agg).reduce((a, v) => a + v, 0)
      return { head: ['Outlet — Table/Section', 'Sales'], align: ['l', 'r'], rows, foot: ['TOTAL', money(t)] }
    }
    case 'pos_void_discount': {
      const { data } = await supabase.from('pos_orders').select('order_no, outlet, table_no, status, discount_pct, discount, total, created_at, created_by').or('status.eq.CANCELLED,discount_pct.gt.0').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59').order('created_at')
      const rows = (data || []).map((r) => [fmtDate(r.created_at), r.order_no, r.outlet || '—', r.status === 'CANCELLED' ? 'Void' : 'Discount', r.status === 'CANCELLED' ? money(r.total) : `${r.discount_pct}%`, r.created_by || '—'])
      return { head: ['Date', 'Order', 'Outlet', 'Type', 'Value', 'By'], align: ['l', 'l', 'l', 'l', 'r', 'l'], rows, foot: ['', '', '', '', '', `Total: ${rows.length}`] }
    }
    case 'sal_complimentary_rooms': {
      const { data: shRes } = await supabase.from('reservations').select('res_no, reservation_name, check_in, check_out, shareholder_id, shareholders(name)').not('shareholder_id', 'is', null).gte('check_in', from).lte('check_in', to)
      const { data: zeroRooms } = await supabase.from('reservation_rooms').select('rate, rooms(room_no), reservations!inner(res_no, reservation_name, check_in, check_out, shareholder_id)').eq('rate', 0).gte('reservations.check_in', from).lte('reservations.check_in', to)
      const rows = []
      for (const r of shRes || []) rows.push([r.res_no, r.reservation_name || '—', fmtDate(r.check_in), fmtDate(r.check_out), 'Shareholder Free Stay', (r.shareholders && r.shareholders.name) || '—'])
      for (const r of zeroRooms || []) { const res = r.reservations; if (!res || res.shareholder_id) continue; rows.push([res.res_no, res.reservation_name || '—', fmtDate(res.check_in), fmtDate(res.check_out), 'Zero-Rate / House Use', (r.rooms && r.rooms.room_no) || '—']) }
      return { head: ['Res No', 'Guest', 'Check-in', 'Check-out', 'Type', 'Detail'], align: ['l', 'l', 'l', 'l', 'l', 'l'], rows, foot: ['', '', '', '', '', `Total: ${rows.length}`] }
    }
    case 'sal_group_block': {
      const { data } = await supabase.from('reservation_rooms').select('reservation_id, rooms(room_no), reservations!inner(res_no, reservation_name, check_in, check_out, status)').gte('reservations.check_in', from).lte('reservations.check_in', to)
      const byRes = {}
      for (const r of data || []) { const res = r.reservations; byRes[r.reservation_id] = byRes[r.reservation_id] || { res, rooms: [] }; byRes[r.reservation_id].rooms.push((r.rooms && r.rooms.room_no) || '—') }
      const groups = Object.values(byRes).filter((g) => g.rooms.length > 1)
      const rows = groups.map((g) => [g.res.res_no, g.res.reservation_name || '—', String(g.rooms.length), g.rooms.join(', '), fmtDate(g.res.check_in), fmtDate(g.res.check_out), g.res.status])
      return { head: ['Res No', 'Guest', 'Rooms', 'Room List', 'Check-in', 'Check-out', 'Status'], align: ['l', 'l', 'r', 'l', 'l', 'l', 'l'], rows, foot: ['', '', '', '', '', '', `Group bookings: ${rows.length}`] }
    }
    case 'acc_ap_aging': {
      const { data } = await supabase.from('v_ap_aging').select('*').gt('outstanding', 0).order('due_date')
      const today = todayISO()
      const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000)
      const list = (data || []).map((r) => { const age = daysBetween(r.due_date, today); const bucket = age > 90 ? '90+ days' : age > 60 ? '61-90 days' : age > 30 ? '31-60 days' : age > 0 ? '1-30 days' : 'Current'; return { ...r, age, bucket } })
      list.sort((a, b) => b.outstanding - a.outstanding)
      const rows = list.map((r) => [r.grn_no, r.vendor_name, fmtDate(r.due_date), String(r.age), r.bucket, money(r.outstanding)])
      const total = list.reduce((a, r) => a + +r.outstanding, 0)
      return { head: ['GRN No', 'Vendor', 'Due Date', 'Age (days)', 'Bucket', 'Outstanding'], align: ['l', 'l', 'l', 'r', 'l', 'r'], rows, foot: ['', '', '', '', 'TOTAL PAYABLE', money(total)] }
    }
    case 'adm_exec_summary': {
      const { data: rooms } = await supabase.from('rooms').select('id').eq('is_active', true)
      const totalRooms = (rooms || []).length
      const days = Math.floor((new Date(to) - new Date(from)) / 86400000) + 1
      const availableRoomNights = totalRooms * days
      const { data: rr } = await supabase.from('reservation_rooms').select('rate, from_date, to_date')
      let roomNightsSold = 0, roomRevenue = 0
      for (const r of rr || []) { const fd = r.from_date || from; const td = r.to_date || to; const s = fd > from ? fd : from; const e = td < to ? td : to; const nights = Math.max(0, Math.floor((new Date(e) - new Date(s)) / 86400000)); if (nights > 0) { roomNightsSold += nights; roomRevenue += nights * +r.rate } }
      const occPct = availableRoomNights ? (roomNightsSold / availableRoomNights) * 100 : 0
      const adr = roomNightsSold ? roomRevenue / roomNightsSold : 0
      const revpar = availableRoomNights ? roomRevenue / availableRoomNights : 0
      const { data: posData } = await supabase.from('pos_orders').select('total').eq('status', 'SETTLED').gte('settled_at', from + 'T00:00:00').lte('settled_at', to + 'T23:59:59')
      const posRevenue = (posData || []).reduce((a, r) => a + +r.total, 0)
      const { data: facData } = await supabase.from('facility_sales').select('total').eq('status', 'SETTLED').gte('sale_date', from).lte('sale_date', to)
      const facRevenue = (facData || []).reduce((a, r) => a + +r.total, 0)
      const { data: payData } = await supabase.from('payments').select('amount').gte('received_date', from).lte('received_date', to)
      const collections = (payData || []).reduce((a, r) => a + +r.amount, 0)
      const { data: bookings } = await supabase.from('reservations').select('id').gte('check_in', from).lte('check_in', to)
      const rows = [['Occupancy %', occPct.toFixed(1) + '%'], ['ADR', money(adr)], ['RevPAR', money(revpar)], ['Room Revenue', money(roomRevenue)], ['Restaurant/POS Revenue', money(posRevenue)], ['Facility Revenue', money(facRevenue)], ['Total Revenue', money(roomRevenue + posRevenue + facRevenue)], ['Total Collections', money(collections)], ['Bookings (by Check-in date)', String((bookings || []).length)]]
      return { head: ['KPI', 'Value'], align: ['l', 'r'], rows, foot: null }
    }
    case 'acc_expense_category': {
      const acc = await periodBalances(from, to)
      const exp = acc.filter((a) => a.type === 'EXPENSE').map((a) => ({ ...a, amt: a.debit - a.credit })).sort((a, b) => b.amt - a.amt)
      const rows = exp.map((a) => [a.code, a.name, money(a.amt)])
      const t = exp.reduce((a, x) => a + x.amt, 0)
      return { head: ['Code', 'Expense Category', 'Amount'], align: ['l', 'l', 'r'], rows, foot: ['', 'TOTAL EXPENSE', money(t)] }
    }
    case 'inv_low_stock': {
      const { data } = await supabase.from('v_stock_balance').select('*').order('on_hand')
      const low = (data || []).filter((r) => +r.on_hand <= +r.reorder_level)
      const rows = low.map((r) => [r.code || '—', r.name, r.category || '—', r.unit, String(r.on_hand), String(r.reorder_level), String(+r.reorder_level - +r.on_hand)])
      return { head: ['Code', 'Item', 'Category', 'Unit', 'On Hand', 'Reorder Level', 'Shortfall'], align: ['l', 'l', 'l', 'l', 'r', 'r', 'r'], rows, foot: ['', '', '', '', '', '', `Items low: ${rows.length}`] }
    }
    case 'hk_lost_found': {
      const { data } = await supabase.from('lost_found_items').select('found_date, item_description, found_location, found_by, room_no, guest_name, status, claimed_by, claimed_date').gte('found_date', from).lte('found_date', to).order('found_date', { ascending: false })
      const rows = (data || []).map((r) => [fmtDate(r.found_date), r.item_description, r.found_location || '—', r.room_no || '—', r.status, r.status === 'CLAIMED' ? `${r.claimed_by || '—'} (${fmtDate(r.claimed_date)})` : '—'])
      return { head: ['Found Date', 'Item', 'Location', 'Room', 'Status', 'Claimed By'], align: ['l', 'l', 'l', 'l', 'l', 'l'], rows, foot: ['', '', '', '', '', `Total: ${rows.length}`] }
    }
    default:
      return { head: ['Info'], align: ['l'], rows: [['This report is not wired yet.']], foot: null }
  }
}

async function periodBalances(from, to) {
  let q = supabase.from('v_ledger').select('account_code, account_name, account_type, debit, credit')
  if (from) q = q.gte('jv_date', from)
  if (to) q = q.lte('jv_date', to)
  const { data } = await q
  const agg = {}
  for (const r of data || []) {
    const k = r.account_code
    agg[k] = agg[k] || { code: r.account_code, name: r.account_name, type: r.account_type, debit: 0, credit: 0 }
    agg[k].debit += +r.debit; agg[k].credit += +r.credit
  }
  return Object.values(agg).sort((a, b) => a.code < b.code ? -1 : 1)
}

async function ledgerForCodes(codes, from, to, label) {
  const { data } = await supabase.from('v_ledger').select('*').in('account_code', codes).gte('jv_date', from).lte('jv_date', to).order('jv_date')
  let bal = 0
  const rows = (data || []).map((r) => { bal += (+r.debit - +r.credit); return [fmtDate(r.jv_date), r.jv_no, r.line_note || r.narration || '', money(r.debit), money(r.credit), money(bal)] })
  const t = (data || []).reduce((a, r) => ({ d: a.d + +r.debit, c: a.c + +r.credit }), { d: 0, c: 0 })
  return { head: ['Date', 'JV', `Particulars (${label})`, 'Debit', 'Credit', 'Balance'], align: ['l', 'l', 'l', 'r', 'r', 'r'], rows, foot: ['', '', 'TOTAL', money(t.d), money(t.c), money(t.d - t.c)] }
}

const BUILDER_SOURCES = {
  folio_charges: { label: 'Folio Charges', date_col: 'charge_date', fields: [{ field: 'charge_date', label: 'Date', type: 'date' }, { field: 'charge_type', label: 'Type', type: 'text' }, { field: 'description', label: 'Description', type: 'text' }, { field: 'base_amount', label: 'Base', type: 'money' }, { field: 'discount', label: 'Discount', type: 'money' }, { field: 'service_charge', label: 'Service charge', type: 'money' }, { field: 'sd', label: 'SD', type: 'money' }, { field: 'vat', label: 'VAT', type: 'money' }, { field: 'total', label: 'Total', type: 'money' }, { field: 'status', label: 'Status', type: 'text' }] },
  payments: { label: 'Payments', date_col: 'received_date', fields: [{ field: 'received_date', label: 'Date', type: 'date' }, { field: 'method', label: 'Method', type: 'text' }, { field: 'amount', label: 'Amount', type: 'money' }, { field: 'payment_class', label: 'Class', type: 'text' }, { field: 'reference', label: 'Reference', type: 'text' }, { field: 'received_by', label: 'By', type: 'text' }] },
  pos_orders: { label: 'POS Orders', date_col: 'settled_at', fields: [{ field: 'order_no', label: 'Order', type: 'text' }, { field: 'order_type', label: 'Type', type: 'text' }, { field: 'outlet', label: 'Outlet', type: 'text' }, { field: 'payment_method', label: 'Method', type: 'text' }, { field: 'total', label: 'Total', type: 'money' }, { field: 'status', label: 'Status', type: 'text' }] },
  facility_sales: { label: 'Facility Sales', date_col: 'sale_date', fields: [{ field: 'sale_date', label: 'Date', type: 'date' }, { field: 'item_name', label: 'Item', type: 'text' }, { field: 'qty', label: 'Qty', type: 'num' }, { field: 'total', label: 'Total', type: 'money' }, { field: 'status', label: 'Status', type: 'text' }] },
  vat_sales_register: { label: 'VAT Sales Register', date_col: 'issue_date', fields: [{ field: 'issue_date', label: 'Date', type: 'date' }, { field: 'invoice_no', label: 'Invoice', type: 'text' }, { field: 'buyer_name', label: 'Buyer', type: 'text' }, { field: 'taxable_value', label: 'Taxable', type: 'money' }, { field: 'sd', label: 'SD', type: 'money' }, { field: 'vat', label: 'VAT', type: 'money' }, { field: 'total', label: 'Total', type: 'money' }] },
  vat_purchase_register: { label: 'VAT Purchase Register', date_col: 'entry_date', fields: [{ field: 'entry_date', label: 'Date', type: 'date' }, { field: 'vendor_name', label: 'Vendor', type: 'text' }, { field: 'invoice_no', label: 'Invoice', type: 'text' }, { field: 'taxable_value', label: 'Taxable', type: 'money' }, { field: 'vat_amount', label: 'VAT', type: 'money' }, { field: 'total', label: 'Total', type: 'money' }] },
  reservations: { label: 'Reservations', date_col: 'check_in', fields: [{ field: 'res_no', label: 'Res No', type: 'text' }, { field: 'reservation_name', label: 'Guest', type: 'text' }, { field: 'check_in', label: 'Check-in', type: 'date' }, { field: 'check_out', label: 'Check-out', type: 'date' }, { field: 'status', label: 'Status', type: 'text' }, { field: 'room_rate', label: 'Room rate', type: 'money' }, { field: 'source', label: 'Source', type: 'text' }, { field: 'created_by', label: 'Created by', type: 'text' }] },
  v_ledger: { label: 'Ledger (journal lines)', date_col: 'jv_date', fields: [{ field: 'jv_date', label: 'Date', type: 'date' }, { field: 'jv_no', label: 'JV', type: 'text' }, { field: 'account_code', label: 'A/C code', type: 'text' }, { field: 'account_name', label: 'Account', type: 'text' }, { field: 'debit', label: 'Debit', type: 'money' }, { field: 'credit', label: 'Credit', type: 'money' }, { field: 'line_note', label: 'Note', type: 'text' }, { field: 'source', label: 'Source', type: 'text' }] },
}

function fmtCell(val, type) {
  if (val === null || val === undefined || val === '') return type === 'money' ? money(0) : '—'
  if (type === 'money') return money(val)
  if (type === 'date') return fmtDate(val)
  return String(val)
}

async function runCustomReport(config, from, to) {
  const src = BUILDER_SOURCES[config.source]
  if (!src) return { head: ['Error'], align: ['l'], rows: [['Unknown source']], foot: null }
  const cols = config.columns || src.fields
  const sel = cols.map((c) => c.field).join(', ')
  let q = supabase.from(config.source).select(sel)
  const dcol = config.date_col || src.date_col
  if (dcol) { const isTs = dcol.endsWith('_at'); q = q.gte(dcol, isTs ? from + 'T00:00:00' : from).lte(dcol, isTs ? to + 'T23:59:59' : to) }
  for (const f of config.filters || []) if (f.field && f.value !== '') q = q.eq(f.field, f.value)
  q = q.order(dcol || cols[0].field)
  const { data, error } = await q
  if (error) return { head: ['Error'], align: ['l'], rows: [[error.message]], foot: null }
  const head = cols.map((c) => c.label)
  const align = cols.map((c) => (c.type === 'money' || c.type === 'num') ? 'r' : 'l')
  const rows = (data || []).map((r) => cols.map((c) => fmtCell(r[c.field], c.type)))
  let foot = null
  if ((config.totals || []).length) { foot = cols.map((c, i) => { if (config.totals.includes(c.field)) { const s = (data || []).reduce((a, r) => a + (+r[c.field] || 0), 0); return money(s) }; return i === 0 ? 'TOTAL' : '' }) }
  return { head, align, rows, foot }
}

function ReportBuilder({ onClose, onSaved }) {
  const [name, setName] = useState('')
  const [dept, setDept] = useState('Custom')
  const [source, setSource] = useState('folio_charges')
  const src = BUILDER_SOURCES[source]
  const [picked, setPicked] = useState(src.fields.map((f) => f.field))
  const [totals, setTotals] = useState([])
  const [fStatusField, setFStatusField] = useState('')
  const [fStatusVal, setFStatusVal] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const onSource = (s) => { setSource(s); const sf = BUILDER_SOURCES[s]; setPicked(sf.fields.map((f) => f.field)); setTotals([]); setFStatusField('') }
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const save = async () => {
    if (!name.trim()) { setErr('Give the report a name.'); return }
    if (picked.length === 0) { setErr('Pick at least one column.'); return }
    setBusy(true); setErr('')
    const columns = src.fields.filter((f) => picked.includes(f.field))
    const config = { source, date_col: src.date_col, columns, totals: totals.filter((t) => picked.includes(t)), filters: fStatusField && fStatusVal ? [{ field: fStatusField, op: 'eq', value: fStatusVal }] : [] }
    const key = 'custom_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') + '_' + Date.now().toString(36)
    const { error } = await supabase.from('report_definitions').insert({ department: dept || 'Custom', report_name: name.trim(), report_key: key, status: 'READY', is_custom: true, config, sort_order: 900 })
    setBusy(false)
    if (error) { setErr(error.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-start justify-center overflow-auto p-6">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-leaf">
          <h3 className="font-display font-semibold text-pine">Build a custom report</h3>
          <button className="btn-ghost !py-1" onClick={onClose}>Close</button>
        </div>
        <div className="p-5 space-y-4">
          {err && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{err}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Report name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Settled POS Orders" /></div>
            <div><label className="label">Department</label><input className="input" value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Custom" /></div>
          </div>
          <div>
            <label className="label">Data source</label>
            <select className="input" value={source} onChange={(e) => onSource(e.target.value)}>{Object.entries(BUILDER_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            <p className="text-[11px] text-pine/50 mt-1">Date filter uses "{src.date_col}". Cycle/date range applies automatically.</p>
          </div>
          <div>
            <label className="label">Columns to show</label>
            <div className="flex flex-wrap gap-2">{src.fields.map((f) => (<button key={f.field} onClick={() => toggle(picked, setPicked, f.field)} className={`px-2 py-1 rounded-lg text-xs border ${picked.includes(f.field) ? 'bg-forest text-white border-forest' : 'border-leaf text-pine'}`}>{f.label}</button>))}</div>
          </div>
          <div>
            <label className="label">Sum these columns (totals row)</label>
            <div className="flex flex-wrap gap-2">{src.fields.filter((f) => f.type === 'money' || f.type === 'num').map((f) => (<button key={f.field} onClick={() => toggle(totals, setTotals, f.field)} className={`px-2 py-1 rounded-lg text-xs border ${totals.includes(f.field) ? 'bg-amber text-white border-amber' : 'border-leaf text-pine'}`}>{f.label}</button>))}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Optional filter — field</label><select className="input" value={fStatusField} onChange={(e) => setFStatusField(e.target.value)}><option value="">(none)</option>{src.fields.filter((f) => f.type === 'text').map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}</select></div>
            <div><label className="label">equals</label><input className="input" value={fStatusVal} onChange={(e) => setFStatusVal(e.target.value)} placeholder="e.g. SETTLED" disabled={!fStatusField} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save report'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
