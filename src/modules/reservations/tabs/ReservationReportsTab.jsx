import { ArrowUpRight, FileBarChart2, FileSpreadsheet, Printer } from 'lucide-react'
import DataTable from '../../../components/data/DataTable'
import ReservationActionsMenu from '../components/ReservationActionsMenu'
import ReservationStatusBadge from '../components/ReservationStatusBadge'

const REPORT_ROWS = [
  'Arrival List',
  'Departure List',
  'Reservation Summary',
  'Cancellation Report',
  'No Show Report',
  'Source-wise Booking Report',
  'Room Type-wise Booking Report',
  'Advance Collection Report',
  'Occupancy Forecast',
  'Reservation Revenue Forecast',
].map((name) => ({
  id: name,
  report: name,
  scope: 'Reservation Operations',
  status: 'DRAFT',
  owner: 'Reports Center',
}))

const COLUMNS = [
  { key: 'report', header: 'Report' },
  { key: 'scope', header: 'Scope' },
  { key: 'owner', header: 'Source' },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <ReservationStatusBadge status={row.status} />,
  },
]

export default function ReservationReportsTab({ canOpenReportsCenter = false, onOpenReportsCenter }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <h2 className="font-medium text-foreground">Reservation Reports</h2>
        <p className="mt-1 text-sm text-muted-foreground">Operational report catalog shell for arrivals, departures, occupancy and reservation revenue forecasting.</p>
      </div>

      <DataTable
        columns={COLUMNS}
        data={REPORT_ROWS}
        rowActions={(row) => (
          <ReservationActionsMenu
            label={`${row.report} actions`}
            actions={[
              {
                id: 'open',
                label: 'Open in Reports Center',
                icon: ArrowUpRight,
                disabled: !canOpenReportsCenter,
                onSelect: () => onOpenReportsCenter?.(),
              },
              { id: 'csv', label: 'Export CSV', icon: FileSpreadsheet },
              { id: 'print', label: 'Print', icon: Printer },
              { id: 'summary', label: 'View Summary', icon: FileBarChart2 },
            ]}
          />
        )}
      />
    </div>
  )
}
