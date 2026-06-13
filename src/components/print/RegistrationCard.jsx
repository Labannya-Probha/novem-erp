import { fmtBDT, fmtDate, nightsBetween } from '../../lib/helpers'
import { ReportHeader } from './ReportHeader'

export default function RegistrationCard({ res, guest, resGuests, resRooms, payments, company }) {
  const advance = (payments || []).filter((p) => p.payment_class === 'ADVANCE')
  const advanceTotal = advance.reduce((a, p) => a + Number(p.amount), 0)
  const cell = { border: '1px solid #000', padding: '5px 8px', verticalAlign: 'top' }
  const lbl = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#444' }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <ReportHeader title="Guest Registration Card" showNBR={false} />

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <tbody>
          <tr>
            <td style={cell} colSpan={2}><div style={lbl}>Guest Name</div><b>{guest?.full_name || '—'}</b></td>
            <td style={cell} colSpan={2}><div style={lbl}>Reservation Name / No.</div><b>{res.reservation_name || '—'}</b> · <span>{res.res_no}</span></td>
          </tr>
          <tr>
            <td style={cell}><div style={lbl}>Room No(s).</div><b>{resRooms.map((r) => `${r.rooms?.room_no}${r.rooms?.room_name ? ` (${r.rooms.room_name})` : ''}`).join(', ') || '—'}</b></td>
            <td style={cell}><div style={lbl}>Check-In</div>{fmtDate(res.check_in)}</td>
            <td style={cell}><div style={lbl}>Check-Out</div>{fmtDate(res.check_out)}</td>
            <td style={cell}><div style={lbl}>Nights / Pax</div>{nightsBetween(res.check_in, res.check_out)} night(s) · {res.pax_adults} adult, {res.pax_children} child</td>
          </tr>
          <tr>
            <td style={cell} colSpan={3}><div style={lbl}>Guest Address</div>{guest?.address || '—'}</td>
            <td style={cell}><div style={lbl}>Contact No.</div>{guest?.phone || '—'}</td>
          </tr>
          <tr>
            <td style={cell} colSpan={2}><div style={lbl}>NID / Smart ID / Valid Photo ID</div>{guest?.id_type || '—'} · {guest?.id_number || '—'}</td>
            <td style={cell}><div style={lbl}>Driver Accommodation</div>{res.driver_accommodation ? `Yes · ${res.driver_count} @ ${fmtBDT(res.driver_rate)}/night` : 'No'}</td>
            <td style={cell}><div style={lbl}>Extra Pax</div>{res.extra_pax > 0 ? `${res.extra_pax} @ ${fmtBDT(res.extra_pax_rate)}/night` : 'No'}</td>
          </tr>
          <tr>
            <td style={cell} colSpan={2}><div style={lbl}>Room Rate</div>{resRooms.map((r) => `Room ${r.rooms?.room_no}: ${fmtBDT(r.rate)}/night`).join(' · ') || fmtBDT(res.room_rate)}</td>
            <td style={cell} colSpan={2}><div style={lbl}>Advance Payment Details</div>
              {advance.length === 0 ? '—' : advance.map((p, i) => (
                <div key={i}>{fmtDate(p.received_date)} · {p.method} · {fmtBDT(p.amount)} {p.reference ? `(${p.reference})` : ''}</div>
              ))}
              <b>Total advance: {fmtBDT(advanceTotal)}</b>
            </td>
          </tr>
          <tr>
            <td style={cell} colSpan={4}>
              <div style={lbl}>All Guest Names</div>
              {resGuests.length ? resGuests.map((g, i) => <span key={g.id}>{i + 1}. {g.guest_name}{g.id_number ? ` (${g.id_type}: ${g.id_number})` : ''}&nbsp;&nbsp;&nbsp;</span>) : '—'}
            </td>
          </tr>
          <tr>
            <td style={{ ...cell, height: 50 }} colSpan={4}><div style={lbl}>Notes / Special Instructions</div>{res.special_instructions || res.notes || ''}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: 10, marginTop: 10, lineHeight: 1.5 }}>
        I confirm the above information is correct and agree to abide by the policies of {company?.name || 'the resort'}. Check-out time is 12:00 PM.
      </div>

      <table style={{ width: '100%', marginTop: 48, fontSize: 12 }}>
        <tbody>
          <tr>
            <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: 6 }}>
              Guest Signature & Date
            </td>
            <td style={{ width: '10%' }}></td>
            <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: 6 }}>
              Front Office Employee Name & Signature<br />
              <span style={{ fontSize: 10 }}>{res.checkin_by ? `Served by: ${res.checkin_by}` : ''}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
