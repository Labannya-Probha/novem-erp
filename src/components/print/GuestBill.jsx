import { fmtBDT, fmtDate, takaInWords, nightsBetween } from '../../lib/helpers'

export default function GuestBill({ 
  invoice, res, guest, company,
  charges, totals, paid, due, invoice_no, issued_at, is_void, buyer_name, buyer_address 
}) {
  const activeLines = invoice?.line_snapshot || charges || []
  
  if (!invoice && activeLines.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#b91c1c' }}>No guest bill to display. Check the guest out from the Folio &amp; Payments tab first, then print the bill.</div>
  }

  const lines = activeLines.filter((l) => l.charge_type !== 'ROUNDING')
  const t = invoice?.totals || totals || {}
  
  const isVoid = invoice?.is_void || is_void
  const invNo = invoice?.invoice_no || invoice_no || '—'
  const issuedDate = invoice?.issued_at || issued_at || new Date()
  
  const bName = invoice?.buyer_name || buyer_name || guest?.full_name
  const bAddress = invoice?.buyer_address || buyer_address || guest?.address || '—'
  
  const tPaid = paid ?? t.paid ?? 0
  const tDue = due ?? t.due ?? 0

  const cell = { borderBottom: '1px solid #ccc', padding: '5px 6px', fontSize: 11 }
  const num = { ...cell, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }
  const hcell = { borderBottom: '2px solid #2E7D32', padding: '6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}>
      {isVoid && <div style={{ position: 'absolute', top: '40%', left: 0, right: 0, textAlign: 'center', transform: 'rotate(-24deg)', fontSize: 96, fontWeight: 800, color: 'rgba(220,0,0,0.16)', letterSpacing: 8, pointerEvents: 'none' }}>VOID</div>}
      <table style={{ width: '100%' }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {company?.logo_url && <img src={company.logo_url} alt="" style={{ height: 46, width: 46, objectFit: 'contain' }} />}
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Fraunces, serif', color: '#2E7D32' }}>{company?.name || 'Novem Eco Resort'}</div>
                  <div style={{ fontSize: 10, color: '#333' }}>{company?.legal_name}</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#333', marginTop: 2 }}>{company?.address}</div>
              <div style={{ fontSize: 10, color: '#333' }}>{company?.phone} · {company?.email}</div>
              {company?.bin && <div style={{ fontSize: 10, color: '#333' }}>BIN: {company.bin}</div>}
            </td>
            <td style={{ textAlign: 'right', verticalAlign: 'top' }}>
              <div style={{ display: 'inline-block', background: '#2E7D32', color: '#fff', padding: '6px 14px', borderRadius: 6, fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>GUEST BILL</div>
              <div style={{ fontSize: 11, marginTop: 8, fontFamily: '"IBM Plex Mono", monospace' }}>
                <div><b>Invoice No:</b> {invNo}</div>
                <div><b>Date:</b> {fmtDate(issuedDate)}</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', marginTop: 12, border: '1px solid #2E7D32', borderRadius: 4, fontSize: 11 }}>
        <tbody>
          <tr>
            <td style={{ padding: '6px 10px' }}>
              <b>Guest:</b> {bName}<br />
              <b>Address:</b> {bAddress}
            </td>
            <td style={{ padding: '6px 10px', textAlign: 'right' }}>
              <b>Reservation:</b> {res?.res_no}<br />
              <b>Stay:</b> {fmtDate(res?.check_in)} → {fmtDate(res?.check_out)} ({nightsBetween(res?.check_in, res?.check_out)} nights)
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={hcell}>Date</th><th style={hcell}>Description</th>
            <th style={{ ...hcell, textAlign: 'right' }}>Base</th>
            <th style={{ ...hcell, textAlign: 'right' }}>Discount</th>
            <th style={{ ...hcell, textAlign: 'right' }}>Service Chg.</th>
            <th style={{ ...hcell, textAlign: 'right' }}>SD</th>
            <th style={{ ...hcell, textAlign: 'right' }}>VAT</th>
            <th style={{ ...hcell, textAlign: 'right' }}>Total</th>
            <th style={hcell}>Status</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={{ ...cell, whiteSpace: 'nowrap' }}>{fmtDate(l.charge_date)}</td>
              <td style={cell}>{l.description}</td>
              <td style={num}>{Number(l.base_amount).toFixed(2)}</td>
              <td style={num}>{Number(l.discount).toFixed(2)}</td>
              <td style={num}>{Number(l.service_charge).toFixed(2)}</td>
              <td style={num}>{Number(l.sd).toFixed(2)}</td>
              <td style={num}>{Number(l.vat).toFixed(2)}</td>
              <td style={{ ...num, fontWeight: 600 }}>{Number(l.total).toFixed(2)}</td>
              <td style={{ ...cell, fontSize: 9, fontWeight: 700, color: l.status === 'PAID' ? '#2E7D32' : '#b91c1c' }}>{l.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '46%', marginLeft: 'auto', marginTop: 10, fontSize: 11 }}>
        <tbody>
          <TR k="Room / service charges (base)" v={fmtBDT(t.base)} />
          <TR k="Discount" v={'− ' + fmtBDT(t.discount)} />
          <TR k="Service charge" v={fmtBDT(t.service_charge)} />
          <TR k="Supplementary duty (SD)" v={fmtBDT(t.sd)} />
          <TR k="VAT" v={fmtBDT(t.vat)} />
          {!!t.rounding && <TR k="Subtotal" v={fmtBDT(t.grand_total_raw ?? t.grand_total)} />}
          {!!t.rounding && <TR k="Rounding adjustment" v={(t.rounding > 0 ? '+ ' : '− ') + fmtBDT(Math.abs(t.rounding))} />}
          <tr>
            <td style={{ padding: '6px', borderTop: '2px solid #2E7D32', fontWeight: 700 }}>GRAND TOTAL</td>
            <td style={{ padding: '6px', borderTop: '2px solid #2E7D32', fontWeight: 700, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }}>{fmtBDT(t.grand_total)}</td>
          </tr>
          <TR k="Paid" v={fmtBDT(tPaid)} />
          <tr>
            <td style={{ padding: '4px 6px', fontWeight: 700, color: tDue > 0 ? '#b91c1c' : '#2E7D32' }}>{tDue > 0 ? 'BALANCE DUE' : 'FULLY SETTLED'}</td>
            <td style={{ padding: '4px 6px', fontWeight: 700, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace', color: tDue > 0 ? '#b91c1c' : '#2E7D32' }}>{fmtBDT(tDue)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: 10, marginTop: 8 }}><b>In words:</b> {takaInWords(t.grand_total || 0)}</div>

      <table style={{ width: '100%', marginTop: 56, fontSize: 11 }}>
        <tbody>
          <tr>
            <td style={{ width: '40%', borderTop: '1px solid #000', paddingTop: 5 }}>Guest Signature</td>
            <td style={{ width: '20%' }}></td>
            <td style={{ width: '40%', borderTop: '1px solid #000', paddingTop: 5, textAlign: 'right' }}>Authorized Signature — {company?.name}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ textAlign: 'center', fontSize: 10, marginTop: 18, color: '#2E7D32', fontStyle: 'italic' }}>{company?.invoice_footer}</div>
    </div>
  )
}

const TR = ({ k, v }) => (
  <tr>
    <td style={{ padding: '3px 6px' }}>{k}</td>
    <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }}>{v}</td>
  </tr>
)
