import { useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Breadcrumb from '../../components/layout/Breadcrumb'
import ModuleTabs from '../../components/layout/ModuleTabs'
import { Button } from '../../components/ui/button'
import { useReportsCenter } from './hooks/useReportsCenter'
import ReportCategoryGrid from './components/ReportCategoryGrid'
import ReportFilterDrawer from './components/ReportFilterDrawer'
import ReportViewer from './components/ReportViewer'
import FinancialReports from './categories/FinancialReports'
import HotelOperationsReports from './categories/HotelOperationsReports'
import RestaurantPosReports from './categories/RestaurantPosReports'
import AccountingControlReports from './categories/AccountingControlReports'
import InventoryReports from './categories/InventoryReports'
import HrReports from './categories/HrReports'
import ManagementReports from './categories/ManagementReports'

const CATEGORY_COMPONENTS = {
  financial: FinancialReports,
  'hotel-operations': HotelOperationsReports,
  'restaurant-pos': RestaurantPosReports,
  'accounting-control': AccountingControlReports,
  inventory: InventoryReports,
  hr: HrReports,
  management: ManagementReports,
}

export default function ReportsCenterPage({ userName, userId, role, company }) {
  const [isDrawerOpen, setDrawerOpen] = useState(false)
  const {
    category,
    activeReportCode,
    reportsForCategory,
    setCategory,
    setReport,
    categoryTabs,
  } = useReportsCenter({ role, userId })

  const CategoryPanel = useMemo(() => CATEGORY_COMPONENTS[category] || FinancialReports, [category])

  return (
    <div className="space-y-4">
      <PageHeader
        title="AEDS v2 Reports Center"
        subtitle="Consolidated access to all operational, compliance, and management reports."
        breadcrumb={<Breadcrumb items={[{ label: 'Modules' }, { label: 'Reports Center', current: true }]} />}
        actions={(
          <Button type="button" variant="outline" onClick={() => setDrawerOpen(true)}>
            <SlidersHorizontal size={14} /> Open Reports Panel
          </Button>
        )}
        tabs={<ModuleTabs tabs={categoryTabs} activeTab={category} onChange={setCategory} />}
      />

      <ReportCategoryGrid tabs={categoryTabs} activeTab={category} onChange={setCategory} />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <CategoryPanel items={reportsForCategory} activeReportCode={activeReportCode} onSelectReport={setReport} />
        <ReportViewer userName={userName} userId={userId} role={role} company={company} />
      </div>

      <ReportFilterDrawer
        open={isDrawerOpen}
        onOpenChange={setDrawerOpen}
        items={reportsForCategory}
        activeReportCode={activeReportCode}
        onSelectReport={(code) => {
          setReport(code)
          setDrawerOpen(false)
        }}
      />
    </div>
  )
}
