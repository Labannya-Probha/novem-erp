import CmsPortal from '../../../pages/CmsPortal.jsx'

export default function GuestsTab({ role, isAdmin }) {
  return <CmsPortal role={role} isAdmin={isAdmin} entityId="guests" hidePageHeader />
}
