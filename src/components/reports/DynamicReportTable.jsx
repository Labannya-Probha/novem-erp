import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Expand,
  GripVertical,
  Minimize2,
  RefreshCw,
  Rows3,
  TableProperties,
} from 'lucide-react'
import { fmtDate } from '../../lib/helpers'

const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

const comparisonColumns = [
  { key: 'currentPeriod', label: 'Current Period', type: 'currency', align: 'right', width: 160, total: true },
  { key: 'previousPeriod', label: 'Previous Period', type: 'currency', align: 'right', width: 160, total: true },
  { key: 'variance', label: 'Variance', type: 'currency', align: 'right', width: 140, total: true },
  { key: 'variancePercent', label: 'Variance %', type: 'percent', align: 'right', width: 120, total: false },
]

const metricKeyPriority = ['balance', 'netAmount', 'grossAmount', 'credit', 'debit']

const amountFormatter = (value, currency = 'BDT') => {
  const safeValue = Number(value || 0)
  const absoluteValue = Math.abs(safeValue)
  const formatted = absoluteValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return safeValue < 0 ? `(${currency} ${formatted})` : `${currency} ${formatted}`
}

function percentFormatter(value) {
  const safeValue = Number(value || 0)
  const absoluteValue = Math.abs(safeValue)
  const formatted = `${absoluteValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
  return safeValue < 0 ? `(${formatted})` : formatted
}

function statusTone(value) {
  const text = String(value || '').toLowerCase()
  if (/cancel|dirty|void|failed|overdue/.test(text)) return 'border-rose-200 bg-rose-50 text-rose-700'
  if (/pending|inspect|hold|draft/.test(text)) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (/complete|checked|bill|posted|transfer/.test(text)) return 'border-sky-200 bg-sky-50 text-sky-700'
  if (/clean|settled|confirm|approve|balanced|open/.test(text)) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function compareValues(a, b, direction) {
  const av = a ?? ''
  const bv = b ?? ''
  const result = typeof av === 'number' && typeof bv === 'number'
    ? av - bv
    : String(av).localeCompare(String(bv), undefined, { numeric: true })
  return direction === 'asc' ? result : -result
}

function inferMetricKey(columns = []) {
  return metricKeyPriority.find((key) => columns.some((column) => column.key === key)) || columns.find((column) => column.total)?.key || columns[0]?.key
}

function buildRowKey(row, fallbackIndex) {
  return [
    row.accountCode,
    row.accountName,
    row.description,
    row.documentNo,
    row.voucherNo,
    row.reservationNo,
    row.guestName,
    row.roomNo,
    fallbackIndex,
  ].filter(Boolean).join('|')
}

function formatValue(value, column, currency) {
  if (column.type === 'currency') return amountFormatter(value, currency)
  if (column.type === 'date') return fmtDate(value)
  if (column.type === 'percent') return percentFormatter(value)
  if (column.type === 'status') return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusTone(value)}`}>{value ?? '—'}</span>
  return value ?? '—'
}

export function calculateTotals(columns, rows) {
  return columns.reduce((acc, column) => {
    if (column.total) {
      acc[column.key] = rows.reduce((sum, row) => sum + Number(row[column.key] || 0), 0)
    }
    return acc
  }, {})
}

function downloadSelectedRows(report, columns, rows) {
  const header = columns.map((column) => column.label)
  const body = rows.map((row) => columns.map((column) => {
    const raw = row[column.key]
    if (column.type === 'currency') return Number(raw || 0).toFixed(2)
    if (column.type === 'percent') return `${Number(raw || 0).toFixed(2)}%`
    return raw ?? ''
  }))
  const csv = [header, ...body]
    .map((line) => line.map((cell) => {
      const value = String(cell ?? '')
      return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
    }).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${report.code || 'report'}-selected.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function DynamicReportTable({
  report,
  rows,
  comparisonRows = [],
  comparisonEnabled = false,
  onToggleComparison,
  currentPeriodLabel,
  previousPeriodLabel,
  currency = 'BDT',
  onRefresh,
  isRefreshing = false,
  bookmarked = false,
  onToggleBookmark,
  isFullscreen = false,
  onToggleFullscreen,
}) {
  const metricKey = useMemo(() => inferMetricKey(report.columns), [report.columns])
  const [sort, setSort] = useState(report.defaultSort || { key: metricKey, direction: 'desc' })
  const [page, setPage] = useState(1)
  const [density, setDensity] = useState('comfortable')
  const [groupBy, setGroupBy] = useState(report.grouping || 'none')
  const [freezeFirstColumn, setFreezeFirstColumn] = useState(true)
  const [selectedRowKeys, setSelectedRowKeys] = useState(() => new Set())
  const [columnChooserOpen, setColumnChooserOpen] = useState(false)
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(() => report.columns.map((column) => column.key))
  const [columnWidths, setColumnWidths] = useState(() => Object.fromEntries(
    [...report.columns, ...comparisonColumns].map((column) => [column.key, Number(column.width || 140)])
  ))
  const chooserRef = useRef(null)
  const resizeRef = useRef(null)

  useEffect(() => {
    setSort(report.defaultSort || { key: metricKey, direction: 'desc' })
    setGroupBy(report.grouping || 'none')
    setVisibleColumnKeys(report.columns.map((column) => column.key))
    setSelectedRowKeys(new Set())
    setPage(1)
  }, [report.code, report.columns, report.defaultSort, report.grouping, metricKey])

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!resizeRef.current) return
      const { key, startX, startWidth } = resizeRef.current
      setColumnWidths((current) => ({
        ...current,
        [key]: Math.max(96, startWidth + (event.clientX - startX)),
      }))
    }

    const handlePointerUp = () => {
      resizeRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (chooserRef.current && !chooserRef.current.contains(event.target)) {
        setColumnChooserOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const mergedRows = useMemo(() => {
    const currentMap = new Map(rows.map((row, index) => [buildRowKey(row, index), row]))
    const previousMap = new Map(comparisonRows.map((row, index) => [buildRowKey(row, index), row]))
    const orderedKeys = [...currentMap.keys(), ...previousMap.keys().filter((key) => !currentMap.has(key))]

    return orderedKeys.map((key, index) => {
      const currentRow = currentMap.get(key)
      const previousRow = previousMap.get(key)
      const sourceRow = currentRow || previousRow || {}
      const currentValue = Number(currentRow?.[metricKey] || 0)
      const previousValue = Number(previousRow?.[metricKey] || 0)
      const variance = currentValue - previousValue
      const variancePercent = previousValue ? (variance / Math.abs(previousValue)) * 100 : currentValue ? 100 : 0

      return {
        ...sourceRow,
        __rowKey: `${key}-${index}`,
        currentPeriod: currentValue,
        previousPeriod: previousValue,
        variance,
        variancePercent,
      }
    })
  }, [comparisonRows, metricKey, rows])

  const baseColumns = useMemo(
    () => report.columns.filter((column) => visibleColumnKeys.includes(column.key)),
    [report.columns, visibleColumnKeys]
  )

  const displayColumns = useMemo(
    () => baseColumns.concat(comparisonEnabled ? comparisonColumns : []),
    [baseColumns, comparisonEnabled]
  )

  const sortedRows = useMemo(() => {
    const sortable = [...mergedRows]
    sortable.sort((left, right) => compareValues(left[sort.key], right[sort.key], sort.direction))
    return sortable
  }, [mergedRows, sort])

  const totals = useMemo(() => calculateTotals(displayColumns, sortedRows), [displayColumns, sortedRows])
  const pageSize = density === 'compact' ? 16 : 12
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageRows = useMemo(
    () => sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [pageSize, safePage, sortedRows]
  )

  const groupedRows = useMemo(() => {
    if (!groupBy || groupBy === 'none') return { All: pageRows }
    return pageRows.reduce((accumulator, row) => {
      const key = row[groupBy] || 'Unassigned'
      if (!accumulator[key]) accumulator[key] = []
      accumulator[key].push(row)
      return accumulator
    }, {})
  }, [groupBy, pageRows])

  const pageRowKeys = pageRows.map((row) => row.__rowKey)
  const allPageRowsSelected = pageRowKeys.length > 0 && pageRowKeys.every((key) => selectedRowKeys.has(key))
  const firstVisibleColumnKey = displayColumns[0]?.key

  const toggleSort = (key) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const toggleColumn = (key) => {
    setVisibleColumnKeys((current) => (
      current.includes(key)
        ? current.filter((columnKey) => columnKey !== key)
        : report.columns.filter((column) => current.includes(column.key) || column.key === key).map((column) => column.key)
    ))
  }

  const toggleSelectAllPage = () => {
    setSelectedRowKeys((current) => {
      const next = new Set(current)
      if (allPageRowsSelected) {
        pageRowKeys.forEach((key) => next.delete(key))
      } else {
        pageRowKeys.forEach((key) => next.add(key))
      }
      return next
    })
  }

  const toggleRowSelection = (rowKey) => {
    setSelectedRowKeys((current) => {
      const next = new Set(current)
      if (next.has(rowKey)) next.delete(rowKey)
      else next.add(rowKey)
      return next
    })
  }

  const selectedRows = sortedRows.filter((row) => selectedRowKeys.has(row.__rowKey))

  const startResize = (key, event) => {
    resizeRef.current = {
      key,
      startX: event.clientX,
      startWidth: Number(columnWidths[key] || 140),
    }
  }

  const groupingOptions = useMemo(() => [
    { value: 'none', label: 'No Grouping' },
    ...report.columns
      .filter((column) => ['text', 'code', 'status'].includes(column.type))
      .map((column) => ({ value: column.key, label: column.label })),
  ], [report.columns])

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-700">
              <Rows3 className="size-4 text-slate-500" />
              <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)} className="bg-transparent outline-none">
                {groupingOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <div className="inline-flex h-10 items-center overflow-hidden rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`px-3 text-sm font-medium ${density === 'compact' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => setDensity('comfortable')}
                className={`px-3 text-sm font-medium ${density === 'comfortable' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}
              >
                Comfortable
              </button>
            </div>

            <button
              type="button"
              onClick={() => setFreezeFirstColumn((current) => !current)}
              className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition ${
                freezeFirstColumn ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <TableProperties className="size-4" />
              <span>Freeze First Column</span>
            </button>

            <div className="relative" ref={chooserRef}>
              <button
                type="button"
                onClick={() => setColumnChooserOpen((current) => !current)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Columns3 className="size-4" />
                <span>Column Chooser</span>
                <ChevronDown className="size-4" />
              </button>

              {columnChooserOpen ? (
                <div className="absolute left-0 top-12 z-40 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
                  <div className="grid gap-2">
                    {report.columns.map((column) => (
                      <label key={column.key} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={visibleColumnKeys.includes(column.key)}
                          onChange={() => toggleColumn(column.key)}
                          className="size-4 rounded border-slate-300"
                        />
                        <span>{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              disabled={!selectedRows.length}
              onClick={() => downloadSelectedRows(report, displayColumns, selectedRows)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="size-4" />
              <span>Export Selected</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-10 items-center gap-3 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={comparisonEnabled}
                onChange={onToggleComparison}
                className="size-4 rounded border-slate-300"
              />
              <span>Show Comparative Period</span>
            </label>
            <button
              type="button"
              onClick={onToggleBookmark}
              className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition ${
                bookmarked ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Bookmark className="size-4" />
              <span>Bookmark View</span>
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Expand className="size-4" />}
              <span>Fullscreen</span>
            </button>
          </div>
        </div>

        {comparisonEnabled ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1">{currentPeriodLabel}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{previousPeriodLabel}</span>
          </div>
        ) : null}
      </div>

      <div className="max-h-[720px] overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20 bg-white">
            <tr>
              <th className="sticky left-0 z-30 border-b border-slate-200 bg-white px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allPageRowsSelected}
                  onChange={toggleSelectAllPage}
                  className="size-4 rounded border-slate-300"
                />
              </th>
              {displayColumns.map((column) => {
                const isSticky = freezeFirstColumn && column.key === firstVisibleColumnKey
                const width = columnWidths[column.key] || column.width || 140
                return (
                  <th
                    key={column.key}
                    style={{ width, minWidth: width, left: isSticky ? 48 : undefined }}
                    className={`${alignClass[column.align] || 'text-left'} border-b border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 ${isSticky ? 'sticky z-20 shadow-[8px_0_16px_-16px_rgba(15,23,42,0.35)]' : ''}`}
                  >
                    <div className="group relative flex items-center gap-2">
                      <button type="button" onClick={() => toggleSort(column.key)} className="flex items-center gap-2">
                        <span>{column.label}</span>
                        <ChevronDown className={`size-4 transition ${sort.key === column.key && sort.direction === 'asc' ? 'rotate-180 text-slate-900' : 'text-slate-400'}`} />
                      </button>
                      <button
                        type="button"
                        onPointerDown={(event) => startResize(column.key, event)}
                        className="absolute -right-3 top-1/2 hidden -translate-y-1/2 cursor-col-resize rounded p-1 text-slate-300 group-hover:block"
                      >
                        <GripVertical className="size-4" />
                      </button>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedRows).map(([groupName, groupRows]) => (
              <Fragment key={groupName}>
                {groupBy !== 'none' ? (
                  <tr className="bg-slate-50">
                    <td colSpan={displayColumns.length + 1} className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                      {groupName}
                    </td>
                  </tr>
                ) : null}
                {groupRows.map((row) => (
                  <tr key={row.__rowKey} className="odd:bg-white even:bg-slate-50/50">
                    <td className={`sticky left-0 z-10 border-b border-slate-100 bg-inherit px-4 ${density === 'compact' ? 'py-2' : 'py-3'}`}>
                      <input
                        type="checkbox"
                        checked={selectedRowKeys.has(row.__rowKey)}
                        onChange={() => toggleRowSelection(row.__rowKey)}
                        className="size-4 rounded border-slate-300"
                      />
                    </td>
                    {displayColumns.map((column) => {
                      const isSticky = freezeFirstColumn && column.key === firstVisibleColumnKey
                      return (
                        <td
                          key={column.key}
                          style={{ width: columnWidths[column.key] || column.width || 140, minWidth: columnWidths[column.key] || column.width || 140, left: isSticky ? 48 : undefined }}
                          className={`${alignClass[column.align] || 'text-left'} border-b border-slate-100 px-4 text-slate-700 ${density === 'compact' ? 'py-2' : 'py-3'} ${isSticky ? 'sticky z-10 bg-inherit shadow-[8px_0_16px_-16px_rgba(15,23,42,0.35)]' : ''}`}
                        >
                          {formatValue(row[column.key], column, currency)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}

            {!pageRows.length ? (
              <tr>
                <td colSpan={displayColumns.length + 1} className="px-4 py-12 text-center text-sm text-slate-500">
                  No report rows match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr>
              <td className="sticky left-0 z-10 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                Total
              </td>
              {displayColumns.map((column, index) => (
                <td
                  key={column.key}
                  style={{ width: columnWidths[column.key] || column.width || 140, minWidth: columnWidths[column.key] || column.width || 140, left: freezeFirstColumn && column.key === firstVisibleColumnKey ? 48 : undefined }}
                  className={`${alignClass[column.align] || 'text-left'} border-t border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 ${freezeFirstColumn && column.key === firstVisibleColumnKey ? 'sticky z-10 bg-slate-50 shadow-[8px_0_16px_-16px_rgba(15,23,42,0.35)]' : ''}`}
                >
                  {index === 0 && !column.total ? 'Grand Total' : column.total ? formatValue(totals[column.key], column, currency) : '—'}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span>{sortedRows.length} rows</span>
          <span>{selectedRows.length} selected</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={safePage <= 1}
            className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-24 text-center text-sm font-medium text-slate-700">Page {safePage} of {pageCount}</span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            disabled={safePage >= pageCount}
            className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  )
}
