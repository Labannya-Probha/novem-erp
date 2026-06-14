import { fmtBDT, fmtDate } from '../../lib/helpers'

// A4 Night Audit (Manager's Day-End) report — prints a saved night_audits row.
export default function NightAuditReport({ audit, company }) {
  const s = audit?.summary || {}
  const revenue = s.revenue || {}
  const receipts = s.receipts || {}
  const totals = s.totals || { net: 0, sc: 0, sd: 0, vat: 0, total: 0 }
  const cell = { border: '1px solid #000', padding: '5px 8px', fontSize: 11 }
  const rt = { ...cell, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }
  const recTotal = s.recTotal != null ? s.recTotal : Object.values(receipts).reduce((a, v) => a + (+v || 0), 0)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#000' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid #1B4D2E', paddingBottom: 8, marginBottom: 12 }}>
        {company?.logo_url && <img src={company.logo_url} alt="" style={{ height: 50, width: 50, objectFit: 'contain' }} />}
        <div style={{ flex: 1, textAlign: company?.logo_url ? 'left' : 'center' }}>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: 'Fraunces, serif', color: '#1B4D2E' }}>{company?.name || 'Resort'}</div>
          <div style={{ fontSize: 10.5 }}>{company?.address}{company?.phone ? ` · ${company.phone}` : ''}</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, letterSpacing: 1, marginBottom: 4, textDecoration: 'underline' }}>NIGHT AUDIT — DAY-END REPORT</div>
      <table style={{ width: '100%', fontSize: 11, marginBottom: 10 }}>
        <tbody>
          <tr>
            <td><b>Audit date:</b> {fmtDate(audit.audit_date)}</td>
            <td style={{ textAlign: 'right' }}><b>Performed by:</b> {audit.performed_by || '—'}</td>
          </tr>
          <tr>
            <td><b>In-house at audit:</b> {s.inHouseCount != null ? s.inHouseCount : '—'}</td>
            <td style={{ textAlign: 'right' }}><b>Journal voucher:</b> {audit.jv_id ? 'Posted' : '—'}</td>
          </tr>
        </tbody>
      </table>

      {/* Revenue accrual */}
      <div style={{ fontSize: 12, fontWeight: 700, margin: '6px 0 4px' }}>A · Revenue posted (accrual)</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#eee' }}>
            <th style={cell}>Revenue head</th>
            <th style={{ ...cell, textAlign: 'right' }}>Net</th>
            <th style={{ ...cell, textAlign: 'right' }}>Service charge</th>
            <th style={{ ...cell, textAlign: 'right' }}>SD</th>
            <th style={{ ...cell, textAlign: 'right' }}>VAT</th>
            <th style={{ ...cell, textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(revenue).map(([k, r]) => (
            <tr key={k}>
              <td style={cell}>{k}</td>
              <td style={rt}>{fmtBDT(r.net)}</td>
              <td style={rt}>{fmtBDT(r.sc)}</td>
              <td style={rt}>{fmtBDT(r.sd)}</td>
              <td style={rt}>{fmtBDT(r.vat)}</td>
              <td style={rt}>{fmtBDT(r.total)}</td>
            </tr>
          ))}
          {Object.keys(revenue).length === 0 && <tr><td style={cell} colSpan={6}>No revenue posted on this date.</td></tr>}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
            <td style={cell}>TOTAL</td>
            <td style={rt}>{fmtBDT(totals.net)}</td>
            <td style={rt}>{fmtBDT(totals.sc)}</td>
            <td style={rt}>{fmtBDT(totals.sd)}</td>
            <td style={rt}>{fmtBDT(totals.vat)}</td>
            <td style={rt}>{fmtBDT(totals.total)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Receipts */}
      <div style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 4px' }}>B · Receipts collected (cash basis)</div>
      <table style={{ width: '60%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#eee' }}>
            <th style={cell}>Method</th>
            <th style={{ ...cell, textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(receipts).map(([m, v]) => (
            <tr key={m}><td style={cell}>{m}</td><td style={rt}>{fmtBDT(v)}</td></tr>
          ))}
          {Object.keys(receipts).length === 0 && <tr><td style={cell} colSpan={2}>No receipts on this date.</td></tr>}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
            <td style={cell}>TOTAL</td>
            <td style={rt}>{fmtBDT(recTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ fontSize: 10, marginTop: 10, color: '#444' }}>
        Note: Revenue is shown on an accrual basis (charges posted on the audit date); receipts are on a cash basis (money received on the audit date). The two need not be equal.
      </div>

      {/* Signatures */}
      <table style={{ width: '100%', marginTop: 44, fontSize: 11 }}>
        <tbody>
          <tr>
            <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: 6, textAlign: 'center' }}>Night Auditor<br /><span style={{ fontSize: 10 }}>{audit.performed_by || ''}</span></td>
            <td style={{ width: '10%' }}></td>
            <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: 6, textAlign: 'center' }}>Manager / Accounts</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
