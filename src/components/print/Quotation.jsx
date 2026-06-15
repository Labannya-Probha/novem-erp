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

  // গ্র্যান্ড টোটাল থেকে ডিসকাউন্ট বাদ দিয়ে ক্যালকুলেশন
  const sum = lines.reduce((a, l) => ({
    base: a.base + l.calc.base_amount * l.nights,
    discount: a.discount + l.calc.discount * l.nights,
    sc: a.sc + l.calc.service_charge * l.nights, 
    sd: a.sd + l.calc.sd * l.nights,
    vat: a.vat + l.calc.vat * l.nights, 
    total: a.total + (l.calc.base_amount - l.calc.discount) * l.nights, // সংশোধিত টোটাল
  }), { base: 0, discount: 0, sc: 0, sd: 0, vat: 0, total: 0 })

  const cell = { border: '1px solid #000', padding: '5px 8px' }
  const rt = { ...cell, textAlign: 'right' }
  const validUntil = new Date(Date.now() + (validDays || 7) * 86400000)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* ... (পূর্বের হেডার অংশটি এখানে থাকবে) */}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#eee' }}>
            <th style={cell}>Description</th>
            <th style={rt}>Tariff</th>
            <th style={rt}>Dates</th>
            <th style={rt}>Nights</th>
            <th style={rt}>Disc %</th>
            <th style={rt}>Disc Amt</th>
            <th style={rt}>Amount</th>
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
          {sum.sd > 0 && <tr><td style={cell} colSpan={6}>Supplementary duty {rate.sd_pct}%</td><td style={rt}>{fmtBDT(sum.sd)}</td></tr>}
          <tr><td style={cell} colSpan={6}>VAT {rate.vat_pct}%</td><td style={rt}>{fmtBDT(sum.vat)}</td></tr>
          <tr style={{ fontWeight: 700, background: '#f5f5f5' }}><td style={cell} colSpan={6}>GRAND TOTAL</td><td style={rt}>{fmtBDT(sum.total + sum.sc + sum.sd + sum.vat)}</td></tr>
        </tfoot>
      </table>
      
      {/* ... (পূর্বের ফুটর অংশটি এখানে থাকবে) */}
    </div>
  )
}
