import { MessageCircle, Printer, RefreshCcw } from 'lucide-react'
import DataTable from '../../../components/data/DataTable'
import FilterPanel from '../../../components/data/FilterPanel'
import ExportMenu from '../../../components/data/ExportMenu'
import EmptyState from '../../../components/data/EmptyState'
import { Button } from '../../../components/ui/button'
import ReservationActionsMenu from '../components/ReservationActionsMenu'
import ReservationStatusBadge from '../components/ReservationStatusBadge'

const FILTER_FIELDS = [
  { key: 'dateFrom', label: 'Date From', type: 'date' },
  { key: 'dateTo', label: 'Date To', type: 'date' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: ['DRAFT', 'SENT', 'ACCEPTED', 'CONVERTED', 'EXPIRED', 'CANCELLED'].map((status) => ({ label: status.replace('_', ' '), value: status })),
  },
  { key: 'guest', label: 'Guest / Company', placeholder: 'Search quotation guest' },
]

const COLUMNS = [
  { key: 'quotationNo', header: 'Quotation No' },
  { key: 'guest', header: 'Guest / Company' },
  { key: 'date', header: 'Date' },
  { key: 'validUntil', header: 'Valid Until' },
  { key: 'roomType', header: 'Room Type' },
  { key: 'nights', header: 'Nights' },
  { key: 'amount', header: 'Amount' },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <ReservationStatusBadge status={row.status} />,
  },
]

export default function QuotationsTab({ onCreateReservation }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <h2 className="font-medium text-foreground">Quotations</h2>
          <p className="text-sm text-muted-foreground">Safe shell for pre-confirmation quotations while legacy quotation printing remains on the reservation detail route.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportMenu onPrint={() => window.print()} />
          <Button onClick={() => onCreateReservation?.({})}>Create Quotation Shell</Button>
        </div>
      </div>

      <FilterPanel fields={FILTER_FIELDS} value={{}} collapsible={false} />

      <DataTable
        columns={COLUMNS}
        data={[]}
        emptyState={
          <EmptyState
            title="Quotation wrapper pending migration"
            description="Existing reservation quotation print logic is preserved. This tab now provides the AEDS v2 structure without changing the old business flow."
            action={{ label: 'Convert to Reservation Flow', onClick: () => onCreateReservation?.({}) }}
          />
        }
        rowActions={() => (
          <ReservationActionsMenu
            actions={[
              { id: 'convert', label: 'Convert to Reservation', icon: RefreshCcw },
              { id: 'print', label: 'Print / PDF', icon: Printer },
              { id: 'send', label: 'Send Email / WhatsApp', icon: MessageCircle },
            ]}
          />
        )}
      />
    </div>
  )
}
