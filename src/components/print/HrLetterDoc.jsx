import { fmtBDT, fmtDate } from '../../lib/helpers'

/* ─────────────────────────────────────────────────────────────
   HR LETTER DOCUMENT — All standard HR application formats
   Rendered inside PrintPortal for A4 printing.
   ───────────────────────────────────────────────────────────── */

const primary   = 'var(--print-primary, #1B4D2E)'
const accent    = 'var(--print-accent,  #2E7D32)'
const lineColor = 'rgba(27,77,46,0.22)'
const soft      = 'rgba(46,125,50,0.07)'

/* Shared styles */
const pageStyle  = { maxWidth: '186mm', margin: '0 auto', color: '#000', fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.6 }
const hdrStyle   = { display: 'flex', alignItems: 'center', gap: 12, borderBottom: `2px solid ${primary}`, paddingBottom: 8, marginBottom: 16 }
const titleStyle = { textAlign: 'center', fontSize: 15, fontWeight: 700, letterSpacing: 1, marginBottom: 14, textDecoration: 'underline', color: primary }
const paraStyle  = { marginBottom: 10, textAlign: 'justify' }
const sigBlock   = {
  display: 'flex', justifyContent: 'space-between',
  marginTop: 48, fontSize: 11,
}
const sigCell    = { width: '42%', textAlign: 'center' }
const sigLine    = { borderTop: `1px solid #000`, paddingTop: 4 }

function Header({ company }) {
  return (
    <div style={hdrStyle}>
      {company?.logo_url && <img src={company.logo_url} alt="" style={{ height: 52, width: 52, objectFit: 'contain' }} />}
      <div style={{ flex: 1, textAlign: company?.logo_url ? 'left' : 'center' }}>
        <div style={{ fontSize: 19, fontWeight: 700, color: primary }}>{company?.name || 'Resort'}</div>
        <div style={{ fontSize: 10.5 }}>{company?.address}{company?.phone ? ` · ${company.phone}` : ''}{company?.email ? ` · ${company.email}` : ''}</div>
        {company?.bin && <div style={{ fontSize: 10 }}>BIN: {company.bin}</div>}
      </div>
    </div>
  )
}

function Footer({ company }) {
  if (!company?.invoice_footer) return null
  return <div style={{ textAlign: 'center', fontSize: 10, marginTop: 20, color: '#555', borderTop: `1px solid ${lineColor}`, paddingTop: 6 }}>{company.invoice_footer}</div>
}

/* ──────────────────────────────────────────────────────────────
   1. APPOINTMENT LETTER
   ────────────────────────────────────────────────────────────── */
function AppointmentLetter({ employee, extra, company, date }) {
  return (
    <div style={pageStyle}>
      <Header company={company} />
      <div style={{ fontSize: 11, marginBottom: 8 }}>Date: {fmtDate(date)}</div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>To,</div>
        <div>{employee.full_name}</div>
        {employee.address && <div style={{ whiteSpace: 'pre-line' }}>{employee.address}</div>}
      </div>
      <div style={titleStyle}>APPOINTMENT LETTER</div>
      <p style={paraStyle}>Dear <b>{employee.full_name}</b>,</p>
      <p style={paraStyle}>
        With reference to your application and subsequent interview, we are pleased to appoint you as <b>{employee.designation || extra.designation || '_______________'}</b> in the <b>{employee.department || extra.department || '_______________'}</b> department of <b>{company?.name || 'the company'}</b>, with effect from <b>{fmtDate(extra.joiningDate || employee.join_date)}</b>.
      </p>
      <p style={paraStyle}>Your terms and conditions of employment are as follows:</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 11 }}>
        <tbody>
          <tr style={{ background: soft }}><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Gross Monthly Salary</td><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{fmtBDT(employee.gross_salary)}</td></tr>
          <tr><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Designation</td><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{employee.designation || extra.designation || '—'}</td></tr>
          <tr style={{ background: soft }}><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Department</td><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{employee.department || extra.department || '—'}</td></tr>
          <tr><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Date of Joining</td><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{fmtDate(extra.joiningDate || employee.join_date)}</td></tr>
          <tr style={{ background: soft }}><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Probation Period</td><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{extra.probation || '3 months'}</td></tr>
        </tbody>
      </table>
      <p style={paraStyle}>You are expected to maintain the highest standards of professionalism, confidentiality, and discipline during the course of your employment. This appointment is subject to your satisfactory completion of the probation period and is governed by the service rules of {company?.name || 'the organization'}.</p>
      <p style={paraStyle}>Please sign and return the duplicate copy of this letter as acknowledgement of your acceptance of the above terms.</p>
      <p style={{ ...paraStyle, marginTop: 16 }}>We welcome you to the team and wish you a rewarding career with us.</p>
      <div style={sigBlock}>
        <div style={sigCell}>
          <div style={sigLine}>Employee Signature &amp; Date</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>{employee.full_name}</div>
        </div>
        <div style={sigCell}>
          <div style={sigLine}>For {company?.legal_name || company?.name || 'the company'}</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>Authorised Signatory</div>
        </div>
      </div>
      <Footer company={company} />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
   2. SALARY CERTIFICATE
   ────────────────────────────────────────────────────────────── */
function SalaryCertificate({ employee, extra, company, date }) {
  return (
    <div style={pageStyle}>
      <Header company={company} />
      <div style={{ fontSize: 11, textAlign: 'right', marginBottom: 8 }}>Date: {fmtDate(date)}</div>
      <div style={titleStyle}>SALARY CERTIFICATE</div>
      <p style={paraStyle}>To Whom It May Concern,</p>
      <p style={paraStyle}>
        This is to certify that <b>{employee.full_name}</b> bearing Employee Code <b>{employee.emp_code}</b> is employed as <b>{employee.designation || '—'}</b> in the <b>{employee.department || '—'}</b> department of <b>{company?.name || 'our organization'}</b> since <b>{fmtDate(employee.join_date)}</b>.
      </p>
      <p style={paraStyle}>The gross monthly salary details are as follows:</p>
      <table style={{ width: '70%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 11 }}>
        <tbody>
          <tr style={{ background: soft }}><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Gross Monthly Salary</td><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, textAlign: 'right', fontFamily: 'monospace' }}>{fmtBDT(employee.gross_salary)}</td></tr>
          {extra.showBreakdown && <>
            <tr><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>Basic (48%)</td><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, textAlign: 'right', fontFamily: 'monospace' }}>{fmtBDT((+employee.gross_salary * 0.48).toFixed(2))}</td></tr>
            <tr style={{ background: soft }}><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>House Rent (50% of Basic)</td><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, textAlign: 'right', fontFamily: 'monospace' }}>{fmtBDT((+employee.gross_salary * 0.48 * 0.50).toFixed(2))}</td></tr>
            <tr><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>Transportation (35% of Basic)</td><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, textAlign: 'right', fontFamily: 'monospace' }}>{fmtBDT((+employee.gross_salary * 0.48 * 0.35).toFixed(2))}</td></tr>
            <tr style={{ background: soft }}><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>Medical (20% of Basic)</td><td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, textAlign: 'right', fontFamily: 'monospace' }}>{fmtBDT((+employee.gross_salary * 0.48 * 0.20).toFixed(2))}</td></tr>
          </>}
        </tbody>
      </table>
      <p style={paraStyle}>This certificate is issued on request of the employee for {extra.purpose || 'official / personal purpose'} and is valid for the period mentioned above.</p>
      <p style={paraStyle}>We wish him/her all the best in his/her endeavours.</p>
      <div style={sigBlock}>
        <div style={{ ...sigCell, textAlign: 'left' }}></div>
        <div style={sigCell}>
          <div style={sigLine}>For {company?.legal_name || company?.name || 'the company'}</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>HR Manager / Authorised Signatory</div>
        </div>
      </div>
      <Footer company={company} />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
   3. EXPERIENCE CERTIFICATE
   ────────────────────────────────────────────────────────────── */
function ExperienceCertificate({ employee, extra, company, date }) {
  return (
    <div style={pageStyle}>
      <Header company={company} />
      <div style={{ fontSize: 11, textAlign: 'right', marginBottom: 8 }}>Date: {fmtDate(date)}</div>
      <div style={titleStyle}>EXPERIENCE CERTIFICATE</div>
      <p style={paraStyle}>To Whom It May Concern,</p>
      <p style={paraStyle}>
        This is to certify that <b>{employee.full_name}</b> was employed with <b>{company?.name || 'our organization'}</b> as <b>{employee.designation || '—'}</b> in the <b>{employee.department || '—'}</b> department from <b>{fmtDate(employee.join_date)}</b> to <b>{fmtDate(extra.lastWorkingDate)}</b>.
      </p>
      <p style={paraStyle}>
        During his/her tenure of approximately <b>{extra.tenure || '—'}</b>, {employee.full_name} was found to be a dedicated, hardworking, and responsible employee. He/She has demonstrated excellent {extra.skills || 'professional skills and a positive attitude towards work'}.
      </p>
      {extra.additionalNote && <p style={paraStyle}>{extra.additionalNote}</p>}
      <p style={paraStyle}>We wish him/her every success in future endeavours.</p>
      <div style={sigBlock}>
        <div style={{ ...sigCell, textAlign: 'left' }}></div>
        <div style={sigCell}>
          <div style={sigLine}>For {company?.legal_name || company?.name || 'the company'}</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>HR Manager / Authorised Signatory</div>
        </div>
      </div>
      <Footer company={company} />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
   4. RELIEVING LETTER
   ────────────────────────────────────────────────────────────── */
function RelievingLetter({ employee, extra, company, date }) {
  return (
    <div style={pageStyle}>
      <Header company={company} />
      <div style={{ fontSize: 11, marginBottom: 8 }}>Date: {fmtDate(date)}</div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>To,</div>
        <div>{employee.full_name}</div>
        <div>{employee.designation || '—'} – {employee.department || '—'}</div>
      </div>
      <div style={titleStyle}>RELIEVING LETTER</div>
      <p style={paraStyle}>Dear <b>{employee.full_name}</b>,</p>
      <p style={paraStyle}>
        This is with reference to your {extra.resignationType === 'TERMINATION' ? 'separation' : 'resignation'} from the position of <b>{employee.designation || '—'}</b> in the <b>{employee.department || '—'}</b> department. Your last working day with <b>{company?.name || 'the organization'}</b> was <b>{fmtDate(extra.lastWorkingDate)}</b>.
      </p>
      <p style={paraStyle}>We confirm that you have been relieved from your duties on <b>{fmtDate(extra.lastWorkingDate)}</b> after completing all required handover formalities. All dues have been settled as per company policy.</p>
      <p style={paraStyle}>We appreciate your contribution during your tenure and wish you all the best in your future endeavours.</p>
      <div style={sigBlock}>
        <div style={{ ...sigCell, textAlign: 'left' }}></div>
        <div style={sigCell}>
          <div style={sigLine}>For {company?.legal_name || company?.name || 'the company'}</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>HR Manager / Authorised Signatory</div>
        </div>
      </div>
      <Footer company={company} />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
   5. WARNING LETTER
   ────────────────────────────────────────────────────────────── */
function WarningLetter({ employee, extra, company, date }) {
  return (
    <div style={pageStyle}>
      <Header company={company} />
      <div style={{ fontSize: 11, marginBottom: 8 }}>Date: {fmtDate(date)}</div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>To,</div>
        <div>{employee.full_name}</div>
        <div>{employee.designation || '—'} – {employee.department || '—'}</div>
        <div>Employee Code: {employee.emp_code}</div>
      </div>
      <div style={titleStyle}>WARNING LETTER</div>
      <p style={paraStyle}>Dear <b>{employee.full_name}</b>,</p>
      <p style={paraStyle}>
        This letter is a formal warning to you regarding <b>{extra.subject || 'misconduct / unsatisfactory performance'}</b> that occurred on <b>{fmtDate(extra.incidentDate || date)}</b>.
      </p>
      <p style={paraStyle}>{extra.description || 'It has been observed that your conduct/performance is not in line with the standards and expectations of the organization. Details of the incident/issue are as stated above.'}</p>
      <p style={paraStyle}>
        This is your <b>{extra.warningNo || '1st'}</b> warning. We strongly advise you to immediately rectify your behaviour and ensure that such incidents do not recur in future. Please note that any further violation of company policies may result in more serious disciplinary action, including termination of employment.
      </p>
      <p style={paraStyle}>You are requested to acknowledge receipt of this letter by signing the copy enclosed herewith.</p>
      <div style={sigBlock}>
        <div style={sigCell}>
          <div style={sigLine}>Employee Acknowledgement</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>{employee.full_name} / Date</div>
        </div>
        <div style={sigCell}>
          <div style={sigLine}>For {company?.legal_name || company?.name || 'the company'}</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>HR Manager / Authorised Signatory</div>
        </div>
      </div>
      <Footer company={company} />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
   6. SHOW CAUSE NOTICE
   ────────────────────────────────────────────────────────────── */
function ShowCauseNotice({ employee, extra, company, date }) {
  return (
    <div style={pageStyle}>
      <Header company={company} />
      <div style={{ fontSize: 11, marginBottom: 8 }}>Date: {fmtDate(date)}</div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>To,</div>
        <div>{employee.full_name}</div>
        <div>{employee.designation || '—'} – {employee.department || '—'}</div>
        <div>Employee Code: {employee.emp_code}</div>
      </div>
      <div style={titleStyle}>SHOW CAUSE NOTICE</div>
      <p style={paraStyle}>Subject: <b>{extra.subject || 'Show Cause Notice regarding misconduct'}</b></p>
      <p style={paraStyle}>Dear <b>{employee.full_name}</b>,</p>
      <p style={paraStyle}>
        It has come to our attention that you have {extra.allegation || 'allegedly committed an act of misconduct / violation of company policy'} on <b>{fmtDate(extra.incidentDate || date)}</b>.
      </p>
      <p style={paraStyle}>{extra.details || 'Please provide details of the circumstances that led to this incident. The management needs to assess your conduct before deciding on any course of action.'}</p>
      <p style={paraStyle}>
        You are hereby directed to submit your written explanation / show cause within <b>{extra.replyDays || '48 hours'}</b> from the date of receipt of this notice, failing which the management will be constrained to take appropriate disciplinary action without further reference to you.
      </p>
      <p style={paraStyle}>Please treat this as urgent.</p>
      <div style={sigBlock}>
        <div style={sigCell}>
          <div style={sigLine}>Employee Acknowledgement</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>{employee.full_name} / Date &amp; Time</div>
        </div>
        <div style={sigCell}>
          <div style={sigLine}>For {company?.legal_name || company?.name || 'the company'}</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>HR Manager / Authorised Signatory</div>
        </div>
      </div>
      <Footer company={company} />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
   7. LEAVE APPLICATION
   ────────────────────────────────────────────────────────────── */
function LeaveApplication({ employee, extra, company, date }) {
  const days = extra.fromDate && extra.toDate
    ? Math.max(1, Math.round((new Date(extra.toDate) - new Date(extra.fromDate)) / 86400000) + 1)
    : '—'
  return (
    <div style={pageStyle}>
      <Header company={company} />
      <div style={{ fontSize: 11, textAlign: 'right', marginBottom: 8 }}>Date: {fmtDate(date)}</div>
      <div style={titleStyle}>LEAVE APPLICATION</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 11 }}>
        <tbody>
          <tr>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600, width: '35%' }}>Employee Name</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{employee.full_name}</td>
          </tr>
          <tr style={{ background: soft }}>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Employee Code</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{employee.emp_code}</td>
          </tr>
          <tr>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Designation</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{employee.designation || '—'}</td>
          </tr>
          <tr style={{ background: soft }}>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Department</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{employee.department || '—'}</td>
          </tr>
          <tr>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Type of Leave</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{extra.leaveType || '—'}</td>
          </tr>
          <tr style={{ background: soft }}>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>From Date</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{fmtDate(extra.fromDate)}</td>
          </tr>
          <tr>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>To Date</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{fmtDate(extra.toDate)}</td>
          </tr>
          <tr style={{ background: soft }}>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Number of Days</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontFamily: 'monospace', fontWeight: 700 }}>{days}</td>
          </tr>
          <tr>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Reason for Leave</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{extra.reason || '—'}</td>
          </tr>
          <tr style={{ background: soft }}>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Contact during Leave</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{employee.phone || extra.contactNo || '—'}</td>
          </tr>
          <tr>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Address during Leave</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{extra.addressDuringLeave || employee.address || '—'}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ ...paraStyle, fontSize: 11 }}>I hereby request you to kindly grant me leave as mentioned above. I undertake to resume duty on <b>{fmtDate(extra.resumeDate || extra.toDate)}</b>.</p>
      <div style={sigBlock}>
        <div style={sigCell}>
          <div style={sigLine}>Applicant Signature</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>{employee.full_name}</div>
        </div>
        <div style={sigCell}>
          <div style={sigLine}>Approved / Rejected By</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>HR Manager / Dept. Head</div>
        </div>
      </div>
      <div style={{ marginTop: 24, padding: '8px 12px', border: `1px solid ${lineColor}`, borderRadius: 4, fontSize: 11 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>HR Office Use Only</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          <div>Leave Balance (before): __________</div>
          <div>Leave Balance (after): __________</div>
          <div>Status: ☐ Approved &nbsp; ☐ Rejected &nbsp; ☐ Partially Approved</div>
          <div>Remarks: __________</div>
        </div>
      </div>
      <Footer company={company} />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
   8. JOINING REPORT
   ────────────────────────────────────────────────────────────── */
function JoiningReport({ employee, extra, company, date }) {
  return (
    <div style={pageStyle}>
      <Header company={company} />
      <div style={{ fontSize: 11, textAlign: 'right', marginBottom: 8 }}>Date: {fmtDate(date)}</div>
      <div style={titleStyle}>JOINING REPORT</div>
      <p style={paraStyle}>
        I, <b>{employee.full_name}</b>, hereby report my joining as <b>{employee.designation || extra.designation || '—'}</b> in the <b>{employee.department || extra.department || '—'}</b> department of <b>{company?.name || 'the organization'}</b> on <b>{fmtDate(extra.joiningDate || employee.join_date)}</b>.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 11 }}>
        <tbody>
          <tr style={{ background: soft }}>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600, width: '35%' }}>Full Name</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{employee.full_name}</td>
          </tr>
          <tr>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Employee Code</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{employee.emp_code}</td>
          </tr>
          <tr style={{ background: soft }}>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Designation</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{employee.designation || '—'}</td>
          </tr>
          <tr>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Department</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{employee.department || '—'}</td>
          </tr>
          <tr style={{ background: soft }}>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Date of Joining</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{fmtDate(extra.joiningDate || employee.join_date)}</td>
          </tr>
          <tr>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Gross Monthly Salary</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontFamily: 'monospace' }}>{fmtBDT(employee.gross_salary)}</td>
          </tr>
          <tr style={{ background: soft }}>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>Phone</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{employee.phone || '—'}</td>
          </tr>
          <tr>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}`, fontWeight: 600 }}>NID</td>
            <td style={{ padding: '5px 8px', border: `1px solid ${lineColor}` }}>{employee.nid || '—'}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ ...paraStyle, fontSize: 11 }}>I acknowledge that I have received a copy of the Appointment Letter, Company Policies, and the Service Rules of {company?.name || 'the organization'}, and I agree to abide by them.</p>
      <div style={sigBlock}>
        <div style={sigCell}>
          <div style={sigLine}>Employee Signature</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>{employee.full_name} / Date</div>
        </div>
        <div style={sigCell}>
          <div style={sigLine}>Received By (HR)</div>
          <div style={{ fontSize: 10, marginTop: 2 }}>Name &amp; Designation / Date</div>
        </div>
      </div>
      <Footer company={company} />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
   MAIN EXPORT — dispatch to the right template
   ────────────────────────────────────────────────────────────── */
export default function HrLetterDoc({ type, employee, extra, company, date }) {
  if (!employee) return null
  const props = { employee, extra: extra || {}, company, date }
  switch (type) {
    case 'APPOINTMENT':   return <AppointmentLetter    {...props} />
    case 'SALARY_CERT':   return <SalaryCertificate    {...props} />
    case 'EXP_CERT':      return <ExperienceCertificate {...props} />
    case 'RELIEVING':     return <RelievingLetter       {...props} />
    case 'WARNING':       return <WarningLetter         {...props} />
    case 'SHOW_CAUSE':    return <ShowCauseNotice       {...props} />
    case 'LEAVE_APP':     return <LeaveApplication      {...props} />
    case 'JOINING':       return <JoiningReport         {...props} />
    default:              return null
  }
}
