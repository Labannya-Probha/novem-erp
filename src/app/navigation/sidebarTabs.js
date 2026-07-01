import {
  BookOpen, Scale, BookMarked, Landmark, Lock, ArrowLeftRight, CreditCard, Wallet,
  FileText, UserCog, Users, CalendarCheck, CalendarDays, BadgeDollarSign,
  Calculator, ClipboardList, PartyPopper, AlertTriangle, MessageSquareWarning,
  AlertOctagon, ShieldCheck, Award, Briefcase, Banknote, UsersRound, Siren,
  LogOut, LogIn, CheckCircle, TrendingUp, ArrowUpCircle, ClipboardCheck,
  FileCheck, BookMarked as BookMarkedAlt,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  SIDEBAR NESTED MENU CONFIGURATIONS                                  */
/* ------------------------------------------------------------------ */

export const SIDEBAR_SETTINGS_SECTIONS = [
  { id: 'my-account',           label: 'My Account',              adminOnly: false, superuserOnly: false },
  { id: 'branding',             label: 'Branding',                adminOnly: true,  superuserOnly: false },
  { id: 'pos-print',            label: 'POS Print Settings',      adminOnly: true,  superuserOnly: false },
  { id: 'tax-policy',           label: 'Tax Policy',              adminOnly: false, superuserOnly: false },
  { id: 'allowance',            label: 'Allowance Configuration', adminOnly: false, superuserOnly: true  },
  { id: 'role-permissions',     label: 'Role Permissions',        adminOnly: false, superuserOnly: true  },
  { id: 'admin-feature-access', label: 'Admin Feature Access',    adminOnly: false, superuserOnly: true  },
  { id: 'staff',                label: 'Staff Management',        adminOnly: false, superuserOnly: false },
  { id: 'data-system',          label: 'Data & System',           adminOnly: false, superuserOnly: true  },
]

export const SIDEBAR_CMS_ENTITY_TABS = [
  { id: 'companies',            label: 'Companies' },
  { id: 'agencies',             label: 'Agencies' },
  { id: 'shareholders',         label: 'Shareholders' },
  { id: 'vendors',              label: 'Vendors' },
  { id: 'inv_items',            label: 'Inventory Items' },
  { id: 'menu_categories',      label: 'Menu Categories' },
  { id: 'menu_items',           label: 'Menu Items' },
  { id: 'chart_of_accounts',    label: 'Chart of Accounts' },
  { id: 'rooms',                label: 'Rooms' },
  { id: 'reservation_policies', label: 'Reservation Policies' },
  { id: 'store_locations',      label: 'Store Locations' },
  { id: 'guests',               label: 'Guests' },
]

export const SIDEBAR_INVENTORY_TABS = [
  { id: 'Items & Stock',   label: 'Items & Stock' },
  { id: 'Vendors',         label: 'Vendors' },
  { id: 'Requisitions',    label: 'Requisitions' },
  { id: 'Purchase Orders', label: 'Purchase Orders' },
  { id: 'Goods Receipt',   label: 'Goods Receipt' },
  { id: 'Transfers',       label: 'Transfers' },
  { id: 'Returns',         label: 'Returns' },
]

export const SIDEBAR_POS_TABS = [
  { id: 'orders',           label: 'POS Orders',       path: '/pos' },
  { id: 'receipt-preview',  label: 'Receipt Preview',  path: '/pos/print-center?tab=receipt-preview' },
  { id: 'kot-bot-preview',  label: 'KOT/BOT Preview',  path: '/pos/print-center?tab=kot-bot-preview' },
  { id: 'profiles',         label: 'Print Profiles',   path: '/pos/print-center?tab=profiles' },
  { id: 'routing',          label: 'Printer Routing',  path: '/pos/print-center?tab=routing' },
  { id: 'designer',         label: 'Receipt Designer', path: '/pos/print-center?tab=designer' },
  { id: 'thermal-test',     label: 'Thermal Test',     path: '/pos/print-center?tab=thermal-test' },
  { id: 'logs',             label: 'Print Logs',       path: '/pos/print-center?tab=logs' },
  { id: 'menu-management',  label: 'Menu Management',  path: '/menu-management' },
]

export const SIDEBAR_ACCOUNTING_TABS = [
  { id: 'voucher-entry',       label: 'Voucher Entry',       icon: BookOpen,       path: '/accounting/voucher-entry' },
  { id: 'trial-balance',       label: 'Trial Balance',       icon: Scale,          path: '/accounting/trial-balance' },
  { id: 'chart-of-accounts',   label: 'Chart of Accounts',   icon: BookMarked,     path: '/accounting/chart-of-accounts' },
  { id: 'fixed-assets',        label: 'Fixed Assets',        icon: Landmark,       path: '/accounting/fixed-assets' },
  { id: 'opening-balance',     label: 'Opening Balance',     icon: Lock,           path: '/accounting/opening-balance', adminOnly: true },
  { id: 'transaction-mapping', label: 'Transaction Mapping', icon: ArrowLeftRight, path: '/accounting/transaction-mapping', adminOnly: true },
  { id: 'vendor-payments',     label: 'Vendor Payments',     icon: CreditCard,     path: '/accounting/vendor-payments' },
  { id: 'vat',                 label: 'VAT Centre',          icon: Wallet,         path: '/vat' },
  { id: 'vat-return',          label: 'VAT Return',          icon: FileText,       path: '/vat-return' },
]

export const SIDEBAR_HR_TABS = [
  { id: 'employee-entry',       label: 'Employee Entry',             icon: UserCog,              path: '/hr/employee-entry' },
  { id: 'service-book',         label: 'Service Book Entry',         icon: BookOpen,             path: '/hr/service-book' },
  { id: 'nominee',              label: 'Nominee Declaration',        icon: Users,                path: '/hr/nominee' },
  { id: 'leave-entry',          label: 'Leave Entry',                icon: CalendarCheck,        path: '/hr/leave-entry' },
  { id: 'comp-leave',           label: 'Comp Leave Mgmt',            icon: CalendarDays,         path: '/hr/comp-leave' },
  { id: 'festival-leave',       label: 'Festival Leave Mgmt',        icon: PartyPopper,          path: '/hr/festival-leave' },
  { id: 'payroll-config',       label: 'Payroll Configuration',      icon: BadgeDollarSign,      path: '/hr/payroll-config' },
  { id: 'payroll-gen',          label: 'Payroll Generation',         icon: Calculator,           path: '/hr/payroll-gen' },
  { id: 'payroll-register',     label: 'Payroll Register',           icon: ClipboardList,        path: '/hr/payroll-register' },
  { id: 'offer-letter',         label: 'Offer Letter',               icon: FileText,             path: '/hr/offer-letter' },
  { id: 'appointment-letter',   label: 'Appointment Letter',         icon: FileCheck,            path: '/hr/appointment-letter' },
  { id: 'joining-letter',       label: 'Joining Letter',             icon: LogIn,                path: '/hr/joining-letter' },
  { id: 'confirmation-letter',  label: 'Confirmation Letter',        icon: CheckCircle,          path: '/hr/confirmation-letter' },
  { id: 'increment-letter',     label: 'Salary Increment Letter',    icon: TrendingUp,           path: '/hr/increment-letter' },
  { id: 'promotion-letter',     label: 'Promotion Letter',           icon: ArrowUpCircle,        path: '/hr/promotion-letter' },
  { id: 'objection-letter',     label: 'Objection Letter',           icon: AlertTriangle,        path: '/hr/objection-letter' },
  { id: 'show-cause',           label: 'Show Cause Letter',          icon: MessageSquareWarning, path: '/hr/show-cause' },
  { id: 'warning-letter',       label: 'Warning Letter',             icon: AlertOctagon,         path: '/hr/warning-letter' },
  { id: 'dismissal-letter',     label: 'Letter of Dismissal',        icon: LogOut,               path: '/hr/dismissal-letter' },
  { id: 'noc',                  label: 'No Objection Certificate',   icon: ShieldCheck,          path: '/hr/noc' },
  { id: 'experience-cert',      label: 'Experience Certificate',     icon: Award,                path: '/hr/experience-cert' },
  { id: 'employment-cert',      label: 'Employment Certificate',     icon: Briefcase,            path: '/hr/employment-cert' },
  { id: 'final-payment',        label: 'Final Payment Letter',       icon: Banknote,             path: '/hr/final-payment' },
  { id: 'attendance-register',  label: 'Attendance Register',        icon: ClipboardCheck,       path: '/hr/attendance-register' },
  { id: 'employee-register',    label: 'Employee Register (Form-8)', icon: UsersRound,           path: '/hr/employee-register' },
  { id: 'service-book-reg',     label: 'Service Book',               icon: BookMarkedAlt,        path: '/hr/service-book-reg' },
  { id: 'incidents',            label: 'Incidents',                  icon: Siren,                path: '/hr/incidents' },
  { id: 'compliance',           label: 'Compliance',                 icon: Scale,                path: '/hr/compliance' },
]
