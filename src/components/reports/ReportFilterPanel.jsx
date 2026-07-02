import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { STANDARD_FILTERS } from '../../lib/reporting/reportConfig'
import { Input } from '../ui/input'

const PRIMARY_FILTERS = ['dateFrom', 'dateTo', 'property', 'outlet', 'department']
const ADVANCED_FILTERS = [
  'costCenter',
  'roomType',
  'guestType',
  'currency',
  'paymentMethod',
  'reservationSource',
  'user',
  'status',
  'businessUnit',
  'segment',
  'tags',
]

const FILTER_LABELS = Object.fromEntries(STANDARD_FILTERS.map((filter) => [filter.key, filter.label]))

function FilterField({ filter, value, options, onChange }) {
  const selectOptions = options?.length ? options : filter.options || []

  return (
    <label className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{filter.label}</span>
      {filter.type === 'date' ? (
        <Input
          type="date"
          value={value || ''}
          onChange={(event) => onChange(filter.key, event.target.value)}
          className="h-10 rounded-xl border-slate-200 bg-white"
        />
      ) : (
        <select
          value={value || ''}
          onChange={(event) => onChange(filter.key, event.target.value)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
        >
          {selectOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      )}
    </label>
  )
}

function FilterChip({ chip, onRemove }) {
  return (
    <button
      type="button"
      onClick={() => onRemove(chip.key)}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
    >
      <span>{chip.label}: {chip.value}</span>
      <X className="size-3.5" />
    </button>
  )
}

export default function ReportFilterPanel({
  filters,
  filterOptions = {},
  expanded = false,
  onToggleExpanded,
  onChange,
  appliedFilters = [],
  onRemoveFilter,
  onResetFilters,
}) {
  const filterMap = Object.fromEntries(STANDARD_FILTERS.map((filter) => [filter.key, filter]))
  const primaryFields = PRIMARY_FILTERS.map((key) => filterMap[key]).filter(Boolean)
  const advancedFields = ADVANCED_FILTERS.map((key) => filterMap[key]).filter(Boolean)

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {primaryFields.map((filter) => (
            <FilterField
              key={filter.key}
              filter={filter}
              value={filters[filter.key]}
              options={filterOptions[filter.key]}
              onChange={onChange}
            />
          ))}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span>More Filters</span>
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {advancedFields.map((filter) => (
            <FilterField
              key={filter.key}
              filter={filter}
              value={filters[filter.key]}
              options={filterOptions[filter.key]}
              onChange={onChange}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {appliedFilters.length ? (
          appliedFilters.map((chip) => (
            <FilterChip key={`${chip.key}-${chip.value}`} chip={chip} onRemove={onRemoveFilter} />
          ))
        ) : (
          <span className="text-sm text-slate-500">{FILTER_LABELS.dateFrom && 'No additional filters applied'}</span>
        )}
      </div>
    </section>
  )
}
