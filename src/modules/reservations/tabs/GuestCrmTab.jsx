import GuestCRM from '../../../pages/GuestCRM.jsx'

export default function GuestCrmTab({ userName, isAdmin, role }) {
  return <GuestCRM userName={userName} isAdmin={isAdmin} role={role} />
}
