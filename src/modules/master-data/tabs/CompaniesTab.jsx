import CmsPortal from '../../../pages/CmsPortal.jsx'

export default function CompaniesTab({ role, isAdmin }) {
  return <CmsPortal role={role} isAdmin={isAdmin} entityId="companies" hidePageHeader />
}
