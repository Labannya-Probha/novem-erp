import { reportCategories, reportTemplates, sampleRows } from './reportTemplates.js'

const currencyKeys = ['grossAmount', 'discount', 'vat', 'serviceCharge', 'netAmount', 'debit', 'credit', 'balance']

export function listReports(user = {}) {
  return {
    categories: reportCategories,
    reports: reportTemplates.map((report) => ({
      code: report.code,
      name: report.name,
      category: report.category,
      ifrsReference: report.ifrsReference,
      exportPermission: report.exportPermission,
      printPermission: report.printPermission,
      canView: hasReportAccess(user, report.code),
    })),
  }
}

export function getReport(reportCode, user = {}) {
  const report = reportTemplates.find((item) => item.code === reportCode)
  if (!report) {
    const error = new Error(`Unknown report code: ${reportCode}`)
    error.status = 404
    throw error
  }
  if (!hasReportAccess(user, reportCode)) {
    const error = new Error('You do not have permission to view this report.')
    error.status = 403
    throw error
  }
  return report
}

export function generateReport(reportCode, payload = {}, user = {}) {
  const report = getReport(reportCode, user)
  const filters = payload.filters || {}
  const rows = filterRows(sampleRows, filters, report)
  const totals = calculateTotals(rows)
  const kpis = calculateKpis(rows)

  return {
    report,
    filters,
    rows,
    totals,
    kpis,
    audit: {
      generatedBy: user.name || user.username || 'system',
      generatedAt: new Date().toISOString(),
      filterHash: Buffer.from(JSON.stringify(filters)).toString('base64url'),
    },
  }
}

export function hasReportAccess(user = {}, reportCode) {
  if (!user.role || ['SUPERUSER', 'ADMIN', 'MANAGER'].includes(user.role)) return true
  const allowed = user.reportCodes || []
  return allowed.includes(reportCode)
}

function filterRows(rows, filters, report) {
  return rows
    .filter((row) => {
      if (filters.dateFrom && row.transactionDate < filters.dateFrom) return false
      if (filters.dateTo && row.transactionDate > filters.dateTo) return false
      if (filters.department && !filters.department.startsWith('All') && row.department !== filters.department) return false
      if (filters.paymentMethod && !filters.paymentMethod.startsWith('All') && row.paymentMethod !== filters.paymentMethod) return false
      if (report.category === 'POS' && row.costCenter !== 'F&B') return false
      if (report.category === 'HOTEL_KPI' && row.department !== 'Rooms') return false
      return true
    })
    .map((row, index) => ({ ...row, slNo: index + 1 }))
}

function calculateTotals(rows) {
  return currencyKeys.reduce((acc, key) => {
    acc[key] = rows.reduce((sum, row) => sum + Number(row[key] || 0), 0)
    return acc
  }, {})
}

function calculateKpis(rows) {
  const totals = calculateTotals(rows)
  const roomRevenue = rows.filter((row) => row.department === 'Rooms').reduce((sum, row) => sum + Number(row.netAmount || 0), 0)
  const restaurantRevenue = rows.filter((row) => row.department === 'Restaurant').reduce((sum, row) => sum + Number(row.netAmount || 0), 0)
  return {
    totalRevenue: totals.netAmount,
    roomRevenue,
    restaurantRevenue,
    otherRevenue: Math.max(totals.netAmount - roomRevenue - restaurantRevenue, 0),
    occupancy: 68.5,
    adr: roomRevenue ? roomRevenue / 3 : 0,
    revpar: roomRevenue ? roomRevenue / 5 : 0,
    cashCollection: rows.filter((row) => row.paymentMethod === 'Cash').reduce((sum, row) => sum + Number(row.netAmount || 0), 0),
    cardCollection: rows.filter((row) => row.paymentMethod === 'Card').reduce((sum, row) => sum + Number(row.netAmount || 0), 0),
    outstandingReceivable: totals.balance,
    vatPayable: totals.vat,
    netProfit: totals.netAmount * 0.3,
    gop: totals.netAmount * 0.45,
    ebitdaMargin: totals.netAmount ? 29.9 : 0,
  }
}
