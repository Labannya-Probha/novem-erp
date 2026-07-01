import EnterpriseReportHeader from './EnterpriseReportHeader'
import EnterpriseReportFooter from './EnterpriseReportFooter'
import { fmtBDT, fmtDate } from '../../lib/helpers'

const filterLabels = {
  dateFrom: 'Date From',
  dateTo: 'Date To',
  property: 'Property',
  outlet: 'Outlet',
  department: 'Department',
  costCenter: 'Cost Center',
  roomType: 'Room Type',
  guestType: 'Guest Type',
  reservationSource: 'Source',
  paymentMethod: 'Payment',
  status: 'Status',
  user: 'User',
  currency: 'Currency',
}

function formatValue(value, column) {
  if (column.type === 'currency') return fmtBDT(value)
  if (column.type === 'date') return fmtDate(value)
  if (column.type === 'percent') return `${Number(value || 0).toFixed(2)}%`
  if (column.type === 'status') return <span className={`erp-status-pill ${statusTone(value)}`}>{value ?? '-'}</span>
  return value ?? ''
}

function statusTone(value) {
  const text = String(value || '').toLowerCase()
  if (/cancel|dirty|void|failed|overdue/.test(text)) return 'danger'
  if (/pending|inspect|hold|draft/.test(text)) return 'warning'
  if (/complete|checked|bill|posted|transfer/.test(text)) return 'info'
  if (/clean|settled|confirm|approve|balanced|open/.test(text)) return 'success'
  return 'neutral'
}

function printTotals(columns, rows) {
  return columns.reduce((acc, column) => {
    if (column.total) acc[column.key] = rows.reduce((sum, row) => sum + Number(row[column.key] || 0), 0)
    return acc
  }, {})
}

export default function ReportPrintDocument({ company, report, filters, rows, generatedBy }) {
  const totals = printTotals(report.columns, rows)
  const totalColumnWidth = report.columns.reduce((sum, column) => sum + Number(column?.width || 120), 0)
  const visibleFilters = Object.entries(filters).filter(([key, value]) => {
    if (!value) return false
    if (key === 'dateFrom' || key === 'dateTo') return false
    if (String(value).startsWith('All ')) return false
    return key !== 'currency'
  })

  return (
    <div className="enterprise-print-doc">
      <EnterpriseReportHeader company={company} report={report} filters={filters} generatedBy={generatedBy} />
      {visibleFilters.length > 0 && (
        <div className="erp-print-filter-summary">
          {visibleFilters.map(([key, value]) => (
            <span key={key}>{filterLabels[key] || key}: <b>{value}</b></span>
          ))}
        </div>
      )}
      <table className="erp-print-table">
        <thead>
          <tr>
            {report.columns.map((column) => (
              <th
                key={column.key}
                style={{
                  textAlign: column.align || 'left',
                  width: totalColumnWidth ? `${((Number(column?.width || 120) / totalColumnWidth) * 100).toFixed(2)}%` : undefined,
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.documentNo || row.slNo}-${index}`}>
              {report.columns.map((column) => (
                <td key={column.key} style={{ textAlign: column.align || 'left' }}>
                  {formatValue(row[column.key], column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            {report.columns.map((column, index) => (
              <td key={column.key} style={{ textAlign: column.align || 'left' }}>
                {index === 0 ? 'Grand Total' : column.total ? formatValue(totals[column.key], column) : ''}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      <EnterpriseReportFooter printedBy={generatedBy} />
    </div>
  )
}
