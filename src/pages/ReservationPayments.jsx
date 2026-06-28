import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate, todayISO } from '../lib/helpers'
import SearchableSelect from '../components/SearchableSelect.jsx'
import { Receipt, Trash2, Pencil, MessageCircle, Mail, Printer, X } from 'lucide-react'
import { generateReservationPaymentNo, parsePaymentReference, toPaymentReference } from '../lib/paymentNumber'
import { logAudit } from '../lib/pms.api.js'

export default function ReservationPayments({ userName, isAdmin }) {
  const [reservations, setReservations] = useState([])
  const [payments, setPayments]         = useState([])
  const [busy, setBusy]                 = useState(false)
  const [msg, setMsg]                   = useState('')
  const [msgKind, setMsgKind]           = useState('ok')

  // ── new payment form ────────────────────────────────────────────
  const [f, setF] = useState({
    reservation_id: '',
    amount: '',
    method: 'CASH',
    reference: '',
    received_date: todayISO(),
    received_by: userName,
    paid_by_party: '',
    payment_class: 'SETTLEMENT',
  })

  // ── edit state ──────────────────────────────────────────────────
  const [editRow,  setEditRow]  = useState(null)
  const [editForm, setEditForm] = useState({})

  // ── send dialog ──────────────────────────────────────────────────
  const [sendBox, setSendBox] = useState({
    open: false, channel: 'WHATSAPP', to: '', subject: '', body: '', payment: null,
  })
  const [sendBusy, setSendBusy] = useState(false)

  const loadAll = async () => {
    const [{ data: rs }, { data: pm }] = await Promise.all([
      supabase
        .from('reservations')
        .select('id,res_no,reservation_name, guests:primary_guest_id(full_name,phone,email)')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('payments')
        .select('id,reservation_id,received_date,amount,method,reference,received_by,paid_by_party,payment_class,reservations(res_no,reservation_name,primary_guest_id,guests:primary_guest_id(full_name,phone,email))')
        .order('received_date', { ascending: false })
        .limit(500),
    ])
    setReservations(rs || [])
    setPayments(pm || [])
  }

  useEffect(() => { loadAll() }, [])

  const flash = (text, kind = 'ok') => {
    setMsg(text); setMsgKind(kind)
    setTimeout(() => setMsg(''), 3500)
  }

  // ── Create ──────────────────────────────────────────────────────
  const addPayment = async () => {
    if (!f.reservation_id) { flash('Select a reservation first.', 'err'); return }
    if (!f.amount || +f.amount <= 0) { flash('Enter a valid amount.', 'err'); return }

    setBusy(true)
    const paymentNo = await generateReservationPaymentNo()
    const { error } = await supabase.from('payments').insert({
      reservation_id: f.reservation_id,
      amount: +f.amount,
      method: f.method,
      reference: toPaymentReference(paymentNo, f.reference),
      received_date: f.received_date,
      received_by: f.received_by || userName,
      paid_by_party: f.paid_by_party || null,
      payment_class: f.payment_class || 'SETTLEMENT',
    })
    setBusy(false)
    if (error) { flash(error.message, 'err'); return }
    setF({ reservation_id: '', amount: '', method: 'CASH', reference: '', received_date: todayISO(), received_by: userName, paid_by_party: '', payment_class: 'SETTLEMENT' })
    await loadAll()
    flash('Reservation payment recorded.')
  }

  // ── Edit ────────────────────────────────────────────────────────
  const startEdit = (pm) => {
    const parsed = parsePaymentReference(pm.reference)
    setEditRow(pm)
    setEditForm({
      amount: String(pm.amount || ''),
      method: pm.method || 'CASH',
      reference: parsed.reference || '',
      received_date: pm.received_date || todayISO(),
      paid_by_party: pm.paid_by_party || '',
      payment_class: pm.payment_class || 'SETTLEMENT',
    })
  }

  const saveEdit = async () => {
    if (!editRow) return
    if (!editForm.amount || +editForm.amount <= 0) { flash('Enter a valid amount.', 'err'); return }
    const parsedCurrent = parsePaymentReference(editRow.reference)
    const paymentNo = parsedCurrent.paymentNo || await generateReservationPaymentNo()
    const { error } = await supabase.from('payments').update({
      amount: +editForm.amount,
      method: editForm.method,
      reference: toPaymentReference(paymentNo, editForm.reference),
      received_date: editForm.received_date,
      paid_by_party: editForm.paid_by_party || null,
      payment_class: editForm.payment_class || 'SETTLEMENT',
    }).eq('id', editRow.id)
    if (error) { flash(error.message || 'Update failed.', 'err'); return }
    setEditRow(null)
    await loadAll()
    flash('Payment updated.')
  }

  // ── Delete ──────────────────────────────────────────────────────
  const delPayment = async (pm) => {
    if (!window.confirm(`Delete payment ${parsePaymentReference(pm.reference).paymentNo || pm.id}?`)) return
    const { error } = await supabase.from('payments').delete().eq('id', pm.id)
    if (error) { flash(error.message || 'Delete failed.', 'err'); return }
    await loadAll()
    flash('Payment deleted.')
  }

  // ── Print ───────────────────────────────────────────────────────
  const printPayment = (pm) => {
    const parsed = parsePaymentReference(pm.reference)
    const resName = pm.reservations?.reservation_name || pm.reservations?.guests?.full_name || '—'
    const html = `<!doctype html><html><head><title>Payment Receipt</title><style>
      body{font-family:Arial,sans-serif;padding:32px;max-width:480px;margin:auto}
      h2{margin-bottom:4px}p{margin:6px 0}hr{border:none;border-top:1px solid #ccc;margin:12px 0}
      .amt{font-size:1.4rem;font-weight:700;margin-top:12px}
    </style></head><body>
      <h2>Payment Receipt</h2>
      <hr/>
      <p><b>Reservation:</b> ${pm.reservations?.res_no || '—'} — ${resName}</p>
      <p><b>Payment ID:</b> ${parsed.paymentNo || 'N/A'}</p>
      <p><b>Date:</b> ${pm.received_date || '—'}</p>
      <p><b>Paid by:</b> ${pm.paid_by_party || pm.received_by || '—'}</p>
      <p><b>Method:</b> ${pm.method || '—'}</p>
      <p><b>Class:</b> ${pm.payment_class || 'SETTLEMENT'}</p>
      <p><b>Reference:</b> ${parsed.reference || '—'}</p>
      <hr/>
      <p class="amt">Amount: ${fmtBDT(Number(pm.amount || 0))}</p>
    </body></html>`
    const w = window.open('', '_blank', 'width=640,height=760')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
    flash('Print sent.')
  }

  // ── Send (WhatsApp / Email) ──────────────────────────────────────
  const openSend = (channel, pm) => {
    const parsed  = parsePaymentReference(pm.reference)
    const guest   = pm.reservations?.guests
    const resName = pm.reservations?.reservation_name || guest?.full_name || '—'
    const msg     = [
      `Reservation: ${pm.reservations?.res_no || '—'} — ${resName}`,
      `Payment ID: ${parsed.paymentNo || 'N/A'}`,
      `Amount: ${fmtBDT(Number(pm.amount || 0))}`,
      `Method: ${pm.method || '—'}`,
      `Date: ${pm.received_date || '—'}`,
    ].join('\n')
    const phone = (guest?.phone || '').replace(/[^\d]/g, '')
    setSendBox({
      open: true, channel,
      to: channel === 'EMAIL' ? (guest?.email || '') : phone,
      subject: `Payment Receipt — ${parsed.paymentNo || pm.reservations?.res_no || ''}`,
      body: msg,
      payment: pm,
    })
  }

  const sendNow = async () => {
    const pm = sendBox.payment
    if (!pm) return
    if (!sendBox.to?.trim()) { flash('Recipient is required.', 'err'); return }
    setSendBusy(true)

    const parsed = parsePaymentReference(pm.reference)

    if (sendBox.channel === 'WHATSAPP') {
      const phone = sendBox.to.replace(/[^\d]/g, '')
      const intl  = phone.startsWith('880') ? phone : phone.startsWith('0') ? '88' + phone : '880' + phone
      window.open(`https://wa.me/${intl}?text=${encodeURIComponent(sendBox.body)}`, '_blank')
      await logAudit({
        actor: userName, action: 'SEND_WHATSAPP', entity: 'payment',
        entity_id: parsed.paymentNo || pm.id,
        details: { channel: 'WHATSAPP', to: sendBox.to, reservation_id: pm.reservation_id, payment_id: pm.id },
      })
      flash('WhatsApp window opened.')
    } else {
      window.open(
        `mailto:${sendBox.to}?subject=${encodeURIComponent(sendBox.subject)}&body=${encodeURIComponent(sendBox.body)}`,
        '_blank'
      )
      await logAudit({
        actor: userName, action: 'SEND_EMAIL', entity: 'payment',
        entity_id: parsed.paymentNo || pm.id,
        details: { channel: 'EMAIL', to: sendBox.to, reservation_id: pm.reservation_id, payment_id: pm.id },
      })
      flash('Email client opened.')
    }

    setSendBusy(false)
    setSendBox({ ...sendBox, open: false })
  }

  const advanceTotal = useMemo(
    () => payments
      .filter((p) => p.payment_class === 'ADVANCE' && Number(p.amount) > 0)
      .reduce((a, p) => a + Number(p.amount), 0),
    [payments],
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-pine">Reservation Payments</h1>
        <p className="text-sm text-pine/60">Record and review reservation/front-office payments with auto payment ID.</p>
      </div>

      {msg && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${msgKind === 'err' ? 'bg-red-50 text-red-700' : 'bg-forest/10 text-forest'}`}>
          {msg}
        </div>
      )}

      {/* ── Payment Entry Form ───────────────────────────────────── */}
      <div className="card p-4">
        <h3 className="font-display font-semibold text-pine mb-3 flex items-center gap-2">
          <Receipt size={16} className="text-forest" /> Reservation Payment Entry
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="label !text-xs">Reservation *</label>
            <SearchableSelect
              value={f.reservation_id}
              onChange={(v) => setF({ ...f, reservation_id: v })}
              options={reservations.map((r) => ({
                value: r.id,
                label: `${r.res_no} - ${r.reservation_name || r.guests?.full_name || 'Guest'}`,
              }))}
              placeholder="Select reservation…"
            />
          </div>
          <div>
            <label className="label !text-xs">Amount (৳) *</label>
            <input type="number" className="input money" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </div>
          <div>
            <label className="label !text-xs">Date</label>
            <input type="date" className="input" value={f.received_date} onChange={(e) => setF({ ...f, received_date: e.target.value })} />
          </div>
          <div>
            <label className="label !text-xs">Method</label>
            <SearchableSelect
              value={f.method}
              onChange={(v) => setF({ ...f, method: v })}
              options={['CASH', 'BKASH', 'NAGAD', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']}
              placeholder="Method…"
            />
          </div>
          <div>
            <label className="label !text-xs">Payment class</label>
            <SearchableSelect
              value={f.payment_class}
              onChange={(v) => setF({ ...f, payment_class: v })}
              options={[
                { value: 'ADVANCE', label: 'Advance' },
                { value: 'SETTLEMENT', label: 'Settlement' },
                { value: 'PARTIAL', label: 'Partial' },
              ]}
              placeholder="Class…"
            />
          </div>
          <div>
            <label className="label !text-xs">Paid by</label>
            <input className="input" value={f.paid_by_party} onChange={(e) => setF({ ...f, paid_by_party: e.target.value })} placeholder="Guest/Agency" />
          </div>
          <div className="lg:col-span-2">
            <label className="label !text-xs">Reference / TrxID</label>
            <input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="Optional" />
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button className="btn-primary" onClick={addPayment} disabled={busy}>
              <Receipt size={15} /> {busy ? 'Saving…' : 'Save payment'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Payment History Table ────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-leaf font-display font-semibold text-pine flex items-center justify-between">
          <span>Reservation Payment History</span>
          <span className="text-xs text-forest">Advance Paid Total: <span className="money font-semibold">{fmtBDT(advanceTotal)}</span></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              <th className="th">Date</th>
              <th className="th">Payment ID</th>
              <th className="th">Reservation</th>
              <th className="th">Paid by</th>
              <th className="th">Class</th>
              <th className="th">Method</th>
              <th className="th">Reference</th>
              <th className="th text-right">Amount</th>
              <th className="th">Actions</th>
            </tr></thead>
            <tbody>
              {payments.map((pm) => {
                const parsedRef = parsePaymentReference(pm.reference)
                return (
                  <tr key={pm.id}>
                    <td className="td text-xs">{fmtDate(pm.received_date)}</td>
                    <td className="td text-xs font-mono text-pine/80">{parsedRef.paymentNo || '—'}</td>
                    <td className="td text-xs">
                      <div className="font-semibold">{pm.reservations?.res_no || '—'}</div>
                      <div className="text-pine/50">{pm.reservations?.reservation_name || pm.reservations?.guests?.full_name || '—'}</div>
                    </td>
                    <td className="td text-xs">{pm.paid_by_party || pm.received_by || '—'}</td>
                    <td className="td text-xs">
                      <span className={`status-chip text-xs ${
                        pm.payment_class === 'ADVANCE'    ? 'bg-amber/20 text-amber' :
                        pm.payment_class === 'SETTLEMENT' ? 'bg-forest/15 text-forest' :
                        'bg-sky-50 text-sky-700'
                      }`}>{pm.payment_class || 'SETTLEMENT'}</span>
                    </td>
                    <td className="td text-xs">{pm.method}</td>
                    <td className="td text-xs">{parsedRef.reference || '—'}</td>
                    <td className="td money text-right font-semibold">{fmtBDT(pm.amount)}</td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        <button className="btn-ghost !py-1 !px-2 text-xs" title="Edit" onClick={() => startEdit(pm)}>
                          <Pencil size={12} />
                        </button>
                        {isAdmin && (
                          <button className="btn-ghost !py-1 !px-2 text-xs text-red-600" title="Delete" onClick={() => delPayment(pm)}>
                            <Trash2 size={12} />
                          </button>
                        )}
                        <button className="btn-ghost !py-1 !px-2 text-xs" title="Print receipt" onClick={() => printPayment(pm)}>
                          <Printer size={12} />
                        </button>
                        <button className="btn-ghost !py-1 !px-2 text-xs text-green-700" title="Send via WhatsApp" onClick={() => openSend('WHATSAPP', pm)}>
                          <MessageCircle size={12} />
                        </button>
                        <button className="btn-ghost !py-1 !px-2 text-xs text-blue-600" title="Send via Email" onClick={() => openSend('EMAIL', pm)}>
                          <Mail size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {payments.length === 0 && <tr><td className="td text-pine/50" colSpan={9}>No payments found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Edit Modal ───────────────────────────────────────────── */}
      {editRow && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-pine">Edit Payment</h3>
              <button className="btn-ghost !p-1" onClick={() => setEditRow(null)}><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label !text-xs">Amount (৳) *</label>
                <input type="number" className="input money" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
              </div>
              <div>
                <label className="label !text-xs">Date</label>
                <input type="date" className="input" value={editForm.received_date} onChange={(e) => setEditForm({ ...editForm, received_date: e.target.value })} />
              </div>
              <div>
                <label className="label !text-xs">Method</label>
                <SearchableSelect value={editForm.method} onChange={(v) => setEditForm({ ...editForm, method: v })} options={['CASH', 'BKASH', 'NAGAD', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']} placeholder="Method…" />
              </div>
              <div>
                <label className="label !text-xs">Payment class</label>
                <SearchableSelect
                  value={editForm.payment_class}
                  onChange={(v) => setEditForm({ ...editForm, payment_class: v })}
                  options={[
                    { value: 'ADVANCE', label: 'Advance' },
                    { value: 'SETTLEMENT', label: 'Settlement' },
                    { value: 'PARTIAL', label: 'Partial' },
                  ]}
                  placeholder="Class…"
                />
              </div>
              <div>
                <label className="label !text-xs">Paid by</label>
                <input className="input" value={editForm.paid_by_party} onChange={(e) => setEditForm({ ...editForm, paid_by_party: e.target.value })} placeholder="Guest/Agency" />
              </div>
              <div>
                <label className="label !text-xs">Reference</label>
                <input className="input" value={editForm.reference} onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setEditRow(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveEdit}>Save changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Send Modal ───────────────────────────────────────────── */}
      {sendBox.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-pine flex items-center gap-2">
                {sendBox.channel === 'WHATSAPP' ? <MessageCircle size={16} className="text-green-600" /> : <Mail size={16} className="text-blue-600" />}
                Send via {sendBox.channel === 'WHATSAPP' ? 'WhatsApp' : 'Email'}
              </h3>
              <button className="btn-ghost !p-1" onClick={() => setSendBox({ ...sendBox, open: false })}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label !text-xs">{sendBox.channel === 'WHATSAPP' ? 'Phone number' : 'Email address'} *</label>
                <input className="input" value={sendBox.to} onChange={(e) => setSendBox({ ...sendBox, to: e.target.value })}
                  placeholder={sendBox.channel === 'WHATSAPP' ? '01XXXXXXXXX' : 'guest@email.com'} />
              </div>
              {sendBox.channel === 'EMAIL' && (
                <div>
                  <label className="label !text-xs">Subject</label>
                  <input className="input" value={sendBox.subject} onChange={(e) => setSendBox({ ...sendBox, subject: e.target.value })} />
                </div>
              )}
              <div>
                <label className="label !text-xs">Message</label>
                <textarea className="input h-32 resize-none" value={sendBox.body} onChange={(e) => setSendBox({ ...sendBox, body: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setSendBox({ ...sendBox, open: false })}>Cancel</button>
              <button className="btn-primary" onClick={sendNow} disabled={sendBusy}>
                {sendBox.channel === 'WHATSAPP' ? <MessageCircle size={14} /> : <Mail size={14} />}
                {sendBusy ? 'Sending…' : sendBox.channel === 'WHATSAPP' ? 'Open WhatsApp' : 'Open Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
