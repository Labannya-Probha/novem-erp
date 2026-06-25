import * as React from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command'
import { cn } from '../../lib/utils'

export function Combobox({
  items = [],           // [{ value, label, sublabel? }]
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results found.',
  className = '',
  disabled = false,
  clearable = false,
  onClear,
  allowCreate = false,
  onCreate,
  closeOnSelect = true,
  createLabel = 'Add',
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [creating, setCreating] = React.useState(false)
  const selected = items.find((it) => String(it.value) === String(value))
  const q = query.trim().toLowerCase()
  const exactMatch = !q || items.some((it) => String(it.label || '').toLowerCase() === q)
  const canCreate = !!allowCreate && !!onCreate && !!q && !exactMatch

  const handleSelect = async (item) => {
    if (item?.__create__) {
      setCreating(true)
      try {
        const created = await onCreate(query.trim())
        if (created != null) {
          if (typeof created === 'object' && created?.value !== undefined) onChange(created.value, created)
          else onChange(created)
          if (closeOnSelect) setOpen(false)
          setQuery('')
        }
      } finally {
        setCreating(false)
      }
      return
    }
    onChange(item.value, item)
    if (closeOnSelect) setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'input w-full flex items-center justify-between gap-2 cursor-pointer',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <span className={selected ? 'text-pine truncate' : 'text-pine/40'}>
            {selected?.label || placeholder}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {clearable && selected && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onClear?.()
                  onChange?.('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onClear?.()
                    onChange?.('')
                  }
                }}
                className="text-pine/40 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 text-pine/40" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map(it => (
                <CommandItem
                  key={it.value}
                  value={`${it.label} ${it.sublabel || ''}`}
                  onSelect={() => { handleSelect(it) }}
                >
                  <Check className={cn('mr-2 h-4 w-4 text-forest', String(value) === String(it.value) ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{it.label}</div>
                    {it.sublabel && <div className="text-xs text-pine/40 truncate">{it.sublabel}</div>}
                  </div>
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem value={`create ${query}`} onSelect={() => { handleSelect({ __create__: true }) }}>
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  <div className="font-medium text-forest">
                    {creating ? 'Adding…' : `${createLabel} "${query.trim()}"`}
                  </div>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
