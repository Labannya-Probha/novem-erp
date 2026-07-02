import CmsPortal from '../../../pages/CmsPortal.jsx'

export default function ReservationPoliciesTab({ role, isAdmin }) {
  return <CmsPortal role={role} isAdmin={isAdmin} entityId="reservation_policies" hidePageHeader />
}
