import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent } from 'src/components/ui/card'
import { cn } from 'src/lib/utils'

/**
 * @typedef {Object} KpiItem
 * @property {string} label
 * @property {string|number} value
 * @property {'up'|'down'|'neutral'|string|number} [trend]
 * @property {import('react').ComponentType<{className?: string}>} [icon]
 * @property {boolean} [loading]
 */

/**
 * @param {{
 *   items: KpiItem[]
 *   loading?: boolean
 *   className?: string
 * }} props
 */
export default function KpiStrip({ items = [], loading = false, className }) {
  if (!items.length) return null

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {items.map((item, index) => {
        const Icon = item.icon
        const isLoading = loading || item.loading
        const trendText = item.trend === undefined || item.trend === null ? null : String(item.trend)
        const trendLower = trendText?.toLowerCase() || ''
        const TrendIcon = trendLower === 'up' ? TrendingUp : trendLower === 'down' ? TrendingDown : null

        return (
          <Card key={`${item.label}-${index}`} size="sm">
            <CardContent className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-foreground" aria-busy={isLoading}>
                  {isLoading ? '—' : item.value}
                </p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                {TrendIcon ? <TrendIcon className="size-4" aria-hidden="true" /> : null}
                {trendText ? (
                  <span className={cn('text-xs', trendLower === 'down' ? 'text-destructive' : trendLower === 'up' ? 'text-emerald-700' : '')}>
                    {trendText}
                  </span>
                ) : null}
                {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
