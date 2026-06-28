import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT, fmtDate } from '../lib/helpers'
import { withTenantInsert } from '../lib/tenant'
import { logAudit } from '../lib/pms.api.js'
import {
  Pencil, Trash2, Printer, MessageCircle, Mail, X, Save, Search,
} from 'lucide-react'

const PAYMENT_METHODS = ['CASH', 'BKASH', 'NAGAD', 'CARD', 'BANK', 'OTHER']
const PAYMENT_CLASSES = ['ADVANCE', 'SETTLEMENT', 'REFUND', 'PARTIAL']

export default function ReservationPayments({ userName, isAdmin }) {
  const [payments, setPayments]     = useState([])
  const [loading, setLoading]       = useState(false)
  const [search, setSearch]         = useState('')
  const [editRow, setEditRow]       = useState(null)
  const [editForm, setEditForm]     = useState({})
  const [busy, setBusy]             = useState(false)
  const [flash, setFlashMsg]        = useState('')
  const [sendRow, setSendRow]       = useState(null)
  const [sendPhone, setSendPhone]   = useState('')
  const [sendEmail, setSendEmail]   = useState('')

  const showFlash = (m) => { setFlashMsg(m); setTimeout(() => setFlashMsg(''), 4000) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id, created_at, amount, method, payment_class, notes, invoice_no,
        received_by, reservation_id,
        reservations:reservation_id(res_no, reservation_name,
          guests:primary_guest_id(full_name, phone, email))
      `)
      .order('created_at', { ascending: false })
      .limit(500)
    if (!error) setPayments(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase()
    return (
      (p.reservations?.res_no || '').toLowerCase().includes(q) ||
      (p.reservations?.reservation_name || '').toLowerCase().includes(q) ||
      (p.reservations?.guests?.full_name || '').toLowerCase().includes(q) ||
      (p.invoice_no || '').toLowerCase().includes(q) ||
      (p.notes || '').toLowerCase().includes(q)
    )
  })

  /* ── EDIT ── */
  const openEdit = (row) => {
    setEditRow(row)
    setEditForm({
      amount:        row.amount,
      method:        row.method,
      payment_class: row.payment_class,
      notes:         row.notes || '',
      invoice_no:    row.invoice_no || '',
    })
  }
  const saveEdit = async () => {
    setBusy(true)
    try {
      const { error } = await supabase.from('payments')
        .update({
          amount:        +editForm.amount,
          method:        editForm.method,
          payment_class: editForm.payment_class,
          notes:         editForm.notes,
          invoice_no:    editForm.invoice_no,
        })
        .eq('id', editRow.id)
      if (error) throw error
      showFlash('Payment updated.')
      setEditRow(null)
      load()
    } catch (e) {
      showFlash(e.message)
    }
    setBusy(false)
  }

  /* ── DELETE ── */
  const deleteRow = async (row) => {
    if (!window.confirm(`Delete payment of ${fmtBDT(row.amount)} for ${row.reservations?.res_no}?`)) return
    if (!isAdmin) { showFlash('Admin access required.'); return }
    setBusy(true)
    const { error } = await supabase.from('payments').delete().eq('id', row.id)
    if (!error) {
      showFlash('Payment deleted.')
      await logAudit({ actor: userName, action: 'DELETE_PAYMENT', entity: 'payment', entity_id: row.id, details: { amount: row.amount, res_no: row.reservations?.res_no } })
      load()
    } else {
      showFlash(error.message)
    }
    setBusy(false)
  }

  /* ── PRINT ── */
  const printReceipt = (row) => {
    const guest = row.reservations?.guests?.full_name || row.reservations?.reservation_name || '—'
    const resNo = row.reservations?.res_no || '—'
    const win = window.open('', '_blank', 'width=480,height=600')
    win.document.write(`<!DOCTYPE html><html><head><title>Receipt</title>
      <style>
        body{font-family:sans-serif;padding:24px;font-size:14px;}
        h2{margin-bottom:4px;}
        table{width:100%;border-collapse:collapse;margin-top:12px;}
        td{padding:6px 0;}
        td:last-child{text-align:right;}
        hr{border:none;border-top:1px solid #ccc;}
        .total{font-size:1.2em;font-weight:bold;}
      </style>
    </head><body>
      <h2>Payment Receipt</h2>
      <p style="color:#555;">${resNo}</p>
      <hr/>
      <table>
        <tr><td>Guest</td><td>${guest}</td></tr>
        <tr><td>Date</td><td>${fmtDate(row.created_at)}</td></tr>
        <tr><td>Invoice No.</td><td>${row.invoice_no || '—'}</td></tr>
        <tr><td>Method</td><td>${row.method}</td></tr>
        <tr><td>Type</td><td>${row.payment_class}</td></tr>
        <tr><td>Notes</td><td>${row.notes || '—'}</td></tr>
        <tr><td colspan="2"><hr/></td></tr>
        <tr><td class="total">Amount</td><td class="total">${fmtBDT(row.amount)}</td></tr>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#888;">Received by: ${row.received_by || '—'}</p>
      <script>window.print();window.close();</script>
    </body></html>`)
    win.document.close()
  }

  /* ── SEND ── */
  const openSend = (row) => {
    setSendRow(row)
    setSendPhone(row.reservations?.guests?.phone || '')
    setSendEmail(row.reservations?.guests?.email || '')
  }
  const buildSendMsg = (row) =>
    `Dear ${row.reservations?.guests?.full_name || row.reservations?.reservation_name || 'Guest'},\n\nPayment Confirmation:\nReservation: ${row.reservations?.res_no}\nAmount: ${fmtBDT(row.amount)}\nMethod: ${row.method}\nType: ${row.payment_class}\nDate: ${fmtDate(row.created_at)}\n${row.invoice_no ? `Invoice: ${row.invoice_no}\n` : ''}${row.notes ? `Note: ${row.notes}\n` : ''}\nThank you.`
  const sendWhatsApp = () => {
    const phone = (sendPhone || '').replace(/[^0-9]/g, '')
    const intl = phone.startsWith('880') ? phone : phone.startsWith('0') ? '88' + phone : '880' + phone
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(buildSendMsg(sendRow))}`, '_blank')
    logAudit({ actor: userName, action: 'SEND_PAYMENT_WHATSAPP', entity: 'payment', entity_id: sendRow?.id, details: { to: sendPhone, res_no: sendRow?.reservations?.res_no } })
    setSendRow(null)
  }
  const sendEmailNow = () => {
    window.open(
      `mailto:${sendEmail}?subject=${encodeURIComponent(`Payment Confirmation — ${sendRow?.reservations?.res_no || ''}`)}&body=${encodeURIComponent(buildSendMsg(sendRow))}`,
      '_blank'
    )
    logAudit({ actor: userName, action: 'SEND_PAYMENT_EMAIL', entity: 'payment', entity_id: sendRow?.id, details: { to: sendEmail, res_no: sendRow?.reservations?.res_no } })
    setSendRow(null)
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display font-semibold text-xl text-pine">Reservation Payment History</h1>
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pine/40" />
          <input
            className="input pl-8"
            placeholder="Search by reservation, guest, invoice…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {flash && (
        <div className="px-4 py-2 rounded-lg bg-forest/10 text-forest text-sm">{flash}</div>
      )}

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[--border-color] text-left text-pine/60 uppercase text-xs tracking-wide">
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Reservation</th>
              <th className="px-3 py-3">Guest</th>
              <th className="px-3 py-3">Invoice</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Method</th>
              <th className="px-3 py-3 text-right">Amount</th>
              <th className="px-3 py-3">Notes</th>
              <th className="px-3 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="text-center py-10 text-pine/40">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-pine/40">No payments found.</td></tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id} className="border-b border-[--border-color] hover:bg-leaf/10 transition">
                <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(row.created_at)}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{row.reservations?.res_no || '—'}</td>
                <td className="px-3 py-2.5">{row.reservations?.guests?.full_name || row.reservations?.reservation_name || '—'}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{row.invoice_no || '—'}</td>
                <td className="px-3 py-2.5">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-forest/10 text-forest">{row.payment_class}</span>
                </td>
                <td className="px-3 py-2.5">{row.method}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{fmtBDT(row.amount)}</td>
                <td className="px-3 py-2.5 text-pine/60 max-w-[160px] truncate">{row.notes || '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => openEdit(row)} title="Edit" className="p-1.5 rounded hover:bg-forest/10 text-forest transition">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => printReceipt(row)} title="Print receipt" className="p-1.5 rounded hover:bg-sky-50 text-sky-600 transition">
                      <Printer size={14} />
                    </button>
                    <button onClick={() => openSend(row)} title="Send via WhatsApp / Email" className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 transition">
                      <MessageCircle size={14} />
                    </button>
                    {isAdmin && (
                      <button onClick={() => deleteRow(row)} title="Delete" disabled={busy} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-pine">Edit Payment</h2>
              <button onClick={() => setEditRow(null)} className="text-pine/40 hover:text-pine"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Amount (BDT)</label>
                <input className="input" type="number" min="0" step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
              </div>
              <div>
                <label className="label">Method</label>
                <select className="input" value={editForm.method}
                  onChange={(e) => setEditForm({ ...editForm, method: e.target.value })}>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={editForm.payment_class}
                  onChange={(e) => setEditForm({ ...editForm, payment_class: e.target.value })}>
                  {PAYMENT_CLASSES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Invoice No.</label>
                <input className="input" value={editForm.invoice_no}
                  onChange={(e) => setEditForm({ ...editForm, invoice_no: e.target.value })} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setEditRow(null)}>Cancel</button>
              <button className="btn-primary gap-2" onClick={saveEdit} disabled={busy}>
                <Save size={14} /> {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {sendRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-pine">Send Payment Confirmation</h2>
              <button onClick={() => setSendRow(null)} className="text-pine/40 hover:text-pine"><X size={18} /></button>
            </div>
            <p className="text-sm text-pine/70">
              {sendRow.reservations?.res_no} — {fmtBDT(sendRow.amount)} ({sendRow.method})
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">WhatsApp / Phone</label>
                <input className="input" value={sendPhone} onChange={(e) => setSendPhone(e.target.value)} placeholder="e.g. 01XXXXXXXXX" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} placeholder="guest@example.com" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button className="btn-outline" onClick={() => setSendRow(null)}>Cancel</button>
              <button className="btn-outline gap-2" onClick={sendWhatsApp} disabled={!sendPhone}>
                <MessageCircle size={14} /> WhatsApp
              </button>
              <button className="btn-primary gap-2" onClick={sendEmailNow} disabled={!sendEmail}>
                <Mail size={14} /> Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
