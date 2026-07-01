/* ------------------------------------------------------------------ */
/*  SHARED SETTINGS CONFIGURATION CONSTANTS                            */
/*  Used across multiple settings card components.                      */
/* ------------------------------------------------------------------ */

export const PLAN_OPTIONS = ['TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']
export const SUBSCRIPTION_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED']
export const BILLING_CYCLES = ['MONTHLY', 'QUARTERLY', 'YEARLY']

export const PRIV_ROLES = ['SUPERUSER', 'ADMIN', 'MANAGER', 'FRONT_OFFICE', 'RESTAURANT', 'STORE', 'ACCOUNTS', 'HR', 'HOUSEKEEPING']

export const PRIV_MODULES = [
  'dashboard', 'reservations', 'calendar', 'nightaudit', 'housekeeping', 'pos',
  'facilities', 'inventory', 'vat', 'accounting', 'hr', 'reports', 'settings', 'cms',
]

export const MODULE_LABELS = {
  dashboard: 'Dashboard', reservations: 'Reservations', calendar: 'Booking Calendar',
  nightaudit: 'Night Audit', housekeeping: 'Housekeeping', pos: 'Restaurant POS',
  facilities: 'Facilities', inventory: 'Inventory', vat: 'VAT Center',
  accounting: 'Accounting', hr: 'HR & Office', reports: 'Reports',
  settings: 'Settings', cms: 'Client Management',
}
