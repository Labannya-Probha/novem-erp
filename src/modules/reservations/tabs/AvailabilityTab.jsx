import { CalendarCheck2 } from 'lucide-react'
import DataTable from '../../../components/data/DataTable'
import EmptyState from '../../../components/data/EmptyState'
import FilterPanel from '../../../components/data/FilterPanel'
import ExportMenu from '../../../components/data/ExportMenu'
import { Button } from '../../../components/ui/button'
import { fmtBDT } from '../../../lib/helpers'
import { useAvailability } from '../hooks/useAvailability'

const FILTER_FIELDS = [
  { key: 'checkIn', label: 'Check-in Date', type: 'date' },
  { key: 'checkOut', label: 'Check-out Date', type: 'date' },
  { key: 'roomType', label: 'Room Type', type: 'select' },
  { key: 'roomCount', label: 'Number of Rooms', type: 'number', placeholder: '1' },
  { key: 'pax', label: 'Pax', type: 'number', placeholder: '1' },
  {
    key: 'ratePlan',
    label: 'Rate Plan',
    type: 'select',
    options: [
      { label: 'BAR', value: 'BAR' },
      { label: 'Corporate', value: 'CORPORATE' },
      { label: 'Package', value: 'PACKAGE' },
    ],
  },
]

const COLUMNS = [
  { key: 'roomType', header: 'Room Type' },
  { key: 'availableRooms', header: 'Available Rooms' },
  { key: 'baseRate', header: 'Base Rate', render: (row) => fmtBDT(row.baseRate || 0) },
  { key: 'discount', header: 'Discount', render: (row) => `${row.discount || 0}%` },
  { key: 'finalRate', header: 'Final Rate', render: (row) => fmtBDT(row.finalRate || 0) },
  { key: 'totalNights', header: 'Total Nights' },
  { key: 'estimatedTotal', header: 'Estimated Total', render: (row) => fmtBDT(row.estimatedTotal || 0) },
]

export default function AvailabilityTab({ onCreateReservation }) {
  const { filters, setFilters, results, roomTypeOptions, loading, error } = useAvailability()

  const fields = FILTER_FIELDS.map((field) => {
    if (field.key !== 'roomType') return field
    return {
      ...field,
      options: roomTypeOptions.map((option) => ({ label: option, value: option })),
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <h2 className="font-medium text-foreground">Availability</h2>
          <p className="text-sm text-muted-foreground">Fast availability preview using the current room inventory and active room allocations.</p>
        </div>
        <ExportMenu onPrint={() => window.print()} />
      </div>

      <FilterPanel
        fields={fields}
        value={filters}
        onChange={setFilters}
        onReset={() => setFilters((current) => ({ ...current, roomType: '', roomCount: '1', pax: '1', ratePlan: 'BAR' }))}
      />

      {error ? (
        <EmptyState title="Availability needs valid dates" description={error} />
      ) : null}

      <DataTable
        loading={loading}
        columns={COLUMNS}
        data={results}
        emptyState={{
          title: 'No room types found',
          description: 'Adjust the stay dates or room type filter to continue.',
        }}
        rowActions={(row) => (
          <Button
            size="sm"
            disabled={!row.availableRooms}
            onClick={() => onCreateReservation?.({ from_date: filters.checkIn, to_date: filters.checkOut, room_type: row.roomType })}
          >
            <CalendarCheck2 className="size-4" />
            Create Reservation
          </Button>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-medium text-foreground">Suggested Rooms</h3>
          <p className="mt-2 text-sm text-muted-foreground">{results[0]?.suggestedRooms || 'Select dates to preview suggested room numbers.'}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-medium text-foreground">Suggested Package</h3>
          <p className="mt-2 text-sm text-muted-foreground">{results[0]?.suggestedPackage || 'Standard Stay'}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-medium text-foreground">Operational Notes</h3>
          <p className="mt-2 text-sm text-muted-foreground">Blocked / out-of-order indicators are surfaced in this shell without changing existing allocation logic.</p>
        </div>
      </div>
    </div>
  )
}
