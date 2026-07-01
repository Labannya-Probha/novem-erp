import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from 'src/components/ui/button'
import { Input } from 'src/components/ui/input'
import { cn } from 'src/lib/utils'

/**
 * @typedef {Object} FilterField
 * @property {string} key
 * @property {string} label
 * @property {'text'|'number'|'date'|'select'|'checkbox'} [type]
 * @property {string} [placeholder]
 * @property {{label: string, value: string|number}[]} [options]
 */

/**
 * @param {{
 *   fields: FilterField[]
 *   value: Record<string, unknown>
 *   onChange?: (nextValue: Record<string, unknown>) => void
 *   onReset?: () => void
 *   collapsible?: boolean
 *   defaultOpen?: boolean
 *   className?: string
 * }} props
 */
export default function FilterPanel({
  fields = [],
  value = {},
  onChange,
  onReset,
  collapsible = true,
  defaultOpen = true,
  className,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const updateField = (key, nextFieldValue) => {
    onChange?.({ ...value, [key]: nextFieldValue })
  }

  return (
    <section className={cn('rounded-xl border border-border bg-card p-4', className)} aria-label="Filters">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">Filters</h2>
        <div className="flex items-center gap-2">
          {onReset ? (
            <Button size="sm" variant="ghost" onClick={onReset}>
              Reset
            </Button>
          ) : null}
          {collapsible ? (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setIsOpen((current) => !current)}
              aria-expanded={isOpen}
              aria-controls="filter-panel-fields"
              aria-label={isOpen ? 'Collapse filters' : 'Expand filters'}
            >
              {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          ) : null}
        </div>
      </div>

      {(isOpen || !collapsible) && (
        <div id="filter-panel-fields" className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => {
            const fieldType = field.type || 'text'
            const fieldValue = value[field.key]

            return (
              <label key={field.key} className="space-y-1 text-sm">
                <span className="text-muted-foreground">{field.label}</span>
                {fieldType === 'select' ? (
                  <select
                    className="input h-8"
                    value={String(fieldValue ?? '')}
                    onChange={(event) => updateField(field.key, event.target.value)}
                  >
                    <option value="">All</option>
                    {(field.options || []).map((option) => (
                      <option key={`${field.key}-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : fieldType === 'checkbox' ? (
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={Boolean(fieldValue)}
                    onChange={(event) => updateField(field.key, event.target.checked)}
                  />
                ) : (
                  <Input
                    type={fieldType}
                    value={String(fieldValue ?? '')}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    placeholder={field.placeholder}
                  />
                )}
              </label>
            )
          })}
        </div>
      )}
    </section>
  )
}
