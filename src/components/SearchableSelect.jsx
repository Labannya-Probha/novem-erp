import { useMemo } from 'react'
import { Combobox } from './ui/combobox'

/**
 * SearchableSelect — a type-to-filter dropdown that matches the app's
 * existing `.input` / `.label` styling, meant as a drop-in replacement
 * for native <select> elements throughout the ERP.
 *
 * Props:
 *  - options: array of { value, label, sublabel? }  (sublabel renders smaller/lighter, e.g. phone or rate)
 *  - value: the currently selected `value` (or '' for none)
 *  - onChange(value): called with the selected option's `value`
 *  - placeholder: text shown when nothing is selected / in the search box
 *  - allowCreate: if true, shows an "+ Add '<query>'" row when no option matches
 *  - onCreate(query): called when the create row is clicked; should resolve to a value to select
 *  - disabled, className: passthrough
 *  - clearable: if true, shows an X to clear the selection
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select…',
  allowCreate = false,
  onCreate,
  disabled = false,
  className = '',
  clearable = false,
}) {
  const items = useMemo(
    () => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options],
  )

  return (
    <Combobox
      items={items}
      value={value}
      onChange={(v) => onChange?.(v)}
      placeholder={placeholder}
      searchPlaceholder="Type to search…"
      emptyText="No matches."
      disabled={disabled}
      className={className}
      clearable={clearable}
      allowCreate={allowCreate}
      onCreate={onCreate}
      createLabel="Add"
    />
  )
}
