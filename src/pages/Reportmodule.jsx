import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, FileDown, Printer } from 'lucide-react'
import { Button } from '../components/ui/button'
import PrintPortal from '../components/PrintPortal'
import EnterpriseReportHeader from '../components/reports/EnterpriseReportHeader'
import EnterpriseReportFooter from '../components/reports/EnterpriseReportFooter'
import ReportFilterPanel from '../components/reports/ReportFilterPanel'
import ReportKpiCards from '../components/reports/ReportKpiCards'
import DynamicReportTable, { calculateTotals } from '../components/reports/DynamicReportTable'
import ReportPrintDocument from '../components/reports/ReportPrintDocument'
import {
  getDefaultFilters,
} from '../lib/reporting/reportConfig'
import { loadLiveReportData } from '../lib/reporting/liveReportData'
import { exportReportCsv, exportReportExcel, exportReportPdf, getReportPrintSettings } from '../lib/reporting/reportExport'
import { todayISO } from '../lib/helpers'
import { buildBrandTheme } from '../lib/branding'
import { getRoleDefaultReportCatalog, getTenantReportContext, loadTenantReportCatalog, logReportExport, logReportPrint } from '../lib/reporting/tenantReporting'

export default function Reports({ userName, userId, role, company }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const reportParam = searchParams.get('report')
  const [activeCode, setActiveCode] = useState(reportParam || 'IFRS-PNL')
  const [filters, setFilters] = useState(() => getDefaultFilters(todayISO))
  const [search, setSearch] = useState('')
  const [printReport, setPrintReport] = useState(null)
  const [reportData, setReportData] = useState({ rows: [], kpis: {}, sourceCounts: {}, errors: [] })
  const [tenantReports, setTenantReports] = useState(() => getRoleDefaultReportCatalog(role))
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [loading, setLoading] = useState(false)

  const activeReport = useMemo(
    () => tenantReports.find((report) => report.code === activeCode) || tenantReports[0],
    [activeCode, tenantReports]
  )
  const activeKpiKeys = activeReport?.kpis?.length ? activeReport.kpis : ['totalRevenue', 'roomRevenue', 'restaurantRevenue', 'outstandingReceivable']
  const rows = reportData.rows
  const totals = useMemo(() => activeReport ? calculateTotals(activeReport.columns, rows) : {}, [activeReport, rows])
  const sourceCount = Object.values(reportData.sourceCounts || {}).reduce((sum, count) => sum + Number(count || 0), 0)
  const printSettings = useMemo(() => getReportPrintSettings(activeReport), [activeReport])
  const previewPrintSettings = useMemo(() => getReportPrintSettings(printReport || activeReport), [printReport, activeReport])
  const reportTheme = useMemo(() => buildBrandTheme({
    primary: company?.primary_color || company?.brand_primary,
    accent: company?.accent_color || company?.brand_accent,
    printPrimary: company?.print_primary_color || company?.brand_primary || company?.primary_color,
    printAccent: company?.print_accent_color || company?.brand_accent || company?.accent_color,
  }), [company])
  const reportStyle = {
    '--erp-blue': reportTheme.printPrimary,
    '--erp-blue-2': reportTheme.primary,
    '--erp-accent': reportTheme.printAccent,
  }
  const tenantContext = useMemo(() => getTenantReportContext(company, role), [company, role])
  const meta = {
    companyName: company?.software_name || company?.name || 'Aura Stay',
    propertyName: filters.property === 'All Properties' ? company?.name || 'All Properties' : filters.property,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    currency: filters.currency,
    generatedBy: userName,
  }

  useEffect(() => {
    if (reportParam && reportParam !== activeCode) {
      setActiveCode(reportParam)
    }
  }, [reportParam, activeCode])

  useEffect(() => {
    let cancelled = false
    setCatalogLoading(true)
    loadTenantReportCatalog({ role, userId })
      .then((reports) => {
        if (cancelled) return
        setTenantReports(reports)
        if (!reports.some((report) => report.code === activeCode)) {
          const nextCode = reports[0]?.code || 'IFRS-PNL'
          setActiveCode(nextCode)
          setSearchParams({ report: nextCode }, { replace: true })
        } else if (!reportParam && activeCode) {
          setSearchParams({ report: activeCode }, { replace: true })
        }
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false)
      })
    return () => { cancelled = true }
  }, [role, userId])

  useEffect(() => {
    if (!activeReport) return
    let cancelled = false
    setLoading(true)
    loadLiveReportData(activeReport, filters)
      .then((data) => {
        if (!cancelled) setReportData(data)
      })
      .catch((error) => {
        if (!cancelled) setReportData({ rows: [], kpis: {}, sourceCounts: {}, errors: [error.message] })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [activeReport, filters])

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const exportAndLog = async (format) => {
    if (!activeReport) return
    await logReportExport({ report: activeReport, format, filters, userId, userName })
    if (format === 'CSV') return exportReportCsv(activeReport, rows, totals, meta)
    if (format === 'PDF') return exportReportPdf(activeReport, rows, totals, meta)
    return exportReportExcel(activeReport, rows, totals, meta)
  }
  const openPrint = async () => {
    if (!activeReport) return
    await logReportPrint({ report: activeReport, pageSize: printSettings.title, filters, userId, userName })
    setPrintReport(activeReport)
  }

  return (
    <div className="enterprise-reporting-module" style={reportStyle}>
      {!activeReport ? (
        <section className="erp-report-canvas">
          <div className="erp-report-warning no-print">
            No reports are assigned to this tenant role. Ask a tenant administrator to grant report access.
          </div>
        </section>
      ) : null}
      {activeReport && printReport && (
        <PrintPortal
          title={`${printReport.name} - ${previewPrintSettings.title}`}
          onClose={() => setPrintReport(null)}
          primaryColor={reportTheme.printPrimary}
          accentColor={reportTheme.printAccent}
          type={previewPrintSettings.portalType}
        >
          <div className={previewPrintSettings.printClass}>
            <ReportPrintDocument company={company} report={printReport} filters={filters} rows={rows} generatedBy={userName} />
          </div>
        </PrintPortal>
      )}

      <section className="erp-dashboard-top no-print">
        <div className="erp-dashboard-copy">
          <span className="erp-dashboard-kicker">Enterprise SaaS Reporting</span>
          <h1>Reporting Workbench</h1>
          <p>{tenantContext.tenantName} / {tenantContext.propertyName} / {activeReport?.reportCategory || 'Reports'}</p>
          <div className="erp-dashboard-meta">
            <span>{activeReport?.code || 'REPORT'}</span>
            <span>{printSettings.title}</span>
            <span>{activeReport?.columns?.length || 0} Columns</span>
          </div>
        </div>
        <div className="erp-top-actions">
          <Button variant="outline" disabled={!activeReport?.exportPermission} onClick={() => exportAndLog('CSV')}>
            <Download size={15} /> CSV
          </Button>
          <Button variant="outline" disabled={!activeReport?.exportPermission} onClick={() => exportAndLog('PDF')}>
            <FileDown size={15} /> PDF
          </Button>
          <Button variant="outline" disabled={!activeReport?.printPermission} onClick={openPrint}>
            <Printer size={15} /> Print
          </Button>
          <Button variant="outline" disabled={!activeReport?.exportPermission} onClick={() => exportAndLog('EXCEL')}>
            <Download size={15} /> Excel
          </Button>
        </div>
      </section>

      <section className="erp-workspace erp-workspace-single">
        {activeReport && <main className="erp-report-canvas">
          <div className="erp-report-document-bar no-print">
            <div>
              <span>{activeReport.code}</span>
              <strong>{activeReport.name}</strong>
            </div>
            <div className="erp-report-document-meta">
              <span>{printSettings.title}</span>
              <small>{catalogLoading ? 'Loading access' : `${tenantReports.length} role reports available in sidebar`}</small>
            </div>
          </div>
          <EnterpriseReportHeader company={company} report={activeReport} filters={filters} generatedBy={userName} />
          <div className="erp-live-report-status no-print">
            <span className={loading ? 'loading' : 'ready'}>{loading ? 'Loading tenant records...' : 'Tenant isolated data'}</span>
            <b>{rows.length} report rows</b>
            <small>{sourceCount} tenant records scanned</small>
            <small>Role: {role || 'User'}</small>
          </div>
          {reportData.errors?.length > 0 && (
            <div className="erp-report-warning no-print">
              {reportData.errors.join(' ')}
            </div>
          )}
          <ReportKpiCards values={reportData.kpis} activeKeys={activeKpiKeys} />
          <ReportFilterPanel
            filters={filters}
            onChange={updateFilter}
            search={search}
            onSearchChange={setSearch}
            activeFilterKeys={activeReport.filters}
            filterOptions={reportData.filterOptions}
          />
          <DynamicReportTable report={activeReport} rows={rows} search={search} />
          <EnterpriseReportFooter printedBy={userName} />
        </main>}
      </section>
    </div>
  )
}
