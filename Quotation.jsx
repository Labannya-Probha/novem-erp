import { fmtBDT, fmtDate, nightsBetween, computeCharge, rateFor, todayISO } from '../../lib/helpers'

export default function Quotation({ res, guest, resRooms, company, taxConfig, terms, roomRate, roomCount, discountPct, validDays }) {
  const nights = nightsBetween(res.check_in, res.check_out)
  const rate = rateFor(taxConfig, 'ROOM', todayISO())
  const lines = (resRooms && resRooms.length)
    ? resRooms.map((rr) => ({ label: `Room ${rr.rooms?.room_no}${rr.rooms?.room_name ? ` · ${rr.rooms.room_name}` : ''}`, calc: computeCharge(rr.rate, discountPct, rate) }))
    : [{ label: `${roomCount} room(s)`, calc: computeCharge(Number(roomRate) * Number(roomCount), discountPct, rate) }]
  const sum = lines.reduce((a, l) => ({
    base: a.base + l.calc.base_amount * nights, discount: a.discount + l.calc.discount * nights,
    sc: a.sc + l.calc.service_charge * nights, sd: a.sd + l.calc.sd * nights,
    vat: a.vat + l.calc.vat * nights, total: a.total + l.calc.total * nights,
  }), { base: 0, discount: 0, sc: 0, sd: 0, vat: 0, total: 0 })
  const cell = { border: '1px solid #000', padding: '5px 8px' }
  const rt = { ...cell, textAlign: 'right' }
  const validUntil = new Date(Date.now() + (validDays || 7) * 86400000)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid #000', paddingBottom: 8, marginBottom: 12 }}>
        {company?.logo_url && <img src={company.logo_url} alt="" style={{ height: 54, width: 54, objectFit: 'contain' }} />}
        <div style={{ flex: 1, textAlign: company?.logo_url ? 'left' : 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Fraunces, serif' }}>{company?.name || 'Novem Eco Resort'}</div>
          <div style={{ fontSize: 11 }}>{company?.address} · {company?.phone} · {company?.email}</div>
          {company?.bin && <div style={{ fontSize: 10 }}>BIN: {company.bin}</div>}
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>QUOTATION</div>

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
          <tr>
            <td><b>Check-in:</b> {fmtDate(res.check_in)}</td>
            <td style={{ textAlign: 'right' }}><b>Check-out:</b> {fmtDate(res.check_out)} ({nights} night{nights !== 1 ? 's' : ''})</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#eee' }}>
            <th style={cell}>Description</th><th style={rt}>Tariff/night</th><th style={rt}>Nights</th><th style={rt}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={cell}>{l.label}</td>
              <td style={rt}>{fmtBDT(l.calc.base_amount)}</td>
              <td style={rt}>{nights}</td>
              <td style={rt}>{fmtBDT(l.calc.base_amount * nights)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {sum.discount > 0 && <tr><td style={cell} colSpan={3}>Discount {discountPct}%</td><td style={rt}>− {fmtBDT(sum.discount)}</td></tr>}
          {sum.sc > 0 && <tr><td style={cell} colSpan={3}>Service charge {rate.service_charge_pct}%</td><td style={rt}>{fmtBDT(sum.sc)}</td></tr>}
          {sum.sd > 0 && <tr><td style={cell} colSpan={3}>Supplementary duty {rate.sd_pct}%</td><td style={rt}>{fmtBDT(sum.sd)}</td></tr>}
          <tr><td style={cell} colSpan={3}>VAT {rate.vat_pct}%</td><td style={rt}>{fmtBDT(sum.vat)}</td></tr>
          <tr style={{ fontWeight: 700, background: '#f5f5f5' }}><td style={cell} colSpan={3}>GRAND TOTAL</td><td style={rt}>{fmtBDT(sum.total)}</td></tr>
        </tfoot>
      </table>

      {terms && (
        <div style={{ marginTop: 14, fontSize: 10.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', borderTop: '1px solid #999', paddingTop: 8 }}>{terms}</div>
      )}

      <div style={{ marginTop: 28, fontSize: 12 }}>
        For {company?.legal_name || company?.name || 'the resort'},<br /><br /><br />
        ____________________________<br />Authorised Signature
      </div>
      {company?.invoice_footer && <div style={{ textAlign: 'center', fontSize: 10, marginTop: 16, color: '#555' }}>{company.invoice_footer}</div>}
    </div>
  )
}
