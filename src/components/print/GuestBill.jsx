import { fmtBDT, fmtDate, nightsBetween } from '../../lib/helpers'
import { normalizeInvoiceItems, normalizeInvoiceTotals, resolveBuyerInfo } from '../../lib/invoiceFormat'

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const two = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''))
const three = (n) => {
  const h = Math.floor(n / 100), r = n % 100
  return (h ? ONES[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? two(r) : '')
}
function inWords(num) {
  if (num === 0) return 'Zero'
  let w = ''
  const cr = Math.floor(num / 10000000); num %= 10000000
  const la = Math.floor(num / 100000); num %= 100000
  const th = Math.floor(num / 1000); num %= 1000
  if (cr) w += three(cr) + ' Crore '
  if (la) w += two(la) + ' Lakh '
  if (th) w += two(th) + ' Thousand '
  if (num) w += three(num)
  return w.trim()
}
function takaInWords(amount) {
  const v = Math.round(Number(amount || 0) * 100) / 100
  const taka = Math.floor(v)
  const poisha = Math.round((v - taka) * 100)
  let s = 'Taka ' + inWords(taka)
  if (poisha) s += ' and ' + inWords(poisha) + ' Poisha'
  return s + ' Only'
}

const FOREST = 'var(--print-accent, #2E7D32)'
const PINE = 'var(--print-primary, #1B4D2E)'
const GOLD = '#D4A017'
const INK = '#1f2937'
const MUTE = '#6b7280'
const LINE = 'var(--print-line, rgba(27,77,46,0.18))'

function stableHash(value) {
  let hash = 0
  String(value || '').split('').forEach((char) => { hash = ((hash << 5) - hash) + char.charCodeAt(0) })
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0').slice(0, 12)
}

function compactDate(value) {
  return value ? fmtDate(value).replace(/,/g, '') : '---'
}

function valueOf(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') || '---'
}

export default function GuestBill({
  charges = [], line_snapshot = [], totals = {}, paid = 0, due = 0,
  res, guest, company, guestCompany, invoice_no, issued_at,
  buyer_name, buyer_address, buyer_bin, copyLabel, singleCopy = false,
}) {
  const co = {
    name: company?.name || company?.company_name || '',
    address: company?.address || '',
    phone: company?.phone || '',
    email: company?.email || '',
    website: company?.website || '',
    bin: company?.bin || company?.bin_no || company?.vat_reg || company?.vat_bin || '',
    tin: company?.tin || company?.tin_no || company?.etin || '',
    logo: company?.logo_url || '',
    software: company?.software_name || 'Aura Stay ERP',
  }

  const { items: chargeItems, isLegacy } = normalizeInvoiceItems(charges, line_snapshot)
  const chargeTotals = normalizeInvoiceTotals(totals)
  const buyer = resolveBuyerInfo({ res, guest, guestCompany, buyer_name, buyer_address, buyer_bin })
  const invoiceNumber = invoice_no || `INV-${res?.res_no || 'DRAFT'}`
  const issued = new Date(issued_at || new Date())
  const issueDate = fmtDate(issued)
  const printTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' })
  const nights = res?.check_in && res?.check_out ? nightsBetween(res.check_in, res.check_out) : 0
  const pax = (Number(res?.pax_adults) || 0) + (Number(res?.pax_children) || 0)
  const grandTotal = chargeTotals.grand_total
  const balanceDue = Number(due ?? grandTotal - paid)
  const statusLabel = balanceDue <= 0 ? 'PAID' : Number(paid) > 0 ? 'PARTIALLY PAID' : 'UNPAID'
  const statusColor = balanceDue <= 0 ? FOREST : '#b91c1c'
  const folioNo = valueOf(res?.folio_no, res?.folio, res?.res_no, 'FOL-DRAFT')
  const roomNo = valueOf(res?.room_no, res?.room_numbers, res?.rooms, res?.room)
  const roomType = valueOf(res?.room_type, res?.roomType, res?.rate_plan)
  const cashier = valueOf(res?.cashier, res?.created_by, res?.created_by_name, 'System')
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const verifyUrl = `${origin}/verify/invoice/${encodeURIComponent(invoiceNumber)}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=92x92&margin=1&data=${encodeURIComponent(verifyUrl)}`

  const th = { textAlign: 'left', fontSize: 8.6, fontWeight: 900, textTransform: 'uppercase', color: '#fff', padding: '4px 5px', background: PINE }
  const td = { fontSize: 9.6, padding: '3.5px 5px', borderBottom: `1px solid ${LINE}`, color: INK, verticalAlign: 'top' }
  const sectionTitle = { fontSize: 9.4, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: FOREST, marginBottom: 4 }
  const sumRow = { display: 'flex', justifyContent: 'space-between', fontSize: 10.3, padding: '2px 0', color: INK, gap: 12 }
  const cell = (item, field) => item._legacy && ['discount', 'service_charge', 'vat'].includes(field) ? '-' : Number(item[field] || 0).toFixed(2)

  if (!singleCopy) {
    return (
      <div className="guest-bill-copy-stack">
        {['Guest Copy', 'Resort Copy', 'Finance Copy'].map((label) => (
          <GuestBill
            key={label}
            charges={charges}
            line_snapshot={line_snapshot}
            totals={totals}
            paid={paid}
            due={due}
            res={res}
            guest={guest}
            company={company}
            guestCompany={guestCompany}
            invoice_no={invoice_no}
            issued_at={issued_at}
            buyer_name={buyer_name}
            buyer_address={buyer_address}
            buyer_bin={buyer_bin}
            copyLabel={label}
            singleCopy
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`gb-wrap print-copy print-a4-doc ${copyLabel !== 'Guest Copy' ? 'print-copy-break' : ''}`} style={{
      fontFamily: "'Inter', sans-serif",
      color: INK,
      background: '#fff',
      maxWidth: '186mm',
      margin: '0 auto',
      padding: '2mm 3mm 4mm',
      lineHeight: 1.22,
      position: 'relative',
    }}>
      <style>{`
        .gb-wrap, .gb-wrap * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
        .gb-wrap table { table-layout: auto; }
        .gb-wrap td, .gb-wrap th { overflow-wrap: anywhere; }
        @media print {
          .gb-wrap { padding: 0 !important; max-width: 100% !important; }
          .gb-wrap .break-avoid { page-break-inside: avoid; break-inside: avoid; }
          .gb-wrap .w-auto-table { table-layout: auto !important; }
        }
      `}</style>

      <header className="break-avoid" style={{ position: 'relative', zIndex: 1, border: `1px solid ${LINE}`, borderRadius: 6, overflow: 'hidden', marginBottom: 7 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '58px 1fr 82px', gap: 10, alignItems: 'center', padding: '7px 9px' }}>
          <div>
            {co.logo
              ? <img src={co.logo} alt="logo" style={{ width: 50, height: 50, objectFit: 'contain', display: 'block' }} />
              : <div style={{ width: 50, height: 50, borderRadius: 8, background: FOREST, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, fontWeight: 800 }}>A</div>}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="copy-badge" style={{ display: 'inline-block', border: `1px solid ${PINE}`, borderRadius: 999, padding: '2px 12px', fontSize: 9, fontWeight: 900, color: PINE, letterSpacing: '0.14em', textTransform: 'uppercase', background: 'rgba(46,125,50,0.045)', marginBottom: 3 }}>{copyLabel}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: PINE, lineHeight: 1.05, textTransform: 'uppercase' }}>{co.name}</div>
            <div style={{ fontSize: 9.3, color: MUTE, marginTop: 3 }}>{co.address}</div>
            <div style={{ fontSize: 8.5, color: MUTE, marginTop: 2 }}>
              {co.bin && <>BIN: {co.bin}</>}
              {co.tin && <><span style={{ color: LINE }}> | </span>TIN: {co.tin}</>}
              {co.phone && <><span style={{ color: LINE }}> | </span>Phone: {co.phone}</>}
              {co.email && <><span style={{ color: LINE }}> | </span>Email: {co.email}</>}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <img src={qrUrl} alt="Invoice verification QR" style={{ width: 70, height: 70, border: `1px solid ${LINE}`, padding: 2 }} />
            <div style={{ fontSize: 7.4, color: MUTE, marginTop: 2, fontWeight: 700 }}>QR VERIFY</div>
          </div>
        </div>
      </header>

      <section className="break-avoid" style={{ position: 'relative', zIndex: 1, border: `1px solid ${LINE}`, borderRadius: 6, overflow: 'hidden', marginBottom: 7 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', padding: '6px 9px', borderBottom: `1px solid ${LINE}` }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: PINE, letterSpacing: '0.05em' }}>GUEST INVOICE</div>
          <div style={{ fontSize: 10, fontWeight: 900, color: statusColor }}>Status: {statusLabel}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '3px 10px', padding: '6px 9px', fontSize: 9.5 }}>
          <Meta label="Invoice No" value={invoiceNumber} strong />
          <Meta label="Folio" value={folioNo} />
          <Meta label="Page" value="1 of 1" />
          <Meta label="Date" value={issueDate} />
          <Meta label="Cashier" value={cashier} />
          <Meta label="Print" value={printTime} />
        </div>
      </section>

      <section className="break-avoid" style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', border: `1px solid ${LINE}`, borderRadius: 6, overflow: 'hidden', marginBottom: 7 }}>
        <div style={{ padding: '7px 11px', borderRight: `1px solid ${LINE}`, background: 'rgba(46,125,50,0.03)', minWidth: 0 }}>
          <div style={sectionTitle}>Guest Information</div>
          <Field k="Guest Name" v={buyer.isCompany ? guest?.full_name || res?.reservation_name || buyer.name : buyer.name} strong />
          <Field k="Mobile" v={guest?.phone || '---'} />
          <Field k="Guest ID" v={guest?.guest_code || guest?.id || res?.guest_id || '---'} />
          {guest?.email && <Field k="Email" v={guest.email} />}
          <Field k="Address" v={buyer.address || '---'} />
          {buyer.bin && <Field k="BIN" v={buyer.bin} />}
          {!buyer.isCompany && guest?.id_number && <Field k={guest?.id_type || 'ID'} v={guest.id_number} />}
        </div>
        <div style={{ padding: '7px 11px', background: 'rgba(46,125,50,0.03)', minWidth: 0 }}>
          <div style={sectionTitle}>Stay Information</div>
          <Field k="Reservation" v={res?.res_no || '---'} strong />
          <Field k="Room No" v={roomNo} />
          <Field k="Room Type" v={roomType} />
          <Field k="Check-in" v={res?.check_in ? fmtDate(res.check_in) : '---'} />
          <Field k="Check-out" v={res?.check_out ? fmtDate(res.check_out) : '---'} />
          <Field k="Nights" v={`${nights} night${nights !== 1 ? 's' : ''}`} />
          <Field k="Guests" v={`${pax} pax`} />
        </div>
      </section>

      <section style={{ position: 'relative', zIndex: 1 }}>
        <div style={sectionTitle}>Billing Details</div>
        <table className="w-auto-table" style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${LINE}` }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 70 }}>Date</th>
              <th style={{ ...th, width: 48 }}>Dept</th>
              <th style={{ ...th, width: 58 }}>Ref</th>
              <th style={th}>Description</th>
              <th style={{ ...th, width: 28, textAlign: 'right' }}>Qty</th>
              <th style={{ ...th, width: 54, textAlign: 'right' }}>Rate</th>
              <th style={{ ...th, width: 46, textAlign: 'right' }}>Disc</th>
              <th style={{ ...th, width: 46, textAlign: 'right' }}>VAT</th>
              <th style={{ ...th, width: 60, textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {chargeItems.length === 0 && <tr><td style={{ ...td, textAlign: 'center', color: MUTE }} colSpan={9}>No charges recorded.</td></tr>}
            {chargeItems.map((ch, i) => (
              <tr key={ch.id || i}>
                <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 9 }}>{compactDate(ch.charge_date)}</td>
                <td style={{ ...td, fontSize: 9 }}>{ch.charge_type || '---'}</td>
                <td style={{ ...td, fontSize: 9 }}>{ch.ref_no || ch.document_no || `RC-${String(i + 1).padStart(3, '0')}`}</td>
                <td style={td}>{ch.description}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number(ch.quantity || ch.qty || 1).toFixed(0)}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number(ch.rate || ch.base_amount || 0).toFixed(2)}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cell(ch, 'discount')}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cell(ch, 'vat')}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{Number(ch.total || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          {chargeItems.length > 0 && (
            <tfoot>
              <tr style={{ background: 'rgba(46,125,50,0.07)' }}>
                <td style={{ ...td, fontWeight: 800, borderBottom: 'none', textAlign: 'right' }} colSpan={5}>TOTAL</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{chargeTotals.base.toFixed(2)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{chargeTotals.discount.toFixed(2)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{chargeTotals.vat.toFixed(2)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{chargeTotals.grand_total_raw.toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        {isLegacy && <div style={{ fontSize: 9, color: MUTE, marginTop: 4, fontStyle: 'italic' }}>This invoice was issued before line-level breakdown was recorded. The totals remain accurate.</div>}
      </section>

      <section className="break-avoid" style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', border: `1px solid ${LINE}`, borderRadius: 6, overflow: 'hidden', margin: '8px 0' }}>
        <div style={{ padding: '7px 11px', borderRight: `1px solid ${LINE}` }}>
          <div style={sectionTitle}>Amount Summary</div>
          <div style={sumRow}><span style={{ color: MUTE }}>Subtotal</span><span>{fmtBDT(chargeTotals.base)}</span></div>
          <div style={sumRow}><span style={{ color: MUTE }}>Discount</span><span>{fmtBDT(chargeTotals.discount)}</span></div>
          <div style={sumRow}><span style={{ color: MUTE }}>VAT</span><span>{fmtBDT(chargeTotals.vat)}</span></div>
          <div style={{ ...sumRow, fontSize: 12.4, fontWeight: 900, color: PINE, borderTop: `1px solid ${LINE}`, marginTop: 4, paddingTop: 5 }}>
            <span>Grand Total</span><span>{fmtBDT(grandTotal)}</span>
          </div>
        </div>
        <div style={{ padding: '7px 11px' }}>
          <div style={sectionTitle}>Payment History</div>
          <div style={sumRow}><span style={{ color: MUTE }}>Paid Amount</span><span style={{ color: FOREST }}>{fmtBDT(paid)}</span></div>
          <div style={sumRow}><span style={{ color: MUTE }}>Paid Date</span><span>{paid > 0 ? issueDate : '---'}</span></div>
          <div style={sumRow}><span style={{ color: MUTE }}>Method</span><span>{res?.payment_method || totals?.payment_method || 'Cash / Card'}</span></div>
          <div style={{ ...sumRow, fontSize: 12.4, fontWeight: 900, color: statusColor, borderTop: `1px solid ${LINE}`, marginTop: 4, paddingTop: 5 }}>
            <span>Balance Due</span><span>{fmtBDT(balanceDue)}</span>
          </div>
        </div>
      </section>

      <section style={{ position: 'relative', zIndex: 1, border: `1px solid ${LINE}`, borderLeft: `4px solid ${GOLD}`, borderRadius: 6, padding: '6px 10px', marginBottom: 12, background: 'rgba(212,160,23,0.05)' }}>
        <span style={{ fontSize: 9.2, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: GOLD }}>Amount in words:&nbsp;</span>
        <span style={{ fontSize: 11.4, fontWeight: 600, color: INK }}>{takaInWords(grandTotal)}</span>
      </section>

      <section className="print-signature-grid" style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginBottom: 10, pageBreakInside: 'avoid' }}>
        {['Prepared By', 'Cashier', 'Checked By', 'Duty Manager', 'Guest Signature'].map((label) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ borderTop: `1px solid ${INK}`, marginTop: '30px', paddingTop: 4, fontSize: 9, color: MUTE }}>{label}</div>
          </div>
        ))}
      </section>

      <footer id="print-footer" className="print-avoid-break" style={{ position: 'relative', zIndex: 1, borderTop: `1px solid ${LINE}`, paddingTop: 7, textAlign: 'center', pageBreakInside: 'avoid' }}>
        <div style={{ fontSize: 9.2, fontWeight: 600, color: MUTE }}>This is a system generated invoice. VAT included as per regulation.</div>
        <div style={{ fontSize: 8, color: MUTE, marginTop: 4, letterSpacing: '0.02em' }}>
          Powered by <span style={{ fontWeight: 800, color: PINE }}>{co.software || 'Aura Stay ERP'}</span>
          <span> | Printed By: {cashier}</span>
          <span> | Terminal: WEB</span>
        </div>
      </footer>
    </div>
  )
}

function Meta({ label, value, strong }) {
  return (
    <div style={{ minWidth: 0 }}>
      <span style={{ color: '#6b7280', fontWeight: 600 }}>{label}: </span>
      <b style={{ color: '#1f2937', fontWeight: strong ? 900 : 700, overflowWrap: 'anywhere' }}>{value || '---'}</b>
    </div>
  )
}

function Field({ k, v, strong }) {
  return (
    <div style={{ display: 'flex', fontSize: 10.3, margin: '2px 0', minWidth: 0 }}>
      <span style={{ width: 82, color: '#6b7280', flexShrink: 0 }}>{k}</span>
      <span style={{ fontWeight: strong ? 800 : 500, color: '#1f2937', minWidth: 0, overflowWrap: 'anywhere' }}>{v || '---'}</span>
    </div>
  )
}
