import CmsPortal from '../../../pages/CmsPortal.jsx'

export default function ChartOfAccountsTab({ role, isAdmin }) {
  return <CmsPortal role={role} isAdmin={isAdmin} entityId="chart_of_accounts" hidePageHeader />
}
