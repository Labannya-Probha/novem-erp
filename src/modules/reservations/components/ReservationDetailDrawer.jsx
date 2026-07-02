import { useMemo, useState } from 'react'
import { Mail, MessageCircle, Pencil, Printer, Receipt, XCircle } from 'lucide-react'
import DrawerForm from '../../../components/forms/DrawerForm'
import ConfirmDialog from '../../../components/forms/ConfirmDialog'
import { Button } from '../../../components/ui/button'
import EmptyState from '../../../components/data/EmptyState'
import ModuleTabs from '../../../components/layout/ModuleTabs'
import useReservationDetail from '../hooks/useReservationDetail'
import ReservationStatusBadge from './ReservationStatusBadge'
import ReservationTimeline from './ReservationTimeline'

const DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'guest', label: 'Guest' },
  { id: 'stay', label: 'Stay' },
  { id: 'folio', label: 'Folio' },
  { id: 'payments', label: 'Payments' },
  { id: 'documents', label: 'Documents' },
  { id: 'notes', label: 'Notes' },
  { id: 'activity', label: 'Activity' },
]

function DetailSection({ title, children }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-medium text-foreground">{title}</h3>
      <div className="mt-3 text-sm text-muted-foreground">{children}</div>
    </section>
  )
}

export default function ReservationDetailDrawer({
  open = false,
  onOpenChange,
  reservationId,
  reservation,
  onEdit,
  onCheckIn,
  onAddPayment,
  onPrint,
  onSendWhatsApp,
  onSendEmail,
  onCancel,
}) {
  const detail = useReservationDetail(reservationId)
  const [activeTab, setActiveTab] = useState('overview')
  const [confirmCancel, setConfirmCancel] = useState(false)

  const currentReservation = reservation || detail.res
  const guest = detail.guest

  const activityItems = useMemo(() => (currentReservation ? [
    {
      id: 'created',
      title: 'Reservation record loaded',
      description: 'Detailed lifecycle events will move into this drawer in the next phase.',
      timestamp: currentReservation.created_at,
      actor: currentReservation.created_by || 'System',
    },
  ] : []), [currentReservation])

  const footer = (
    <div className="flex flex-wrap justify-between gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" type="button" onClick={onEdit}><Pencil className="size-4" /> Edit</Button>
        <Button variant="outline" type="button" onClick={onCheckIn}><Receipt className="size-4" /> Check In</Button>
        <Button variant="outline" type="button" onClick={onAddPayment}><Receipt className="size-4" /> Add Payment</Button>
        <Button variant="outline" type="button" onClick={onPrint}><Printer className="size-4" /> Print</Button>
        <Button variant="outline" type="button" onClick={onSendWhatsApp}><MessageCircle className="size-4" /> Send WhatsApp</Button>
        <Button variant="outline" type="button" onClick={onSendEmail}><Mail className="size-4" /> Send Email</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" type="button" onClick={() => setConfirmCancel(true)}><XCircle className="size-4" /> Cancel</Button>
        <Button variant="outline" type="button" onClick={() => onOpenChange?.(false)}>Close</Button>
      </div>
    </div>
  )

  return (
    <>
      <DrawerForm
        open={open}
        onOpenChange={onOpenChange}
        title={currentReservation?.reservation_name || guest?.full_name || 'Reservation detail'}
        subtitle={currentReservation ? `${currentReservation.res_no || 'Pending no'} · Reusable detail drawer shell` : 'Reusable detail drawer shell'}
        size="xl"
        footer={footer}
      >
        {currentReservation ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <ReservationStatusBadge status={currentReservation.status} />
              <span className="text-sm text-muted-foreground">{currentReservation.check_in || 'TBD'} → {currentReservation.check_out || 'TBD'}</span>
            </div>

            <ModuleTabs tabs={DETAIL_TABS} activeTab={activeTab} onChange={setActiveTab} />

            {activeTab === 'overview' ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <DetailSection title="Reservation">
                  Reservation No: {currentReservation.res_no || '—'}<br />
                  Source: {currentReservation.source || '—'}<br />
                  Status: {currentReservation.status || '—'}
                </DetailSection>
                <DetailSection title="Amounts">
                  Total: {detail.totals?.grand_total ?? '—'}<br />
                  Paid: {detail.paid ?? '—'}<br />
                  Due: {detail.due ?? '—'}
                </DetailSection>
              </div>
            ) : null}

            {activeTab === 'guest' ? (
              <DetailSection title="Guest">
                Name: {guest?.full_name || currentReservation.reservation_name || '—'}<br />
                Mobile: {guest?.phone || '—'}<br />
                Email: {guest?.email || '—'}
              </DetailSection>
            ) : null}

            {activeTab === 'stay' ? (
              <DetailSection title="Stay">
                Check-in: {currentReservation.check_in || '—'}<br />
                Check-out: {currentReservation.check_out || '—'}<br />
                Nights: {detail.nights ?? '—'}
              </DetailSection>
            ) : null}

            {activeTab === 'folio' ? (
              <DetailSection title="Folio">
                Charges, add-ons and settlement steps remain on the legacy detail screen until migration.
              </DetailSection>
            ) : null}

            {activeTab === 'payments' ? (
              <DetailSection title="Payments">
                {detail.payments?.length ? `${detail.payments.length} payment record(s) loaded.` : 'No payments recorded yet.'}
              </DetailSection>
            ) : null}

            {activeTab === 'documents' ? (
              <EmptyState title="Documents drawer shell" description="Reservation documents will surface here once the legacy attachments flow is wrapped." />
            ) : null}

            {activeTab === 'notes' ? (
              <DetailSection title="Notes">
                {currentReservation.notes || 'No internal or guest-facing notes captured in the new shell yet.'}
              </DetailSection>
            ) : null}

            {activeTab === 'activity' ? <ReservationTimeline items={activityItems} /> : null}
          </div>
        ) : (
          <EmptyState title="Select a reservation" description="Pass a reservationId or reservation payload to load the reusable detail drawer shell." />
        )}
      </DrawerForm>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel reservation"
        description="Manager approval and full cancellation flow stay on the legacy detail route during this migration phase."
        confirmText="Continue"
        onConfirm={() => {
          setConfirmCancel(false)
          onCancel?.()
        }}
      />
    </>
  )
}
