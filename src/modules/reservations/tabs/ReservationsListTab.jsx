import { useLocation, useNavigate } from 'react-router-dom'
import Reservations from '../../../pages/Reservations.jsx'

export default function ReservationsListTab({ openReservation, userName }) {
  const location = useLocation()
  const navigate = useNavigate()
  const prefill = location.state?.prefill || null
  const clearPrefill = () =>
    navigate(location.pathname + location.search, { replace: true, state: {} })

  return (
    <Reservations
      openReservation={openReservation}
      userName={userName}
      prefill={prefill}
      clearPrefill={clearPrefill}
    />
  )
}
