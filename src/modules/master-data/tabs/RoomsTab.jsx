import CmsPortal from '../../../pages/CmsPortal.jsx'

export default function RoomsTab({ role, isAdmin }) {
  return <CmsPortal role={role} isAdmin={isAdmin} entityId="rooms" hidePageHeader />
}
