import { Button } from '../../../components/ui/button'

export default function QuickActions({ actions = [] }) {
  if (!actions.length) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant={action.variant || 'outline'}
          size="sm"
          onClick={action.onClick}
          type="button"
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
}
