import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO, exportXLSX } from '../lib/helpers'
import { Calculator, Plus, Trash2, FileDown, Scale, Building2, Printer, Pencil } from 'lucide-react'
import PrintPortal from '../components/PrintPortal.jsx'
import VoucherDoc from '../components/print/VoucherDoc.jsx'

const TABS = ['Journal Vouchers', 'Trial Balance', 'Chart of Accounts', 'Fixed Assets']

export default function AccountingHub({ userName, isAdmin }) {
  const [tab, setTab] = useState('Journal Vouchers')
  const [accounts, setAccounts] = useState([])
  const [company, setCompany] = useState(null)
  const [msg, setMsg] = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 5000) }

  const loadAccounts = async () => { const { data } = await supabase.from('chart_of_accounts').select('*').eq('is_active', true).order('code'); setAccounts(data || []) }
  useEffect(() => {
    loadAccounts()
    supabase.from('company_settings').select('*').eq('id', 1).single().then(({ data }) => setCompany(data))
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2"><Calculator className="text-forest" /> Accounting</h1>
        <p className="text-sm text-pine/60">Double-entry journals (IFRS), trial balance, chart of accounts and fixed-asset depreciation.</p>
      </div>
      {msg && <div className="px-4 py-3 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}
      <div className="flex gap-1 justify-end items-center flex-wrap">
                      <button className="btn-ghost !py-1" title="Print voucher (auto Dr/Cr/JV)" onClick={() => openVoucher(r, undefined)}><Printer size={13} /> Voucher</button>
                      <button className="btn-ghost !py-1" title="Edit" onClick={() => edit(r)}><Pencil size={13} /></button>
                      {isAdmin && <button className="btn-ghost !py-1 text-red-600" title="Delete" onClick={() => del(r.id)}><Trash2 size={13} /></button>}
                    </div>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${tab === t ? 'bg-white border border-leaf border-b-white text-forest -mb-px' : 'text-pine/60 hover:text-pine'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Journal Vouchers' && <JournalsTab accounts={accounts} userName={userName} flash={flash} company={company} isAdmin={isAdmin} />}
      {tab === 'Trial Balance' && <TrialBalance />}
      {tab === 'Chart of Accounts' && <CoaTab accounts={accounts} reload={loadAccounts} flash={flash} isAdmin={isAdmin} />}
      {tab === 'Fixed Assets' && <AssetsTab accounts={accounts} userName={userName} flash={flash} />}
    </div>
  )
}

/* ---------------- JOURNAL VOUCHERS (+ Debit / Credit voucher print) ---------------- */
function JournalsTab({ accounts, userName, flash, company, isAdmin }) {
  const [rows, setRows] = useState([])
  const [head, setHead] = useState({ jv_date: todayISO(), narration: '' })
  const [lines, setLines] = useState([{ account_id: '', debit: '', credit: '', line_note: '' }, { account_id: '', debit: '', credit: '', line_note: '' }])
  const [editingId, setEditingId] = useState(null)
  const [printV, setPrintV] = useState(null) // { entry, lines, type }

  const load = async () => {
    const { data } = await supabase.from('journal_entries').select('*, journal_lines(*, chart_of_accounts(code,name))').order('created_at', { ascending: false }).limit(60)
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const upd = (i, k, v) => { const n = [...lines]; n[i][k] = v; setLines(n) }
  const addLine = () => setLines([...lines, { account_id: '', debit: '', credit: '', line_note: '' }])
  const delLine = (i) => setLines(lines.length > 2 ? lines.filter((_, idx) => idx !== i) : lines)
  const totDr = lines.reduce((a, l) => a + (+l.debit || 0), 0)
  const totCr = lines.reduce((a, l) => a + (+l.credit || 0), 0)
  const balanced = totDr > 0 && Math.abs(totDr - totCr) < 0.01

  const resetForm = () => { setEditingId(null); setHead({ jv_date: todayISO(), narration: '' }); setLines([{ account_id: '', debit: '', credit: '', line_note: '' }, { account_id: '', debit: '', credit: '', line_note: '' }]) }

  const post = async () => {
    if (!balanced) { flash('Debit and credit must be equal and non-zero.'); return }
    const valid = lines.filter((l) => l.account_id && (+l.debit || +l.credit))
    if (valid.length < 2) { flash('A journal needs at least two valid lines.'); return }
    try {
      if (editingId) {
        const { error: ue } = await supabase.from('journal_entries').update({ jv_date: head.jv_date, narration: head.narration }).eq('id', editingId)
        if (ue) throw ue
        await supabase.from('journal_lines').delete().eq('entry_id', editingId)
        const { error: le } = await supabase.from('journal_lines').insert(valid.map((l) => ({ entry_id: editingId, account_id: l.account_id, debit: +l.debit || 0, credit: +l.credit || 0, line_note: l.line_note })))
        if (le) throw le
        flash('Journal updated.')
      } else {
        const { data: jv, error: je } = await supabase.from('journal_entries').insert({ jv_date: head.jv_date, narration: head.narration, source: 'MANUAL', posted_by: userName }).select().single()
        if (je) throw je
        const { error: le } = await supabase.from('journal_lines').insert(valid.map((l) => ({ entry_id: jv.id, account_id: l.account_id, debit: +l.debit || 0, credit: +l.credit || 0, line_note: l.line_note })))
        if (le) throw le
        flash(`${jv.jv_no} posted.`)
      }
      resetForm(); load()
    } catch (e) { flash(e.message) }
  }

  const edit = (r) => {
    setEditingId(r.id)
    setHead({ jv_date: r.jv_date, narration: r.narration || '' })
    setLines((r.journal_lines || []).map((l) => ({ account_id: l.account_id, debit: l.debit || '', credit: l.credit || '', line_note: l.line_note || '' })))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const del = async (id) => {
    if (!window.confirm('Delete this voucher permanently? This cannot be undone.')) return
    const { error } = await supabase.from('journal_entries').delete().eq('id', id)
    if (error) flash(error.message); else { if (editingId === id) resetForm(); load(); flash('Voucher deleted.') }
  }

  const openVoucher = (r, type) => {
    const vlines = (r.journal_lines || []).map((l) => ({ code: l.chart_of_accounts?.code, name: l.chart_of_accounts?.name, debit: l.debit, credit: l.credit, line_note: l.line_note }))
    setPrintV({ entry: r, lines: vlines, type })
  }

  return (
    <div className="space-y-4">
      {printV && (
        <PrintPortal title={`Voucher — ${printV.entry.jv_no}`} onClose={() => setPrintV(null)}>
          <VoucherDoc entry={printV.entry} lines={printV.lines} company={company} voucherType={printV.type} />
        </PrintPortal>
      )}

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-pine">{editingId ? 'Edit journal voucher' : 'New journal voucher'}</h3>
          {editingId && <button className="btn-ghost !py-1 text-sm" onClick={resetForm}>Cancel edit</button>}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <input type="date" className="input" value={head.jv_date} onChange={(e) => setHead({ ...head, jv_date: e.target.value })} />
          <input className="input col-span-3" placeholder="Narration" value={head.narration} onChange={(e) => setHead({ ...head, narration: e.target.value })} />
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <select className="input col-span-4" value={l.account_id} onChange={(e) => upd(i, 'account_id', e.target.value)}><option value="">Account…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select>
            <input type="number" className="input col-span-2 money" placeholder="Debit" value={l.debit} onChange={(e) => upd(i, 'debit', e.target.value)} />
            <input type="number" className="input col-span-2 money" placeholder="Credit" value={l.credit} onChange={(e) => upd(i, 'credit', e.target.value)} />
            <input className="input col-span-3" placeholder="Note" value={l.line_note} onChange={(e) => upd(i, 'line_note', e.target.value)} />
            <button className="text-red-400 hover:text-red-600 col-span-1" onClick={() => delLine(i)}><Trash2 size={15} /></button>
          </div>
        ))}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button className="btn-ghost !py-1" onClick={addLine}><Plus size={14} /> Add line</button>
          <div className={`money font-semibold text-sm ${balanced ? 'text-forest' : 'text-red-600'}`}>Dr {totDr.toFixed(2)} · Cr {totCr.toFixed(2)} {balanced ? '✓ balanced' : '✗ not balanced'}</div>
          <button className="btn-primary" disabled={!balanced} onClick={post}><Plus size={15} /> {editingId ? 'Update journal' : 'Post journal'}</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">JV No</th><th className="th">Date</th><th className="th">Narration</th><th className="th text-right">Amount</th><th className="th text-right">Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const amt = (r.journal_lines || []).reduce((a, l) => a + +l.debit, 0)
              return (
                <tr key={r.id}>
                  <td className="td font-semibold money">{r.jv_no}</td>
                  <td className="td text-xs">{fmtDate(r.jv_date)}</td>
                  <td className="td text-sm">{r.narration}</td>
                  <td className="td money text-right">{fmtBDT(amt)}</td>
                  <td className="td text-right">
                    <div className="flex gap-1 justify-end items-center flex-wrap">
                      <button className="btn-ghost !py-1" title="Journal Voucher" onClick={() => openVoucher(r, 'JV')}><Printer size={13} /> JV</button>
                      <button className="btn-ghost !py-1" title="Debit Voucher" onClick={() => openVoucher(r, 'DEBIT')}>Dr</button>
                      <button className="btn-ghost !py-1" title="Credit Voucher" onClick={() => openVoucher(r, 'CREDIT')}>Cr</button>
                      <button className="btn-ghost !py-1" title="Edit" onClick={() => edit(r)}><Pencil size={13} /></button>
                      {isAdmin && <button className="btn-ghost !py-1 text-red-600" title="Delete" onClick={() => del(r.id)}><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={5}>No journals yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------------- TRIAL BALANCE ---------------- */
function TrialBalance() {
  const [rows, setRows] = useState([])
  useEffect(() => { supabase.from('v_trial_balance').select('*').then(({ data }) => setRows(data || [])) }, [])
  const tot = rows.reduce((a, r) => ({ d: a.d + +r.total_debit, c: a.c + +r.total_credit }), { d: 0, c: 0 })
  const xls = () => exportXLSX('Trial_Balance.xlsx', [{ name: 'Trial Balance', rows: [['Trial Balance', '', fmtDate(todayISO())], [], ['Code', 'Account', 'Type', 'Debit', 'Credit', 'Balance'], ...rows.map((r) => [r.code, r.name, r.type, +r.total_debit, +r.total_credit, +r.balance]), [], ['', 'TOTAL', '', tot.d, tot.c, '']] }])
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-leaf flex items-center justify-between"><span className="font-display font-semibold text-pine">Trial Balance</span><button className="btn-ghost !py-1" onClick={xls}><FileDown size={14} /> Excel</button></div>
      <table className="w-full">
        <thead><tr><th className="th">Code</th><th className="th">Account</th><th className="th">Type</th><th className="th text-right">Debit</th><th className="th text-right">Credit</th><th className="th text-right">Balance</th></tr></thead>
        <tbody>
          {rows.map((r) => (<tr key={r.code}><td className="td money text-xs">{r.code}</td><td className="td text-sm">{r.name}</td><td className="td text-xs">{r.type}</td><td className="td money text-right">{(+r.total_debit).toFixed(2)}</td><td className="td money text-right">{(+r.total_credit).toFixed(2)}</td><td className="td money text-right font-semibold">{(+r.balance).toFixed(2)}</td></tr>))}
          {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={6}>No postings yet.</td></tr>}
        </tbody>
        <tfoot><tr className="bg-leaf/40 font-bold money"><td className="td" colSpan={3}>TOTAL</td><td className="td text-right">{tot.d.toFixed(2)}</td><td className="td text-right">{tot.c.toFixed(2)}</td><td className="td"></td></tr></tfoot>
      </table>
    </div>
  )
}

/* ---------------- CHART OF ACCOUNTS ---------------- */
function CoaTab({ accounts, reload, flash, isAdmin }) {
  const [f, setF] = useState({ code: '', name: '', type: 'EXPENSE' })
  const add = async () => { if (!f.code || !f.name) return; const { error } = await supabase.from('chart_of_accounts').insert(f); if (error) flash(error.message); else { setF({ code: '', name: '', type: 'EXPENSE' }); reload() } }
  const del = async (id) => { const { error } = await supabase.from('chart_of_accounts').delete().eq('id', id); if (error) flash('Admin access required, or account is in use.'); else reload() }
  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-5 gap-2">
        <input className="input money" placeholder="Code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        <input className="input col-span-2" placeholder="Account name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].map((t) => <option key={t}>{t}</option>)}</select>
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Add</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Code</th><th className="th">Account</th><th className="th">Type</th><th className="th"></th></tr></thead>
          <tbody>
            {accounts.map((a) => (<tr key={a.id}><td className="td money text-xs">{a.code}</td><td className="td text-sm">{a.name}</td><td className="td text-xs">{a.type}</td><td className="td">{isAdmin && <button onClick={() => del(a.id)} className="text-red-300 hover:text-red-600"><Trash2 size={13} /></button>}</td></tr>))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------------- FIXED ASSETS + DEPRECIATION ---------------- */
function AssetsTab({ accounts, userName, flash }) {
  const [rows, setRows] = useState([])
  const [period, setPeriod] = useState(todayISO().slice(0, 7))
  const [makeJV, setMakeJV] = useState(true)
  const [f, setF] = useState({ name: '', category: 'GENERAL', purchase_date: todayISO(), cost: '', salvage_value: 0, useful_life_months: 60, location: '' })
  const load = async () => { const { data } = await supabase.from('fixed_assets').select('*, asset_depreciation(*)').order('created_at', { ascending: false }); setRows(data || []) }
  useEffect(() => { load() }, [])
  const add = async () => { if (!f.name || !f.cost) return; const { error } = await supabase.from('fixed_assets').insert({ ...f, cost: +f.cost, salvage_value: +f.salvage_value, useful_life_months: +f.useful_life_months }); if (error) flash(error.message); else { setF({ name: '', category: 'GENERAL', purchase_date: todayISO(), cost: '', salvage_value: 0, useful_life_months: 60, location: '' }); load() } }
  const monthly = (a) => a.useful_life_months > 0 ? +((+a.cost - +a.salvage_value) / a.useful_life_months).toFixed(2) : 0
  const runDep = async () => {
    const active = rows.filter((a) => a.status === 'ACTIVE' && !(a.asset_depreciation || []).some((d) => d.period === period))
    if (active.length === 0) { flash('All active assets already have depreciation for this period.'); return }
    let jvId = null
    const totalDep = active.reduce((s, a) => s + monthly(a), 0)
    if (makeJV && totalDep > 0) {
      const acc = Object.fromEntries(accounts.map((a) => [a.code, a.id]))
      if (acc['5500'] && acc['1590']) {
        const { data: jv } = await supabase.from('journal_entries').insert({ jv_date: `${period}-28`, narration: `Depreciation — ${period}`, source: 'DEPRECIATION', posted_by: userName }).select().single()
        await supabase.from('journal_lines').insert([
          { entry_id: jv.id, account_id: acc['5500'], debit: totalDep, credit: 0, line_note: 'Depreciation expense' },
          { entry_id: jv.id, account_id: acc['1590'], debit: 0, credit: totalDep, line_note: 'Accumulated depreciation' },
        ])
        jvId = jv.id
      }
    }
    await supabase.from('asset_depreciation').insert(active.map((a) => ({ asset_id: a.id, period, amount: monthly(a), jv_id: jvId })))
    load(); flash(`Depreciation posted for ${active.length} asset(s)${jvId ? ' with journal voucher' : ''}.`)
  }
  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-6 gap-2">
        <input className="input col-span-2" placeholder="Asset name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input" placeholder="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <input type="number" className="input money" placeholder="Cost" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} />
        <input type="number" className="input money" placeholder="Salvage" value={f.salvage_value} onChange={(e) => setF({ ...f, salvage_value: e.target.value })} />
        <input type="number" className="input money" placeholder="Life (months)" value={f.useful_life_months} onChange={(e) => setF({ ...f, useful_life_months: e.target.value })} />
        <button className="btn-primary justify-center col-span-6" onClick={add}><Building2 size={15} /> Add asset</button>
      </div>
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <span className="label !mb-0">Depreciation run</span>
        <input type="month" className="input !w-44" value={period} onChange={(e) => setPeriod(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-forest" checked={makeJV} onChange={(e) => setMakeJV(e.target.checked)} /> Post JV (Dr 5500 / Cr 1590)</label>
        <button className="btn-amber" onClick={runDep}><Scale size={15} /> Run straight-line depreciation</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">Code</th><th className="th">Asset</th><th className="th text-right">Cost</th><th className="th text-right">Monthly dep.</th><th className="th text-right">Accum.</th><th className="th text-right">Book value</th></tr></thead>
          <tbody>
            {rows.map((a) => { const accum = (a.asset_depreciation || []).reduce((s, d) => s + +d.amount, 0); return (
              <tr key={a.id}><td className="td money text-xs">{a.asset_code}</td><td className="td text-sm">{a.name}</td><td className="td money text-right">{fmtBDT(a.cost)}</td><td className="td money text-right">{fmtBDT(monthly(a))}</td><td className="td money text-right">{fmtBDT(accum)}</td><td className="td money text-right font-semibold">{fmtBDT(+a.cost - accum)}</td></tr>) })}
            {rows.length === 0 && <tr><td className="td text-pine/40" colSpan={6}>No assets yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
