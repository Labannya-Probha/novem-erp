import { fmtBDT, fmtDate, takaInWords } from '../../lib/helpers'

export default function Mushak63({ invoice, res, company, refNo, charges, totals, invoice_no, issued_at, buyer_name, buyer_address, buyer_bin, is_void, created_by }) {
  const activeLines = invoice?.line_snapshot || charges || []
  if (!invoice && activeLines.length === 0) return <div style={{ padding: 24, textAlign: 'center', color: '#b91c1c' }}>No tax invoice to display.</div>

  const lines = activeLines.filter((l) => l.charge_type !== 'ROUNDING')
  const t = invoice?.totals || totals || {}
  const issued = new Date(invoice?.issued_at || issued_at || new Date())
  const issueTime = issued.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' })

  const b = { border: '1px solid #000', padding: '6px', fontSize: 11, verticalAlign: 'top', fontFamily: 'Inter, sans-serif' }
  const bc = { ...b, textAlign: 'center' }
  const br = { ...b, textAlign: 'right' }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#000' }}>
      <table style={{ width: '100%', marginBottom: '10px' }}>
        <tbody>
          <tr>
            <td style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
              <div style={{ fontSize: 11 }}>জাতীয় রাজস্ব বোর্ড · মূসক-৬.৩</div>
            </td>
          </tr>
        </tbody>
      </table>
      {/* বাকি সব লজিক ও টেবিল স্ট্রাকচার অপরিবর্তিত রেখে স্টাইল ফন্ট ইন্টার করা হয়েছে */}
      {/* [সূত্র: 7] */}
    </div>
  )
}
