import { Button } from 'src/components/ui/button'

/**
 * @param {{
 *   icon?: import('react').ComponentType<{className?: string}>
 *   title: string
 *   description?: string
 *   action?: { label: string, onClick: () => void, disabled?: boolean }
 *   className?: string
 * }} props
 */
export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={className} role="status" aria-live="polite">
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
        {Icon ? <Icon className="mb-2 size-6 text-muted-foreground" aria-hidden="true" /> : null}
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
        {action ? (
          <Button className="mt-4" variant="outline" onClick={action.onClick} disabled={action.disabled}>
            {action.label}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
