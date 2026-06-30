import {
  BarChart3,
  BedDouble,
  Building2,
  CalendarCheck2,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  HandCoins,
  Landmark,
  PackageCheck,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react'

export const CONFIDENTIAL_NOTE = 'This report is system generated and intended for internal use only.'

export const REPORT_CATEGORIES = [
  { code: 'IFRS', name: 'IFRS Financial Reports', icon: Landmark, description: 'IAS/IFRS presentation reports for management and statutory review.' },
  { code: 'HOTEL_KPI', name: 'Hotel KPI & Operations', icon: BedDouble, description: 'Occupancy, rooms, reservations, guest ledger, and night audit reports.' },
  { code: 'POS', name: 'Restaurant POS', icon: Receipt, description: 'Restaurant sales, KOT, outlet collection, and cashier control reports.' },
  { code: 'ACCOUNTING', name: 'Accounting Control', icon: FileSpreadsheet, description: 'Ledger, receivable, payable, tax, payment, and voucher reports.' },
]

export const STANDARD_FILTERS = [
  { key: 'dateFrom', label: 'Date From', type: 'date', defaultValue: 'monthStart' },
  { key: 'dateTo', label: 'Date To', type: 'date', defaultValue: 'today' },
  { key: 'property', label: 'Property', type: 'select', options: ['All Properties', 'Aura Stay Demo', 'City Branch'] },
  { key: 'outlet', label: 'Outlet', type: 'select', options: ['All Outlets', 'Restaurant', 'Room Service', 'Banquet'] },
  { key: 'department', label: 'Department', type: 'select', options: ['All Departments', 'Rooms', 'Restaurant', 'Accounting', 'Housekeeping', 'Inventory'] },
  { key: 'costCenter', label: 'Cost Center', type: 'select', options: ['All Cost Centers', 'ROOMS', 'F&B', 'ADMIN', 'HK'] },
  { key: 'roomType', label: 'Room Type', type: 'select', options: ['All Room Types', 'Deluxe', 'Suite', 'Family Villa'] },
  { key: 'guestType', label: 'Guest Type', type: 'select', options: ['All Guest Types', 'FIT', 'Corporate', 'OTA', 'Group'] },
  { key: 'reservationSource', label: 'Reservation Source', type: 'select', options: ['All Sources', 'Direct', 'OTA', 'Corporate', 'Walk-in'] },
  { key: 'paymentMethod', label: 'Payment Method', type: 'select', options: ['All Methods', 'Cash', 'Card', 'Mobile Banking', 'Bank Transfer'] },
  { key: 'status', label: 'Status', type: 'select', options: ['All Status', 'Open', 'Approved', 'Posted', 'Settled', 'Cancelled'] },
  { key: 'user', label: 'User', type: 'select', options: ['All Users'] },
  { key: 'currency', label: 'Currency', type: 'select', options: ['BDT', 'USD'] },
]

export const STANDARD_COLUMNS = [
  { key: 'slNo', label: 'SL No', type: 'number', align: 'center', width: 72 },
  { key: 'transactionDate', label: 'Transaction Date', type: 'date', align: 'center', width: 130 },
  { key: 'documentNo', label: 'Document No', type: 'code', align: 'center', width: 130 },
  { key: 'voucherNo', label: 'Voucher No', type: 'code', align: 'center', width: 130 },
  { key: 'reservationNo', label: 'Reservation No', type: 'code', align: 'center', width: 140 },
  { key: 'guestId', label: 'Guest ID', type: 'code', align: 'center', width: 110 },
  { key: 'guestName', label: 'Guest Name', type: 'text', align: 'left', width: 180 },
  { key: 'roomNo', label: 'Room No', type: 'code', align: 'center', width: 95 },
  { key: 'roomType', label: 'Room Type', type: 'text', align: 'left', width: 130 },
  { key: 'department', label: 'Department', type: 'text', align: 'left', width: 140 },
  { key: 'costCenter', label: 'Cost Center', type: 'code', align: 'center', width: 120 },
  { key: 'accountCode', label: 'Account Code', type: 'code', align: 'center', width: 120 },
  { key: 'accountName', label: 'Account Name', type: 'text', align: 'left', width: 180 },
  { key: 'description', label: 'Description', type: 'text', align: 'left', width: 220 },
  { key: 'quantity', label: 'Quantity', type: 'number', align: 'right', width: 95 },
  { key: 'rate', label: 'Rate', type: 'currency', align: 'right', width: 110, total: false },
  { key: 'grossAmount', label: 'Gross Amount', type: 'currency', align: 'right', width: 130, total: true },
  { key: 'discount', label: 'Discount', type: 'currency', align: 'right', width: 115, total: true },
  { key: 'vat', label: 'VAT', type: 'currency', align: 'right', width: 110, total: true },
  { key: 'serviceCharge', label: 'Service Charge', type: 'currency', align: 'right', width: 130, total: true },
  { key: 'netAmount', label: 'Net Amount', type: 'currency', align: 'right', width: 130, total: true },
  { key: 'debit', label: 'Debit', type: 'currency', align: 'right', width: 120, total: true },
  { key: 'credit', label: 'Credit', type: 'currency', align: 'right', width: 120, total: true },
  { key: 'balance', label: 'Balance', type: 'currency', align: 'right', width: 130, total: true },
  { key: 'paymentMethod', label: 'Payment Method', type: 'text', align: 'left', width: 145 },
  { key: 'createdBy', label: 'Created By', type: 'text', align: 'left', width: 130 },
  { key: 'approvedBy', label: 'Approved By', type: 'text', align: 'left', width: 130 },
  { key: 'status', label: 'Status', type: 'status', align: 'center', width: 110 },
  { key: 'remarks', label: 'Remarks', type: 'text', align: 'left', width: 200 },
]

const c = (key) => STANDARD_COLUMNS.find((col) => col.key === key)

const baseColumns = [
  c('slNo'), c('transactionDate'), c('documentNo'), c('reservationNo'), c('guestName'),
  c('roomNo'), c('department'), c('accountName'), c('description'), c('grossAmount'),
  c('discount'), c('vat'), c('serviceCharge'), c('netAmount'), c('paymentMethod'), c('status'),
]

const financialColumns = [
  c('slNo'), c('accountCode'), c('accountName'), c('description'), c('debit'), c('credit'), c('balance'), c('remarks'),
]

const hotelColumns = [
  c('slNo'), c('transactionDate'), c('reservationNo'), c('guestId'), c('guestName'), c('roomNo'), c('roomType'),
  c('reservationSource'), c('grossAmount'), c('netAmount'), c('status'),
].filter(Boolean)

const posColumns = [
  c('slNo'), c('transactionDate'), c('documentNo'), c('department'), c('costCenter'), c('description'),
  c('quantity'), c('rate'), c('grossAmount'), c('discount'), c('vat'), c('serviceCharge'), c('netAmount'),
  c('paymentMethod'), c('createdBy'), c('status'),
]

export const DASHBOARD_KPIS = [
  { key: 'totalRevenue', label: 'Total Revenue', type: 'currency', icon: TrendingUp },
  { key: 'roomRevenue', label: 'Room Revenue', type: 'currency', icon: BedDouble },
  { key: 'restaurantRevenue', label: 'Restaurant Revenue', type: 'currency', icon: Receipt },
  { key: 'otherRevenue', label: 'Other Revenue', type: 'currency', icon: Wallet },
  { key: 'occupancy', label: 'Occupancy %', type: 'percent', icon: Building2 },
  { key: 'adr', label: 'ADR', type: 'currency', icon: BarChart3 },
  { key: 'revpar', label: 'RevPAR', type: 'currency', icon: CalendarCheck2 },
  { key: 'totalGuests', label: 'Total Guests', type: 'number', icon: BedDouble },
  { key: 'checkIns', label: 'Check-ins', type: 'number', icon: ClipboardList },
  { key: 'checkOuts', label: 'Check-outs', type: 'number', icon: ClipboardList },
  { key: 'cancellations', label: 'Cancellations', type: 'number', icon: ClipboardList },
  { key: 'noShows', label: 'No-shows', type: 'number', icon: ClipboardList },
  { key: 'cashCollection', label: 'Cash Collection', type: 'currency', icon: HandCoins },
  { key: 'cardCollection', label: 'Card Collection', type: 'currency', icon: CreditCard },
  { key: 'mobileCollection', label: 'Mobile Banking Collection', type: 'currency', icon: Wallet },
  { key: 'outstandingReceivable', label: 'Outstanding Receivable', type: 'currency', icon: FileSpreadsheet },
  { key: 'vatPayable', label: 'VAT Payable', type: 'currency', icon: Landmark },
  { key: 'netProfit', label: 'Net Profit', type: 'currency', icon: TrendingUp },
  { key: 'gop', label: 'GOP', type: 'currency', icon: PackageCheck },
  { key: 'ebitdaMargin', label: 'EBITDA Margin', type: 'percent', icon: BarChart3 },
]

const ifrsNotes = {
  'IAS 1': 'Presents assets, liabilities, equity, income, expenses, and comparatives with clear subtotals.',
  'IFRS 15': 'Recognizes hotel revenue when performance obligations are satisfied.',
  'IAS 2': 'Reports inventory movements at cost with consumption and closing stock controls.',
  'IAS 16': 'Tracks fixed assets, capitalization, depreciation, and carrying value.',
  'IFRS 16': 'Separates lease liability, finance cost, and right-of-use asset movement.',
  'IAS 7': 'Classifies cash flows into operating, investing, and financing activities.',
}

const makeTemplate = (code, name, category, columns, options = {}) => ({
  code,
  name,
  category,
  reportCategory: REPORT_CATEGORIES.find((x) => x.code === category)?.name || category,
  description: options.description || '',
  ifrsReference: options.ifrsReference || null,
  ifrsNote: options.ifrsReference ? ifrsNotes[options.ifrsReference] : null,
  columns,
  filters: options.filters || STANDARD_FILTERS.map((f) => f.key),
  kpis: options.kpis || ['totalRevenue', 'netAmount', 'outstandingReceivable'],
  grouping: options.grouping || 'department',
  defaultSort: options.defaultSort || { key: 'transactionDate', direction: 'desc' },
  exportPermission: true,
  printPermission: true,
  dataSource: options.dataSource || 'reporting.vw_enterprise_report_rows',
})

export const REPORT_TEMPLATES = [
  makeTemplate('IFRS-SFP', 'Statement of Financial Position', 'IFRS', financialColumns, { ifrsReference: 'IAS 1', grouping: 'classification', description: 'Assets, liabilities, and equity at reporting date.' }),
  makeTemplate('IFRS-PNL', 'Statement of Profit or Loss', 'IFRS', financialColumns, { ifrsReference: 'IAS 1', grouping: 'statementLine', description: 'Revenue, expenses, GOP, EBITDA, and net profit.' }),
  makeTemplate('IFRS-CFS', 'Statement of Cash Flows', 'IFRS', financialColumns, { ifrsReference: 'IAS 7', grouping: 'cashFlowClass', description: 'Operating, investing, and financing cash flow.' }),
  makeTemplate('IFRS-SCE', 'Statement of Changes in Equity', 'IFRS', financialColumns, { ifrsReference: 'IAS 1', grouping: 'equityComponent' }),
  makeTemplate('IFRS-REV-REC', 'Revenue Recognition Report', 'IFRS', baseColumns, { ifrsReference: 'IFRS 15', grouping: 'performanceObligation' }),
  makeTemplate('IFRS-DEF-REV', 'Deferred Revenue Report', 'IFRS', baseColumns, { ifrsReference: 'IFRS 15', grouping: 'status' }),
  makeTemplate('INV-MOV', 'Inventory Movement Report', 'IFRS', [...financialColumns, c('quantity')].filter(Boolean), { ifrsReference: 'IAS 2', grouping: 'itemCategory' }),
  makeTemplate('FA-REG', 'Fixed Asset Register', 'IFRS', financialColumns, { ifrsReference: 'IAS 16', grouping: 'assetClass' }),
  makeTemplate('FA-DEP', 'Depreciation Schedule', 'IFRS', financialColumns, { ifrsReference: 'IAS 16', grouping: 'assetClass' }),
  makeTemplate('LEASE-LIAB', 'Lease Liability Schedule', 'IFRS', financialColumns, { ifrsReference: 'IFRS 16', grouping: 'leaseContract' }),
  makeTemplate('AR-AGING', 'Accounts Receivable Aging', 'ACCOUNTING', financialColumns, { grouping: 'agingBucket' }),
  makeTemplate('AP-AGING', 'Accounts Payable Aging', 'ACCOUNTING', financialColumns, { grouping: 'agingBucket' }),
  makeTemplate('OCC-RPT', 'Occupancy Report', 'HOTEL_KPI', hotelColumns, { kpis: ['occupancy', 'totalGuests', 'roomRevenue'], grouping: 'roomType' }),
  makeTemplate('ADR-RPT', 'ADR Report', 'HOTEL_KPI', hotelColumns, { kpis: ['adr', 'roomRevenue', 'occupancy'], grouping: 'roomType' }),
  makeTemplate('REVPAR-RPT', 'RevPAR Report', 'HOTEL_KPI', hotelColumns, { kpis: ['revpar', 'adr', 'occupancy'], grouping: 'roomType' }),
  makeTemplate('ROOM-REV', 'Room Revenue Report', 'HOTEL_KPI', hotelColumns, { kpis: ['roomRevenue', 'adr', 'revpar'], grouping: 'roomType' }),
  makeTemplate('GUEST-LEDGER', 'Guest Ledger Report', 'HOTEL_KPI', baseColumns, { grouping: 'guestName' }),
  makeTemplate('RES-RPT', 'Reservation Report', 'HOTEL_KPI', hotelColumns, { grouping: 'reservationSource' }),
  makeTemplate('CHECKIN-RPT', 'Check-in Report', 'HOTEL_KPI', hotelColumns, { kpis: ['checkIns', 'totalGuests'], grouping: 'roomType' }),
  makeTemplate('CHECKOUT-RPT', 'Check-out Report', 'HOTEL_KPI', hotelColumns, { kpis: ['checkOuts', 'totalGuests'], grouping: 'roomType' }),
  makeTemplate('NOSHOW-RPT', 'No-show Report', 'HOTEL_KPI', hotelColumns, { kpis: ['noShows'], grouping: 'reservationSource' }),
  makeTemplate('CANCEL-RPT', 'Cancellation Report', 'HOTEL_KPI', hotelColumns, { kpis: ['cancellations'], grouping: 'reservationSource' }),
  makeTemplate('HK-STATUS', 'Housekeeping Status Report', 'HOTEL_KPI', hotelColumns, { grouping: 'status' }),
  makeTemplate('ROOM-AVAIL', 'Room Availability Report', 'HOTEL_KPI', hotelColumns, { grouping: 'roomType' }),
  makeTemplate('REST-SALES', 'Restaurant Sales Report', 'POS', posColumns, { kpis: ['restaurantRevenue', 'vatPayable', 'cashCollection'], grouping: 'outlet' }),
  makeTemplate('POS-COLL', 'POS Collection Report', 'POS', posColumns, { kpis: ['cashCollection', 'cardCollection', 'mobileCollection'], grouping: 'paymentMethod' }),
  makeTemplate('PAY-SUM', 'Payment Summary Report', 'ACCOUNTING', baseColumns, { kpis: ['cashCollection', 'cardCollection', 'mobileCollection'], grouping: 'paymentMethod' }),
  makeTemplate('DAILY-SALES', 'Daily Sales Report', 'ACCOUNTING', baseColumns, { kpis: ['totalRevenue', 'roomRevenue', 'restaurantRevenue'], grouping: 'department' }),
  makeTemplate('NIGHT-AUDIT', 'Night Audit Report', 'ACCOUNTING', baseColumns, { kpis: ['totalRevenue', 'cashCollection', 'outstandingReceivable'], grouping: 'department' }),
]

export function getDefaultFilters(todayISO) {
  const today = todayISO()
  return {
    dateFrom: `${today.slice(0, 8)}01`,
    dateTo: today,
    property: 'All Properties',
    outlet: 'All Outlets',
    department: 'All Departments',
    costCenter: 'All Cost Centers',
    roomType: 'All Room Types',
    guestType: 'All Guest Types',
    reservationSource: 'All Sources',
    paymentMethod: 'All Methods',
    status: 'All Status',
    user: 'All Users',
    currency: 'BDT',
  }
}
