import CmsPortal from '../../../pages/CmsPortal.jsx'

export default function MenuItemsTab({ role, isAdmin }) {
  return <CmsPortal role={role} isAdmin={isAdmin} entityId="menu_items" hidePageHeader />
}
