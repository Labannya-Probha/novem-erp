/* ------------------------------------------------------------------ */
/*  RESERVATIONS PAGE — AEDS v2 unified module page                    */
/* ------------------------------------------------------------------ */
import PageHeader from '../../components/layout/PageHeader'
import ModuleTabs from '../../components/layout/ModuleTabs'
import { useReservationsTabs } from './hooks/useReservationsTabs'
import { RESERVATION_TABS } from './reservations.config'
import ReservationsListTab from './tabs/ReservationsListTab'
import BookingCalendarTab from './tabs/BookingCalendarTab'
import ReservationPaymentsTab from './tabs/ReservationPaymentsTab'
import GuestCrmTab from './tabs/GuestCrmTab'

export default function ReservationsPage({
  openReservation,
  startReservation,
  userName,
  isAdmin,
  role,
}) {
  const { activeTab, setActiveTab } = useReservationsTabs()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reservations"
        breadcrumb={[{ label: 'Reservations', current: true }]}
        tabs={
          <ModuleTabs
            tabs={RESERVATION_TABS}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        }
      />

      <div
        id={`module-tab-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`module-tab-${activeTab}`}
      >
        {activeTab === 'list' && (
          <ReservationsListTab openReservation={openReservation} userName={userName} />
        )}
        {activeTab === 'calendar' && (
          <BookingCalendarTab
            openReservation={openReservation}
            onNewReservation={startReservation}
          />
        )}
        {activeTab === 'payments' && (
          <ReservationPaymentsTab userName={userName} isAdmin={isAdmin} />
        )}
        {activeTab === 'crm' && (
          <GuestCrmTab userName={userName} isAdmin={isAdmin} role={role} />
        )}
      </div>
    </div>
  )
}
