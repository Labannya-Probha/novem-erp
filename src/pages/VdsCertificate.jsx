import { fmtBDT, fmtDate, takaInWords } from '../lib/helpers'

function NbrLogo({ url, size = 54 }) {
  if (url) return <img src={url} alt="NBR" style={{ height: size, width: size, objectFit: 'contain' }} />
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="NBR">
      <circle cx="50" cy="50" r="47" fill="#fff" stroke="#0a5c2b" strokeWidth="3" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#0a5c2b" strokeWidth="1" />
      <g fill="#0a5c2b">
        <path d="M50 30 C54 40 54 46 50 52 C46 46 46 40 50 30 Z" />
        <path d="M50 52 C58 48 64 44 70 44 C66 52 58 56 50 56 Z" />
        <path d="M50 52 C42 48 36 44 30 44 C34 52 42 56 50 56 Z" />
      </g>
      <text x="50" y="74" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0a5c2b" fontFamily="serif">NBR</text>
    </svg>
  )
}

// মূসক-৬.৬ — উৎসে কর্তিত মূল্য সংযোজন কর সনদপত্র
export default function VdsCertificate({ cert, company }) {
  const issued = cert.direction === 'ISSUED'
  const deductor = issued
    ? { name: company?.legal_name || company?.name, bin: company?.bin, addr: company?.address }
    : { name: cert.party_name, bin: cert.party_bin, addr: '' }
  const deductee = issued
    ? { name: cert.party_name, bin: cert.party_bin, addr: '' }
    : { name: company?.legal_name || company?.name, bin: company?.bin, addr: company?.address }
  const b = { border: '1px solid #000', padding: '6px 8px', fontSize: 11, verticalAlign: 'top' }
  const lbl = { fontWeight: 700 }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#000' }}>
      {/* NBR logo (left) + title + company logo (right) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '2px solid #000', paddingBottom: 8, marginBottom: 10 }}>
        <NbrLogo url={company?.nbr_logo_url} size={56} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
          <div style={{ fontSize: 11 }}>জাতীয় রাজস্ব বোর্ড · National Board of Revenue</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3 }}>উৎসে কর্তিত মূল্য সংযোজন কর সনদপত্র</div>
          <div style={{ fontSize: 10.5 }}>Certificate of VAT Deduction at Source — মূসক-৬.৬</div>
        </div>
        {company?.logo_url
          ? <img src={company.logo_url} alt="" style={{ height: 50, width: 50, objectFit: 'contain' }} />
          : <div style={{ width: 56 }} />}
      </div>
      <div style={{ textAlign: 'center', fontSize: 9, marginBottom: 8 }}>[বিধি ৪০ এর উপ-বিধি (৫) দ্রষ্টব্য]</div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr>
            <td style={b}><span style={lbl}>সনদপত্র নং (Certificate No.):</span> {cert.cert_no || '—'}</td>
            <td style={b}><span style={lbl}>তারিখ (Date):</span> {fmtDate(cert.cert_date)}</td>
          </tr>
          <tr>
            <td style={b} colSpan={2}>
              <div style={lbl}>১। উৎসে কর্তনকারী সত্তার নাম ও ঠিকানা (Withholding entity):</div>
              {deductor.name || '—'}{deductor.addr ? `, ${deductor.addr}` : ''}<br />
              <span style={lbl}>বিআইএন (BIN):</span> <span style={{ fontFamily: '"IBM Plex Mono", monospace' }}>{deductor.bin || '—'}</span>
            </td>
          </tr>
          <tr>
            <td style={b} colSpan={2}>
              <div style={lbl}>২। যাহার নিকট হইতে কর্তন (Supplier):</div>
              {deductee.name || '—'}{deductee.addr ? `, ${deductee.addr}` : ''}<br />
              <span style={lbl}>বিআইএন (BIN):</span> <span style={{ fontFamily: '"IBM Plex Mono", monospace' }}>{deductee.bin || '—'}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#eee' }}>
            <th style={b}>৩। সরবরাহের বিবরণ (Description)</th>
            <th style={{ ...b, textAlign: 'right' }}>৪। সরবরাহ মূল্য (Value)</th>
            <th style={{ ...b, textAlign: 'right' }}>৫। হার (Rate)</th>
            <th style={{ ...b, textAlign: 'right' }}>৬। কর্তিত মূসক (VAT deducted)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={b}>{cert.description || 'Supply of goods / services'}</td>
            <td style={{ ...b, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }}>{fmtBDT(cert.base_amount)}</td>
            <td style={{ ...b, textAlign: 'right' }}>{Number(cert.vds_rate || 0).toFixed(1)}%</td>
            <td style={{ ...b, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }}>{fmtBDT(cert.vds_amount)}</td>
          </tr>
          <tr>
            <td style={{ ...b, fontWeight: 700, textAlign: 'right' }} colSpan={3}>সর্বমোট (Total VAT deducted)</td>
            <td style={{ ...b, textAlign: 'right', fontWeight: 700, fontFamily: '"IBM Plex Mono", monospace' }}>{fmtBDT(cert.vds_amount)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ fontSize: 10.5, marginTop: 6 }}><b>কথায় (In words):</b> {takaInWords(cert.vds_amount)}</div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <tbody>
          <tr>
            <td style={b}><span style={lbl}>৭। ট্রেজারি চালান নং (Treasury challan):</span> {cert.challan_no || '—'}</td>
            <td style={b}><span style={lbl}>চালান তারিখ (Date):</span> {cert.challan_date ? fmtDate(cert.challan_date) : '—'}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: 10, marginTop: 10, lineHeight: 1.5 }}>
        প্রত্যয়ন করা যাইতেছে যে, উপরে বর্ণিত মূসক উৎসে কর্তন করিয়া যথাযথভাবে সরকারি কোষাগারে জমা করা হইয়াছে।<br />
        <i>Certified that the VAT shown above has been deducted at source and duly deposited to the Government treasury.</i>
      </div>

      <table style={{ width: '100%', marginTop: 44, fontSize: 12 }}>
        <tbody>
          <tr>
            <td style={{ width: '55%' }}></td>
            <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: 6, textAlign: 'center' }}>
              উৎসে কর্তনকারী সত্তার স্বাক্ষর ও সিল<br />
              <span style={{ fontSize: 10 }}>Signature & seal of withholding entity</span><br />
              <span style={{ fontSize: 10 }}>{deductor.name || ''}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
