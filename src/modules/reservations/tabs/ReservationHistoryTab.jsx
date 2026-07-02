import { ShieldCheck } from 'lucide-react'
import DataTable from '../../../components/data/DataTable'
import FilterPanel from '../../../components/data/FilterPanel'
import ExportMenu from '../../../components/data/ExportMenu'
import ReservationTimeline from '../components/ReservationTimeline'

const FILTER_FIELDS = [
  { key: 'dateFrom', label: 'Date From', type: 'date' },
  { key: 'dateTo', label: 'Date To', type: 'date' },
  { key: 'reservationNo', label: 'Reservation No', placeholder: 'Search reservation' },
  { key: 'user', label: 'User', placeholder: 'Created / modified by' },
]

const COLUMNS = [
  { key: 'dateTime', header: 'Date Time' },
  { key: 'reservationNo', header: 'Reservation No' },
  { key: 'action', header: 'Action' },
  { key: 'oldValue', header: 'Old Value' },
  { key: 'newValue', header: 'New Value' },
  { key: 'user', header: 'User' },
  { key: 'source', header: 'Source' },
  { key: 'ip', header: 'IP' },
]

export default function ReservationHistoryTab() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <h2 className="font-medium text-foreground">Reservation History</h2>
          <p className="text-sm text-muted-foreground">Audit trail shell for reservation lifecycle events without touching legacy mutation logic.</p>
        </div>
        <ExportMenu onPrint={() => window.print()} />
      </div>

      <FilterPanel fields={FILTER_FIELDS} value={{}} collapsible={false} />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <DataTable
          columns={COLUMNS}
          data={[]}
          emptyState={{
            title: 'Audit table ready for wrapper migration',
            description: 'Create/modify/check-in/check-out/cancel/no-show events will be surfaced here once they are wrapped safely.',
          }}
        />

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" />
            <h3 className="font-medium text-foreground">Lifecycle Timeline</h3>
          </div>
          <ReservationTimeline />
        </div>
      </div>
    </div>
  )
}
