import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO } from '../lib/helpers'
import {
  Calculator, Plus, Trash2, Scale, Building2, Printer, Pencil,
  Lock, BookOpen, AlertCircle, CheckCircle2, X, ArrowRight, Save, Search,
} from 'lucide-react'
import PrintPortal from '../components/PrintPortal.jsx'
import VoucherDoc from '../components/print/VoucherDoc.jsx'

/* ------------------------------------------------------------------ */
/*  RETAINED EARNINGS account code — offsetting account for OB entries  */
/*  Matches chart_of_accounts code = '300100' (Retained Earnings)       */
/* ------------------------------------------------------------------ */
const RE_CODE = '300100'

/* ------------------------------------------------------------------ */
/*  ROOT                                                                */
/* ------------------------------------------------------------------ */
export default function AccountingHub({ userName, isAdmin }) {
  const [tab, setTab]         = useState('Journal Vouchers')
  const [accounts, setAccounts] = useState([])
  const [company, setCompany] = useState(null)
  const [msg, setMsg]         = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 5000) }

  const loadAccounts = async () => {
    const { data } = await supabase.from('chart_of_accounts').select('*').eq('is_active', true).order('code')
    setAccounts(data || [])
  }

  useEffect(() => {
    loadAccounts()
    supabase.from('company_settings').select('*').limit(1).single()
      .then(({ data }) => setCompany(data))
  }, [])

  // Opening Balance tab only for Admin / Superuser
  const TABS = [
    'Journal Vouchers',
    'Trial Balance',
    'Chart of Accounts',
    'Fixed Assets',
    ...(isAdmin ? ['Opening Balance'] : []),
    ...(isAdmin ? ['Transaction Mapping'] : []),
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-pine flex items-center gap-2">
          <Calculator className="text-forest" /> Accounting
        </h1>
        <p className="text-sm text-pine/60">
          Double-entry journals (IFRS), trial balance, chart of accounts and fixed-asset depreciation.
        </p>
      </div>
      {msg && (
        <div className="px-4 py-3 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>
      )}
      <div className="flex gap-1 border-b border-leaf flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${
              tab === t
                ? 'bg-white border border-leaf border-b-white text-forest -mb-px'
                : 'text-pine/60 hover:text-pine'
            }`}
          >
            {t === 'Opening Balance' && (
              <span className="inline-flex items-center gap-1">
                <BookOpen size={13} /> Opening Balance
              </span>
            )}
            {t !== 'Opening Balance' && t}
          </button>
        ))}
      </div>

      {tab === 'Journal Vouchers' && (
        <JournalsTab accounts={accounts} userName={userName} flash={flash} company={company} isAdmin={isAdmin} />
      )}
      {tab === 'Trial Balance'    && <TrialBalance />}
      {tab === 'Chart of Accounts' && (
        <CoaTab accounts={accounts} reload={loadAccounts} flash={flash} isAdmin={isAdmin} />
      )}
      {tab === 'Fixed Assets'     && (
        <AssetsTab accounts={accounts} userName={userName} flash={flash} />
      )}
      {tab === 'Opening Balance' && isAdmin && (
        <OpeningBalanceTab accounts={accounts} userName={userName} flash={flash} />
      )}
      {tab === 'Transaction Mapping' && isAdmin && (
        <TransactionMappingTab accounts={accounts} flash={flash} userName={userName} />
      )}
    </div>
  )
}

/* ================================================================== */
/*  OPENING BALANCE TAB                                                 */
/* ================================================================== */
function OpeningBalanceTab({ accounts, userName, flash }) {
  const [obDate, setObDate]   = useState(todayISO())
  const [narration, setNarration] = useState('Opening balances as at commencement of accounting')
  const [lines, setLines]     = useState([
    { account_id: '', debit: '', credit: '', line_note: '' },
    { account_id: '', debit: '', credit: '', line_note: '' },
  ])
  const [postedList, setPostedList] = useState([])
  const [busy, setBusy]       = useState(false)
  const [confirmPost, setConfirmPost] = useState(false)

  // Retained Earnings account id for the offsetting line
  const reAccount = accounts.find((a) => a.code === RE_CODE)

  // Load already-posted Opening Balance entries
  const loadPosted = useCallback(async () => {
    const { data } = await supabase
      .from('journal_entries')
      .select('*, journal_lines(*, chart_of_accounts(code,name))')
      .eq('source', 'OPENING_BALANCE')
      .order('created_at', { ascending: false })
    setPostedList(data || [])
  }, [])

  useEffect(() => { loadPosted() }, [loadPosted])

  /* ---------- form helpers ---------- */
  const upd = (i, k, v) => {
    const n = [...lines]
    // Enforce mutual exclusivity: if entering debit, clear credit & vice versa
    if (k === 'debit'  && v) n[i] = { ...n[i], debit: v,  credit: '' }
    else if (k === 'credit' && v) n[i] = { ...n[i], credit: v, debit: '' }
    else n[i] = { ...n[i], [k]: v }
    setLines(n)
  }
  const addLine = () =>
    setLines([...lines, { account_id: '', debit: '', credit: '', line_note: '' }])
  const delLine = (i) =>
    setLines(lines.length > 1 ? lines.filter((_, idx) => idx !== i) : lines)

  // Filter out RE account from user-selectable list (it's the auto-offset)
  const selectableAccounts = accounts.filter((a) => a.code !== RE_CODE)

  // Valid lines only (has account + at least one amount)
  const validLines = lines.filter((l) => l.account_id && (+l.debit || +l.credit))

  const totDr  = validLines.reduce((s, l) => s + (+l.debit  || 0), 0)
  const totCr  = validLines.reduce((s, l) => s + (+l.credit || 0), 0)
  const netDiff = +(totDr - totCr).toFixed(2)   // positive → needs offsetting CR, negative → needs DR

  // The auto-generated RE offset line
  const reOffsetLine = netDiff !== 0
    ? {
        account_id: reAccount?.id,
        debit:  netDiff < 0 ? Math.abs(netDiff) : 0,
        credit: netDiff > 0 ? netDiff : 0,
        line_note: 'Auto-offset to Retained Earnings',
      }
    : null

  const totalDrWithOffset = totDr  + (reOffsetLine?.debit  || 0)
  const totalCrWithOffset = totCr  + (reOffsetLine?.credit || 0)
  const balanced = validLines.length >= 1 && Math.abs(totalDrWithOffset - totalCrWithOffset) < 0.01

  /* ---------- post ---------- */
  const postOB = async () => {
    if (!balanced || validLines.length === 0) return
    if (!reAccount && netDiff !== 0) {
      flash(`Retained Earnings account (${RE_CODE}) not found in chart of accounts. Please add it first.`)
      return
    }
    setBusy(true)
    try {
      // Generate JV number via tenant_sequences
      const { data: seqData, error: seqErr } = await supabase.rpc('next_tenant_seq', {
        p_seq_name: 'jv_no_seq',
      })
      let jvNo
      if (seqErr || seqData === null) {
        // Fallback: count existing OB entries + 1
        jvNo = `OB-${new Date().getFullYear()}-${String(postedList.length + 1).padStart(4, '0')}`
      } else {
        jvNo = `OB-${new Date().getFullYear()}-${String(seqData).padStart(4, '0')}`
      }

      // Insert journal entry with is_locked = true, source = 'OPENING_BALANCE'
      const { data: jv, error: jvErr } = await supabase
        .from('journal_entries')
        .insert({
          jv_no:      jvNo,
          jv_date:    obDate,
          ob_date:    obDate,
          narration,
          source:     'OPENING_BALANCE',
          posted_by:  userName,
          is_locked:  true,
        })
        .select()
        .single()
      if (jvErr) throw jvErr

      // Build lines array incl. RE offset
      const allLines = [
        ...validLines.map((l) => ({
          entry_id:   jv.id,
          account_id: l.account_id,
          debit:      +l.debit  || 0,
          credit:     +l.credit || 0,
          line_note:  l.line_note || null,
        })),
        ...(reOffsetLine
          ? [{
              entry_id:   jv.id,
              account_id: reOffsetLine.account_id,
              debit:      reOffsetLine.debit,
              credit:     reOffsetLine.credit,
              line_note:  reOffsetLine.line_note,
            }]
          : []),
      ]

      const { error: lErr } = await supabase.from('journal_lines').insert(allLines)
      if (lErr) throw lErr

      flash(`✓ Opening Balance posted as ${jvNo} — permanently locked.`)
      // Reset form
      setLines([
        { account_id: '', debit: '', credit: '', line_note: '' },
        { account_id: '', debit: '', credit: '', line_note: '' },
      ])
      setConfirmPost(false)
      loadPosted()
    } catch (e) {
      flash(`Error: ${e.message}`)
    }
    setBusy(false)
  }

  /* ---------- render ---------- */
  return (
    <div className="space-y-5">
      {/* ── Info banner ── */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
        <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-600" />
        <div>
          <span className="font-semibold">Opening Balance entries are permanent.</span> Once posted, they are
          locked and cannot be edited or deleted — even by Superuser. The difference between total Debits and
          Credits is automatically offset to <span className="font-mono font-semibold">{RE_CODE} Retained Earnings</span>.
          Post only once per accounting commencement date.
        </div>
      </div>

      {/* ── Entry form ── */}
      <div className="card p-5 space-y-4">
        <h3 className="font-display font-semibold text-pine flex items-center gap-2">
          <BookOpen size={17} className="text-forest" /> New Opening Balance Entry
        </h3>

        {/* Header row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">As at date <span className="text-red-500">*</span></label>
            <input
              type="date"
              className="input"
              value={obDate}
              onChange={(e) => setObDate(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Narration</label>
            <input
              className="input"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
            />
          </div>
        </div>

        {/* Lines */}
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-pine/50 uppercase tracking-wide px-1">
            <span className="col-span-5">Account</span>
            <span className="col-span-2 text-right">Debit (Dr)</span>
            <span className="col-span-2 text-right">Credit (Cr)</span>
            <span className="col-span-2">Note</span>
            <span className="col-span-1" />
          </div>

          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <select
                className="input col-span-5 text-sm"
                value={l.account_id}
                onChange={(e) => upd(i, 'account_id', e.target.value)}
              >
                <option value="">Select account…</option>
                {selectableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                className="input col-span-2 money text-right"
                placeholder="0.00"
                value={l.debit}
                onChange={(e) => upd(i, 'debit', e.target.value)}
              />
              <input
                type="number"
                min="0"
                className="input col-span-2 money text-right"
                placeholder="0.00"
                value={l.credit}
                onChange={(e) => upd(i, 'credit', e.target.value)}
              />
              <input
                className="input col-span-2 text-sm"
                placeholder="Note"
                value={l.line_note}
                onChange={(e) => upd(i, 'line_note', e.target.value)}
              />
              <button
                className="col-span-1 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-300 hover:text-red-600"
                onClick={() => delLine(i)}
                title="Remove line"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {/* Auto-offset RE line preview */}
          {reOffsetLine && (
            <div className="grid grid-cols-12 gap-2 items-center opacity-60">
              <div className="col-span-5 flex items-center gap-2 text-sm text-pine/70 pl-1">
                <Lock size={12} className="text-amber-500 shrink-0" />
                <span className="font-medium truncate">{RE_CODE} · Retained Earnings</span>
                <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1 shrink-0">auto-offset</span>
              </div>
              <div className="col-span-2 money text-right text-sm font-medium text-pine/70">
                {reOffsetLine.debit > 0 ? fmtBDT(reOffsetLine.debit) : '—'}
              </div>
              <div className="col-span-2 money text-right text-sm font-medium text-pine/70">
                {reOffsetLine.credit > 0 ? fmtBDT(reOffsetLine.credit) : '—'}
              </div>
              <div className="col-span-3 text-xs text-pine/40 italic">Auto-offset to Retained Earnings</div>
            </div>
          )}
        </div>

        {/* Add line + totals row */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-1 border-t border-leaf">
          <button className="btn-ghost !py-1 text-sm" onClick={addLine}>
            <Plus size={14} /> Add account line
          </button>

          <div className="flex items-center gap-4 text-sm money font-semibold">
            <span className="text-pine/50">
              Dr: <span className="text-pine">{fmtBDT(totalDrWithOffset)}</span>
            </span>
            <span className="text-pine/50">
              Cr: <span className="text-pine">{fmtBDT(totalCrWithOffset)}</span>
            </span>
            {balanced ? (
              <span className="flex items-center gap-1 text-forest">
                <CheckCircle2 size={15} /> Balanced
              </span>
            ) : (
              <span className="text-red-500">
                ✗ Diff: {fmtBDT(Math.abs(netDiff))}
              </span>
            )}
          </div>
        </div>

        {/* Confirm + Post */}
        {!confirmPost ? (
          <button
            className="btn-primary"
            disabled={!balanced || validLines.length === 0 || busy}
            onClick={() => setConfirmPost(true)}
          >
            <BookOpen size={15} /> Post Opening Balance
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap p-3 rounded-xl bg-amber-50 border border-amber-300">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800 font-medium flex-1">
              This will be permanently locked. Are you sure?
            </span>
            <button
              className="btn-primary !bg-amber-600 hover:!bg-amber-700"
              disabled={busy}
              onClick={postOB}
            >
              <Lock size={14} /> {busy ? 'Posting…' : 'Yes, Post & Lock'}
            </button>
            <button
              className="btn-ghost"
              onClick={() => setConfirmPost(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ── Posted OB entries list ── */}
      {postedList.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-leaf flex items-center gap-2">
            <Lock size={15} className="text-amber-600" />
            <span className="font-display font-semibold text-pine text-sm">
              Posted Opening Balances ({postedList.length})
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">JV No</th>
                <th className="th">As at Date</th>
                <th className="th">Narration</th>
                <th className="th text-right">Total Dr</th>
                <th className="th">Accounts</th>
                <th className="th text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {postedList.map((r) => {
                const totalAmt = (r.journal_lines || []).reduce((s, l) => s + +l.debit, 0)
                const acctNames = (r.journal_lines || [])
                  .map((l) => l.chart_of_accounts?.name)
                  .filter(Boolean)
                return (
                  <tr key={r.id}>
                    <td className="td money font-semibold text-sm">{r.jv_no}</td>
                    <td className="td text-sm">{fmtDate(r.ob_date || r.jv_date)}</td>
                    <td className="td text-sm max-w-[200px] truncate">{r.narration}</td>
                    <td className="td money text-right">{fmtBDT(totalAmt)}</td>
                    <td className="td text-xs text-pine/60 max-w-[200px]">
                      <div className="truncate">{acctNames.slice(0, 3).join(', ')}{acctNames.length > 3 ? ` +${acctNames.length - 3} more` : ''}</div>
                    </td>
                    <td className="td text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
                        <Lock size={10} /> Locked
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {postedList.length === 0 && (
        <div className="text-center text-pine/40 text-sm py-6">
          No opening balance entries posted yet.
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/*  JOURNAL VOUCHERS TAB                                                */
/* ================================================================== */
function JournalsTab({ accounts, userName, flash, company, isAdmin }) {
  const [rows, setRows]       = useState([])
  const [head, setHead]       = useState({ jv_date: todayISO(), narration: '' })
  const [lines, setLines]     = useState([
    { account_id: '', debit: '', credit: '', line_note: '' },
    { account_id: '', debit: '', credit: '', line_note: '' },
  ])
  const [editingId, setEditingId] = useState(null)
  const [printV, setPrintV]   = useState(null)

  const load = async () => {
    const { data } = await supabase
      .from('journal_entries')
      .select('*, journal_lines(*, chart_of_accounts(code,name))')
      .neq('source', 'OPENING_BALANCE')   // OB entries shown in OB tab only
      .order('created_at', { ascending: false })
      .limit(60)
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const upd = (i, k, v) => { const n = [...lines]; n[i][k] = v; setLines(n) }
  const addLine = () => setLines([...lines, { account_id: '', debit: '', credit: '', line_note: '' }])
  const delLine = (i) => setLines(lines.length > 2 ? lines.filter((_, idx) => idx !== i) : lines)
  const totDr   = lines.reduce((a, l) => a + (+l.debit  || 0), 0)
  const totCr   = lines.reduce((a, l) => a + (+l.credit || 0), 0)
  const balanced = totDr > 0 && Math.abs(totDr - totCr) < 0.01

  const resetForm = () => {
    setEditingId(null)
    setHead({ jv_date: todayISO(), narration: '' })
    setLines([
      { account_id: '', debit: '', credit: '', line_note: '' },
      { account_id: '', debit: '', credit: '', line_note: '' },
    ])
  }

  const post = async () => {
    if (!balanced) { flash('Debit and credit must be equal and non-zero.'); return }
    const valid = lines.filter((l) => l.account_id && (+l.debit || +l.credit))
    if (valid.length < 2) { flash('A journal needs at least two valid lines.'); return }
    try {
      if (editingId) {
        const { error: ue } = await supabase.from('journal_entries')
          .update({ jv_date: head.jv_date, narration: head.narration })
          .eq('id', editingId)
        if (ue) throw ue
        await supabase.from('journal_lines').delete().eq('entry_id', editingId)
        const { error: le } = await supabase.from('journal_lines').insert(
          valid.map((l) => ({ entry_id: editingId, account_id: l.account_id, debit: +l.debit || 0, credit: +l.credit || 0, line_note: l.line_note }))
        )
        if (le) throw le
        flash('Journal updated.')
      } else {
        const { data: jv, error: je } = await supabase.from('journal_entries')
          .insert({ jv_date: head.jv_date, narration: head.narration, source: 'MANUAL', posted_by: userName })
          .select().single()
        if (je) throw je
        const { error: le } = await supabase.from('journal_lines').insert(
          valid.map((l) => ({ entry_id: jv.id, account_id: l.account_id, debit: +l.debit || 0, credit: +l.credit || 0, line_note: l.line_note }))
        )
        if (le) throw le
        flash(`${jv.jv_no} posted.`)
      }
      resetForm(); load()
    } catch (e) { flash(e.message) }
  }

  const edit = (r) => {
    if (r.is_locked) { flash('This entry is locked and cannot be edited.'); return }
    setEditingId(r.id)
    setHead({ jv_date: r.jv_date, narration: r.narration || '' })
    setLines((r.journal_lines || []).map((l) => ({
      account_id: l.account_id, debit: l.debit || '', credit: l.credit || '', line_note: l.line_note || '',
    })))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const del = async (id) => {
    if (!window.confirm('Delete this voucher permanently? This cannot be undone.')) return
    const { error } = await supabase.from('journal_entries').delete().eq('id', id)
    if (error) flash(error.message.includes('locked') ? 'This entry is locked and cannot be deleted.' : error.message)
    else { if (editingId === id) resetForm(); load(); flash('Voucher deleted.') }
  }

  const openVoucher = (r) => {
    const vlines = (r.journal_lines || []).map((l) => ({
      code: l.chart_of_accounts?.code,
      name: l.chart_of_accounts?.name,
      debit: l.debit,
      credit: l.credit,
      line_note: l.line_note,
    }))
    setPrintV({ entry: r, lines: vlines })
  }

  return (
    <div className="space-y-4">
      {printV && (
        <PrintPortal title={`Voucher — ${printV.entry.jv_no}`} onClose={() => setPrintV(null)}>
          <VoucherDoc entry={printV.entry} lines={printV.lines} company={company} />
        </PrintPortal>
      )}

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-pine">
            {editingId ? 'Edit journal voucher' : 'New journal voucher'}
          </h3>
          {editingId && (
            <button className="btn-ghost !py-1 text-sm" onClick={resetForm}>Cancel edit</button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <input
            type="date" className="input"
            value={head.jv_date}
            onChange={(e) => setHead({ ...head, jv_date: e.target.value })}
          />
          <input
            className="input col-span-3" placeholder="Narration"
            value={head.narration}
            onChange={(e) => setHead({ ...head, narration: e.target.value })}
          />
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <select
              className="input col-span-4" value={l.account_id}
              onChange={(e) => upd(i, 'account_id', e.target.value)}
            >
              <option value="">Account…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
            </select>
            <input type="number" className="input col-span-2 money" placeholder="Debit"  value={l.debit}  onChange={(e) => upd(i, 'debit',  e.target.value)} />
            <input type="number" className="input col-span-2 money" placeholder="Credit" value={l.credit} onChange={(e) => upd(i, 'credit', e.target.value)} />
            <input className="input col-span-3" placeholder="Note" value={l.line_note} onChange={(e) => upd(i, 'line_note', e.target.value)} />
            <button className="text-red-400 hover:text-red-600 col-span-1" onClick={() => delLine(i)}><Trash2 size={15} /></button>
          </div>
        ))}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button className="btn-ghost !py-1" onClick={addLine}><Plus size={14} /> Add line</button>
          <div className={`money font-semibold text-sm ${balanced ? 'text-forest' : 'text-red-600'}`}>
            Dr {totDr.toFixed(2)} · Cr {totCr.toFixed(2)} {balanced ? '✓ balanced' : '✗ not balanced'}
          </div>
          <button className="btn-primary" disabled={!balanced} onClick={post}>
            <Plus size={15} /> {editingId ? 'Update journal' : 'Post journal'}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">JV No</th>
              <th className="th">Date</th>
              <th className="th">Narration</th>
              <th className="th text-right">Amount</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
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
                      <button className="btn-ghost !py-1" title="Print voucher" onClick={() => openVoucher(r)}>
                        <Printer size={13} /> Voucher
                      </button>
                      {!r.is_locked && (
                        <button className="btn-ghost !py-1" title="Edit" onClick={() => edit(r)}>
                          <Pencil size={13} />
                        </button>
                      )}
                      {isAdmin && !r.is_locked && (
                        <button className="btn-ghost !py-1 text-red-600" title="Delete" onClick={() => del(r.id)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                      {r.is_locked && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200">
                          <Lock size={9} /> Locked
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td className="td text-pine/40" colSpan={5}>No journals yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  TRIAL BALANCE                                                       */
/* ================================================================== */
function TrialBalance() {
  const [rows, setRows] = useState([])

  useEffect(() => {
    const loadTB = async () => {
      const { data, error } = await supabase.from('journal_lines').select(`
        debit, credit, chart_of_accounts(code, name, type)
      `)
      if (error) { console.error('TB error:', error); return }
      if (!data?.length) { setRows([]); return }
      const summary = data.reduce((acc, l) => {
        const info = l.chart_of_accounts
        if (!info) return acc
        const code = info.code
        if (!acc[code]) acc[code] = { code, name: info.name, type: info.type, dr: 0, cr: 0 }
        acc[code].dr += Number(l.debit  || 0)
        acc[code].cr += Number(l.credit || 0)
        return acc
      }, {})
      setRows(Object.values(summary))
    }
    loadTB()
  }, [])

  const tot = rows.reduce((a, r) => ({ d: a.d + r.dr, c: a.c + r.cr }), { d: 0, c: 0 })

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-leaf font-display font-semibold text-pine">Trial Balance</div>
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">Code</th>
            <th className="th">Account</th>
            <th className="th text-right">Debit</th>
            <th className="th text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code}>
              <td className="td money text-xs">{r.code}</td>
              <td className="td text-sm">{r.name}</td>
              <td className="td money text-right">{r.dr.toFixed(2)}</td>
              <td className="td money text-right">{r.cr.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-leaf/40 font-bold money">
            <td className="td" colSpan={2}>TOTAL</td>
            <td className="td text-right">{tot.d.toFixed(2)}</td>
            <td className="td text-right">{tot.c.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/* ================================================================== */
/*  CHART OF ACCOUNTS                                                   */
/* ================================================================== */
function CoaTab({ accounts, reload, flash, isAdmin }) {
  const [f, setF] = useState({ code: '', name: '', type: 'EXPENSE' })
  const add = async () => {
    if (!f.code || !f.name) return
    const { error } = await supabase.from('chart_of_accounts').insert(f)
    if (error) flash(error.message)
    else { setF({ code: '', name: '', type: 'EXPENSE' }); reload() }
  }
  const del = async (id) => {
    const { error } = await supabase.from('chart_of_accounts').delete().eq('id', id)
    if (error) flash('Admin access required, or account is in use.')
    else reload()
  }
  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-5 gap-2">
        <input className="input money" placeholder="Code"
          value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        <input className="input col-span-2" placeholder="Account name"
          value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'].map((t) => <option key={t}>{t}</option>)}
        </select>
        <button className="btn-primary justify-center" onClick={add}><Plus size={15} /> Add</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Code</th>
              <th className="th">Account</th>
              <th className="th">Type</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="td money text-xs">{a.code}</td>
                <td className="td text-sm">{a.name}</td>
                <td className="td text-xs">{a.type}</td>
                <td className="td">
                  {isAdmin && (
                    <button onClick={() => del(a.id)} className="text-red-300 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  FIXED ASSETS + DEPRECIATION                                         */
/* ================================================================== */
function AssetsTab({ accounts, userName, flash }) {
  const [rows, setRows]   = useState([])
  const [period, setPeriod] = useState(todayISO().slice(0, 7))
  const [makeJV, setMakeJV] = useState(true)
  const [f, setF] = useState({
    name: '', category: 'GENERAL', purchase_date: todayISO(),
    cost: '', salvage_value: 0, useful_life_months: 60, location: '',
  })

  const load = async () => {
    const { data } = await supabase.from('fixed_assets')
      .select('*, asset_depreciation(*)')
      .order('created_at', { ascending: false })
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!f.name || !f.cost) return
    const { error } = await supabase.from('fixed_assets').insert({
      ...f, cost: +f.cost, salvage_value: +f.salvage_value, useful_life_months: +f.useful_life_months,
    })
    if (error) flash(error.message)
    else {
      setF({ name: '', category: 'GENERAL', purchase_date: todayISO(), cost: '', salvage_value: 0, useful_life_months: 60, location: '' })
      load()
    }
  }

  const monthly = (a) =>
    a.useful_life_months > 0 ? +((+a.cost - +a.salvage_value) / a.useful_life_months).toFixed(2) : 0

  const runDep = async () => {
    const active = rows.filter(
      (a) => a.status === 'ACTIVE' && !(a.asset_depreciation || []).some((d) => d.period === period)
    )
    if (active.length === 0) { flash('All active assets already have depreciation for this period.'); return }
    let jvId = null
    const totalDep = active.reduce((s, a) => s + monthly(a), 0)
    if (makeJV && totalDep > 0) {
      const acc = Object.fromEntries(accounts.map((a) => [a.code, a.id]))
      if (acc['5500'] && acc['1590']) {
        const { data: jv } = await supabase.from('journal_entries').insert({
          jv_date: `${period}-28`,
          narration: `Depreciation — ${period}`,
          source: 'DEPRECIATION',
          posted_by: userName,
        }).select().single()
        await supabase.from('journal_lines').insert([
          { entry_id: jv.id, account_id: acc['5500'], debit: totalDep,    credit: 0,        line_note: 'Depreciation expense' },
          { entry_id: jv.id, account_id: acc['1590'], debit: 0,           credit: totalDep, line_note: 'Accumulated depreciation' },
        ])
        jvId = jv.id
      }
    }
    await supabase.from('asset_depreciation').insert(
      active.map((a) => ({ asset_id: a.id, period, amount: monthly(a), jv_id: jvId }))
    )
    load()
    flash(`Depreciation posted for ${active.length} asset(s)${jvId ? ' with journal voucher' : ''}.`)
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-6 gap-2">
        <input className="input col-span-2" placeholder="Asset name"
          value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input" placeholder="Category"
          value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <input type="number" className="input money" placeholder="Cost"
          value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} />
        <input type="number" className="input money" placeholder="Salvage"
          value={f.salvage_value} onChange={(e) => setF({ ...f, salvage_value: e.target.value })} />
        <input type="number" className="input money" placeholder="Life (months)"
          value={f.useful_life_months} onChange={(e) => setF({ ...f, useful_life_months: e.target.value })} />
        <button className="btn-primary justify-center col-span-6" onClick={add}>
          <Building2 size={15} /> Add asset
        </button>
      </div>
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <span className="label !mb-0">Depreciation run</span>
        <input type="month" className="input !w-44"
          value={period} onChange={(e) => setPeriod(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-forest" checked={makeJV} onChange={(e) => setMakeJV(e.target.checked)} />
          Post JV (Dr 5500 / Cr 1590)
        </label>
        <button className="btn-amber" onClick={runDep}>
          <Scale size={15} /> Run straight-line depreciation
        </button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Code</th>
              <th className="th">Asset</th>
              <th className="th text-right">Cost</th>
              <th className="th text-right">Monthly dep.</th>
              <th className="th text-right">Accum.</th>
              <th className="th text-right">Book value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const accum = (a.asset_depreciation || []).reduce((s, d) => s + +d.amount, 0)
              return (
                <tr key={a.id}>
                  <td className="td money text-xs">{a.asset_code}</td>
                  <td className="td text-sm">{a.name}</td>
                  <td className="td money text-right">{fmtBDT(a.cost)}</td>
                  <td className="td money text-right">{fmtBDT(monthly(a))}</td>
                  <td className="td money text-right">{fmtBDT(accum)}</td>
                  <td className="td money text-right font-semibold">{fmtBDT(+a.cost - accum)}</td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td className="td text-pine/40" colSpan={6}>No assets yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  TRANSACTION MAPPING TAB                                             */
/*  Maps each transaction type to Dr/Cr GL accounts                    */
/*  Admin/Superuser only — controls how folio charges post to ledger   */
/* ================================================================== */
const TRANSACTION_GROUPS = [
  {
    title: 'Room & Accommodation',
    types: ['ROOM_REVENUE'],
  },
  {
    title: 'Restaurant & F&B',
    types: ['RESTAURANT_REVENUE', 'TEA_REVENUE', 'PICKLE_REVENUE'],
  },
  {
    title: 'Facilities & Other',
    types: ['SPORTS_REVENUE', 'LAUNDRY_REVENUE', 'OTHER_REVENUE'],
  },
  {
    title: 'Payments Received',
    types: ['PAYMENT_CASH', 'PAYMENT_BKASH', 'PAYMENT_NAGAD', 'PAYMENT_CARD', 'PAYMENT_BANK', 'PAYMENT_ADVANCE'],
  },
  {
    title: 'Adjustments',
    types: ['DISCOUNT_GIVEN', 'SHAREHOLDER_REDEEM'],
  },
  {
    title: 'Tax & SC Settlement',
    types: ['VAT_SETTLEMENT', 'SC_SETTLEMENT'],
  },
]

function TransactionMappingTab({ accounts, flash, userName }) {
  const [mappings, setMappings] = useState([])
  const [editId, setEditId]     = useState(null)
  const [editF, setEditF]       = useState({})
  const [busy, setBusy]         = useState(false)
  const [search, setSearch]     = useState('')

  const load = async () => {
    const { data } = await supabase
      .from('accounting_transaction_mapping')
      .select(`
        *,
        debit:debit_account_id(code, name),
        credit:credit_account_id(code, name),
        vat:vat_account_id(code, name),
        sc:sc_account_id(code, name)
      `)
      .order('transaction_type')
    setMappings(data || [])
  }
  useEffect(() => { load() }, [])

  const startEdit = (m) => {
    setEditId(m.id)
    setEditF({
      label:            m.label,
      debit_account_id: m.debit_account_id  || '',
      credit_account_id: m.credit_account_id || '',
      vat_account_id:   m.vat_account_id    || '',
      sc_account_id:    m.sc_account_id     || '',
      notes:            m.notes             || '',
    })
  }

  const saveEdit = async () => {
    setBusy(true)
    const { error } = await supabase
      .from('accounting_transaction_mapping')
      .update({
        label:            editF.label,
        debit_account_id: editF.debit_account_id  || null,
        credit_account_id: editF.credit_account_id || null,
        vat_account_id:   editF.vat_account_id    || null,
        sc_account_id:    editF.sc_account_id     || null,
        notes:            editF.notes,
        updated_by:       userName,
        updated_at:       new Date().toISOString(),
      })
      .eq('id', editId)
    setBusy(false)
    if (error) flash(error.message)
    else { setEditId(null); load(); flash('Mapping updated.') }
  }

  // Account options for dropdowns — grouped by type
  const acctOptions = accounts.map(a => ({
    value: a.id,
    label: `${a.code} · ${a.name}`,
    type: a.type,
  }))

  const acctName = (id) => {
    const a = accounts.find(x => x.id === id)
    return a ? `${a.code} · ${a.name}` : '—'
  }

  const filteredMappings = (types) =>
    mappings.filter(m =>
      types.includes(m.transaction_type) &&
      (!search || m.label.toLowerCase().includes(search.toLowerCase()) ||
       m.transaction_type.toLowerCase().includes(search.toLowerCase()))
    )

  const AccountSelect = ({ value, onChange, placeholder }) => (
    <select
      className="input text-xs !py-1"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">— {placeholder || 'Select account'} —</option>
      {['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'].map(type => {
        const group = acctOptions.filter(a => a.type === type)
        if (!group.length) return null
        return (
          <optgroup key={type} label={type}>
            {group.map(a => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <div>
            <h3 className="font-display font-semibold text-pine">Transaction → GL Account Mapping</h3>
            <p className="text-xs text-pine/50 mt-0.5">
              Defines which accounts to Debit and Credit for each transaction type.
              Changes apply to newly posted JVs — historical entries are unchanged.
            </p>
          </div>
          <div className="relative w-56">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pine/30" />
            <input
              className="input !pl-8 text-sm"
              placeholder="Search transaction…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-pine/50">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Dr = Debit account</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-forest inline-block" /> Cr = Credit account</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> VAT = VAT Output account</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> SC = Service Charge account</span>
        </div>
      </div>

      {/* Grouped mapping cards */}
      {TRANSACTION_GROUPS.map(group => {
        const rows = filteredMappings(group.types)
        if (rows.length === 0 && search) return null
        return (
          <div key={group.title} className="card overflow-hidden">
            <div className="px-4 py-2.5 bg-leaf/30 border-b border-leaf">
              <h4 className="font-display font-semibold text-pine text-sm">{group.title}</h4>
            </div>
            <div className="divide-y divide-leaf/40">
              {rows.length === 0 && (
                <p className="text-xs text-pine/40 px-4 py-3">No mappings found.</p>
              )}
              {rows.map(m => (
                <div key={m.id} className="p-4">
                  {editId === m.id ? (
                    /* ── Edit row ── */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-pine/40 bg-pine/5 px-2 py-0.5 rounded">{m.transaction_type}</span>
                          <input className="input !py-1 text-sm font-semibold flex-1 min-w-[160px]"
                            value={editF.label}
                            onChange={e => setEditF(p => ({ ...p, label: e.target.value }))} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveEdit} disabled={busy} className="btn-primary !py-1 text-xs">
                            <Save size={12} /> {busy ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={() => setEditId(null)} className="btn-ghost !py-1 text-xs">Cancel</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="label !text-[10px] flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Debit account
                          </label>
                          <AccountSelect value={editF.debit_account_id} onChange={v => setEditF(p => ({ ...p, debit_account_id: v }))} placeholder="Debit" />
                        </div>
                        <div>
                          <label className="label !text-[10px] flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-forest inline-block" /> Credit account
                          </label>
                          <AccountSelect value={editF.credit_account_id} onChange={v => setEditF(p => ({ ...p, credit_account_id: v }))} placeholder="Credit" />
                        </div>
                        <div>
                          <label className="label !text-[10px] flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> VAT account
                          </label>
                          <AccountSelect value={editF.vat_account_id} onChange={v => setEditF(p => ({ ...p, vat_account_id: v }))} placeholder="VAT (optional)" />
                        </div>
                        <div>
                          <label className="label !text-[10px] flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> SC account
                          </label>
                          <AccountSelect value={editF.sc_account_id} onChange={v => setEditF(p => ({ ...p, sc_account_id: v }))} placeholder="SC (optional)" />
                        </div>
                      </div>
                      <div>
                        <label className="label !text-xs">Notes</label>
                        <input className="input text-xs" value={editF.notes}
                          onChange={e => setEditF(p => ({ ...p, notes: e.target.value }))} />
                      </div>
                    </div>
                  ) : (
                    /* ── View row ── */
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-semibold text-sm text-pine">{m.label}</span>
                          <span className="font-mono text-[10px] text-pine/40 bg-pine/5 px-1.5 py-0.5 rounded">{m.transaction_type}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {/* Debit */}
                          <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-700">
                            <span className="font-bold">Dr</span>
                            <span className="truncate max-w-[160px]">{m.debit ? `${m.debit.code} · ${m.debit.name}` : '—'}</span>
                          </span>
                          <ArrowRight size={12} className="text-pine/30 shrink-0" />
                          {/* Credit */}
                          <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-forest/10 border border-forest/20 text-forest">
                            <span className="font-bold">Cr</span>
                            <span className="truncate max-w-[160px]">{m.credit ? `${m.credit.code} · ${m.credit.name}` : '—'}</span>
                          </span>
                          {/* VAT */}
                          {m.vat && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                              <span className="font-bold">VAT</span>
                              <span className="truncate max-w-[120px]">{m.vat.code} · {m.vat.name}</span>
                            </span>
                          )}
                          {/* SC */}
                          {m.sc && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 border border-violet-200 text-violet-700">
                              <span className="font-bold">SC</span>
                              <span className="truncate max-w-[120px]">{m.sc.code} · {m.sc.name}</span>
                            </span>
                          )}
                        </div>
                        {m.notes && (
                          <p className="text-[10px] text-pine/40 mt-1.5">{m.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => startEdit(m)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-forest shrink-0"
                        title="Edit mapping"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div className="text-xs text-pine/40 px-1">
        ℹ️ These mappings define the accounting entries when transactions are posted from Reservations, POS, and Inventory modules.
        Consult your accountant before changing mappings.
      </div>
    </div>
  )
}
