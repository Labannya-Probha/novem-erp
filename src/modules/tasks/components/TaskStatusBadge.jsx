const STYLE = {
  OPEN:        'bg-sky-100 text-sky-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  DONE:        'bg-forest/15 text-forest',
  CANCELLED:   'bg-stone-200 text-stone-500',
}

export default function TaskStatusBadge({ status }) {
  return (
    <span className={`status-chip ${STYLE[status] || 'bg-pine/10 text-pine'}`}>
      {status?.replace('_', ' ')}
    </span>
  )
}
