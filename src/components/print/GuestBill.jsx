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

export default function GuestBill({
  charges = [], line_snapshot = [], totals = {}, paid = 0, due = 0,
  res, guest, company, guestCompany, invoice_no, issued_at,
  buyer_name, buyer_address, buyer_bin, copyLabel, singleCopy = false,
}) {
  const co = {
    name: company?.name || 'Aura Stay',
    address: company?.address || 'Demo Property, Bangladesh',
    phone: company?.phone || '+8801344775404',
    email: company?.email || 'sales@aurastay.bd',
    website: company?.website || '',
    bin: company?.bin || company?.bin_no || company?.vat_reg || company?.vat_bin || '000000000-0000',
    logo: company?.logo_url || '',
    software: company?.software_name || 'Aura Stay',
  }

  const { items: chargeItems, isLegacy } = normalizeInvoiceItems(charges, line_snapshot)
  const chargeTotals = normalizeInvoiceTotals(totals)
  const buyer = resolveBuyerInfo({ res, guest, guestCompany, buyer_name, buyer_address, buyer_bin })
  const invoiceNumber = invoice_no || `INV-${res?.res_no || 'DRAFT'}`
  const isDraft = !invoice_no
  const issued = new Date(issued_at || new Date())
  const issueDate = fmtDate(issued)
  const issueTime = issued.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' })
  const nights = res?.check_in && res?.check_out ? nightsBetween(res.check_in, res.check_out) : 0
  const pax = (Number(res?.pax_adults) || 0) + (Number(res?.pax_children) || 0)
  const grandTotal = chargeTotals.grand_total
  const balanceDue = Number(due ?? grandTotal - paid)
  const statusLabel = balanceDue <= 0 ? 'PAID' : Number(paid) > 0 ? 'PARTIALLY PAID' : 'UNPAID'
  const statusColor = balanceDue <= 0 ? FOREST : '#b91c1c'

  const sectionTitle = { fontSize: 9.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: FOREST, marginBottom: 4 }
  const th = { textAlign: 'left', fontSize: 9.2, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase', color: '#fff', padding: '5px 7px', background: PINE }
  const td = { fontSize: 10.8, padding: '4px 7px', borderBottom: `1px solid ${LINE}`, color: INK, verticalAlign: 'top' }
  const sumRow = { display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '2px 0', color: INK }
  const cell = (item, field) => {
    if (item._legacy && (field === 'discount' || field === 'service_charge' || field === 'vat')) return '—'
    return Number(item[field] || 0).toFixed(2)
  }

  if (!singleCopy) {
    return (
      <div className="guest-bill-copy-stack">
        {['Guest Copy', 'Resort Copy'].map((label) => (
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
    <div className={`gb-wrap print-copy print-a4-doc ${copyLabel === 'Resort Copy' ? 'print-copy-break' : ''}`} style={{
      fontFamily: "'Inter', sans-serif", color: INK, background: '#fff',
      maxWidth: '186mm', margin: '0 auto', padding: '2mm 3mm 4mm', lineHeight: 1.28,
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

      <section className="copy-section print-avoid-break" style={{ textAlign: 'center', marginBottom: 6 }}>
        <span className="copy-badge" style={{ display: 'inline-block', border: `1px solid ${LINE}`, borderRadius: 4, padding: '3px 14px', fontSize: 10, fontWeight: 800, color: PINE, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(46,125,50,0.04)' }}>
          {copyLabel}
        </span>
      </section>

      <header style={{ textAlign: 'center', paddingBottom: 8, borderBottom: `2px solid ${FOREST}` }}>
        {co.logo
          ? <img src={co.logo} alt="logo" style={{ width: 58, height: 58, objectFit: 'contain', display: 'block', margin: '0 auto 5px' }} />
          : <div style={{ width: 58, height: 58, borderRadius: 10, background: FOREST, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, fontWeight: 800, margin: '0 auto 5px' }}>A</div>}
        <div style={{ fontSize: 22, fontWeight: 800, color: PINE, lineHeight: 1.05 }}>{co.name}</div>
        <div style={{ fontSize: 11.5, color: MUTE, marginTop: 3 }}>{co.address}</div>
        {(co.phone || co.email || co.bin) && (
          <div style={{ fontSize: 11, color: MUTE, marginTop: 3 }}>
            {co.phone && <>📞 {co.phone}</>}
            {co.phone && (co.email || co.bin) && <span style={{ color: LINE }}> | </span>}
            {co.email && <>✉ {co.email}</>}
            {co.email && co.bin && <span style={{ color: LINE }}> | </span>}
            {co.bin && <>BIN: {co.bin}</>}
          </div>
        )}
        {co.website && <div style={{ fontSize: 10.5, color: MUTE, marginTop: 2 }}>{co.website}</div>}
      </header>

      <section style={{ textAlign: 'center', margin: '9px 0 8px' }}>
        <div style={{ display: 'inline-block', fontSize: 16, fontWeight: 800, letterSpacing: '0.08em', color: PINE, padding: '2px 18px', borderTop: `2px solid ${GOLD}`, borderBottom: `2px solid ${GOLD}` }}>GUEST BILL</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 18px', marginTop: 7, fontSize: 11 }}>
          <div><span style={{ color: MUTE }}>Invoice No: </span><b>{invoiceNumber}</b>{isDraft && <span style={{ marginLeft: 7, fontSize: 8.5, fontWeight: 800, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 4, padding: '1px 5px', letterSpacing: '0.08em' }}>DRAFT</span>}</div>
          <div><span style={{ color: MUTE }}>Date: </span><b>{issueDate}</b></div>
          <div><span style={{ color: MUTE }}>Status: </span><b style={{ color: statusColor }}>{statusLabel}</b></div>
        </div>
      </section>

      <section className="break-avoid" style={{ border: `1px solid ${LINE}`, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ background: 'rgba(46,125,50,0.07)', color: PINE, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '5px 10px', borderBottom: `1px solid ${LINE}` }}>Mushak 6.3 Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <InfoCell label="চালানপত্র নম্বর" value={invoiceNumber} />
          <InfoCell label="ইস্যুর তারিখ" value={issueDate} />
          <InfoCell label="ইস্যুর সময়" value={issueTime} />
        </div>
      </section>

      <section className="break-avoid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', border: `1px solid ${LINE}`, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ padding: '7px 11px', borderRight: `1px solid ${LINE}`, background: 'rgba(46,125,50,0.03)', minWidth: 0 }}>
          <div style={sectionTitle}>Billed To</div>
          <Field k={buyer.isCompany ? 'Company' : 'Guest'} v={buyer.name} strong />
          {buyer.isCompany && <Field k="Guest" v={guest?.full_name || res?.reservation_name || '—'} />}
          <Field k="Phone" v={guest?.phone || '—'} />
          {guest?.email && <Field k="Email" v={guest.email} />}
          {buyer.address !== '—' && <Field k="Address" v={buyer.address} />}
          {buyer.bin && <Field k="BIN" v={buyer.bin} />}
          {!buyer.isCompany && guest?.id_number && <Field k={guest?.id_type || 'ID'} v={guest.id_number} />}
        </div>
        <div style={{ padding: '7px 11px', background: 'rgba(46,125,50,0.03)', minWidth: 0 }}>
          <div style={sectionTitle}>Stay Details</div>
          <Field k="Reservation" v={res?.res_no || '—'} strong />
          <Field k="Check-in" v={res?.check_in ? fmtDate(res.check_in) : '—'} />
          <Field k="Check-out" v={res?.check_out ? fmtDate(res.check_out) : '—'} />
          <Field k="Nights" v={`${nights} night${nights !== 1 ? 's' : ''}`} />
          <Field k="Guests" v={`${pax} pax`} />
        </div>
      </section>

      <section>
        <div style={sectionTitle}>Guest Total Billing History</div>
        <table className="w-auto-table" style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${LINE}` }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 74 }}>Date</th>
              <th style={{ ...th, width: 72 }}>Type</th>
              <th style={th}>Description</th>
              <th style={{ ...th, width: 64, textAlign: 'right' }}>Base</th>
              <th style={{ ...th, width: 60, textAlign: 'right' }}>Disc.</th>
              <th style={{ ...th, width: 58, textAlign: 'right' }}>SC</th>
              <th style={{ ...th, width: 66, textAlign: 'right' }}>VAT</th>
              <th style={{ ...th, width: 72, textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {chargeItems.length === 0 && <tr><td style={{ ...td, textAlign: 'center', color: MUTE }} colSpan={8}>No charges recorded.</td></tr>}
            {chargeItems.map((ch, i) => (
              <tr key={ch.id || i}>
                <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 10 }}>{ch.charge_date ? fmtDate(ch.charge_date) : '—'}</td>
                <td style={{ ...td, fontSize: 10 }}>{ch.charge_type || '—'}</td>
                <td style={td}>{ch.description}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number(ch.base_amount || 0).toFixed(2)}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cell(ch, 'discount')}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cell(ch, 'service_charge')}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cell(ch, 'vat')}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{Number(ch.total || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          {chargeItems.length > 0 && (
            <tfoot>
              <tr style={{ background: 'rgba(46,125,50,0.07)' }}>
                <td style={{ ...td, fontWeight: 800, borderBottom: 'none' }} colSpan={3}>Totals</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{chargeTotals.base.toFixed(2)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{chargeTotals.discount.toFixed(2)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{chargeTotals.service_charge.toFixed(2)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{chargeTotals.vat.toFixed(2)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, borderBottom: 'none' }}>{chargeTotals.grand_total_raw.toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        {isLegacy && <div style={{ fontSize: 9.5, color: MUTE, marginTop: 4, fontStyle: 'italic' }}>This invoice was issued before itemized line-level breakdown was recorded. The totals below remain accurate.</div>}
      </section>

      <section style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
        <div style={{ width: 310, maxWidth: '100%', fontVariantNumeric: 'tabular-nums' }}>
          <div style={sumRow}><span style={{ color: MUTE }}>Subtotal</span><span>{fmtBDT(chargeTotals.grand_total_raw)}</span></div>
          {Math.abs(chargeTotals.rounding) > 0.0001 && <div style={sumRow}><span style={{ color: MUTE }}>Rounding adjustment</span><span>{chargeTotals.rounding > 0 ? '+ ' : '− '}{fmtBDT(Math.abs(chargeTotals.rounding))}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5, fontWeight: 800, color: '#fff', background: FOREST, padding: '7px 11px', borderRadius: 6, margin: '6px 0' }}>
            <span>Grand Total</span><span>{fmtBDT(grandTotal)}</span>
          </div>
          <div style={sumRow}><span style={{ color: MUTE }}>Paid</span><span style={{ color: FOREST }}>{fmtBDT(paid)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, fontWeight: 800, color: statusColor, borderTop: `2px solid ${LINE}`, paddingTop: 5, marginTop: 2 }}>
            <span>Balance Due</span><span>{fmtBDT(balanceDue)}</span>
          </div>
        </div>
      </section>

      <section style={{ border: `1px solid ${LINE}`, borderLeft: `4px solid ${GOLD}`, borderRadius: 6, padding: '6px 10px', marginBottom: 14, background: 'rgba(212,160,23,0.05)' }}>
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: GOLD }}>Amount in words:&nbsp;</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{takaInWords(grandTotal)}</span>
      </section>

      <section className="print-signature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '18px', marginBottom: 12, pageBreakInside: 'avoid' }}>
        {['Prepared By', 'Authorized By', 'Guest Signature'].map((label) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ borderTop: `1px solid ${INK}`, marginTop: '36px', paddingTop: 5, fontSize: 10.5, color: MUTE }}>{label}</div>
          </div>
        ))}
      </section>

      {/* ═══ 8. MUSHAK 6.3 DETAILS ═══ */}
      <section className="print-avoid-break" style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, background: 'rgba(46,125,50,0.03)', pageBreakInside: 'avoid' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FOREST, marginBottom: 6 }}>Mushak 6.3 Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 4, columnGap: 8, fontSize: 11.5 }}>
          <span style={{ color: MUTE, fontWeight: 600 }}>Challan No:</span>
          <span style={{ color: INK, fontWeight: 700 }}>{invoiceNumber}</span>
          <span style={{ color: MUTE, fontWeight: 600 }}>Issue Date:</span>
          <span style={{ color: INK, fontWeight: 600 }}>{issueDate}</span>
          <span style={{ color: MUTE, fontWeight: 600 }}>Issue Time:</span>
          <span style={{ color: INK, fontWeight: 600 }}>{issueTime}</span>
        </div>
      </section>

      {/* ═══ 9. FOOTER ═══ */}
      <footer id="print-footer" className="print-avoid-break" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 9, textAlign: 'center', pageBreakInside: 'avoid' }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: FOREST }}>Thank you for staying with {co.name}.</div>
        <div style={{ fontSize: 9, color: MUTE, marginTop: 5, letterSpacing: '0.04em' }}>
          Powered by <span style={{ fontWeight: 800, color: PINE }}>{co.software || 'Aura Stay'}</span>
        </div>
      </footer>
    </div>
  )
}

function InfoCell({ label, value }) {
  return (
    <div style={{ padding: '7px 10px', borderRight: `1px solid ${LINE}`, minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: '#6b7280', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#1f2937', overflowWrap: 'anywhere' }}>{value || '—'}</div>
    </div>
  )
}

function Field({ k, v, strong }) {
  return (
    <div style={{ display: 'flex', fontSize: 11, margin: '2px 0', minWidth: 0 }}>
      <span style={{ width: 88, color: '#6b7280', flexShrink: 0 }}>{k}</span>
      <span style={{ fontWeight: strong ? 800 : 500, color: '#1f2937', minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  )
}
