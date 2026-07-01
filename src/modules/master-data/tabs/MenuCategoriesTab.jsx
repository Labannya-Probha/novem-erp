import CmsPortal from '../../../pages/CmsPortal.jsx'

export default function MenuCategoriesTab({ role, isAdmin }) {
  return <CmsPortal role={role} isAdmin={isAdmin} entityId="menu_categories" hidePageHeader />
}
