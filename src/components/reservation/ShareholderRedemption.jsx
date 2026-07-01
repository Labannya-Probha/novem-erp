import { useEffect, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { fmtBDT, todayISO } from '../../lib/helpers'
import { supabase } from '../../supabase'

export function ShareholderRedemption({ res, charges = [], reload, flash, userName }) {
  const shareholder = res.shareholders
  const [redeemAmt, setRedeemAmt]       = useState('')
  const [shareholders, setShareholders] = useState([])
  const [showPicker, setShowPicker]     = useState(false)
  const [editingBalance, setEditingBalance] = useState(false)
  const [balanceVal, setBalanceVal]     = useState('')
  const [busy, setBusy]                 = useState(false)

  useEffect(() => {
    if (showPicker)
      supabase.from('shareholders').select('id,name').order('name')
        .then(({ data }) => setShareholders(data || []))
  }, [showPicker])

  const assignShareholder = async (id) => {
    const { error } = await supabase.from('reservations').update({ shareholder_id: id }).eq('id', res.id)
    if (error) flash(error.message)
    else { setShowPicker(false); reload(); flash('Shareholder assigned.') }
  }
  const unassignShareholder = async () => {
    if (!window.confirm(`Remove ${shareholder?.name || 'this shareholder'}?`)) return
    const { error } = await supabase.from('reservations').update({ shareholder_id: null }).eq('id', res.id)
    if (error) flash(error.message)
    else { reload(); flash('Shareholder unassigned.') }
  }
  const saveBalance = async () => {
    if (balanceVal === '' || isNaN(Number(balanceVal))) { flash('Enter a valid amount.'); return }
    const { error } = await supabase.from('shareholders')
      .update({ free_stay_balance: Number(balanceVal) }).eq('id', res.shareholder_id)
    if (error) flash(error.message)
    else { setEditingBalance(false); reload(); flash('Shareholder balance corrected.') }
  }

  // Room charge totals
  const roomChargeTotal  = charges.filter(c => c.charge_type === 'ROOM').reduce((a,c) => a + (+c.total||0), 0)
  const alreadyRedeemed  = charges.filter(c => c.charge_type === 'SHAREHOLDER_REDEEM').reduce((a,c) => a + Math.abs(+c.total||0), 0)
  const roomRedeemableLeft = Math.max(0, +(roomChargeTotal - alreadyRedeemed).toFixed(2))
  const hasRoomCharge    = roomChargeTotal > 0

  // 100 shareholder points = ৳1
  const maxRedeemTaka    = Math.floor((shareholder?.free_stay_balance || 0) / 100)

  const redeem = async () => {
    const amount = Number(redeemAmt)
    if (!amount || amount <= 0)        { flash('Enter a valid ৳ amount.'); return }
    if (!hasRoomCharge)                 { flash('No room charge posted — redemption only against room charges.'); return }
    if (amount > roomRedeemableLeft)    { flash(`Max redeemable against room: ${fmtBDT(roomRedeemableLeft)}`); return }
    const pointsNeeded = Math.ceil(amount * 100)
    if ((shareholder?.free_stay_balance || 0) < pointsNeeded) {
      flash(`Insufficient balance. ${shareholder?.free_stay_balance || 0} pts = max ${fmtBDT(maxRedeemTaka)}.`)
      return
    }
    setBusy(true)
    const { error: chErr } = await supabase.from('folio_charges').insert({
      reservation_id: res.id,
      charge_type:    'SHAREHOLDER_REDEEM',
      description:    `Shareholder redemption — ${shareholder?.name} (against room charge)`,
      base_amount:    -amount, discount: 0, service_charge: 0, vat: 0, total: -amount,
      status:         'PAID', charge_date: todayISO(), created_by: userName || 'System',
    })
    if (chErr) { flash('Error recording redemption.'); setBusy(false); return }
    await supabase.from('shareholders')
      .update({ free_stay_balance: shareholder.free_stay_balance - pointsNeeded })
      .eq('id', res.shareholder_id)
    setRedeemAmt('')
    await reload()
    flash(`Redeemed ${fmtBDT(amount)} — ${pointsNeeded} pts deducted from ${shareholder?.name}.`)
    setBusy(false)
  }

  if (!shareholder) {
    return (
      <div className="card p-4">
        <h3 className="font-display font-semibold text-pine text-sm mb-2 flex items-center gap-2">
          <Users size={15} className="text-forest" /> Shareholder Redemption
        </h3>
        <p className="text-xs text-pine/50 mb-3">No shareholder linked to this reservation.</p>
        <button onClick={() => setShowPicker(true)} className="btn-ghost text-sm">
          <Plus size={13} /> Assign Shareholder
        </button>
        {showPicker && (
          <div className="mt-2 border border-leaf rounded-lg p-2 max-h-40 overflow-y-auto">
            {shareholders.map(s => (
              <button key={s.id} onClick={() => assignShareholder(s.id)}
                className="block w-full text-left px-2 py-1.5 text-sm rounded hover:bg-leaf/40">{s.name}</button>
            ))}
            <button onClick={() => setShowPicker(false)}
              className="block w-full text-left px-2 py-1.5 text-xs text-pine/40 hover:bg-leaf/40">Cancel</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-pine text-sm flex items-center gap-2">
          <Users size={15} className="text-forest" /> Shareholder Redemption
        </h3>
        {shareholder && (
          <div className="flex gap-2 text-xs">
            <button onClick={() => setShowPicker(true)} className="text-pine/50 hover:text-forest underline">Change</button>
            <span className="text-pine/20">·</span>
            <button onClick={unassignShareholder} className="text-red-400 hover:text-red-600 underline">Unassign</button>
          </div>
        )}
      </div>

      {showPicker && (
        <div className="border border-leaf rounded-lg p-2 max-h-40 overflow-y-auto">
          {shareholders.map(s => (
            <button key={s.id} onClick={() => assignShareholder(s.id)}
              className="block w-full text-left px-2 py-1.5 text-sm rounded hover:bg-leaf/40">{s.name}</button>
          ))}
          <button onClick={() => setShowPicker(false)}
            className="block w-full text-left px-2 py-1.5 text-xs text-pine/40 hover:bg-leaf/40">Cancel</button>
        </div>
      )}

      {shareholder && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-pine">{shareholder.name}</span>
            <span className="text-xs text-pine/40">·</span>
            {!editingBalance ? (
              <span className="text-sm text-pine/60">
                Balance: <span className="font-bold text-forest">{shareholder.free_stay_balance || 0} pts</span>
                {' '}= <span className="font-semibold money">{fmtBDT(maxRedeemTaka)}</span>
                <button onClick={() => { setBalanceVal(String(shareholder.free_stay_balance || 0)); setEditingBalance(true) }}
                  className="ml-2 text-xs text-pine/40 hover:text-forest underline">Edit</button>
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <input type="number" className="input money !w-28 !py-1" value={balanceVal}
                  onChange={e => setBalanceVal(e.target.value)} />
                <button onClick={saveBalance} className="text-xs text-forest font-semibold underline">Save</button>
                <button onClick={() => setEditingBalance(false)} className="text-xs text-pine/40 underline">Cancel</button>
              </div>
            )}
          </div>

          {/* Rate info */}
          <div className="text-xs text-pine/40 bg-leaf/20 rounded-lg px-3 py-2">
            100 shareholder pts = ৳1.00 &nbsp;·&nbsp; Redeemable against room charges only
            {hasRoomCharge
              ? <span className="ml-2">· Room remaining: <span className="font-semibold text-pine/60">{fmtBDT(roomRedeemableLeft)}</span></span>
              : <span className="ml-2 text-amber-600">· No room charge posted yet</span>}
          </div>

          {/* Redeem input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input type="number" min="0" step="0.01"
                className="input money flex-1"
                placeholder="Amount to redeem (৳)"
                value={redeemAmt}
                onChange={e => setRedeemAmt(e.target.value)}
                disabled={!hasRoomCharge || roomRedeemableLeft <= 0}
              />
              <button onClick={redeem} disabled={busy || !hasRoomCharge || roomRedeemableLeft <= 0 || !redeemAmt}
                className="btn-amber">
                Redeem
              </button>
            </div>
            {redeemAmt && Number(redeemAmt) > 0 && (
              <p className="text-xs text-pine/50">
                = {Math.ceil(Number(redeemAmt) * 100)} pts will be deducted from {shareholder.name}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ShareholderRedemption
