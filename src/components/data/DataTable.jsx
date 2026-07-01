import { ArrowDownUp } from 'lucide-react'
import { isValidElement } from 'react'
import { Button } from 'src/components/ui/button'
import EmptyState from './EmptyState'
import SkeletonRow from './SkeletonRow'
import { cn } from 'src/lib/utils'

/**
 * @typedef {Object} DataColumn
 * @property {string} key
 * @property {string|import('react').ReactNode} header
 * @property {boolean} [sortable]
 * @property {(row: Record<string, unknown>, rowIndex: number) => import('react').ReactNode} [render]
 * @property {string} [className]
 */

/**
 * @param {{
 *   columns: DataColumn[]
 *   data: Record<string, unknown>[]
 *   loading?: boolean
 *   emptyState?: import('react').ReactNode | { title: string, description?: string }
 *   rowActions?: (row: Record<string, unknown>, rowIndex: number) => import('react').ReactNode
 *   bulkActions?: {
 *     selectedRowIds?: string[]
 *     allSelected?: boolean
 *     onToggleAll?: (checked: boolean) => void
 *     onToggleRow?: (rowId: string, checked: boolean, row: Record<string, unknown>) => void
 *     getRowId?: (row: Record<string, unknown>, rowIndex: number) => string
 *     actions?: import('react').ReactNode
 *   }
 *   sort?: { key?: string, direction?: 'asc'|'desc' }
 *   onSortChange?: (next: { key: string, direction: 'asc'|'desc' }) => void
 *   pagination?: { page: number, pageSize: number, total: number, onPageChange?: (page: number) => void }
 *   className?: string
 * }} props
 */
export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  emptyState,
  rowActions,
  bulkActions,
  sort,
  onSortChange,
  pagination,
  className,
}) {
  const selectedIds = new Set(bulkActions?.selectedRowIds || [])
  const hasBulkActions = Boolean(bulkActions)
  const hasRowActions = Boolean(rowActions)
  const columnCount = columns.length + (hasBulkActions ? 1 : 0) + (hasRowActions ? 1 : 0)

  const toggleSort = (key) => {
    if (!onSortChange) return
    const nextDirection = sort?.key === key && sort?.direction === 'asc' ? 'desc' : 'asc'
    onSortChange({ key, direction: nextDirection })
  }

  return (
    <div className={cn('space-y-3', className)}>
      {hasBulkActions && bulkActions?.actions ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
          <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">{bulkActions.actions}</div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left">
            <tr>
              {hasBulkActions ? (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={Boolean(bulkActions?.allSelected)}
                    onChange={(event) => bulkActions?.onToggleAll?.(event.target.checked)}
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2 font-medium text-foreground">
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      aria-label={`Sort by ${String(column.header)}`}
                    >
                      {column.header}
                      <ArrowDownUp className="size-3.5" />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
              {hasRowActions ? <th className="w-20 px-3 py-2 text-right font-medium">Actions</th> : null}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <SkeletonRow columnCount={columnCount} rows={4} />
            ) : data.length ? (
              data.map((row, rowIndex) => {
                const rowId = bulkActions?.getRowId?.(row, rowIndex) || String(row.id || rowIndex)
                return (
                  <tr key={rowId} className="border-b border-border/50 last:border-none">
                    {hasBulkActions ? (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Select row ${rowIndex + 1}`}
                          checked={selectedIds.has(rowId)}
                          onChange={(event) => bulkActions?.onToggleRow?.(rowId, event.target.checked, row)}
                        />
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td key={column.key} className={cn('px-3 py-2 text-muted-foreground', column.className)}>
                        {column.render ? column.render(row, rowIndex) : row[column.key] ?? '—'}
                      </td>
                    ))}
                    {hasRowActions ? <td className="px-3 py-2 text-right">{rowActions?.(row, rowIndex)}</td> : null}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={columnCount} className="px-3 py-10">
                  {isValidElement(emptyState) ? (
                    emptyState
                  ) : (
                    <EmptyState
                      title={emptyState?.title || 'No data found'}
                      description={emptyState?.description || 'Try changing filters or creating a new record.'}
                    />
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} • {pagination.total} rows
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => pagination.onPageChange?.(Math.max(1, pagination.page - 1))}
              disabled={pagination.page <= 1}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => pagination.onPageChange?.(pagination.page + 1)}
              disabled={pagination.page * pagination.pageSize >= pagination.total}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
