import { useMemo, useState } from 'react'
import { PanelLeft } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb'
import ModuleTabs from '../components/layout/ModuleTabs'
import PageHeader from '../components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { useReportsCenter } from '../modules/reports/hooks/useReportsCenter'
import ReportFilterDrawer from '../modules/reports/components/ReportFilterDrawer'
import ReportListPanel from '../modules/reports/components/ReportListPanel'

export default function Reportmodule({ userName, userId, role, company }) {
  const [isDrawerOpen, setDrawerOpen] = useState(false)
  const {
    category,
    activeReportCode,
    reportsForCategory,
    setCategory,
    setReport,
    categoryTabs,
  } = useReportsCenter({ role, userId })

  const activeReport = useMemo(() => (
    reportsForCategory.find((item) => item.reportCode === activeReportCode) || null
  ), [activeReportCode, reportsForCategory])

  const categoryLabel = useMemo(() => (
    categoryTabs.find((tab) => tab.id === category)?.label || 'Reports'
  ), [category, categoryTabs])

  const selectedCount = useMemo(() => (
    reportsForCategory.filter((item) => item.enabled !== false).length
  ), [reportsForCategory])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports Center"
        subtitle="Unified enterprise reports with role-based access and standardized navigation."
        breadcrumb={<Breadcrumb items={[{ label: 'Modules' }, { label: 'Reports', current: true }]} />}
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="outline" className="lg:hidden" onClick={() => setDrawerOpen(true)}>
              <PanelLeft className="size-4" />
              Reports
            </Button>
          </div>
        )}
        tabs={<ModuleTabs tabs={categoryTabs} activeTab={category} onChange={setCategory} />}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <ReportListPanel
            items={reportsForCategory}
            activeReportCode={activeReportCode}
            onSelectReport={setReport}
          />
        </aside>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>{activeReport?.label || 'Select a report'}</CardTitle>
            <CardDescription>
              {activeReport
                ? `${categoryLabel} · ${company?.name || 'Aura Stay'}`
                : `${categoryLabel} · ${selectedCount} available report${selectedCount === 1 ? '' : 's'}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {activeReport ? (
              <p>
                Report <span className="font-medium text-foreground">{activeReport.label}</span> is selected.
                Use the left panel to switch reports or legacy destinations.
              </p>
            ) : (
              <p>
                Pick a report from the list to continue. Access is scoped by your role and enabled modules.
              </p>
            )}
            <p>
              Signed in as <span className="font-medium text-foreground">{userName || 'User'}</span>.
            </p>
          </CardContent>
        </Card>
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
