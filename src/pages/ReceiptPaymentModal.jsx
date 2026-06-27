import { useState } from 'react'
import { X, Banknote, CreditCard, Smartphone, Building2, Plus, Minus } from 'lucide-react'
import { supabase } from '../supabase'
import { fmtBDT, todayISO } from '../lib/helpers'

const METHODS = [
  { id: 'CASH',  label: 'Cash',   icon: Banknote   },
  { id: 'BANK',  label: 'Bank',   icon: Building2  },
  { id: 'BKASH', label: 'bKash',  icon: Smartphone },
  { id: 'NAGAD', label: 'Nagad',  icon: Smartphone },
  { id: 'CARD',  label: 'Card',   icon: CreditCard },
]

/**
 * ReceiptPaymentModal
 * Props:
 *   type: 'RECEIPT' | 'PAYMENT'
 *   onClose: fn
 *   onSaved: fn  (called after successful save)
 *   prefillAmount?: number
 *   prefillRef?: string  (reservation res_no or vendor name)
 *   reservationId?: string
 */
export default function ReceiptPaymentModal({ type = 'RECEIPT', onClose, onSaved, prefillAmount, prefillRef, reservationId }) {
  const isReceipt = type === 'RECEIPT'

  const [date, setDate]         = useState(todayISO())
  const [method, setMethod]     = useState('CASH')
  const [amount, setAmount]     = useState(prefillAmount ? String(prefillAmount) : '')
  const [ref, setRef]           = useState(prefillRef || '')
  const [narration, setNarration] = useState('')
  const [cheque, setCheque]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [err, setErr]           = useState(null)
  const [success, setSuccess]   = useState(false)

  const save = async () => {
    if (!amount || isNaN(+amount) || +amount <= 0) { setErr('Valid amount required.'); return }
    if (!date) { setErr('Date required.'); return }
    setLoading(true); setErr(null)

    try {
      if (isReceipt) {
        // Insert into payments table
        const payload = {
          received_date: date,
          method,
          amount: +amount,
          reference_no: cheque || ref || null,
          narration: narration || null,
        }
        if (reservationId) payload.reservation_id = reservationId

        const { error } = await supabase.from('payments').insert(payload)
        if (error) throw error
      } else {
        // Insert into petty_cash_payments or a general payments_out table
        // Falls back to journal_entries approach if table doesn't exist
        const { error } = await supabase.from('cash_payments').insert({
          payment_date: date,
          method,
          amount: +amount,
          payee: ref || null,
          cheque_no: cheque || null,
          narration: narration || null,
        })
        if (error) {
          // Fallback: try general voucher table
          const { error: e2 } = await supabase.from('petty_cash').insert({
            txn_date: date,
            method,
            amount: +amount,
            party: ref || null,
            remarks: narration || null,
          })
          if (e2) throw e2
        }
      }

      setSuccess(true)
      setTimeout(() => {
        onSaved?.()
        onClose()
      }, 900)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 ${isReceipt ? 'bg-forest' : 'bg-red-600'} text-white`}>
          <div className="flex items-center gap-2 font-display font-bold text-lg">
            {isReceipt ? <Plus size={20} /> : <Minus size={20} />}
            {isReceipt ? 'Record Receipt' : 'Record Payment'}
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-lg transition"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {success && (
            <div className="p-3 bg-forest/10 text-forest rounded-lg text-sm font-semibold text-center">
              ✓ {isReceipt ? 'Receipt' : 'Payment'} saved successfully!
            </div>
          )}
          {err && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{err}</div>}

          {/* Date + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Amount (৳)</label>
              <input type="number" className="input money" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="label">Method</label>
            <div className="flex gap-2 flex-wrap">
              {METHODS.map(m => {
                const Icon = m.icon
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      method === m.id
                        ? 'bg-forest text-white border-forest'
                        : 'border-leaf text-pine/70 hover:border-forest'
                    }`}
                  >
                    <Icon size={12} />{m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ref / Party */}
          <div>
            <label className="label">{isReceipt ? 'Received From' : 'Paid To'}</label>
            <input
              className="input"
              value={ref}
              onChange={e => setRef(e.target.value)}
              placeholder={isReceipt ? 'Guest name / Reservation no.' : 'Vendor / Payee name'}
            />
          </div>

          {/* Cheque no (bank only) */}
          {method === 'BANK' && (
            <div>
              <label className="label">Cheque / Transfer Ref No.</label>
              <input className="input" value={cheque} onChange={e => setCheque(e.target.value)} placeholder="e.g. CHQ-0042 or TT-REF" />
            </div>
          )}

          {/* Narration */}
          <div>
            <label className="label">Narration / Remarks</label>
            <textarea
              className="input !h-16 resize-none"
              value={narration}
              onChange={e => setNarration(e.target.value)}
              placeholder="Optional details…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={save}
            disabled={loading || success}
            className={`btn-primary ${isReceipt ? '' : '!bg-red-600 !hover:bg-red-700'}`}
          >
            {loading ? 'Saving…' : `Save ${isReceipt ? 'Receipt' : 'Payment'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
