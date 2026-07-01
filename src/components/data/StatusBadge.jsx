import { Badge } from 'src/components/ui/badge'
import { cn } from 'src/lib/utils'

const STATUS_MAP = {
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-700',
  checked_in: 'border-sky-200 bg-sky-50 text-sky-700',
  checked_out: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  due: 'border-orange-200 bg-orange-50 text-orange-700',
  draft: 'border-slate-200 bg-slate-50 text-slate-700',
  approved: 'border-teal-200 bg-teal-50 text-teal-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  posted: 'border-violet-200 bg-violet-50 text-violet-700',
  void: 'border-zinc-200 bg-zinc-100 text-zinc-700',
}

/**
 * @param {{
 *   status: string
 *   className?: string
 * }} props
 */
export default function StatusBadge({ status, className }) {
  const normalized = String(status || '').trim().toLowerCase().replace(/\s+/g, '_')
  const label = normalized ? normalized.replaceAll('_', ' ') : 'unknown'

  return (
    <Badge variant="outline" className={cn('capitalize', STATUS_MAP[normalized] || 'border-border bg-muted/50 text-foreground', className)}>
      {label}
    </Badge>
  )
}
