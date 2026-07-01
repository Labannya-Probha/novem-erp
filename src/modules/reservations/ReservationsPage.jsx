/* ------------------------------------------------------------------ */
/*  RESERVATIONS PAGE — AEDS v2 unified module page                    */
/* ------------------------------------------------------------------ */
import { useReservationsTabs } from './hooks/useReservationsTabs'
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
  const { activeTab } = useReservationsTabs()

  return (
    <div>
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
  )
}
