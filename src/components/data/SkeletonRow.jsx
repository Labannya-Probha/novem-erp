/**
 * @param {{
 *   columnCount: number
 *   rows?: number
 * }} props
 */
export default function SkeletonRow({ columnCount, rows = 3 }) {
  return Array.from({ length: rows }).map((_, rowIndex) => (
    <tr key={`skeleton-row-${rowIndex}`} aria-hidden="true">
      {Array.from({ length: columnCount }).map((__, colIndex) => (
        <td key={`skeleton-cell-${rowIndex}-${colIndex}`} className="px-3 py-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </td>
      ))}
    </tr>
  ))
}
