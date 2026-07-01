import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtDate, fmtBDT, todayISO } from '../lib/helpers'
import { Wallet, Plus, X, AlertCircle } from 'lucide-react'

const money = (n) => fmtBDT(n)

export default function VendorPaymentTab({ role }) {
  const canAccess = ['ADMIN', 'SUPERUSER', 'ACCOUNTS'].includes(role)
  const [tab, setTab] = useState('outstanding')

  if (!canAccess) {
    return (
      <div className="card p-6 text-center text-pine/60">
        <AlertCircle className="mx-auto mb-2 text-pine/30" size={28} />
        This section is restricted to Accounts, Admin and Superuser roles.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-pine flex items-center gap-2">
          <Wallet className="text-forest" size={20} /> Vendor Payments
        </h2>
        <p className="text-sm text-pine/60">Record payments against vendor bills (GRNs) and track outstanding balances.</p>
      </div>
      <div className="flex gap-2 border-b border-leaf">
        {[
          { key: 'outstanding', label: 'Outstanding Bills' },
          { key: 'history', label: 'Payment History' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? 'border-forest text-forest' : 'border-transparent text-pine/50 hover:text-pine'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'outstanding' && <OutstandingBillsView />}
      {tab === 'history' && <PaymentHistoryView />}
    </div>
  )
}

function BucketChip({ bucket }) {
  const map = {
    'Current': 'bg-forest/15 text-forest',
    '1-30 days': 'bg-amber-100 text-amber-700',
    '31-60 days': 'bg-orange-100 text-orange-700',
    '61-90 days': 'bg-red-100 text-red-600',
    '90+ days': 'bg-red-200 text-red-800',
  }
  return <span className={`status-chip ${map[bucket] || 'bg-stone-200 text-stone-600'}`}>{bucket}</span>
}

function OutstandingBillsView() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(null)

  const load = () => {
    supabase.from('v_ap_aging').select('*').gt('outstanding', 0).order('due_date')
      .then(({ data }) => {
        const today = todayISO()
        const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000)
        const withBucket = (data || []).map((r) => {
          const age = daysBetween(r.due_date, today)
          const bucket = age > 90 ? '90+ days' : age > 60 ? '61-90 days' : age > 30 ? '31-60 days' : age > 0 ? '1-30 days' : 'Current'
          return { ...r, bucket }
        })
        setItems(withBucket)
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [])

  const totalOutstanding = items.reduce((a, r) => a + +r.outstanding, 0)

  return (
    <div className="space-y-3">
      <div className="card p-3 flex items-center justify-between">
        <span className="text-sm text-pine/60">Total outstanding across all vendors</span>
        <span className="font-display text-lg font-bold text-pine">{money(totalOutstanding)}</span>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr>
            <th className="th">GRN No</th><th className="th">Vendor</th><th className="th">Due Date</th>
            <th className="th text-right">Payable</th><th className="th text-right">Paid</th>
            <th className="th text-right">Outstanding</th><th className="th">Bucket</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {loading && <tr><td className="td text-pine/40" colSpan={8}>Loading...</td></tr>}
            {!loading && items.map((i) => (
              <tr key={i.grn_id}>
                <td className="td text-sm font-medium">{i.grn_no}</td>
                <td className="td text-sm">{i.vendor_name}</td>
                <td className="td text-sm">{i.due_date ? fmtDate(i.due_date) : '—'}</td>
                <td className="td text-sm text-right money">{money(i.payable)}</td>
                <td className="td text-sm text-right money">{money(i.paid)}</td>
                <td className="td text-sm text-right money font-semibold">{money(i.outstanding)}</td>
                <td className="td"><BucketChip bucket={i.bucket} /></td>
                <td className="td"><button className="btn-primary !py-1 !text-xs" onClick={() => setPaying(i)}><Plus size={12} /> Pay</button></td>
              </tr>
            ))}
            {!loading && items.length === 0 && <tr><td className="td text-pine/40" colSpan={8}>No outstanding bills. All vendor payments are up to date.</td></tr>}
          </tbody>
        </table>
      </div>
      {paying && <RecordPaymentModal bill={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); load() }} />}
    </div>
  )
}

function RecordPaymentModal({ bill, onClose, onSaved }) {
  const [amount, setAmount] = useState(bill.outstanding)
  const [paidDate, setPaidDate] = useState(todayISO())
  const [method, setMethod] = useState('BANK')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!amount || amount <= 0) { setErr('Enter a valid amount.'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('vendor_payments').insert({
      vendor_id: bill.vendor_id, grn_id: bill.grn_id, amount: +amount,
      paid_date: paidDate, method, reference: reference || null, notes: notes || null,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-start justify-center overflow-auto p-6">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full my-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-leaf">
          <h3 className="font-display font-semibold text-pine">Record Payment — {bill.grn_no}</h3>
          <button className="btn-ghost !py-1" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="p-5 space-y-3">
          {err && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{err}</div>}
          <div className="text-sm text-pine/60">
            Vendor: <span className="font-medium text-pine">{bill.vendor_name}</span><br />
            Outstanding: <span className="font-medium text-pine">{money(bill.outstanding)}</span>
          </div>
          <div><label className="label">Amount</label><input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} max={bill.outstanding} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Paid Date</label><input type="date" className="input" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} /></div>
            <div><label className="label">Method</label>
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="CASH">Cash</option><option value="BKASH">bKash</option><option value="NAGAD">Nagad</option>
                <option value="CARD">Card</option><option value="BANK">Bank</option><option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div><label className="label">Reference No</label><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque no / transaction id" /></div>
          <div><label className="label">Notes</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save Payment'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PaymentHistoryView() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('vendor_payments').select('paid_date, amount, method, reference, notes, vendors(name), goods_receipts(grn_no)')
      .order('paid_date', { ascending: false })
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [])

  const total = rows.reduce((a, r) => a + +r.amount, 0)

  return (
    <div className="space-y-3">
      <div className="card p-3 flex items-center justify-between">
        <span className="text-sm text-pine/60">Total paid (all time)</span>
        <span className="font-display text-lg font-bold text-pine">{money(total)}</span>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr>
            <th className="th">Date</th><th className="th">Vendor</th><th className="th">GRN</th>
            <th className="th">Method</th><th className="th">Reference</th><th className="th text-right">Amount</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td className="td text-pine/40" colSpan={6}>Loading...</td></tr>}
            {!loading && rows.map((r, i) => (
              <tr key={i}>
                <td className="td text-sm">{fmtDate(r.paid_date)}</td>
                <td className="td text-sm">{(r.vendors && r.vendors.name) || '—'}</td>
                <td className="td text-sm">{(r.goods_receipts && r.goods_receipts.grn_no) || '— (general)'}</td>
                <td className="td text-sm">{r.method}</td>
                <td className="td text-sm">{r.reference || '—'}</td>
                <td className="td text-sm text-right money">{money(r.amount)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td className="td text-pine/40" colSpan={6}>No payments recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
