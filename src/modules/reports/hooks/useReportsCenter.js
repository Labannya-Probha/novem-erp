import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { loadTenantReportCatalog } from '../../../lib/reporting/tenantReporting'
import {
  REPORT_CATEGORY_TABS,
  getCategoryFromReportCode,
  getFirstCategoryWithAccess,
  getFirstReportCodeForCategory,
  getReportsByCategory,
} from '../reports.config'

export function useReportsCenter({ role, userId }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tenantReports, setTenantReports] = useState([])

  const selectedCategory = searchParams.get('category')
  const selectedReportCode = searchParams.get('report')

  useEffect(() => {
    let ignore = false

    loadTenantReportCatalog({ role, userId }).then((catalog) => {
      if (ignore) return
      setTenantReports(catalog)

      const fallbackCategory = (
        selectedCategory
        || getCategoryFromReportCode(selectedReportCode, catalog)
        || getFirstCategoryWithAccess(catalog)
      )
      const fallbackReport = selectedReportCode || getFirstReportCodeForCategory(fallbackCategory, catalog)
      const next = new URLSearchParams(searchParams)

      let changed = false
      if (!selectedCategory || selectedCategory !== fallbackCategory) {
        next.set('category', fallbackCategory)
        changed = true
      }
      if (!selectedReportCode && fallbackReport) {
        next.set('report', fallbackReport)
        changed = true
      }

      if (changed) {
        setSearchParams(next, { replace: true })
      }
    })

    return () => { ignore = true }
  }, [role, userId])

  const category = useMemo(() => (
    REPORT_CATEGORY_TABS.some((tab) => tab.id === selectedCategory)
      ? selectedCategory
      : getCategoryFromReportCode(selectedReportCode, tenantReports) || getFirstCategoryWithAccess(tenantReports)
  ), [selectedCategory, selectedReportCode, tenantReports])

  const activeReportCode = useMemo(() => (
    selectedReportCode || getFirstReportCodeForCategory(category, tenantReports)
  ), [category, selectedReportCode, tenantReports])

  const reportsForCategory = useMemo(() => {
    const allowedCodes = new Set(tenantReports.map((report) => report.code))
    const reportByCode = new Map(tenantReports.map((report) => [report.code, report]))
    return getReportsByCategory(category).map((item) => ({
      ...item,
      ...(item.reportCode ? reportByCode.get(item.reportCode) || {} : {}),
      enabled: !item.reportCode || allowedCodes.has(item.reportCode),
    }))
  }, [category, tenantReports])

  const setCategory = (nextCategory) => {
    const next = new URLSearchParams(searchParams)
    next.set('category', nextCategory)
    const nextReportCode = getFirstReportCodeForCategory(nextCategory, tenantReports)
    if (nextReportCode) next.set('report', nextReportCode)
    setSearchParams(next)
  }

  const setReport = (reportCode) => {
    const next = new URLSearchParams(searchParams)
    if (reportCode) next.set('report', reportCode)
    setSearchParams(next)
  }

  return {
    category,
    activeReportCode,
    reportsForCategory,
    setCategory,
    setReport,
    categoryTabs: REPORT_CATEGORY_TABS,
  }
}
