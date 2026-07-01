import Dashboard from '../../../pages/Dashboard.jsx'

export default function RoomBoardTab({ openReservation, userName, role, isAdmin, company }) {
  return (
    <Dashboard
      openReservation={openReservation}
      userName={userName}
      role={role}
      isAdmin={isAdmin}
      company={company}
    />
  )
}
