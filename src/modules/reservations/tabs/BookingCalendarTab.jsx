import { useNavigate } from 'react-router-dom'
import BookingCalendar from '../../../pages/BookingCalendar.jsx'
import { PATHS } from '../../../app/paths'

export default function BookingCalendarTab({ openReservation, onNewReservation }) {
  const navigate = useNavigate()
  return (
    <BookingCalendar
      openReservation={openReservation}
      onNewReservation={onNewReservation}
      onOpenReservations={() => navigate(`${PATHS.RESERVATIONS}?tab=list`)}
    />
  )
}
