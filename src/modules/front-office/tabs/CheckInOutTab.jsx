import FrontOfficeReservationQueue from '../components/FrontOfficeReservationQueue'

export default function CheckInOutTab({ openReservation }) {
  return (
    <FrontOfficeReservationQueue
      title="Check In / Check Out"
      description="Today arrivals, in-house guests, and scheduled departures."
      empty="No check-in or check-out activity is queued for today."
      openReservation={openReservation}
      targetTab={(row) => row.status === 'CHECKED_IN' ? 'Billings & Check-Out' : 'Check-In'}
      filter={(row, today) => (
        row.status === 'CHECKED_IN' ||
        (['QUERY', 'QUOTED', 'CONFIRMED'].includes(row.status) && row.check_in === today)
      )}
    />
  )
}
