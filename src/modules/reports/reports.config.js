import { PATHS } from '../../app/paths'

export const REPORT_CATEGORY_TABS = [
  { id: 'financial', label: 'Financial' },
  { id: 'hotel-operations', label: 'Hotel Operations' },
  { id: 'restaurant-pos', label: 'Restaurant & POS' },
  { id: 'accounting-control', label: 'Accounting Control' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'hr', label: 'HR' },
  { id: 'management', label: 'Management' },
]

export const REPORTS_CENTER_MAP = {
  financial: [
    { id: 'income-statement', label: 'Income Statement', reportCode: 'IFRS-PNL' },
    { id: 'balance-sheet', label: 'Balance Sheet', reportCode: 'IFRS-SFP' },
    { id: 'cash-flow', label: 'Cash Flow', reportCode: 'IFRS-CFS' },
    { id: 'trial-balance', label: 'Trial Balance', route: PATHS.ACCOUNTING_TRIAL },
  ],
  'hotel-operations': [
    { id: 'occupancy', label: 'Occupancy', reportCode: 'OCC-RPT' },
    { id: 'arrival-departure', label: 'Arrival / Departure', reportCode: 'CHECKIN-RPT' },
    { id: 'room-revenue', label: 'Room Revenue', reportCode: 'ROOM-REV' },
    { id: 'guest-ledger', label: 'Guest Ledger', reportCode: 'GUEST-LEDGER' },
    { id: 'night-audit-report', label: 'Night Audit Report', reportCode: 'NIGHT-AUDIT' },
    { id: 'reservation-source', label: 'Reservation Source', reportCode: 'RES-RPT' },
  ],
  'restaurant-pos': [
    { id: 'daily-sales', label: 'Daily Sales', reportCode: 'DAILY-SALES' },
    { id: 'outlet-collection', label: 'Outlet Collection', reportCode: 'POS-COLL' },
    { id: 'item-wise-sales', label: 'Item-wise Sales', reportCode: 'REST-SALES' },
    { id: 'kot-register', label: 'KOT Register', route: PATHS.POS_PRINT_CENTER },
  ],
  'accounting-control': [
    { id: 'payment-collection', label: 'Payment Collection', reportCode: 'PAY-SUM' },
    { id: 'voucher-register', label: 'Voucher Register', route: PATHS.ACCOUNTING_VOUCHER },
    { id: 'ar-ap-ageing', label: 'AR/AP Ageing', reportCode: 'AR-AGING' },
    { id: 'vat-sales-register', label: 'VAT Sales Register', route: PATHS.VAT },
    { id: 'vds-certificate-register', label: 'VDS Certificate Register', route: PATHS.VAT_RETURN },
  ],
  inventory: [
    { id: 'stock-balance', label: 'Stock Balance', reportCode: 'INV-MOV' },
    { id: 'purchase-order-register', label: 'Purchase Order Register', route: `${PATHS.INVENTORY}?tab=purchase-orders` },
    { id: 'consumption-report', label: 'Consumption Report', route: `${PATHS.INVENTORY}?tab=consumption` },
    { id: 'item-average-cost', label: 'Item Average Cost', reportCode: 'INV-MOV' },
  ],
  hr: [
    { id: 'attendance-register', label: 'Attendance Register', route: PATHS.HR_ATTENDANCE_REGISTER },
    { id: 'employee-register', label: 'Employee Register', route: PATHS.HR_EMPLOYEE_REGISTER },
    { id: 'payroll-register', label: 'Payroll Register', route: PATHS.HR_PAYROLL_REGISTER },
    { id: 'service-book-register', label: 'Service Book Register', route: PATHS.HR_SERVICE_BOOK_REG },
  ],
  management: [
    { id: 'revenue-by-property', label: 'Revenue by Property', reportCode: 'DAILY-SALES' },
    { id: 'kpi-dashboard', label: 'KPI Dashboard', reportCode: 'OCC-RPT' },
    { id: 'department-pnl', label: 'Department P&L', reportCode: 'IFRS-PNL' },
  ],
}

const LEGACY_CATEGORY_MAP = {
  IFRS: 'financial',
  HOTEL_KPI: 'hotel-operations',
  POS: 'restaurant-pos',
  ACCOUNTING: 'accounting-control',
}

export const REPORT_CODE_CATEGORY_MAP = Object.entries(REPORTS_CENTER_MAP)
  .reduce((acc, [slug, reports]) => {
    reports.forEach((report) => {
      if (report.reportCode && !acc[report.reportCode]) {
        acc[report.reportCode] = slug
      }
    })
    return acc
  }, {})

export function getReportsByCategory(category) {
  return REPORTS_CENTER_MAP[category] || []
}

export function getCategoryFromReportCode(reportCode, tenantReports = []) {
  if (!reportCode) return null
  if (REPORT_CODE_CATEGORY_MAP[reportCode]) return REPORT_CODE_CATEGORY_MAP[reportCode]

  const catalogReport = tenantReports.find((report) => report.code === reportCode)
  return LEGACY_CATEGORY_MAP[catalogReport?.category] || null
}

export function getFirstCategoryWithAccess(tenantReports = []) {
  const allowedCodes = new Set(tenantReports.map((report) => report.code))
  const firstWithAllowed = REPORT_CATEGORY_TABS.find((tab) => (
    getReportsByCategory(tab.id).some((item) => !item.reportCode || allowedCodes.has(item.reportCode))
  ))

  return firstWithAllowed?.id || REPORT_CATEGORY_TABS[0].id
}

export function getFirstReportCodeForCategory(category, tenantReports = []) {
  const allowedCodes = new Set(tenantReports.map((report) => report.code))
  return getReportsByCategory(category).find((item) => item.reportCode && allowedCodes.has(item.reportCode))?.reportCode || null
}
