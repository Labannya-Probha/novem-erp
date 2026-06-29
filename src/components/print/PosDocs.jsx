import { fmtBDT, fmtDate } from '../../lib/helpers'

const timeOf = (ts) =>
  new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' })

/* ---------- Restaurant Bill (guest copy) ---------- */
export function PosReceipt({ order, items, company, mushakNo, copyLabel, singleCopy = false }) {
  const row = { padding: '2px 0', fontSize: 11, fontFamily: 'monospace' }
  const num = { textAlign: 'right', fontFamily: 'monospace' }
  const issuedAt = order.settled_at || order.created_at || new Date().toISOString()
  const invoiceNo = mushakNo || order.invoice_no || order.order_no

  if (!singleCopy) {
    return (
      <div className="pos-receipt-copy-stack">
        {['Guest Copy', 'Resort Copy'].map((label) => (
          <PosReceipt
            key={label}
            order={order}
            items={items}
            company={company}
            mushakNo={mushakNo}
            copyLabel={label}
            singleCopy
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`print-copy ${copyLabel === 'Resort Copy' ? 'print-copy-break' : ''}`} style={{ maxWidth: 320, width: '100%', margin: '0 auto', color: '#000', fontFamily: 'monospace' }}>
      <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, border: '1px solid #000', padding: '2px 0', marginBottom: 5, fontFamily: 'monospace' }}>{copyLabel}</div>
      <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: 6 }}>
        <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'monospace', color: '#000' }}>{company?.name || 'Aura Stay'}</div>
        <div style={{ fontSize: 9 }}>{company?.address}</div>
        <div style={{ fontSize: 9 }}>{company?.phone}{company?.bin ? ` · BIN: ${company.bin}` : ''}</div>
        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, letterSpacing: 1 }}>{(order.outlet || 'Restaurant').toUpperCase()} BILL</div>
      </div>

      <table style={{ width: '100%', fontSize: 10, margin: '6px 0', fontFamily: 'monospace' }}>
        <tbody>
          <tr>
            <td><b>{order.order_no}</b></td>
            <td style={{ textAlign: 'right' }}>{fmtDate(order.created_at)} · {timeOf(issuedAt)}</td>
          </tr>
          <tr>
            <td>{order.order_type.replace('_', ' ')}{order.table_no ? ` · Table ${order.table_no}` : ''}</td>
            <td style={{ textAlign: 'right' }}>{order.created_by ? `Served by ${order.created_by}` : ''}</td>
          </tr>
          {(order.guest_name || order.room_no) && (
            <tr><td colSpan={2}><b>Guest:</b> {order.guest_name || '—'}{order.room_no ? ` · Room ${order.room_no}` : ''}</td></tr>
          )}
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: 6, fontSize: 9.5, lineHeight: 1.45, fontFamily: 'monospace' }}>
        <div>চালানপত্র নম্বর: <b>{invoiceNo}</b></div>
        <div>ইস্যুর তারিখ: <b>{fmtDate(issuedAt)}</b></div>
        <div>ইস্যুর সময়: <b>{timeOf(issuedAt)}</b></div>
      </div>

      <table style={{ width: '100%', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', borderCollapse: 'collapse', fontFamily: 'monospace' }}>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td style={row}>{it.item_name} <span style={{ fontFamily: 'monospace' }}>× {Number(it.qty)}</span></td>
              <td style={{ ...row, ...num }}>{Number(it.line_total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '100%', marginTop: 6, fontSize: 11, fontFamily: 'monospace' }}>
        <tbody>
          <tr><td style={row}>Subtotal</td><td style={{ ...row, ...num }}>{Number(order.base_amount).toFixed(2)}</td></tr>
          {Number(order.discount) > 0 && <tr><td style={row}>Discount {order.discount_pct > 0 ? `(${order.discount_pct}%)` : ''}</td><td style={{ ...row, ...num }}>− {Number(order.discount).toFixed(2)}</td></tr>}
          <tr><td style={row}>Service charge</td><td style={{ ...row, ...num }}>{Number(order.service_charge).toFixed(2)}</td></tr>
          {Number(order.sd) > 0 && <tr><td style={row}>SD</td><td style={{ ...row, ...num }}>{Number(order.sd).toFixed(2)}</td></tr>}
          <tr><td style={row}>VAT</td><td style={{ ...row, ...num }}>{Number(order.vat).toFixed(2)}</td></tr>
          <tr>
            <td style={{ ...row, fontWeight: 700, borderTop: '1px solid #000', fontSize: 13 }}>TOTAL</td>
            <td style={{ ...row, ...num, fontWeight: 700, borderTop: '1px solid #000', fontSize: 13 }}>{fmtBDT(order.total)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: 'center', fontSize: 10, marginTop: 8, fontWeight: 700, fontFamily: 'monospace' }}>
        {order.status === 'SETTLED' && `PAID — ${order.payment_method}`}
        {order.status === 'CHARGED_TO_ROOM' && `CHARGED TO ROOM ${order.room_no || ''} — settles at check-out`}
        {order.status === 'OPEN' && 'OPEN — payment pending'}
      </div>
      {mushakNo && <div style={{ textAlign: 'center', fontSize: 9, marginTop: 2, fontFamily: 'monospace' }}>Mushak-6.3 issued: {mushakNo}</div>}
      {order.status === 'CHARGED_TO_ROOM' && <div style={{ textAlign: 'center', fontSize: 8.5, marginTop: 2, fontFamily: 'monospace' }}>Tax invoice (Mushak-6.3) will be issued with the final guest bill at check-out.</div>}
      <div style={{ textAlign: 'center', fontSize: 9, marginTop: 8, fontStyle: 'italic', fontFamily: 'monospace' }}>{`Thanks for ordering from ${company?.name || 'us'}! We truly appreciate you for choosing us.`}
      </div>
    </div>
  )
}

/* ---------- Kitchen Order Ticket ---------- */
export function KitchenTicket({ order, items }) {
  return (
    <div style={{ maxWidth: 320, width: '100%', margin: '0 auto', color: '#000', fontFamily: 'monospace' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, fontFamily: 'monospace' }}>KITCHEN ORDER</div>
        <div style={{ fontSize: 11, fontFamily: 'monospace' }}>{order.order_no} · {timeOf(order.created_at)}</div>
        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
          {order.order_type.replace('_', ' ')}{order.table_no ? ` · TABLE ${order.table_no}` : ''}{order.room_no ? ` · ROOM ${order.room_no}` : ''}
        </div>
      </div>
      <table style={{ width: '100%', marginTop: 6, fontFamily: 'monospace' }}>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td style={{ fontSize: 15, fontWeight: 700, padding: '3px 0', width: 40, fontFamily: 'monospace' }}>{Number(it.qty)} ×</td>
              <td style={{ fontSize: 14, padding: '3px 0', fontFamily: 'monospace' }}>{it.item_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {order.notes && <div style={{ marginTop: 6, fontSize: 12, borderTop: '1px dashed #000', paddingTop: 4, fontFamily: 'monospace' }}><b>NOTE:</b> {order.notes}</div>}
    </div>
  )
}
