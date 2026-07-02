import { useEffect, useMemo, useState } from 'react'
import { Download, PanelLeft, Printer } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import Breadcrumb from '../components/layout/Breadcrumb'
import KpiStrip from '../components/layout/KpiStrip'
import ModuleTabs from '../components/layout/ModuleTabs'
import PageHeader from '../components/layout/PageHeader'
import DynamicReportTable, { calculateTotals } from '../components/reports/DynamicReportTable'
import ReportFilterPanel from '../components/reports/ReportFilterPanel'
import ReportKpiCards from '../components/reports/ReportKpiCards'
import ReportPrintDocument from '../components/reports/ReportPrintDocument'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { loadLiveReportData } from '../lib/reporting/liveReportData'
import { DASHBOARD_KPIS, STANDARD_FILTERS, getDefaultFilters } from '../lib/reporting/reportConfig'
import { exportReportCsv, exportReportExcel, exportReportPdf, getReportPrintSettings } from '../lib/reporting/reportExport'
import { logReportExport, logReportPrint } from '../lib/reporting/tenantReporting'
import { useReportsCenter } from '../modules/reports/hooks/useReportsCenter'
import ReportFilterDrawer from '../modules/reports/components/ReportFilterDrawer'
import ReportListPanel from '../modules/reports/components/ReportListPanel'

const todayISO = () => new Date().toISOString().slice(0, 10)
const buildDefaultFilters = () => getDefaultFilters(todayISO)
const filterLabels = Object.fromEntries(STANDARD_FILTERS.map((filter) => [filter.key, filter.label]))
const kpiMetaByKey = Object.fromEntries(DASHBOARD_KPIS.map((item) => [item.key, item]))

function toISODate(value) {
  return value.toISOString().slice(0, 10)
}

function buildPreviousPeriodFilters(filters) {
  const dateFrom = new Date(filters.dateFrom)
  const dateTo = new Date(filters.dateTo)
  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) return filters

  const dayCount = Math.max(1, Math.round((dateTo - dateFrom) / 86400000) + 1)
  const previousDateTo = new Date(dateFrom)
  previousDateTo.setDate(previousDateTo.getDate() - 1)
  const previousDateFrom = new Date(previousDateTo)
  previousDateFrom.setDate(previousDateFrom.getDate() - dayCount + 1)

  return {
    ...filters,
    dateFrom: toISODate(previousDateFrom),
    dateTo: toISODate(previousDateTo),
  }
}

function formatPeriodLabel({ dateFrom, dateTo }) {
  return `${dateFrom || '—'} → ${dateTo || '—'}`
}

export default function Reportmodule({ userName, userId, role, company }) {
  const [isDrawerOpen, setDrawerOpen] = useState(false)
  const [filters, setFilters] = useState(() => buildDefaultFilters())
  const [filterExpanded, setFilterExpanded] = useState(false)
  const [rows, setRows] = useState([])
  const [comparisonRows, setComparisonRows] = useState([])
  const [kpiValues, setKpiValues] = useState({})
  const [comparisonKpiValues, setComparisonKpiValues] = useState({})
  const [filterOptions, setFilterOptions] = useState({})
  const [errors, setErrors] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [comparisonEnabled, setComparisonEnabled] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
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
  const defaultFilters = useMemo(() => buildDefaultFilters(), [])

  const categoryLabel = useMemo(() => (
    categoryTabs.find((tab) => tab.id === category)?.label || 'Reports'
  ), [category, categoryTabs])

  const selectedCount = useMemo(() => (
    reportsForCategory.filter((item) => item.enabled !== false).length
  ), [reportsForCategory])
  const legacyRouteCount = useMemo(() => (
    reportsForCategory.filter((item) => item.route).length
  ), [reportsForCategory])
  const directReportCount = useMemo(() => (
    reportsForCategory.filter((item) => item.reportCode).length
  ), [reportsForCategory])
  const kpis = useMemo(() => ([
    { label: 'Available reports', value: selectedCount },
    { label: 'Direct report templates', value: directReportCount },
    { label: 'Legacy route links', value: legacyRouteCount },
    { label: 'Current category', value: categoryLabel },
  ]), [categoryLabel, directReportCount, legacyRouteCount, selectedCount])
  const appliedFilters = useMemo(() => (
    Object.entries(filters)
      .filter(([key, value]) => value && key !== 'dateFrom' && key !== 'dateTo' && value !== defaultFilters[key] && key !== 'currency')
      .map(([key, value]) => ({ key, label: filterLabels[key] || key, value }))
  ), [defaultFilters, filters])
  const totals = useMemo(() => (
    activeReport?.columns ? calculateTotals(activeReport.columns, rows) : {}
  ), [activeReport, rows])
  const comparisonPeriod = useMemo(() => buildPreviousPeriodFilters(filters), [filters])
  const kpiCards = useMemo(() => (
    (activeReport?.kpis || []).map((key) => {
      const meta = kpiMetaByKey[key] || { label: key, type: 'currency' }
      const currentValue = Number(kpiValues[key] || 0)
      const previousValue = Number(comparisonKpiValues[key] || 0)
      const varianceValue = currentValue - previousValue
      const variancePercent = previousValue ? (varianceValue / Math.abs(previousValue)) * 100 : currentValue ? 100 : 0
      return {
        key,
        label: meta.label,
        type: meta.type,
        currentValue,
        previousValue,
        varianceValue,
        variancePercent,
      }
    })
  ), [activeReport, comparisonKpiValues, kpiValues])

  useEffect(() => {
    if (!activeReport?.code) return

    let cancelled = false

    const loadReport = async () => {
      setIsLoading(true)
      const [currentReport, previousReport] = await Promise.all([
        loadLiveReportData(activeReport, filters),
        comparisonEnabled ? loadLiveReportData(activeReport, comparisonPeriod) : Promise.resolve(null),
      ])

      if (cancelled) return

      setRows(currentReport.rows || [])
      setKpiValues(currentReport.kpis || {})
      setFilterOptions(currentReport.filterOptions || {})
      setComparisonRows(previousReport?.rows || [])
      setComparisonKpiValues(previousReport?.kpis || {})
      setErrors([...(currentReport.errors || []), ...(previousReport?.errors || [])])
      setIsLoading(false)
    }

    loadReport()

    return () => {
      cancelled = true
    }
  }, [activeReport, comparisonEnabled, comparisonPeriod, filters])

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const handleRemoveFilter = (key) => {
    setFilters((current) => ({
      ...current,
      [key]: defaultFilters[key] || '',
    }))
  }

  const handleResetFilters = () => {
    setFilters({ ...defaultFilters })
  }

  const exportMeta = {
    companyName: company?.software_name || company?.name || 'Aura Stay ERP',
    propertyName: filters.property !== 'All Properties' ? filters.property : company?.name || 'Aura Stay',
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    currency: filters.currency,
    generatedBy: userName || 'System',
  }

  const handleExport = async (format) => {
    if (!activeReport?.code) return

    if (format === 'csv') exportReportCsv(activeReport, rows, totals, exportMeta)
    if (format === 'excel') await exportReportExcel(activeReport, rows, totals, exportMeta)
    if (format === 'pdf') exportReportPdf(activeReport, rows, totals, exportMeta)

    await logReportExport({
      report: activeReport,
      format,
      filters,
      userId,
      userName,
    })
  }

  const handlePrint = async () => {
    if (!activeReport?.code) return

    const printSettings = getReportPrintSettings(activeReport)
    const printWindow = window.open('', '_blank', 'width=1440,height=900')
    if (!printWindow) return

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n')
    const markup = renderToStaticMarkup(
      <ReportPrintDocument
        company={company}
        report={activeReport}
        filters={filters}
        rows={rows}
        generatedBy={userName}
      />
    )

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${activeReport.name || activeReport.label || 'Report'}</title>
          ${styles}
        </head>
        <body class="${printSettings.printClass}">
          ${markup}
          <script>window.onload = () => window.print()</script>
        </body>
      </html>
    `)
    printWindow.document.close()

    await logReportPrint({
      report: activeReport,
      pageSize: printSettings.pageSize,
      filters,
      userId,
      userName,
    })
  }

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
        kpiStrip={<KpiStrip items={kpis} />}
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

        <Card className={`border-border shadow-sm ${isFullscreen ? 'fixed inset-4 z-50 overflow-auto' : ''}`}>
          <CardHeader>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <CardTitle>{activeReport?.name || activeReport?.label || 'Select a report'}</CardTitle>
                <CardDescription>
                  {activeReport
                    ? `${categoryLabel} · ${company?.name || 'Aura Stay'}`
                    : `${categoryLabel} · ${selectedCount} available report${selectedCount === 1 ? '' : 's'}`}
                </CardDescription>
              </div>
              {activeReport?.code ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={() => handleExport('csv')} disabled={isLoading}>
                    <Download className="size-4" />
                    CSV
                  </Button>
                  <Button variant="outline" onClick={() => handleExport('excel')} disabled={isLoading}>
                    <Download className="size-4" />
                    Excel
                  </Button>
                  <Button variant="outline" onClick={() => handleExport('pdf')} disabled={isLoading}>
                    <Download className="size-4" />
                    PDF
                  </Button>
                  <Button variant="outline" onClick={handlePrint} disabled={isLoading}>
                    <Printer className="size-4" />
                    Print
                  </Button>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeReport?.code ? (
              <>
                <ReportFilterPanel
                  filters={filters}
                  filterOptions={filterOptions}
                  expanded={filterExpanded}
                  onToggleExpanded={() => setFilterExpanded((current) => !current)}
                  onChange={handleFilterChange}
                  appliedFilters={appliedFilters}
                  onRemoveFilter={handleRemoveFilter}
                  onResetFilters={handleResetFilters}
                />

                {errors.length ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {errors.join(' ')}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>Signed in as <span className="font-medium text-foreground">{userName || 'User'}</span>.</span>
                  <span>Current period: <span className="font-medium text-foreground">{formatPeriodLabel(filters)}</span></span>
                  {comparisonEnabled ? (
                    <span>Comparing against <span className="font-medium text-foreground">{formatPeriodLabel(comparisonPeriod)}</span></span>
                  ) : null}
                  {isLoading ? <span className="text-foreground">Refreshing report data…</span> : null}
                </div>

                {kpiCards.length ? <ReportKpiCards cards={kpiCards} currency={filters.currency} /> : null}

                <DynamicReportTable
                  report={activeReport}
                  rows={rows}
                  comparisonRows={comparisonRows}
                  comparisonEnabled={comparisonEnabled}
                  onToggleComparison={() => setComparisonEnabled((current) => !current)}
                  currentPeriodLabel={formatPeriodLabel(filters)}
                  previousPeriodLabel={formatPeriodLabel(comparisonPeriod)}
                  currency={filters.currency}
                  onRefresh={() => setFilters((current) => ({ ...current }))}
                  isRefreshing={isLoading}
                  bookmarked={bookmarked}
                  onToggleBookmark={() => setBookmarked((current) => !current)}
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={() => setIsFullscreen((current) => !current)}
                />
              </>
            ) : activeReport ? (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Report <span className="font-medium text-foreground">{activeReport.label}</span> is selected.
                  Use the left panel to switch reports or legacy destinations.
                </p>
                <p>
                  Signed in as <span className="font-medium text-foreground">{userName || 'User'}</span>.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Pick a report from the list to continue. Access is scoped by your role and enabled modules.
                </p>
                <p>
                  Signed in as <span className="font-medium text-foreground">{userName || 'User'}</span>.
                </p>
              </div>
            )}
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
              This redesigned Reports Center uses standardized page header, KPI strip, module tabs, and responsive side panel patterns.
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
