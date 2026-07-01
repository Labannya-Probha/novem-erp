import { CONFIDENTIAL_NOTE } from '../../lib/reporting/reportConfig'

export default function EnterpriseReportFooter({ printedBy, pageLabel = 'Page 1 of 1' }) {
  return (
    <footer className="enterprise-report-footer">
      <div className="erp-footer-meta">
        <span>Aura Stay ERP · Confidential</span>
        <span>{pageLabel}</span>
      </div>
      <div className="erp-signatures">
        <span>Prepared by</span>
        <span>Reviewed by</span>
        <span>Approved by</span>
        <span>{printedBy ? `Printed by ${printedBy}` : CONFIDENTIAL_NOTE}</span>
      </div>
    </footer>
  )
}
