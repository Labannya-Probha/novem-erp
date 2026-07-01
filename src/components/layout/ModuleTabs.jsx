import { cn } from 'src/lib/utils'

/**
 * @typedef {Object} ModuleTab
 * @property {string} id
 * @property {string} label
 * @property {boolean} [hidden]
 * @property {boolean} [disabled]
 * @property {string|number} [badge]
 */

/**
 * @param {{
 *   tabs: ModuleTab[]
 *   activeTab?: string
 *   onChange?: (tabId: string) => void
 *   className?: string
 * }} props
 */
export default function ModuleTabs({ tabs = [], activeTab, onChange, className }) {
  const visibleTabs = tabs.filter((tab) => !tab.hidden)
  if (!visibleTabs.length) return null

  return (
    <div role="tablist" aria-label="Module tabs" className={cn('flex flex-wrap items-center gap-2', className)}>
      {visibleTabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`module-tab-panel-${tab.id}`}
            id={`module-tab-${tab.id}`}
            disabled={tab.disabled}
            onClick={() => onChange?.(tab.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[9px] border px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'border-[rgb(var(--tenant-primary-rgb)_/_0.35)] bg-secondary text-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
              tab.disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none">{tab.badge}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
