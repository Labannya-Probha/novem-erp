import { useEffect, useState } from 'react'
import { Receipt } from 'lucide-react'
import SearchableSelect from '../SearchableSelect.jsx'
import { fmtBDT, fmtDate, todayISO } from '../../lib/helpers'
import { logAudit } from '../../lib/pms.api.js'
import { supabase } from '../../supabase'

export function GuestRefundCard({ res, payments, charges, totals, paid, resRooms = [], reload, flash, userName, isAdmin }) {
  const [open, setOpen]               = useState(false)
  const [policies, setPolicies]       = useState([])
  const [selectedPolicyId, setSelectedPolicyId] = useState('')
  const [cancelCharge, setCancelCharge] = useState(0)
  const [isManual, setIsManual]       = useState(false)
  const [manualCharge, setManualCharge] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [refundMethod, setRefundMethod] = useState('CASH')
  const [refundDate, setRefundDate]   = useState(todayISO())
  const [notes, setNotes]             = useState('')
  const [busy, setBusy]               = useState(false)
  const [existingRefund, setExistingRefund] = useState(null)

  // Load policies + existing refund
  useEffect(() => {
    if (!open) return
    supabase.from('cancellation_policies').select('*').eq('is_active', true)
      .order('is_default', { ascending: false }).order('name')
      .then(({ data }) => {
        const list = data || []
        setPolicies(list)
        // Auto-select default
        const def = list.find(p => p.is_default) || list[0]
        if (def && !selectedPolicyId) {
          setSelectedPolicyId(def.id)
          applyPolicy(def, paid)
        }
      })
    supabase.from('refunds').select('*').eq('reservation_id', res.id).maybeSingle()
      .then(({ data }) => setExistingRefund(data))
  }, [open])

  const applyPolicy = (policy, totalPaid) => {
    if (!policy || policy.charge_type === 'none') {
      setCancelCharge(0); return
    }
    if (policy.charge_type === 'percentage') {
      setCancelCharge(+(totalPaid * policy.charge_value / 100).toFixed(2))
    } else if (policy.charge_type === 'fixed') {
      setCancelCharge(Math.min(policy.charge_value, totalPaid))
    } else if (policy.charge_type === 'nights') {
      // N nights × room rate
      const nightlyRate = resRooms?.[0]?.rate || Number(res.room_rate) || 0
      setCancelCharge(Math.min(policy.charge_value * nightlyRate, totalPaid))
    }
  }

  const handlePolicyChange = (policyId) => {
    setSelectedPolicyId(policyId)
    setIsManual(false)
    const policy = policies.find(p => p.id === policyId)
    if (policy) applyPolicy(policy, paid)
  }

  const effectiveCharge = isManual ? (Number(manualCharge) || 0) : cancelCharge
  const refundAmount    = Math.max(0, +(paid - effectiveCharge).toFixed(2))
  const selectedPolicy  = policies.find(p => p.id === selectedPolicyId)

  const processRefund = async () => {
    if (paid <= 0) { flash('No payment recorded — nothing to refund.'); return }
    if (!window.confirm(`Process refund of ${fmtBDT(refundAmount)} to guest?`)) return
    setBusy(true)
    try {
      // 1. Record refund
      const { error: refErr } = await supabase.from('refunds').insert({
        reservation_id:      res.id,
        refund_date:         refundDate,
        total_paid:          paid,
        cancellation_charge: effectiveCharge,
        refund_amount:       refundAmount,
        refund_method:       refundMethod,
        policy_id:           isManual ? null : (selectedPolicyId || null),
        policy_name:         isManual ? 'Manual Override' : (selectedPolicy?.name || null),
        override_reason:     isManual ? overrideReason : null,
        is_manual_override:  isManual,
        processed_by:        userName,
        notes,
      })
      if (refErr) throw refErr

      // 2. If cancellation charge > 0, post it as a folio charge
      if (effectiveCharge > 0) {
        await supabase.from('folio_charges').insert({
          reservation_id: res.id,
          charge_date:    refundDate,
          charge_type:    'CANCELLATION_FEE',
          description:    `Cancellation fee — ${isManual ? overrideReason || 'Manual' : selectedPolicy?.name}`,
          base_amount:    effectiveCharge,
          discount:       0,
          service_charge: 0,
          vat:            0,
          total:          effectiveCharge,
          status:         'PAID',
          created_by:     userName,
        })
      }

      // 3. Record refund as negative payment
      await supabase.from('payments').insert({
        reservation_id: res.id,
        amount:         -refundAmount,
        method:         refundMethod,
        reference:      `REFUND-${res.res_no}`,
        received_date:  refundDate,
        received_by:    userName,
        payment_class:  'REFUND',
        notes:          `Guest refund — ${isManual ? overrideReason || 'Manual override' : selectedPolicy?.name}`,
      })

      // 4. Audit log
      await logAudit({
        actor: userName, action: 'GUEST_REFUND', entity: 'reservation',
        entity_id: res.res_no,
        details: { total_paid: paid, cancellation_charge: effectiveCharge, refund_amount: refundAmount, method: refundMethod, policy: selectedPolicy?.name || 'Manual' },
      })

      await reload()
      flash(`Refund of ${fmtBDT(refundAmount)} processed via ${refundMethod}.${effectiveCharge > 0 ? ` Cancellation fee ${fmtBDT(effectiveCharge)} recorded.` : ''}`)
      setOpen(false)
    } catch (e) { flash(e.message) }
    setBusy(false)
  }

  if (!isAdmin) return null

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-leaf/20 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <Receipt size={16} className="text-amber" />
          <div>
            <div className="font-display font-semibold text-pine">Guest Refund</div>
            {existingRefund && (
              <div className="text-xs text-pine/50">
                Previous refund: {fmtBDT(existingRefund.refund_amount)} on {fmtDate(existingRefund.refund_date)}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-pine/60 money">Total paid: <span className="font-bold text-pine">{fmtBDT(paid)}</span></span>
          <svg className={`w-4 h-4 text-pine/40 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-leaf space-y-4 pt-4">

          {paid <= 0 && (
            <div className="px-4 py-3 rounded-lg bg-amber/10 text-amber text-sm">
              No payment recorded for this reservation — nothing to refund.
            </div>
          )}

          {paid > 0 && (
            <>
              {/* Cancellation Policy */}
              <div>
                <label className="label">Cancellation Policy</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SearchableSelect
                    value={selectedPolicyId}
                    onChange={handlePolicyChange}
                    options={[
                      { value: '', label: 'No policy / full refund' },
                      ...policies.map(p => ({
                        value: p.id,
                        label: `${p.name} · ${p.charge_type === 'none' ? 'No charge' : p.charge_type === 'percentage' ? `${p.charge_value}% of paid` : p.charge_type === 'fixed' ? fmtBDT(p.charge_value) : `${p.charge_value} nights`}`,
                      })),
                    ]}
                    placeholder="Select policy…"
                    disabled={isManual}
                  />
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-leaf/30 text-sm">
                    <span className="text-pine/60">Policy charge:</span>
                    <span className="font-bold money text-pine">{fmtBDT(cancelCharge)}</span>
                    {selectedPolicy?.description && (
                      <span className="text-xs text-pine/40 ml-1">— {selectedPolicy.description}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Manual Override */}
              <div className="border border-amber/30 rounded-lg p-3 bg-amber/5">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={isManual} onChange={e => setIsManual(e.target.checked)} className="accent-amber" />
                  <span className="text-sm font-medium text-amber-700">Manual override (exception)</span>
                </label>
                {isManual && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="label !text-xs">Cancellation charge (৳)</label>
                      <input type="number" min="0" max={paid}
                        className="input money"
                        placeholder="e.g. 500"
                        value={manualCharge}
                        onChange={e => setManualCharge(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label !text-xs">Reason *</label>
                      <input className="input"
                        placeholder="e.g. VIP guest, emergency cancellation…"
                        value={overrideReason}
                        onChange={e => setOverrideReason(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Refund Summary */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-leaf/30 rounded-lg p-3">
                  <div className="text-xs text-pine/50 mb-1">Total Paid</div>
                  <div className="font-bold money text-pine">{fmtBDT(paid)}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-xs text-pine/50 mb-1">Cancellation Fee</div>
                  <div className="font-bold money text-red-600">− {fmtBDT(effectiveCharge)}</div>
                </div>
                <div className="bg-forest/10 rounded-lg p-3">
                  <div className="text-xs text-pine/50 mb-1">Refund Amount</div>
                  <div className="font-bold money text-forest text-lg">{fmtBDT(refundAmount)}</div>
                </div>
              </div>

              {/* Refund Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label !text-xs">Refund Method</label>
                  <SearchableSelect
                    value={refundMethod}
                    onChange={setRefundMethod}
                    options={['CASH', 'BKASH', 'NAGAD', 'CARD', 'BANK', 'OTHER']}
                    placeholder="Method…"
                  />
                </div>
                <div>
                  <label className="label !text-xs">Refund Date</label>
                  <input type="date" className="input" value={refundDate} onChange={e => setRefundDate(e.target.value)} />
                </div>
                <div>
                  <label className="label !text-xs">Notes (optional)</label>
                  <input className="input" placeholder="Internal note…" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>

              <button
                onClick={processRefund}
                disabled={busy || refundAmount < 0 || (isManual && !overrideReason)}
                className="btn-primary w-full justify-center"
              >
                <Receipt size={15} />
                {busy ? 'Processing…' : `Process Refund — ${fmtBDT(refundAmount)}`}
              </button>

              {isManual && !overrideReason && (
                <p className="text-xs text-red-500 text-center">Override reason required for manual charge.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
/* ── Charge Type Select (fixed-position, pulls from facility_items) ── */

export default GuestRefundCard
