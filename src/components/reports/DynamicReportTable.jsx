import { Fragment, useMemo, useState } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { fmtBDT, fmtDate } from '../../lib/helpers'

const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
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

function compareValues(a, b, direction) {
  const av = a ?? ''
  const bv = b ?? ''
  const result = typeof av === 'number' && typeof bv === 'number'
    ? av - bv
    : String(av).localeCompare(String(bv), undefined, { numeric: true })
  return direction === 'asc' ? result : -result
}

export function calculateTotals(columns, rows) {
  return columns.reduce((acc, col) => {
    if (col.total) acc[col.key] = rows.reduce((sum, row) => sum + Number(row[col.key] || 0), 0)
    return acc
  }, {})
}

export default function DynamicReportTable({ report, rows, search, pageSize = 10 }) {
  const [sort, setSort] = useState(report.defaultSort || { key: 'transactionDate', direction: 'desc' })
  const [page, setPage] = useState(1)
  const columns = report.columns

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const matching = needle
      ? rows.filter((row) => columns.some((col) => String(row[col.key] ?? '').toLowerCase().includes(needle)))
      : rows
    const sorted = [...matching].sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.direction))
    return sorted
  }, [columns, rows, search, sort])

  const totals = useMemo(() => calculateTotals(columns, filteredRows), [columns, filteredRows])
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pagedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const grouped = report.grouping
    ? pagedRows.reduce((acc, row) => {
        const key = row[report.grouping] || 'Unassigned'
        if (!acc[key]) acc[key] = []
        acc[key].push(row)
        return acc
      }, {})
    : { '': pagedRows }

  const toggleSort = (key) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  return (
    <section className="erp-table-shell">
      <div className="erp-table-scroll">
        <table className="erp-report-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ minWidth: col.width }} className={alignClass[col.align] || 'text-left'}>
                  <button type="button" onClick={() => toggleSort(col.key)}>
                    {col.label}
                    <ArrowDownUp size={12} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([groupName, groupRows]) => (
              <Fragment key={groupName}>
                {report.grouping && (
                  <tr key={`${groupName}-group`} className="erp-group-row">
                    <td colSpan={columns.length}>{groupName}</td>
                  </tr>
                )}
                {groupRows.map((row, rowIndex) => (
                  <tr key={`${groupName}-${row.documentNo || row.slNo}-${rowIndex}`}>
                    {columns.map((col) => (
                      <td key={col.key} className={alignClass[col.align] || 'text-left'}>
                        {formatValue(row[col.key], col)}
                      </td>
                    ))}
                  </tr>
                ))}
                {report.grouping && (
                  <tr key={`${groupName}-subtotal`} className="erp-subtotal-row">
                    {columns.map((col, index) => (
                      <td key={col.key} className={alignClass[col.align] || 'text-left'}>
                        {index === 0
                          ? `${groupName} Subtotal`
                          : col.total
                            ? formatValue(groupRows.reduce((sum, row) => sum + Number(row[col.key] || 0), 0), col)
                            : ''}
                      </td>
                    ))}
                  </tr>
                )}
              </Fragment>
            ))}
            {filteredRows.length === 0 && (
              <tr><td colSpan={columns.length} className="text-center text-pine/55 py-8">No report rows match the current filters.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              {columns.map((col, index) => (
                <td key={col.key} className={alignClass[col.align] || 'text-left'}>
                  {index === 0 ? 'Grand Total' : col.total ? formatValue(totals[col.key], col) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="erp-pagination no-print">
        <span>{filteredRows.length} rows</span>
        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>Prev</button>
        <span>Page {safePage} of {pageCount}</span>
        <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={safePage >= pageCount}>Next</button>
      </div>
    </section>
  )
}
