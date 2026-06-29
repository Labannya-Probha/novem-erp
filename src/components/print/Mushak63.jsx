import { fmtBDT, fmtDate } from '../../lib/helpers'
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

const issueTimeOf = (issued) =>
  issued.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' })

const supplyUnit = (line) => line.charge_type === 'ROOM' ? 'Night' : 'Service'

export default function Mushak63({
  charges = [], line_snapshot = [], totals = {}, paid = 0, due = 0,
  res, guest, company, guestCompany, refNo, invoice_no, issued_at,
  buyer_name, buyer_address, buyer_bin, is_void, created_by,
}) {
  const { items, isLegacy } = normalizeInvoiceItems(charges, line_snapshot)
  const lines = items.filter((l) => l.charge_type !== 'ROUNDING')

  if (lines.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#b91c1c' }}>No tax invoice to display. Check the guest out from the Folio &amp; Payments tab first, then print the Mushak-6.3.</div>
  }

  const t = normalizeInvoiceTotals(totals)
  const buyer = resolveBuyerInfo({ res, guest, guestCompany, buyer_name, buyer_address, buyer_bin })
  const issued = new Date(issued_at || new Date())
  const printedAt = new Date()
  const invNo = invoice_no || '—'
  const creator = created_by || '________________'
  const lineValue = (l) => l._legacy
    ? Number(l.base_amount || 0)
    : +(Number(l.base_amount) - Number(l.discount) + Number(l.service_charge)).toFixed(2)
  const totalValue = lines.reduce((a, l) => a + lineValue(l), 0)

  const copies = ['Guest Copy', 'Resort Copy']

  return (
    <div className="mushak-copy-stack">
      {copies.map((copyLabel, copyIndex) => (
        <MushakCopy
          key={copyLabel}
          copyLabel={copyLabel}
          copyIndex={copyIndex}
          lines={lines}
          totals={t}
          totalValue={totalValue}
          lineValue={lineValue}
          buyer={buyer}
          company={company}
          res={res}
          refNo={refNo}
          invNo={invNo}
          issued={issued}
          printedAt={printedAt}
          creator={creator}
          isLegacy={isLegacy}
          isVoid={is_void}
        />
      ))}
    </div>
  )
}

function MushakCopy({
  copyLabel, copyIndex, lines, totals, totalValue, lineValue, buyer, company,
  res, refNo, invNo, issued, printedAt, creator, isLegacy, isVoid,
}) {
  const cell = {
    border: '1px solid #111',
    padding: '3px 4px',
    fontSize: 8.7,
    lineHeight: 1.18,
    verticalAlign: 'top',
    color: '#000',
    background: '#fff',
  }
  const center = { ...cell, textAlign: 'center' }
  const right = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  const label = { fontSize: 10.2, padding: '1px 0', lineHeight: 1.25 }
  const value = { fontSize: 10.2, padding: '1px 0 1px 8px', fontWeight: 600, lineHeight: 1.25, overflowWrap: 'anywhere' }

  return (
    <section
      className={`print-copy mushak-63-doc print-a4-doc ${copyIndex > 0 ? 'print-copy-break' : ''}`}
      style={{ width: '100%', maxWidth: '194mm', minHeight: '281mm', margin: '0 auto', padding: '0 4mm', color: '#000', background: '#fff', fontFamily: "'Noto Sans Bengali', 'SolaimanLipi', 'Inter', sans-serif", position: 'relative', pageBreakAfter: copyIndex === 0 ? 'always' : 'auto' }}
    >
      {isVoid && <div style={{ position: 'absolute', top: '41%', left: 0, right: 0, textAlign: 'center', transform: 'rotate(-24deg)', fontSize: 88, fontWeight: 800, color: 'rgba(220,0,0,0.14)', letterSpacing: 8, pointerEvents: 'none' }}>VOID / বাতিল</div>}

      <div style={{ textAlign: 'right', marginBottom: 2 }}>
        <span className="copy-badge" style={{ display: 'inline-block', border: '1px solid #111', padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{copyLabel}</span>
      </div>

      <header style={{ position: 'relative', textAlign: 'center', marginBottom: 7 }}>
        <div style={{ position: 'absolute', right: 0, top: 5, border: '2px solid #111', padding: '4px 11px', fontSize: 13, fontWeight: 800 }}>মূসক-৬.৩</div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>জাতীয় রাজস্ব বোর্ড</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8, textDecoration: 'underline' }}>কর চালানপত্র</div>
        <div style={{ fontSize: 10, marginTop: 2 }}>বিধি ৪০ এর উপ-বিধি (১) এর দফা (গ) ও দফা (চ) দ্রষ্টব্য</div>
      </header>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6, tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td style={{ ...label, width: '34%' }}>নিবন্ধিত ব্যক্তির নাম</td>
            <td style={{ ...label, width: 14 }}>:</td>
            <td style={value}>{company?.legal_name || company?.name || 'Aura Stay'}</td>
          </tr>
          <tr>
            <td style={label}>নিবন্ধিত ব্যক্তির বিআইএন</td>
            <td style={label}>:</td>
            <td style={value}>{company?.bin || company?.bin_no || company?.vat_reg || company?.vat_bin || '____________________'}</td>
          </tr>
          <tr>
            <td style={label}>চালানপত্র ইস্যুর ঠিকানা</td>
            <td style={label}>:</td>
            <td style={value}>{company?.address || '—'}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 7, tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td style={{ ...label, width: '18%' }}>ক্রেতার নাম</td>
            <td style={{ ...label, width: 14 }}>:</td>
            <td style={value}>{buyer.name}</td>
            <td style={{ ...label, width: '18%' }}>চালানপত্র নম্বর</td>
            <td style={{ ...label, width: 14 }}>:</td>
            <td style={value}>{invNo}</td>
          </tr>
          <tr>
            <td style={label}>ক্রেতার বিআইএন</td>
            <td style={label}>:</td>
            <td style={value}>{buyer.bin || '—'}</td>
            <td style={label}>ইস্যুর তারিখ</td>
            <td style={label}>:</td>
            <td style={value}>{fmtDate(issued)}</td>
          </tr>
          <tr>
            <td style={label}>সরবরাহের গন্তব্যস্থল</td>
            <td style={label}>:</td>
            <td style={value}>{buyer.address !== '—' ? buyer.address : company?.address || '—'}</td>
            <td style={label}>ইস্যুর সময়</td>
            <td style={label}>:</td>
            <td style={value}>{issueTimeOf(printedAt)}</td>
          </tr>
          <tr>
            <td style={label}>যানবাহনের প্রকৃতি ও নাম্বার</td>
            <td style={label}>:</td>
            <td style={value}>প্রযোজ্য নয়</td>
            <td style={label}>রেফারেন্স</td>
            <td style={label}>:</td>
            <td style={value}>{refNo || res?.res_no || '—'}</td>
          </tr>
        </tbody>
      </table>

      <table className="mushak-grid-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ ...center, width: '4.5%' }}>ক্রমিক<br />নং</th>
            <th style={{ ...center, width: '23%' }}>পণ্য বা সেবার বর্ণনা<br />(প্রযোজ্য ক্ষেত্রে ব্র্যান্ড নামসহ)</th>
            <th style={{ ...center, width: '6.5%' }}>সরবরাহের<br />একক</th>
            <th style={{ ...center, width: '5.5%' }}>পরিমাণ</th>
            <th style={{ ...center, width: '8.5%' }}>একক মূল্য *<br />(টাকায়)</th>
            <th style={{ ...center, width: '8.5%' }}>মোট মূল্য<br />(টাকায়)</th>
            <th style={{ ...center, width: '7%' }}>সম্পূরক<br />শুল্কের হার</th>
            <th style={{ ...center, width: '8%' }}>সম্পূরক শুল্কের<br />পরিমাণ</th>
            <th style={{ ...center, width: '8%' }}>মূসক / সুনির্দিষ্ট<br />করের হার</th>
            <th style={{ ...center, width: '9%' }}>মূসক / সুনির্দিষ্ট<br />করের পরিমাণ</th>
            <th style={{ ...center, width: '11.5%' }}>সকল প্রকার শুল্ক ও<br />করসহ মূল্য</th>
          </tr>
          <tr>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => <th key={n} style={center}>{n}</th>)}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const valueAmount = lineValue(line)
            const vatRate = line._legacy ? null : (valueAmount > 0 ? ((Number(line.vat) / valueAmount) * 100).toFixed(1).replace(/\.0$/, '') : '0')
            return (
              <tr key={line.id || i}>
                <td style={center}>{i + 1}</td>
                <td style={cell}>{line.description}</td>
                <td style={center}>{supplyUnit(line)}</td>
                <td style={center}>1</td>
                <td style={right}>{valueAmount.toFixed(2)}</td>
                <td style={right}>{valueAmount.toFixed(2)}</td>
                <td style={center}>—</td>
                <td style={right}>—</td>
                <td style={center}>{vatRate === null ? '—' : `${vatRate}%`}</td>
                <td style={right}>{line._legacy ? '—' : Number(line.vat).toFixed(2)}</td>
                <td style={right}>{Number(line.total).toFixed(2)}</td>
              </tr>
            )
          })}
          <tr>
            <td style={{ ...cell, fontWeight: 800 }} colSpan={5}>মোট:</td>
            <td style={{ ...right, fontWeight: 800 }}>{totalValue.toFixed(2)}</td>
            <td style={center}>—</td>
            <td style={right}>—</td>
            <td style={center}>—</td>
            <td style={{ ...right, fontWeight: 800 }}>{totals.vat.toFixed(2)}</td>
            <td style={{ ...right, fontWeight: 800 }}>{totals.grand_total_raw.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {isLegacy && (
        <div style={{ fontSize: 8.8, marginTop: 4 }}>
          দ্রষ্টব্য: এই চালানটি লাইন-পর্যায়ের বিস্তারিত হিসাব সংরক্ষণের আগে ইস্যু করা হয়েছিল, তাই প্রতি লাইনে মূসক হার দেখানো সম্ভব হয়নি। মোট মূসক ও সর্বমোট মূল্য সঠিক রয়েছে।
        </div>
      )}

      {!!totals.rounding && (
        <div style={{ fontSize: 9.5, marginTop: 5, textAlign: 'right' }}>
          রাউন্ডিং: {totals.rounding > 0 ? '+' : '−'}{fmtBDT(Math.abs(totals.rounding))} &nbsp; <b>প্রদেয়: {fmtBDT(totals.grand_total)}</b>
        </div>
      )}

      <div style={{ border: '1px solid #111', borderTop: 'none', padding: '5px 7px', fontSize: 10.2, fontWeight: 700 }}>
        মোট (কথায়): {takaInWords(totals.grand_total || 0)}
      </div>

      <footer style={{ marginTop: 18, fontSize: 10.2 }}>
        <div style={{ marginBottom: 9 }}>প্রতিষ্ঠান কর্তৃপক্ষের দায়িত্বপ্রাপ্ত ব্যক্তির নামঃ {creator}</div>
        <div style={{ marginBottom: 18 }}>পদবীঃ __________________________</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>সীলঃ</div>
          <div style={{ minWidth: 210, textAlign: 'center', borderTop: '1px solid #111', paddingTop: 5 }}>স্বাক্ষরঃ</div>
        </div>
        <div style={{ marginTop: 8, fontSize: 8.8 }}>* সকল প্রকার কর ব্যতীত মূল্য</div>
      </footer>
    </section>
  )
}
