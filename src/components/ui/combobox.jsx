import * as React from "react"
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react"
import { cn } from "src/lib/utils"

function normalizeItem(item) {
  if (typeof item === "string") {
    return { value: item, label: item }
  }

  return item ?? { value: "", label: "" }
}

function itemMatchesQuery(item, query) {
  if (!query) return true

  const haystack = [item.label, item.sublabel, item.value]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

function useClickOutside(ref, handler) {
  React.useEffect(() => {
    function onPointerDown(event) {
      if (!ref.current || ref.current.contains(event.target)) return
      handler()
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown)

    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown)
    }
  }, [ref, handler])
}

function Combobox({
  items = [],
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled = false,
  className,
  clearable = false,
  allowCreate = false,
  onCreate,
  createLabel = "Create",
  closeOnSelect = true,
}) {
  const normalizedItems = React.useMemo(() => items.map(normalizeItem), [items])
  const selectedItem = React.useMemo(
    () => normalizedItems.find((item) => item.value === value) ?? null,
    [normalizedItems, value]
  )

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const rootRef = React.useRef(null)
  const inputRef = React.useRef(null)

  useClickOutside(rootRef, () => setOpen(false))

  React.useEffect(() => {
    if (!open) {
      setQuery("")
      setCreating(false)
    }
  }, [open])

  React.useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  const filteredItems = React.useMemo(
    () => normalizedItems.filter((item) => itemMatchesQuery(item, query)),
    [normalizedItems, query]
  )

  const canCreate =
    allowCreate &&
    query.trim() &&
    !normalizedItems.some((item) => item.label?.toLowerCase() === query.trim().toLowerCase())

  async function handleCreate() {
    if (!onCreate || !canCreate || creating) return

    try {
      setCreating(true)
      const createdValue = await onCreate(query.trim())
      onChange?.(createdValue ?? query.trim(), {
        value: createdValue ?? query.trim(),
        label: query.trim(),
      })
      setOpen(false)
    } finally {
      setCreating(false)
    }
  }

  function handleSelect(item) {
    onChange?.(item.value, item)
    if (closeOnSelect) {
      setOpen(false)
    }
  }

  function handleClear(event) {
    event.preventDefault()
    event.stopPropagation()
    onChange?.("", null)
    setQuery("")
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60",
          open && "ring-2 ring-emerald-500/30"
        )}>
        <span className={cn("truncate", !selectedItem && "text-slate-400")}>
          {selectedItem?.label || placeholder}
        </span>
        <span className="ml-2 flex items-center gap-1">
          {clearable && selectedItem ? (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <XIcon className="size-4" />
            </span>
          ) : null}
          <ChevronDownIcon className="size-4 text-slate-400" />
        </span>
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 focus-within:border-emerald-300 focus-within:bg-white">
              <SearchIcon className="size-4 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {filteredItems.map((item) => {
              const isSelected = item.value === value

              return (
                <button
                  key={String(item.value)}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50",
                    isSelected && "bg-emerald-50 text-emerald-900"
                  )}>
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    {item.sublabel ? (
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{item.sublabel}</span>
                    ) : null}
                  </span>
                  {isSelected ? <CheckIcon className="mt-0.5 size-4 shrink-0" /> : null}
                </button>
              )
            })}

            {!filteredItems.length && canCreate ? (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 disabled:opacity-60">
                <span>{createLabel} "{query.trim()}"</span>
                {creating ? <span className="text-xs text-slate-500">Saving...</span> : null}
              </button>
            ) : null}

            {!filteredItems.length && !canCreate ? (
              <div className="px-3 py-6 text-center text-sm text-slate-500">{emptyText}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { Combobox }
