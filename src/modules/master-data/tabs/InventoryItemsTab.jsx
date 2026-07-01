import CmsPortal from '../../../pages/CmsPortal.jsx'

export default function InventoryItemsTab({ role, isAdmin }) {
  return <CmsPortal role={role} isAdmin={isAdmin} entityId="inv_items" hidePageHeader />
}
