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

  // স্টাইল আপডেট: বর্ডার রিমুভ ও ইন্টার ফন্ট
  const font = { fontFamily: 'Inter, sans-serif' };
  const cell = { borderBottom: '0.5px solid #ddd', padding: '10px 6px', fontSize: 11, ...font };
  const num = { ...cell, textAlign: 'right' };
  const hcell = { borderBottom: '1px solid #000', padding: '10px 6px', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, ...font };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', ...font }}>
      {isVoid && <div style={{ position: 'absolute', top: '40%', left: 0, right: 0, textAlign: 'center', transform: 'rotate(-24deg)', fontSize: 96, fontWeight: 800, color: 'rgba(220,0,0,0.16)', letterSpacing: 8, pointerEvents: 'none' }}>VOID</div>}
      
      {/* নতুন হেডার লেআউট */}
      <table style={{ width: '100%', marginBottom: 30 }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{company?.name || 'Novem Eco Resort'}</div>
              <div style={{ fontSize: 11, color: '#555' }}>{company?.address}</div>
            </td>
            <td style={{ textAlign: 'right', verticalAlign: 'top', fontSize: 11 }}>
              <div>{company?.phone}</div>
              <div>{company?.email}</div>
              {company?.bin && <div>BIN: {company.bin}</div>}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Guest Bill Title Centered */}
      <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, marginBottom: 20, textTransform: 'uppercase' }}>Guest Bill</div>

      {/* Guest Details */}
      <table style={{ width: '100%', marginBottom: 20, fontSize: 11 }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top' }}>
              <b>Guest:</b> {bName}<br />
              <span style={{ color: '#555' }}>{bAddress}</span>
            </td>
            <td style={{ textAlign: 'right', verticalAlign: 'top' }}>
              <b>Invoice:</b> {invNo}<br />
              <b>Date:</b> {fmtDate(issuedDate)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Lines Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr>
            <th style={hcell}>Date</th><th style={hcell}>Description</th>
            <th style={{ ...hcell, textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={cell}>{fmtDate(l.charge_date)}</td>
              <td style={cell}>{l.description}</td>
              <td style={num}>{Number(l.total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals Table */}
      <table style={{ width: '100%', maxWidth: '300px', marginLeft: 'auto', fontSize: 11 }}>
        <tbody>
          <TR k="Subtotal" v={fmtBDT(t.base)} />
          <TR k="VAT" v={fmtBDT(t.vat)} />
          <tr>
            <td style={{ padding: '8px 6px', fontWeight: 700, borderTop: '1px solid #000' }}>GRAND TOTAL</td>
            <td style={{ padding: '8px 6px', fontWeight: 700, textAlign: 'right', borderTop: '1px solid #000' }}>{fmtBDT(t.grand_total)}</td>
          </tr>
          <TR k="Paid" v={fmtBDT(tPaid)} />
          <tr>
            <td style={{ padding: '4px 6px', fontWeight: 700 }}>{tDue > 0 ? 'BALANCE DUE' : 'FULLY SETTLED'}</td>
            <td style={{ padding: '4px 6px', fontWeight: 700, textAlign: 'right' }}>{fmtBDT(tDue)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: 10, marginTop: 20 }}><b>In words:</b> {takaInWords(t.grand_total || 0)}</div>

      <table style={{ width: '100%', marginTop: 60, fontSize: 11 }}>
        <tbody>
          <tr>
            <td style={{ width: '40%', borderTop: '1px solid #000', paddingTop: 8 }}>Guest Signature</td>
            <td style={{ width: '20%' }}></td>
            <td style={{ width: '40%', borderTop: '1px solid #000', paddingTop: 8, textAlign: 'right' }}>Authorized Signature</td>
          </tr>
        </tbody>
      </table>
      <div style={{ textAlign: 'center', fontSize: 10, marginTop: 30, color: '#666', fontStyle: 'italic' }}>{company?.invoice_footer}</div>
    </div>
  )
}

const TR = ({ k, v }) => (
  <tr>
    <td style={{ padding: '4px 6px' }}>{k}</td>
    <td style={{ padding: '4px 6px', textAlign: 'right' }}>{v}</td>
  </tr>
)
