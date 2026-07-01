import { Search } from 'lucide-react'
import { STANDARD_FILTERS } from '../../lib/reporting/reportConfig'
import { Input } from '../ui/input'

export default function ReportFilterPanel({ filters, onChange, search, onSearchChange, activeFilterKeys, filterOptions = {} }) {
  const fields = STANDARD_FILTERS.filter((filter) => !activeFilterKeys || activeFilterKeys.includes(filter.key))
  return (
    <section className="erp-filter-panel">
      <div className="erp-filter-grid">
        {fields.map((filter) => (
          <label key={filter.key} className="erp-filter-field">
            <span>{filter.label}</span>
            {filter.type === 'date' ? (
              <Input type="date" value={filters[filter.key] || ''} onChange={(e) => onChange(filter.key, e.target.value)} />
            ) : (
              <select value={filters[filter.key] || ''} onChange={(e) => onChange(filter.key, e.target.value)} className="input">
                {(filterOptions[filter.key] || filter.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            )}
          </label>
        ))}
        <label className="erp-filter-field erp-search-field">
          <span>Search</span>
          <Search size={15} />
          <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search report rows" />
        </label>
      </div>
    </section>
  )
}
