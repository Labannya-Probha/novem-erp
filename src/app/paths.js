/* ------------------------------------------------------------------ */
/*  PATH CONSTANTS — single source of truth for all route path strings  */
/*  Import this everywhere instead of writing path strings inline.      */
/* ------------------------------------------------------------------ */

export const PATHS = {
  // Root / auth
  ROOT: '/',
  LOGIN: '/login',

  // Front Office
  FRONTOFFICE: '/frontoffice',
  DASHBOARD: '/dashboard',           // legacy alias → redirects to /frontoffice
  FRONTOFFICE_RESERVATION_DETAIL: '/frontoffice/reservations/:id',
  NIGHTAUDIT: '/nightaudit',
  HOUSEKEEPING: '/housekeeping',
  FACILITIES: '/facilities',

  // Reservations
  RESERVATIONS: '/reservations',
  RESERVATION_DETAIL: '/reservations/:id',
  RESERVATION_PAYMENTS: '/reservation-payments',
  CALENDAR: '/calendar',
  BOOKING_CALENDAR: '/booking-calendar',  // legacy alias → /calendar
  CRM: '/crm',

  // POS
  RESTAURANT: '/restaurant',
  POS: '/pos',
  GUEST_KIOSK: '/kiosk/pos',
  MENU_MANAGEMENT: '/menu-management',
  POS_PRINT_CENTER: '/pos/print-center',
  VERIFY_BILL: '/verify/pos/:id',

  // Inventory
  INVENTORY: '/inventory',
  CONSUMPTION: '/consumption',

  // Accounting
  ACCOUNTING: '/accounting',
  ACCOUNTING_VOUCHER: '/accounting/voucher-entry',
  ACCOUNTING_TRIAL: '/accounting/trial-balance',
  ACCOUNTING_COA: '/accounting/chart-of-accounts',
  ACCOUNTING_ASSETS: '/accounting/fixed-assets',
  ACCOUNTING_OPENING: '/accounting/opening-balance',
  ACCOUNTING_TX_MAP: '/accounting/transaction-mapping',
  ACCOUNTING_VENDOR_PAYMENTS: '/accounting/vendor-payments',
  VAT: '/vat',
  VAT_RETURN: '/vat-return',

  // HR
  HR: '/hr',
  HR_EMPLOYEE_ENTRY: '/hr/employee-entry',
  HR_SERVICE_BOOK: '/hr/service-book',
  HR_NOMINEE: '/hr/nominee',
  HR_LEAVE_ENTRY: '/hr/leave-entry',
  HR_COMP_LEAVE: '/hr/comp-leave',
  HR_FESTIVAL_LEAVE: '/hr/festival-leave',
  HR_PAYROLL_CONFIG: '/hr/payroll-config',
  HR_PAYROLL_GEN: '/hr/payroll-gen',
  HR_PAYROLL_REGISTER: '/hr/payroll-register',
  HR_OFFER_LETTER: '/hr/offer-letter',
  HR_APPOINTMENT_LETTER: '/hr/appointment-letter',
  HR_JOINING_LETTER: '/hr/joining-letter',
  HR_CONFIRMATION_LETTER: '/hr/confirmation-letter',
  HR_INCREMENT_LETTER: '/hr/increment-letter',
  HR_PROMOTION_LETTER: '/hr/promotion-letter',
  HR_OBJECTION_LETTER: '/hr/objection-letter',
  HR_SHOW_CAUSE: '/hr/show-cause',
  HR_WARNING_LETTER: '/hr/warning-letter',
  HR_DISMISSAL_LETTER: '/hr/dismissal-letter',
  HR_NOC: '/hr/noc',
  HR_EXPERIENCE_CERT: '/hr/experience-cert',
  HR_EMPLOYMENT_CERT: '/hr/employment-cert',
  HR_FINAL_PAYMENT: '/hr/final-payment',
  HR_ATTENDANCE_REGISTER: '/hr/attendance-register',
  HR_EMPLOYEE_REGISTER: '/hr/employee-register',
  HR_SERVICE_BOOK_REG: '/hr/service-book-reg',
  HR_INCIDENTS: '/hr/incidents',
  HR_COMPLIANCE: '/hr/compliance',

  // Reports
  REPORTS: '/reports',
  REPORTS_CASED_ALIAS: '/Reports',
  TENANT_REPORTS: '/:slug/reports',
  TENANT_REPORTS_CASED_ALIAS: '/:slug/Reports',

  // Tasks
  TASKS: '/tasks',
  AI_TASKER: '/ai-tasker',

  // System / Config
  CMS: '/cms',
  SETTINGS: '/settings',
}
