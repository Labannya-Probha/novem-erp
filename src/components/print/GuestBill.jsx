import { fmtBDT, fmtDate, nightsBetween } from '../../lib/helpers'

/* ---------- Amount-in-words (Bangladeshi / Indian numbering) ---------- */
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

/* ---------- palette ---------- */
const FOREST = '#2E7D32'
const PINE = '#1B4D2E'
const GOLD = '#D4A017'
const INK = '#1f2937'
const MUTE = '#6b7280'
const LINE = 'rgba(27,77,46,0.18)'

export default function GuestBill({
  charges = [], totals = {}, paid = 0, due = 0,
  res, guest, company, invoice_no, issued_at,
}) {
  const co = {
    name: company?.name || 'Novem Eco Resort',
    address: company?.address || 'Bishamoni, Radhanagar, Sreemangal, Moulvibazar, Bangladesh',
    phone: company?.phone || '',
    email: company?.email || '',
    website: company?.website || '',
    bin: company?.bin || company?.bin_no || company?.vat_reg || company?.vat_bin || '',
    logo: company?.logo_url || '',
    software: company?.software_name || 'Aura Stay',
  }

  const isDraft = !invoice_no
  const invoiceNumber = invoice_no || `INV-${res?.res_no || 'DRAFT'}`
  const issueDate = fmtDate(issued_at || new Date().toISOString())
  const nights = res?.check_in && res?.check_out ? nightsBetween(res.check_in, res.check_out) : 0
  const pax = (Number(res?.pax_adults) || 0) + (Number(res?.pax_children) || 0)

  const subtotal = Number(totals.base || 0)
  const discount = Number(totals.discount || 0)
  const serviceCharge = Number(totals.service_charge || 0)
  const vat = Number(totals.vat || 0)
  const rounding = Number(totals.rounding || 0)
  const grandTotal = Number(totals.grand_total ?? subtotal - discount + serviceCharge + vat + rounding)
  const balanceDue = Number(due ?? grandTotal - paid)
  const statusLabel = balanceDue <= 0 ? 'PAID' : Number(paid) > 0 ? 'PARTIALLY PAID' : 'UNPAID'
  const statusColor = balanceDue <= 0 ? FOREST : '#b91c1c'

  const sectionTitle = { fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: FOREST, marginBottom: 4 }
  const th = { textAlign: 'left', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: '#fff', padding: '6px 9px', background: PINE }
  const td = { fontSize: 11.5, padding: '5px 9px', borderBottom: `1px solid ${LINE}`, color: INK, verticalAlign: 'top' }
  const sumRow = { display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2.5px 0', color: INK }

  return (
    <div className="gb-wrap" style={{
      fontFamily: "'Inter', sans-serif", color: INK, background: '#fff',
      maxWidth: 794, margin: '0 auto', padding: '16px 22px', lineHeight: 1.35,
    }}>
      <style>{`
        .gb-wrap, .gb-wrap * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
        @media print { .gb-wrap { padding: 0 !important; max-width: 100% !important; } }
      `}</style>

      {/* ═══ 1. COMPANY HEADER ═══ */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingBottom: 9, borderBottom: `3px solid ${FOREST}` }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {co.logo
            ? <img src={co.logo} alt="logo" style={{ width: 50, height: 50, objectFit: 'contain' }} />
            : <div style={{ width: 50, height: 50, borderRadius: 10, background: FOREST, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>N</div>}
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: PINE, lineHeight: 1.05 }}>{co.name}</div>
            <div style={{ fontSize: 11, color: MUTE, marginTop: 2, maxWidth: 320 }}>{co.address}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: MUTE, lineHeight: 1.55 }}>
          {co.phone && <div>📞 {co.phone}</div>}
          {co.email && <div>✉ {co.email}</div>}
          {co.website && <div>🌐 {co.website}</div>}
          {co.bin && <div style={{ fontWeight: 600, color: INK }}>BIN: {co.bin}</div>}
        </div>
      </header>

      {/* ═══ 2. CENTERED TITLE ═══ */}
      <section style={{ textAlign: 'center', margin: '12px 0 10px' }}>
        <div style={{ display: 'inline-block', fontSize: 18, fontWeight: 700, letterSpacing: '0.12em', color: PINE, padding: '3px 20px', borderTop: `2px solid ${GOLD}`, borderBottom: `2px solid ${GOLD}` }}>GUEST BILL</div>
        <div style={{ fontSize: 10, color: MUTE, letterSpacing: '0.18em', marginTop: 4 }}></div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 26, marginTop: 8, fontSize: 11.5 }}>
          <div>
            <span style={{ color: MUTE }}>Invoice No: </span>
            <span style={{ fontWeight: 700, color: INK }}>{invoiceNumber}</span>
            {isDraft && <span style={{ marginLeft: 7, fontSize: 8.5, fontWeight: 700, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 4, padding: '1px 5px', letterSpacing: '0.08em' }}>DRAFT</span>}
          </div>
          <div><span style={{ color: MUTE }}>Date: </span><span style={{ fontWeight: 600 }}>{issueDate}</span></div>
          <div><span style={{ color: MUTE }}>Status: </span><span style={{ fontWeight: 700, color: statusColor }}>{statusLabel}</span></div>
        </div>
      </section>

      {/* ═══ 3. GUEST INFO — 2-COLUMN BOX ═══ */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: `1px solid ${LINE}`, borderRadius: 8, overflow: 'hidden', marginBottom: 11 }}>
        <div style={{ padding: '9px 14px', borderRight: `1px solid ${LINE}`, background: 'rgba(46,125,50,0.03)' }}>
          <div style={sectionTitle}>Billed To</div>
          <Field k="Guest" v={guest?.full_name || res?.reservation_name || '—'} strong />
          <Field k="Phone" v={guest?.phone || '—'} />
          {guest?.email && <Field k="Email" v={guest.email} />}
          {guest?.address && <Field k="Address" v={guest.address} />}
          {guest?.id_number && <Field k={guest?.id_type || 'ID'} v={guest.id_number} />}
        </div>
        <div style={{ padding: '9px 14px', background: 'rgba(46,125,50,0.03)' }}>
          <div style={sectionTitle}>Stay Details</div>
          <Field k="Reservation" v={res?.res_no || '—'} strong />
          <Field k="Check-in" v={res?.check_in ? fmtDate(res.check_in) : '—'} />
          <Field k="Check-out" v={res?.check_out ? fmtDate(res.check_out) : '—'} />
          <Field k="Nights" v={`${nights} night${nights !== 1 ? 's' : ''}`} />
          <Field k="Guests" v={`${pax} pax`} />
        </div>
      </section>

      {/* ═══ 4. CHARGES TABLE ═══ */}
      <section>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${LINE}` }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 30, textAlign: 'center' }}>#</th>
              <th style={{ ...th, width: 88 }}>Date</th>
              <th style={th}>Description</th>
              <th style={{ ...th, width: 110, textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 && <tr><td style={{ ...td, textAlign: 'center', color: MUTE }} colSpan={4}>No charges recorded.</td></tr>}
            {charges.map((ch, i) => (
              <tr key={ch.id || i}>
                <td style={{ ...td, textAlign: 'center', color: MUTE }}>{i + 1}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 10.5 }}>{fmtDate(ch.charge_date)}</td>
                <td style={td}>{ch.description}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{Number(ch.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ═══ 5. FINANCIAL SUMMARY ═══ */}
      <section style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0' }}>
        <div style={{ width: 310, fontVariantNumeric: 'tabular-nums' }}>
          <div style={sumRow}><span style={{ color: MUTE }}>Subtotal</span><span>{fmtBDT(subtotal)}</span></div>
          {discount > 0 && <div style={sumRow}><span style={{ color: MUTE }}>Discount</span><span>− {fmtBDT(discount)}</span></div>}
          <div style={sumRow}><span style={{ color: MUTE }}>Service Charge</span><span>{fmtBDT(serviceCharge)}</span></div>
          <div style={sumRow}><span style={{ color: MUTE }}>VAT</span><span>{fmtBDT(vat)}</span></div>
          {Math.abs(rounding) > 0.0001 && <div style={sumRow}><span style={{ color: MUTE }}>Rounding</span><span>{rounding > 0 ? '+ ' : '− '}{fmtBDT(Math.abs(rounding))}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#fff', background: FOREST, padding: '7px 11px', borderRadius: 6, margin: '6px 0' }}>
            <span>Grand Total</span><span>{fmtBDT(grandTotal)}</span>
          </div>
          <div style={sumRow}><span style={{ color: MUTE }}>Paid</span><span style={{ color: FOREST }}>{fmtBDT(paid)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700, color: statusColor, borderTop: `2px solid ${LINE}`, paddingTop: 5, marginTop: 2 }}>
            <span>Balance Due</span><span>{fmtBDT(balanceDue)}</span>
          </div>
        </div>
      </section>

      {/* ═══ 6. AMOUNT IN WORDS ═══ */}
      <section style={{ border: `1px solid ${LINE}`, borderLeft: `4px solid ${GOLD}`, borderRadius: 6, padding: '7px 12px', marginBottom: 22, background: 'rgba(212,160,23,0.05)' }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: GOLD }}>Amount in words:&nbsp;</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{takaInWords(grandTotal)}</span>
      </section>

      {/* ═══ 7. SIGNATURE LINES ═══ */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 36, marginBottom: 18, pageBreakInside: 'avoid' }}>
        {['Prepared By', 'Authorized By', 'Guest Signature'].map((label) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ 
              borderTop: `1px solid ${INK}`, 
              marginTop: '50px', 
              paddingTop: 5, 
              fontSize: 10.5, 
              color: MUTE 
            }}>
              {label}
            </div>
          </div>
        ))}
      </section>

      {/* ═══ 8. FOOTER ═══ */}
      <footer id="print-footer" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 9, textAlign: 'center', pageBreakInside: 'avoid' }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: FOREST }}>Thank you for staying with {co.name}.</div>
        <div style={{ fontSize: 9, color: MUTE, marginTop: 5, letterSpacing: '0.04em' }}>
          Powered by <span style={{ fontWeight: 700, color: PINE }}>{co.software || 'Aura Stay'}</span>
        </div>
      </footer>
    </div>
  )
}

function Field({ k, v, strong }) {
  return (
    <div style={{ display: 'flex', fontSize: 11.5, margin: '2px 0' }}>
      <span style={{ width: 88, color: '#6b7280', flexShrink: 0 }}>{k}</span>
      <span style={{ fontWeight: strong ? 700 : 500, color: '#1f2937' }}>{v}</span>
    </div>
  )
}
