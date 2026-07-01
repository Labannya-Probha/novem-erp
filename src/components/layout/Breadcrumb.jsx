import { ChevronRight } from 'lucide-react'
import { cn } from 'src/lib/utils'

/**
 * @typedef {Object} BreadcrumbItem
 * @property {string} label
 * @property {string} [href]
 * @property {() => void} [onClick]
 * @property {boolean} [current]
 */

/**
 * @param {{
 *   items: BreadcrumbItem[]
 *   className?: string
 *   ariaLabel?: string
 * }} props
 */
export default function Breadcrumb({ items = [], className, ariaLabel = 'Breadcrumb' }) {
  if (!items.length) return null

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground sm:text-sm">
        {items.map((item, index) => {
          const isCurrent = item.current ?? index === items.length - 1
          const key = `${item.label}-${index}`

          return (
            <li key={key} className="inline-flex items-center gap-1">
              {index > 0 && <ChevronRight className="size-3.5" aria-hidden="true" />}
              {item.href ? (
                <a href={item.href} className="hover:text-foreground focus-visible:underline" aria-current={isCurrent ? 'page' : undefined}>
                  {item.label}
                </a>
              ) : item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className={cn('hover:text-foreground focus-visible:underline', isCurrent && 'text-foreground')}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  {item.label}
                </button>
              ) : (
                <span className={cn(isCurrent && 'font-medium text-foreground')} aria-current={isCurrent ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
