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
  
 const bName = invoice?.buyer_name || buyer_name || guest?.full_name || '—'
 const bAddress = invoice?.buyer_address || buyer_address || guest?.address || '—'
  
 const tPaid = paid ?? t.paid ?? 0
 const tDue = due ?? t.due ?? 0

 // Lines are spacious and less congested now with increased padding and line-height
 const cell = { borderBottom: '1px solid #eaeaea', padding: '8px 10px', fontSize: 11, fontFamily: 'Inter, sans-serif', lineHeight: '1.4' };
 const num = { ...cell, textAlign: 'right', fontFamily: 'Inter, sans-serif' };
 const hcell = { borderBottom: '2px solid #2E7D32', padding: '10px 10px', fontSize: 10, textTransform: 'uppercase', fontWeight: '600', fontFamily: 'Inter, sans-serif' };

 return (
  <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', padding: '10px' }}>
   {isVoid && <div style={{ position: 'absolute', top: '40%', left: 0, right: 0, textAlign: 'center', transform: 'rotate(-24deg)', fontSize: 96, fontWeight: 800, color: 'rgba(220,0,0,0.16)', letterSpacing: 8, pointerEvents: 'none' }}>VOID</div>}
   
   {/* Header: Company Details aligned to Right */}
   <table style={{ width: '100%' }}>
    <tbody>
     <tr>
      <td style={{ width: '30%', verticalAlign: 'top' }}>
       {/* Left side keeps empty or space for layout balance */}
      </td>
      <td style={{ width: '70%', textAlign: 'right', verticalAlign: 'top' }}>
       <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
        <div style={{ textAlign: 'right' }}>
         <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Fraunces, serif', color: '#2E7D32' }}>{company?.name || 'Novem Eco Resort'}</div>
         <div style={{ fontSize: 10, color: '#555' }}>{company?.legal_name}</div>
        </div>
        {company?.logo_url && <img src={company.logo_url} alt="" style={{ height: 46, width: 46, objectFit: 'contain' }} />}
       </div>
       <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>{company?.address}</div>
       <div style={{ fontSize: 10, color: '#555' }}>{company?.phone} · {company?.email}</div>
       {company?.bin && <div style={{ fontSize: 10, color: '#555' }}>BIN: {company.bin}</div>}
      </td>
     </tr>
    </tbody>
   </table>

   {/* Gap after Header */}
   <div style={{ height: 24 }} />

   {/* Invoice No (Left Aligned) & Date (Right Aligned) */}
   <table style={{ width: '100%', borderBottom: '1.5px solid #2E7D32', paddingBottom: 6, fontSize: 11, fontFamily: '"IBM Plex Mono", monospace' }}>
    <tbody>
     <tr>
      <td style={{ textAlign: 'left', verticalAlign: 'bottom' }}>
       <b>Invoice No:</b> {}
      </td>
      <td style={{ textAlign: 'right', verticalAlign: 'bottom' }}>
       <b>Date:</b> {fmtDate(issuedDate)}
      </td>
     </tr>
    </tbody>
   </table>

   {/* Guest Bill centered word above Guest Details */}
   <div style={{ textAlign: 'center', marginTop: 24, marginBottom: 8 }}>
    <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, color: '#2E7D32', borderBottom: '2px solid #2E7D32', paddingBottom: 4, textTransform: 'uppercase' }}>
     GUEST BILL
    </span>
   </div>

   {/* Guest Details: Box border replaced with clean minimalist top-bottom border lines */}
   <table style={{ width: '100%', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', padding: '12px 0', fontSize: 11, marginTop: 12 }}>
    <tbody>
     <tr>
      <td style={{ padding: '4px 0', verticalAlign: 'top', lineHeight: '1.5' }}>
       <b>Guest:</b> {}<br />
       <b>Address:</b> {}
      </td>
      <td style={{ padding: '4px 0', textAlign: 'right', verticalAlign: 'top', lineHeight: '1.5' }}>
       <b>Reservation:</b> {res?.res_no}<br />
       <b>Stay:</b> {fmtDate(res?.check_in)} → {fmtDate(res?.check_out)} ({nightsBetween(res?.check_in, res?.check_out)} nights)
      </td>
     </tr>
    </tbody>
   </table>

   {/* Main Charges Table */}
   <table style={{ width: '100%', marginTop: 20, borderCollapse: 'collapse' }}>
    <thead>
     <tr>
      <th style={{}}>Date</th>
      <th style={{}}>Description</th>
      <th style={{ ...hcell, textAlign: 'right' }}>Base</th>
      <th style={{ ...hcell, textAlign: 'right' }}>Discount</th>
      <th style={{ ...hcell, textAlign: 'right' }}>Service Chg.</th>
      <th style={{ ...hcell, textAlign: 'right' }}>SD</th>
      <th style={{ ...hcell, textAlign: 'right' }}>VAT</th>
      <th style={{ ...hcell, textAlign: 'right' }}>Total</th>
      <th style={}>Status</th>
     </tr>
    </thead>
    <tbody>
     {lines.map((l, i) => (
      <tr key={}>
       <td style={{ ...cell, whiteSpace: 'nowrap' }}>{fmtDate(l.charge_date)}</td>
       <td style={}>{l.description}</td>
       <td style={}>{Number(l.base_amount).toFixed(2)}</td>
       <td style={}>{Number(l.discount).toFixed(2)}</td>
       <td style={}>{Number(l.service_charge).toFixed(2)}</td>
       <td style={}>{Number(l.sd).toFixed(2)}</td>
       <td style={}>{Number(l.vat).toFixed(2)}</td>
       <td style={{ ...num, fontWeight: 600 }}>{Number(l.total).toFixed(2)}</td>
       <td style={{ ...cell, fontSize: 9, fontWeight: 700, color: l.status === 'PAID' ? '#2E7D32' : '#b91c1c' }}>{l.status}</td>
      </tr>
     ))}
    </tbody>
   </table>

   {/* Summary Table */}
   <table style={{ width: '48%', marginLeft: 'auto', marginTop: 16, fontSize: 11, borderCollapse: 'collapse' }}>
    <tbody>
     <TR k="Room / service charges (base)" v={fmtBDT(t.base)} />
     <TR k="Discount" v={'− ' + fmtBDT(t.discount)} />
     <TR k="Service charge" v={fmtBDT(t.service_charge)} />
     <TR k="Supplementary duty (SD)" v={fmtBDT(t.sd)} />
     <TR k="VAT" v={fmtBDT(t.vat)} />
     {!!t.rounding && <TR k="Subtotal" v={fmtBDT(t.grand_total_raw ?? t.grand_total)} />}
     {!!t.rounding && <TR k="Rounding adjustment" v={(t.rounding > 0 ? '+ ' : '− ') + fmtBDT(Math.abs(t.rounding))} />}
     <tr>
      <td style={{ padding: '8px 6px', borderTop: '2px solid #2E7D32', fontWeight: 700 }}>GRAND TOTAL</td>
      <td style={{ padding: '8px 6px', borderTop: '2px solid #2E7D32', fontWeight: 700, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }}>{fmtBDT(t.grand_total)}</td>
     </tr>
     <TR k="Paid" v={fmtBDT(tPaid)} />
     <tr>
      <td style={{ padding: '6px 6px', fontWeight: 700, color: tDue > 0 ? '#b91c1c' : '#2E7D32' }}>{tDue > 0 ? 'BALANCE DUE' : 'FULLY SETTLED'}</td>
      <td style={{ padding: '6px 6px', fontWeight: 700, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace', color: tDue > 0 ? '#b91c1c' : '#2E7D32' }}>{fmtBDT(tDue)}</td>
     </tr>
    </tbody>
   </table>

   <div style={{ fontSize: 10, marginTop: 12 }}><b>In words:</b> {takaInWords(t.grand_total || 0)}</div>

   {/* Signatures */}
   <table style={{ width: '100%', marginTop: 60, fontSize: 11 }}>
    <tbody>
     <tr>
      <td style={{ width: '40%', borderTop: '1px solid #000', paddingTop: 8 }}>Guest Signature</td>
      <td style={{ width: '20%' }}></td>
      <td style={{ width: '40%', borderTop: '1px solid #000', paddingTop: 8, textAlign: 'right' }}>Authorized Signature — {company?.name}</td>
     </tr>
    </tbody>
   </table>

   <div style={{ textAlign: 'center', fontSize: 10, marginTop: 24, color: '#2E7D32', fontStyle: 'italic' }}>{company?.invoice_footer}</div>
  </div>
 )
}

// Fixed TR component to properly render the passed key (k) and value (v)
const TR = ({ k, v }) => (
 <tr>
  <td style={{ padding: '5px 6px', fontSize: 11, color: '#444' }}>{}</td>
  <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: '#000' }}>{}</td>
 </tr>
)
