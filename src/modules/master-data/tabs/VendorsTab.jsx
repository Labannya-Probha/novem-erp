import CmsPortal from '../../../pages/CmsPortal.jsx'

export default function VendorsTab({ role, isAdmin }) {
  return <CmsPortal role={role} isAdmin={isAdmin} entityId="vendors" hidePageHeader />
}
