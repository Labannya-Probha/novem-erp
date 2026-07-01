import { fmtBDT, fmtDate, nightsBetween, computeCharge, rateFor, todayISO } from '../../lib/helpers'

export default function Quotation({ res, guest, resRooms, company, taxConfig, terms, roomRate, roomCount, discountPct, validDays }) {
  const rate = rateFor(taxConfig, 'ROOM', todayISO())
  const lines = (resRooms && resRooms.length)
    ? resRooms.map((rr) => ({ 
        label: `Room ${rr.rooms?.room_no}${rr.rooms?.room_name ? ` · ${rr.rooms.room_name}` : ''}`, 
        calc: computeCharge(rr.rate, discountPct, rate),
        nights: nightsBetween(rr.from_date || res.check_in, rr.to_date || res.check_out),
        ci: rr.from_date || res.check_in,
        co: rr.to_date || res.check_out
      }))
    : [{ 
        label: `${roomCount} room(s)`, 
        calc: computeCharge(Number(roomRate) * Number(roomCount), discountPct, rate), 
        nights: nightsBetween(res.check_in, res.check_out),
        ci: res.check_in,
        co: res.check_out
      }]

  const sum = lines.reduce((a, l) => ({
    base: a.base + l.calc.base_amount * l.nights,
    discount: a.discount + l.calc.discount * l.nights,
    sc: a.sc + l.calc.service_charge * l.nights, 
    vat: a.vat + l.calc.vat * l.nights, 
    total: a.total + (l.calc.base_amount - l.calc.discount) * l.nights,
  }), { base: 0, discount: 0, sc: 0, vat: 0, total: 0 })

  const cell = { border: '1px solid #000', padding: '5px 8px' }
  const rt = { ...cell, textAlign: 'right' }
  const validUntil = new Date(Date.now() + (validDays || 7) * 86400000)
  const primary = 'var(--print-primary, #1B4D2E)'
  const line = 'var(--print-line, rgba(27,77,46,0.24))'
  const soft = 'var(--print-soft, rgba(46,125,50,0.08))'

  return (
    <div className="print-a4-doc" style={{ maxWidth: '186mm', margin: '0 auto' }}>
      <div className="print-avoid-break" style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: `2px solid ${primary}`, paddingBottom: 8, marginBottom: 12 }}>
        {company?.logo_url && <img src={company.logo_url} alt="" style={{ height: 54, width: 54, objectFit: 'contain' }} />}
        <div style={{ flex: 1, textAlign: company?.logo_url ? 'left' : 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Fraunces, serif', color: primary }}>{company?.name || 'Novem Eco Resort'}</div>
          <div style={{ fontSize: 11 }}>{company?.address} · {company?.phone} · {company?.email}</div>
          {company?.bin && <div style={{ fontSize: 10 }}>BIN: {company.bin}</div>}
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, letterSpacing: 1, marginBottom: 10, color: primary }}>QUOTATION</div>

      <table style={{ width: '100%', fontSize: 12, marginBottom: 10 }}>
        <tbody>
          <tr>
            <td><b>Quotation Ref:</b> {res.res_no}</td>
            <td style={{ textAlign: 'right' }}><b>Date:</b> {fmtDate(todayISO())}</td>
          </tr>
          <tr>
            <td><b>Guest:</b> {guest?.full_name || res.reservation_name || '—'}{guest?.phone ? ` · ${guest.phone}` : ''}</td>
            <td style={{ textAlign: 'right' }}><b>Valid until:</b> {fmtDate(validUntil)}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: soft }}>
            <th style={cell}>Description</th><th style={rt}>Tariff</th><th style={rt}>Dates</th><th style={rt}>Nights</th><th style={rt}>Disc %</th><th style={rt}>Disc Amt</th><th style={rt}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={cell}>{l.label}</td>
              <td style={rt}>{fmtBDT(l.calc.base_amount)}</td>
              <td style={rt}>{fmtDate(l.ci)} - {fmtDate(l.co)}</td>
              <td style={rt}>{l.nights}</td>
              <td style={rt}>{discountPct}%</td>
              <td style={rt}>{fmtBDT(l.calc.discount * l.nights)}</td>
              <td style={rt}>{fmtBDT((l.calc.base_amount - l.calc.discount) * l.nights)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {sum.sc > 0 && <tr><td style={cell} colSpan={6}>Service charge {rate.service_charge_pct}%</td><td style={rt}>{fmtBDT(sum.sc)}</td></tr>}
          <tr><td style={cell} colSpan={6}>VAT {rate.vat_pct}%</td><td style={rt}>{fmtBDT(sum.vat)}</td></tr>
          <tr style={{ fontWeight: 700, background: soft }}><td style={{ ...cell, borderColor: line }} colSpan={6}>GRAND TOTAL</td><td style={{ ...rt, borderColor: line, color: primary }}>{fmtBDT(sum.total + sum.sc + sum.vat)}</td></tr>
        </tfoot>
      </table>

      {terms && (
        <div style={{ marginTop: 14, fontSize: 10.5, lineHeight: 1.6, borderTop: `1px solid ${line}`, paddingTop: 8 }}>
          {/<[a-z][\s\S]*>/i.test(terms)
            ? <div dangerouslySetInnerHTML={{ __html: terms }} />
            : <div style={{ whiteSpace: 'pre-wrap' }}>{terms}</div>
          }
        </div>
      )}

      <div style={{ marginTop: 28, fontSize: 12 }}>
        For {company?.legal_name || company?.name || 'the resort'},<br /><br /><br />
        ____________________________<br />Authorised Signature
      </div>
      {company?.invoice_footer && <div style={{ textAlign: 'center', fontSize: 10, marginTop: 16, color: '#555' }}>{company.invoice_footer}</div>}
    </div>
  )
}
