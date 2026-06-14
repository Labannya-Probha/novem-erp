import { fmtBDT, fmtDate } from '../../lib/helpers'

function NbrLogo({ url, size = 56 }) {
  if (url) return <img src={url} alt="NBR" style={{ height: size, width: size, objectFit: 'contain' }} />
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="NBR">
      <circle cx="50" cy="50" r="47" fill="#fff" stroke="#0a5c2b" strokeWidth="3" />
      <g fill="#0a5c2b">
        <path d="M50 30 C54 40 54 46 50 52 C46 46 46 40 50 30 Z" />
        <path d="M50 52 C58 48 64 44 70 44 C66 52 58 56 50 56 Z" />
        <path d="M50 52 C42 48 36 44 30 44 C34 52 42 56 50 56 Z" />
      </g>
      <text x="50" y="74" textAnchor="middle" fontSize="14" fontWeight="700" fill="#0a5c2b" fontFamily="serif">NBR</text>
    </svg>
  )
}

// মূসক-৬.৬ — উৎসে কর কর্তন সনদপত্র (NBR actual format)
export default function VdsCertificate({ cert, company }) {
  // ISSUED → আমরা (company) উৎসে কর্তনকারী সত্তা; party হলো সরবরাহকারী।
  // RECEIVED → অন্য পক্ষ আমাদের থেকে কর্তন করেছে; আমরা সরবরাহকারী, party কর্তনকারী।
  const issued = cert.direction === 'ISSUED'
  const withholder = issued
    ? { name: company?.legal_name || company?.name, bin: company?.bin, addr: company?.address }
    : { name: cert.party_name, bin: cert.party_bin, addr: '' }
  const supplier = issued
    ? { name: cert.party_name, bin: cert.party_bin }
    : { name: company?.legal_name || company?.name, bin: company?.bin }

  const cell = { border: '1px solid #000', padding: '5px 6px', fontSize: 10.5, verticalAlign: 'top' }
  const rt = { ...cell, textAlign: 'right', fontFamily: '"IBM Plex Mono", monospace' }
  const ct = { ...cell, textAlign: 'center' }
  const mono = { fontFamily: '"IBM Plex Mono", monospace' }
  const emptyRows = Array.from({ length: 4 })

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', color: '#000', fontSize: 11 }}>
      {/* Header: NBR logo on top, centered — then title block */}
      <div style={{ position: 'relative', textAlign: 'center', paddingTop: 4 }}>
        {/* company logo + form-code box: top-right corner */}
        <div style={{ position: 'absolute', top: 0, right: 0, textAlign: 'right' }}>
          {company?.logo_url && <img src={company.logo_url} alt="" style={{ height: 60, width: 60, objectFit: 'contain', display: 'block', marginLeft: 'auto', marginBottom: 4 }} />}
          <span style={{ display: 'inline-block', border: '1px solid #000', padding: '3px 10px', fontWeight: 700, fontSize: 12 }}>মূসক-৬.৬</span>
        </div>
        {/* NBR logo centered, above the government heading */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <NbrLogo url={company?.nbr_logo_url} size={60} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
        <div style={{ fontSize: 12, fontWeight: 700 }}>জাতীয় রাজস্ব বোর্ড</div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>উৎসে কর কর্তন সনদপত্র</div>
        <div style={{ fontSize: 9 }}>[বিধি ৪০ এর উপ-বিধি (১) এর দফা (চ) দ্রষ্টব্য]</div>
      </div>

      {/* Withholding entity block */}
      <div style={{ marginTop: 12, lineHeight: 1.9 }}>
        <div>উৎসে কর কর্তনকারী সত্তার নাম: <b>{withholder.name || '—'}</b></div>
        <div>উৎসে কর কর্তনকারী সত্তার ঠিকানা: <b>{withholder.addr || '—'}</b></div>
        <div>উৎসে কর কর্তনকারী সত্তার বিআইএন (প্রযোজ্য ক্ষেত্রে): <b style={mono}>{withholder.bin || '—'}</b></div>
        <table style={{ width: '100%', marginTop: 2 }}>
          <tbody>
            <tr>
              <td>উৎসে কর কর্তন সনদপত্র নং: <b style={mono}>{cert.cert_no || '—'}</b></td>
              <td style={{ textAlign: 'right' }}>জারির তারিখ: <b>{fmtDate(cert.cert_date)}</b></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Certification paragraph (sec. 49) */}
      <div style={{ marginTop: 8, border: '1px solid #000', padding: '8px 10px', fontSize: 10, lineHeight: 1.6, textAlign: 'justify' }}>
        এই মর্মে প্রত্যয়ন করা যাইতেছে যে, আইনের ধারা ৪৯ অনুযায়ী উৎসে কর কর্তনযোগ্য সরবরাহ হইতে প্রযোজ্য মূল্য সংযোজন কর বাবদ উৎসে কর কর্তন করা হইল।
        কর্তনকৃত মূল্য সংযোজন করের অর্থ বুক ট্রান্সফার/ট্রেজারি চালান/দাখিলপত্রে বৃদ্ধিকারী সমন্বয়ের মাধ্যমে সরকারি কোষাগারে জমা প্রদান করা হইয়াছে।
        কপি এতদসংগে সংযুক্ত করা হইল (প্রযোজ্য ক্ষেত্রে)।
      </div>

      {/* Main table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr style={{ background: '#eee' }}>
            <th style={ct} rowSpan={2}>ক্রমিক<br />নং</th>
            <th style={ct} colSpan={2}>সরবরাহকারীর</th>
            <th style={ct} colSpan={2}>সংশ্লিষ্ট কর চালানপত্র</th>
            <th style={ct} rowSpan={2}>মোট সরবরাহ<br />মূল্য¹ (টাকা)</th>
            <th style={ct} rowSpan={2}>মূসকের পরিমাণ<br />(টাকা)</th>
            <th style={ct} rowSpan={2}>উৎসে কর্তিত মূসকের<br />পরিমাণ (টাকা)</th>
          </tr>
          <tr style={{ background: '#eee' }}>
            <th style={ct}>নাম</th>
            <th style={ct}>বিআইএন</th>
            <th style={ct}>নম্বর</th>
            <th style={ct}>ইস্যুর তারিখ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={ct}>১</td>
            <td style={cell}>{supplier.name || '—'}</td>
            <td style={{ ...cell, ...mono }}>{supplier.bin || '—'}</td>
            <td style={{ ...cell, ...mono }}>{cert.challan_no || '—'}</td>
            <td style={ct}>{cert.challan_date ? fmtDate(cert.challan_date) : '—'}</td>
            <td style={rt}>{fmtBDT(cert.base_amount)}</td>
            <td style={rt}>{fmtBDT((+cert.base_amount * (+cert.vds_rate || 0) / 100).toFixed(2))}</td>
            <td style={rt}>{fmtBDT(cert.vds_amount)}</td>
          </tr>
          {emptyRows.map((_, i) => (
            <tr key={i}>
              <td style={ct}>{i + 2}</td>
              <td style={cell}>&nbsp;</td><td style={cell}></td><td style={cell}></td><td style={cell}></td>
              <td style={rt}></td><td style={rt}></td><td style={rt}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Authorised officer */}
      <div style={{ marginTop: 26, lineHeight: 2.2 }}>
        ক্ষমতাপ্রাপ্ত কর্মকর্তার -
        <div>স্বাক্ষর: ____________________________</div>
        <div>নাম: {issued ? (cert.officer_name || '____________________________') : '____________________________'}</div>
      </div>

      <div style={{ borderTop: '1px solid #000', marginTop: 18, paddingTop: 4, fontSize: 9 }}>
        ¹ মূসক ও সম্পূরক শুল্ক যদি থাকে সহ মূল্য
      </div>
    </div>
  )
}
