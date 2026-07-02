import EmptyState from '../../../components/data/EmptyState'
import { cn } from '../../../lib/utils'

export default function ReservationTimeline({ items = [], emptyTitle = 'No reservation history yet', emptyDescription = 'Audit events will appear here during the migration.' }) {
  if (!items.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <ol className="space-y-4">
      {items.map((item, index) => (
        <li key={item.id || `${item.title}-${index}`} className="relative pl-6">
          <span className="absolute left-0 top-2 size-2 rounded-full bg-[rgb(var(--tenant-primary-rgb)_/_0.9)]" aria-hidden="true" />
          {index < items.length - 1 ? (
            <span className="absolute left-[3px] top-4 h-full w-px bg-border" aria-hidden="true" />
          ) : null}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{item.title}</p>
                {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {item.timestamp ? <div>{item.timestamp}</div> : null}
                {item.actor ? <div className={cn(item.timestamp ? 'mt-1' : '')}>{item.actor}</div> : null}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
