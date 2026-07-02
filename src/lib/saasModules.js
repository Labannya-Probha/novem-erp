import {
  BarChart3,
  BedDouble,
  Boxes,
  Calculator,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  MoonStar,
  Settings2,
  ShoppingBasket,
  UtensilsCrossed,
  Users,
} from 'lucide-react'

export const MODULE_ENTITLEMENT_BY_NAV = {
  dashboard: 'frontOffice',
  calendar: 'reservations',
  reservations: 'reservations',
  'reservation-payments': 'reservations',
  crm: 'reservations',
  frontoffice: 'frontOffice',
  nightaudit: 'frontOffice',
  housekeeping: 'housekeeping',
  facilities: 'frontOffice',
  pos: 'pos',
  'menu-management': 'pos',
  'pos-print-center': 'pos',
  accounting: 'accounting',
  vat: 'accounting',
  inventory: 'inventory',
  consumption: 'inventory',
  hr: 'hr',
  reports: 'reports',
  tasks: 'tasks',
  'ai-tasker': 'tasks',
  'master-data': 'settings',
  cms: 'settings',
  settings: 'settings',
}

export const SAAS_MODULES = {
  dashboard: {
    title: 'Executive Dashboard',
    category: 'Hospitality ERP',
    entitlement: 'frontOffice',
    icon: LayoutDashboard,
    summary: 'Revenue, occupancy, arrivals, departures and cash collection at property level.',
    features: ['Tenant isolated', 'Live KPIs', 'Revenue view', 'Today summary'],
  },
  reservations: {
    title: 'Reservations',
    category: 'Sales & Reservation',
    entitlement: 'reservations',
    icon: CalendarDays,
    summary: 'Reservation lifecycle from query, quotation and confirmation to folio handoff.',
    features: ['Search & filters', 'Room allocation', 'Guest profile', 'Audit trail'],
  },
  frontoffice: {
    title: 'Front Office',
    category: 'Operations',
    entitlement: 'frontOffice',
    icon: BedDouble,
    summary: 'In-house guests, check-in, check-out, room status, folio and ledger control.',
    features: ['Day close', 'Room board', 'Guest ledger', 'Outstanding balance'],
  },
  housekeeping: {
    title: 'Housekeeping',
    category: 'Operations',
    entitlement: 'housekeeping',
    icon: BedDouble,
    summary: 'Room readiness, cleaning status, occupied rooms and out-of-order tracking.',
    features: ['Status board', 'Assignment', 'Room readiness', 'Live updates'],
  },
  pos: {
    title: 'Food & Beverage POS',
    category: 'Restaurant Operations',
    entitlement: 'pos',
    icon: UtensilsCrossed,
    summary: 'Order taking, settlement, KOT/BOT routing, receipt and restaurant revenue flow.',
    features: ['Order screen', 'KOT/BOT', 'Receipt print', 'Tenant POS branding'],
  },
  accounting: {
    title: 'Accounting',
    category: 'Finance',
    entitlement: 'accounting',
    icon: Calculator,
    summary: 'Vouchers, ledgers, receivables, payables, VAT, trial balance and IFRS reports.',
    features: ['Role approval', 'Voucher audit', 'IFRS output', 'VAT ready'],
  },
  inventory: {
    title: 'Inventory & Procurement',
    category: 'Back Office',
    entitlement: 'inventory',
    icon: Boxes,
    summary: 'Item master, requisition, purchase order, receipt, transfer and stock movement.',
    features: ['Low stock alert', 'PO workflow', 'Stock movement', 'Supplier records'],
  },
  hr: {
    title: 'HR & Payroll',
    category: 'People Operations',
    entitlement: 'hr',
    icon: Users,
    summary: 'Employees, attendance, leave, payroll, letters and compliance documentation.',
    features: ['Employee file', 'Attendance', 'Payroll', 'Letters'],
  },
  reports: {
    title: 'Reports',
    category: 'Business Intelligence',
    entitlement: 'reports',
    icon: BarChart3,
    summary: 'IFRS, hotel KPI, restaurant POS, accounting, inventory and HR reporting.',
    features: ['Excel/PDF/CSV', 'A4 print', 'Role access', 'Tenant branding'],
  },
  tasks: {
    title: 'Task Management',
    category: 'Workflow',
    entitlement: 'tasks',
    icon: ListChecks,
    summary: 'Cross-department task assignment, priority, deadline and completion tracking.',
    features: ['Assignments', 'Priorities', 'Overdue alerts', 'AI tasker'],
  },
  settings: {
    title: 'Settings & Administration',
    category: 'Tenant Administration',
    entitlement: 'settings',
    icon: Settings2,
    summary: 'Tenant branding, users, roles, permissions, tax, print and system controls.',
    features: ['Tenant branding', 'RBAC', 'User limits', 'Audit controls'],
  },
  facilities: {
    title: 'Service Bills',
    category: 'Ancillary Revenue',
    entitlement: 'frontOffice',
    icon: ShoppingBasket,
    summary: 'Facility and extra-service billing with folio and collection linkage.',
    features: ['Service catalogue', 'Bill posting', 'Payment collection', 'Print'],
  },
  nightaudit: {
    title: 'Night Audit',
    category: 'Front Office Control',
    entitlement: 'frontOffice',
    icon: MoonStar,
    summary: 'Daily audit close, unposted charge review and operational control reports.',
    features: ['Day close', 'Audit report', 'Exception checks', 'Locked dates'],
  },
  consumption: {
    title: 'Consumption Entry',
    category: 'Inventory Control',
    entitlement: 'inventory',
    icon: ClipboardList,
    summary: 'Department-wise consumption issue and stock write-off recording.',
    features: ['Department issue', 'Stock impact', 'Cost center', 'Audit trail'],
  },
}

export function moduleForNav(navId) {
  if (SAAS_MODULES[navId]) return SAAS_MODULES[navId]
  const entitlement = MODULE_ENTITLEMENT_BY_NAV[navId]
  return Object.values(SAAS_MODULES).find((m) => m.entitlement === entitlement) || SAAS_MODULES.dashboard
}

export function isModuleEnabled(navId, modulesEnabled, role) {
  if (role === 'SUPERUSER') return true
  const entitlement = MODULE_ENTITLEMENT_BY_NAV[navId] || navId
  if (!modulesEnabled || Object.keys(modulesEnabled).length === 0) return true
  return modulesEnabled[entitlement] !== false
}
