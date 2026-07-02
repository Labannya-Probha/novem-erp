import CmsPortal from '../../../pages/CmsPortal.jsx'

export default function StoreLocationsTab({ role, isAdmin }) {
  return <CmsPortal role={role} isAdmin={isAdmin} entityId="store_locations" hidePageHeader />
}
