import { Button } from 'src/components/ui/button'
import { cn } from 'src/lib/utils'

/**
 * @typedef {Object} WizardStep
 * @property {string} id
 * @property {string} label
 * @property {string} [description]
 * @property {boolean} [disabled]
 * @property {boolean} [hidden]
 */

/**
 * @param {{
 *   steps: WizardStep[]
 *   activeStep: string
 *   onStepChange?: (stepId: string) => void
 *   onNext?: () => void
 *   onPrevious?: () => void
 *   onFinish?: () => void
 *   children?: import('react').ReactNode
 *   className?: string
 * }} props
 */
export default function StepWizard({
  steps = [],
  activeStep,
  onStepChange,
  onNext,
  onPrevious,
  onFinish,
  children,
  className,
}) {
  const visibleSteps = steps.filter((step) => !step.hidden)
  const activeIndex = Math.max(0, visibleSteps.findIndex((step) => step.id === activeStep))
  const isLastStep = activeIndex >= visibleSteps.length - 1

  if (!visibleSteps.length) return null

  return (
    <section className={cn('space-y-4 rounded-xl border border-border bg-card p-4', className)} aria-label="Step wizard">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {visibleSteps.map((step, index) => {
          const isActive = step.id === activeStep
          const isComplete = index < activeIndex

          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onStepChange?.(step.id)}
                disabled={step.disabled}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                  isActive
                    ? 'border-[rgb(var(--tenant-primary-rgb)_/_0.35)] bg-secondary'
                    : 'border-border bg-background hover:bg-muted/50',
                  step.disabled && 'cursor-not-allowed opacity-50'
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                <p className="text-xs text-muted-foreground">Step {index + 1}</p>
                <p className="text-sm font-medium text-foreground">{step.label}</p>
                {step.description ? <p className="text-xs text-muted-foreground">{step.description}</p> : null}
                {isComplete ? <span className="sr-only">Completed</span> : null}
              </button>
            </li>
          )
        })}
      </ol>

      {children ? <div>{children}</div> : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button size="sm" variant="outline" onClick={onPrevious} disabled={activeIndex <= 0}>
          Previous
        </Button>
        {isLastStep ? (
          <Button size="sm" onClick={onFinish}>Finish</Button>
        ) : (
          <Button size="sm" onClick={onNext}>Next</Button>
        )}
      </div>
    </section>
  )
}
