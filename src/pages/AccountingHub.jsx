import { useRef, useEffect, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '../supabase';
import { fmtBDT, fmtDate, todayISO, exportXLSX } from '../lib/helpers';
import { Calculator, Plus, Trash2, FileDown, Scale, Building2 } from 'lucide-react';
function JournalsTab({ accounts, userName, flash }) {
  const [rows, setRows] = useState([])
  const [head, setHead] = useState({ jv_date: todayISO(), narration: '' })
  const [lines, setLines] = useState([{ account_id: '', debit: '', credit: '', line_note: '' }, { account_id: '', debit: '', credit: '', line_note: '' }])
  const [selectedVoucher, setSelectedVoucher] = useState(null)
  const componentRef = useRef()
  const handlePrint = useReactToPrint({ content: () => componentRef.current })

  const load = async () => { const { data } = await supabase.from('journal_entries').select('*, journal_lines(*, chart_of_accounts(code,name))').order('created_at', { ascending: false }).limit(40); setRows(data || []) }
  useEffect(() => { load() }, [])

  const upd = (i, k, v) => { const n = [...lines]; n[i][k] = v; setLines(n) }
  const totDr = lines.reduce((a, l) => a + (+l.debit || 0), 0)
  const totCr = lines.reduce((a, l) => a + (+l.credit || 0), 0)
  const balanced = totDr > 0 && Math.abs(totDr - totCr) < 0.01

  const post = async () => {
    if (!balanced) { flash('Debit and credit must be equal and non-zero.'); return }
    const valid = lines.filter((l) => l.account_id && (+l.debit || +l.credit))
    const { data: jv, error } = await supabase.from('journal_entries').insert({ jv_date: head.jv_date, narration: head.narration, source: 'MANUAL', posted_by: userName }).select().single()
    if (error) { flash(error.message); return }
    const { error: le } = await supabase.from('journal_lines').insert(valid.map((l) => ({ entry_id: jv.id, account_id: l.account_id, debit: +l.debit || 0, credit: +l.credit || 0, line_note: l.line_note })))
    if (le) flash(le.message); else { setHead({ jv_date: todayISO(), narration: '' }); setLines([{ account_id: '', debit: '', credit: '', line_note: '' }, { account_id: '', debit: '', credit: '', line_note: '' }]); load(); flash(`${jv.jv_no} posted.`) }
  }

  const openPrint = (r) => { setSelectedVoucher(r); setTimeout(() => handlePrint(), 100) }

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <input type="date" className="input" value={head.jv_date} onChange={(e) => setHead({ ...head, jv_date: e.target.value })} />
          <input className="input col-span-3" placeholder="Narration" value={head.narration} onChange={(e) => setHead({ ...head, narration: e.target.value })} />
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <select className="input col-span-5" value={l.account_id} onChange={(e) => upd(i, 'account_id', e.target.value)}><option value="">Account…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select>
            <input type="number" className="input col-span-2 money" placeholder="Debit" value={l.debit} onChange={(e) => upd(i, 'debit', e.target.value)} />
            <input type="number" className="input col-span-2 money" placeholder="Credit" value={l.credit} onChange={(e) => upd(i, 'credit', e.target.value)} />
            <input className="input col-span-3" placeholder="Note" value={l.line_note} onChange={(e) => upd(i, 'line_note', e.target.value)} />
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button className="btn-ghost !py-1" onClick={() => setLines([...lines, { account_id: '', debit: '', credit: '', line_note: '' }])}><Plus size={14} /> Add line</button>
          <div className={`money font-semibold ${balanced ? 'text-forest' : 'text-red-600'}`}>Dr {totDr.toFixed(2)} · Cr {totCr.toFixed(2)} {balanced ? '✓ balanced' : '✗ not balanced'}</div>
        </div>
        <button className="btn-primary" disabled={!balanced} onClick={post}><Plus size={15} /> Post journal</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">JV No</th><th className="th">Date</th><th className="th">Narration</th><th className="th">Source</th><th className="th text-right">Amount</th><th className="th"></th></tr></thead>
          <tbody>
            {rows.map((r) => { const amt = (r.journal_lines || []).reduce((a, l) => a + +l.debit, 0); return (
              <tr key={r.id}><td className="td money font-semibold">{r.jv_no}</td><td className="td money text-xs">{fmtDate(r.jv_date)}</td><td className="td text-sm">{r.narration}</td><td className="td text-xs">{r.source}</td><td className="td money text-right">{fmtBDT(amt)}</td><td className="td text-right"><button className="btn-ghost !py-1 text-xs" onClick={() => openPrint(r)}>Print</button></td></tr>) })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'none' }}><div ref={componentRef}>{selectedVoucher && <JournalVoucherPrint voucher={selectedVoucher} />}</div></div>
    </div>
  )
}

function JournalsTab({ accounts, userName, flash }) {
  const [rows, setRows] = useState([])
  const [head, setHead] = useState({ jv_date: todayISO(), narration: '' })
  const [lines, setLines] = useState([{ account_id: '', debit: '', credit: '', line_note: '' }, { account_id: '', debit: '', credit: '', line_note: '' }])
  const [selectedVoucher, setSelectedVoucher] = useState(null)
  const componentRef = useRef()
  const handlePrint = useReactToPrint({ content: () => componentRef.current })

  const load = async () => { const { data } = await supabase.from('journal_entries').select('*, journal_lines(*, chart_of_accounts(code,name))').order('created_at', { ascending: false }).limit(40); setRows(data || []) }
  useEffect(() => { load() }, [])

  const upd = (i, k, v) => { const n = [...lines]; n[i][k] = v; setLines(n) }
  const totDr = lines.reduce((a, l) => a + (+l.debit || 0), 0)
  const totCr = lines.reduce((a, l) => a + (+l.credit || 0), 0)
  const balanced = totDr > 0 && Math.abs(totDr - totCr) < 0.01

  const post = async () => {
    if (!balanced) { flash('Debit and credit must be equal and non-zero.'); return }
    const valid = lines.filter((l) => l.account_id && (+l.debit || +l.credit))
    const { data: jv, error } = await supabase.from('journal_entries').insert({ jv_date: head.jv_date, narration: head.narration, source: 'MANUAL', posted_by: userName }).select().single()
    if (error) { flash(error.message); return }
    const { error: le } = await supabase.from('journal_lines').insert(valid.map((l) => ({ entry_id: jv.id, account_id: l.account_id, debit: +l.debit || 0, credit: +l.credit || 0, line_note: l.line_note })))
    if (le) flash(le.message); else { setHead({ jv_date: todayISO(), narration: '' }); setLines([{ account_id: '', debit: '', credit: '', line_note: '' }, { account_id: '', debit: '', credit: '', line_note: '' }]); load(); flash(`${jv.jv_no} posted.`) }
  }

  const openPrint = (r) => { setSelectedVoucher(r); setTimeout(() => handlePrint(), 100) }

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <input type="date" className="input" value={head.jv_date} onChange={(e) => setHead({ ...head, jv_date: e.target.value })} />
          <input className="input col-span-3" placeholder="Narration" value={head.narration} onChange={(e) => setHead({ ...head, narration: e.target.value })} />
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <select className="input col-span-5" value={l.account_id} onChange={(e) => upd(i, 'account_id', e.target.value)}><option value="">Account…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select>
            <input type="number" className="input col-span-2 money" placeholder="Debit" value={l.debit} onChange={(e) => upd(i, 'debit', e.target.value)} />
            <input type="number" className="input col-span-2 money" placeholder="Credit" value={l.credit} onChange={(e) => upd(i, 'credit', e.target.value)} />
            <input className="input col-span-3" placeholder="Note" value={l.line_note} onChange={(e) => upd(i, 'line_note', e.target.value)} />
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button className="btn-ghost !py-1" onClick={() => setLines([...lines, { account_id: '', debit: '', credit: '', line_note: '' }])}><Plus size={14} /> Add line</button>
          <div className={`money font-semibold ${balanced ? 'text-forest' : 'text-red-600'}`}>Dr {totDr.toFixed(2)} · Cr {totCr.toFixed(2)} {balanced ? '✓ balanced' : '✗ not balanced'}</div>
        </div>
        <button className="btn-primary" disabled={!balanced} onClick={post}><Plus size={15} /> Post journal</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr><th className="th">JV No</th><th className="th">Date</th><th className="th">Narration</th><th className="th">Source</th><th className="th text-right">Amount</th><th className="th"></th></tr></thead>
          <tbody>
            {rows.map((r) => { const amt = (r.journal_lines || []).reduce((a, l) => a + +l.debit, 0); return (
              <tr key={r.id}><td className="td money font-semibold">{r.jv_no}</td><td className="td money text-xs">{fmtDate(r.jv_date)}</td><td className="td text-sm">{r.narration}</td><td className="td text-xs">{r.source}</td><td className="td money text-right">{fmtBDT(amt)}</td><td className="td text-right"><button className="btn-ghost !py-1 text-xs" onClick={() => openPrint(r)}>Print</button></td></tr>) })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'none' }}><div ref={componentRef}>{selectedVoucher && <JournalVoucherPrint voucher={selectedVoucher} />}</div></div>
    </div>
  )
}

function JournalVoucherPrint({ voucher }) {
  const totalDebit = (voucher.journal_lines || []).reduce((a, l) => a + Number(l.debit || 0), 0);
  const totalCredit = (voucher.journal_lines || []).reduce((a, l) => a + Number(l.credit || 0), 0);
  return (
    <div className="p-8 font-sans text-black">
      <h2 className="text-xl font-bold mb-4">Journal Voucher: {voucher.jv_no}</h2>
      <p><strong>Date:</strong> {fmtDate(voucher.jv_date)} | <strong>Narration:</strong> {voucher.narration}</p>
      <table className="w-full mt-4 border border-collapse">
        <thead><tr className="bg-gray-100"><th className="border p-2 text-left">Account</th><th className="border p-2 text-right">Debit</th><th className="border p-2 text-right">Credit</th></tr></thead>
        <tbody>
          {voucher.journal_lines?.map((e, i) => (
            <tr key={i}><td className="border p-2">{e.chart_of_accounts?.name}</td><td className="border p-2 text-right">{fmtBDT(e.debit)}</td><td className="border p-2 text-right">{fmtBDT(e.credit)}</td></tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold bg-gray-50"><td className="border p-2">Total</td><td className="border p-2 text-right">{fmtBDT(totalDebit)}</td><td className="border p-2 text-right">{fmtBDT(totalCredit)}</td></tr>
        </tfoot>
      </table>
    </div>
  )
}
