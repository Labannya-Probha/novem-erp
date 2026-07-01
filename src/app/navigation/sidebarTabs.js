import {
  BookOpen, Scale, BookMarked, Landmark, Lock, ArrowLeftRight, CreditCard, Wallet,
  FileText, UserCog, Users, CalendarCheck, CalendarDays, BadgeDollarSign,
  Calculator, ClipboardList, PartyPopper, AlertTriangle, MessageSquareWarning,
  AlertOctagon, ShieldCheck, Award, Briefcase, Banknote, UsersRound, Siren,
  LogOut, LogIn, CheckCircle, TrendingUp, ArrowUpCircle, ClipboardCheck,
  FileCheck, BookMarked as BookMarkedAlt,
} from 'lucide-react'
import { PATHS } from '../paths'
import { SETTINGS_SECTIONS } from './settingsSections'

/* ------------------------------------------------------------------ */
/*  SIDEBAR NESTED MENU CONFIGURATIONS                                  */
/* ------------------------------------------------------------------ */

export const SIDEBAR_SETTINGS_SECTIONS = SETTINGS_SECTIONS

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
  { id: 'orders',           label: 'POS Orders',       path: PATHS.POS },
  { id: 'receipt-preview',  label: 'Receipt Preview',  path: `${PATHS.POS_PRINT_CENTER}?tab=receipt-preview` },
  { id: 'kot-bot-preview',  label: 'KOT/BOT Preview',  path: `${PATHS.POS_PRINT_CENTER}?tab=kot-bot-preview` },
  { id: 'profiles',         label: 'Print Profiles',   path: `${PATHS.POS_PRINT_CENTER}?tab=profiles` },
  { id: 'routing',          label: 'Printer Routing',  path: `${PATHS.POS_PRINT_CENTER}?tab=routing` },
  { id: 'designer',         label: 'Receipt Designer', path: `${PATHS.POS_PRINT_CENTER}?tab=designer` },
  { id: 'thermal-test',     label: 'Thermal Test',     path: `${PATHS.POS_PRINT_CENTER}?tab=thermal-test` },
  { id: 'logs',             label: 'Print Logs',       path: `${PATHS.POS_PRINT_CENTER}?tab=logs` },
  { id: 'menu-management',  label: 'Menu Management',  path: PATHS.MENU_MANAGEMENT },
]

export const SIDEBAR_ACCOUNTING_TABS = [
  { id: 'voucher-entry',       label: 'Voucher Entry',       icon: BookOpen,       path: PATHS.ACCOUNTING_VOUCHER },
  { id: 'trial-balance',       label: 'Trial Balance',       icon: Scale,          path: PATHS.ACCOUNTING_TRIAL },
  { id: 'chart-of-accounts',   label: 'Chart of Accounts',   icon: BookMarked,     path: PATHS.ACCOUNTING_COA },
  { id: 'fixed-assets',        label: 'Fixed Assets',        icon: Landmark,       path: PATHS.ACCOUNTING_ASSETS },
  { id: 'opening-balance',     label: 'Opening Balance',     icon: Lock,           path: PATHS.ACCOUNTING_OPENING, adminOnly: true },
  { id: 'transaction-mapping', label: 'Transaction Mapping', icon: ArrowLeftRight, path: PATHS.ACCOUNTING_TX_MAP, adminOnly: true },
  { id: 'vendor-payments',     label: 'Vendor Payments',     icon: CreditCard,     path: PATHS.ACCOUNTING_VENDOR_PAYMENTS },
  { id: 'vat',                 label: 'VAT Centre',          icon: Wallet,         path: PATHS.VAT },
  { id: 'vat-return',          label: 'VAT Return',          icon: FileText,       path: PATHS.VAT_RETURN },
]

export const SIDEBAR_HR_TABS = [
  { id: 'employee-entry',       label: 'Employee Entry',             icon: UserCog,              path: PATHS.HR_EMPLOYEE_ENTRY },
  { id: 'service-book',         label: 'Service Book Entry',         icon: BookOpen,             path: PATHS.HR_SERVICE_BOOK },
  { id: 'nominee',              label: 'Nominee Declaration',        icon: Users,                path: PATHS.HR_NOMINEE },
  { id: 'leave-entry',          label: 'Leave Entry',                icon: CalendarCheck,        path: PATHS.HR_LEAVE_ENTRY },
  { id: 'comp-leave',           label: 'Comp Leave Mgmt',            icon: CalendarDays,         path: PATHS.HR_COMP_LEAVE },
  { id: 'festival-leave',       label: 'Festival Leave Mgmt',        icon: PartyPopper,          path: PATHS.HR_FESTIVAL_LEAVE },
  { id: 'payroll-config',       label: 'Payroll Configuration',      icon: BadgeDollarSign,      path: PATHS.HR_PAYROLL_CONFIG },
  { id: 'payroll-gen',          label: 'Payroll Generation',         icon: Calculator,           path: PATHS.HR_PAYROLL_GEN },
  { id: 'payroll-register',     label: 'Payroll Register',           icon: ClipboardList,        path: PATHS.HR_PAYROLL_REGISTER },
  { id: 'offer-letter',         label: 'Offer Letter',               icon: FileText,             path: PATHS.HR_OFFER_LETTER },
  { id: 'appointment-letter',   label: 'Appointment Letter',         icon: FileCheck,            path: PATHS.HR_APPOINTMENT_LETTER },
  { id: 'joining-letter',       label: 'Joining Letter',             icon: LogIn,                path: PATHS.HR_JOINING_LETTER },
  { id: 'confirmation-letter',  label: 'Confirmation Letter',        icon: CheckCircle,          path: PATHS.HR_CONFIRMATION_LETTER },
  { id: 'increment-letter',     label: 'Salary Increment Letter',    icon: TrendingUp,           path: PATHS.HR_INCREMENT_LETTER },
  { id: 'promotion-letter',     label: 'Promotion Letter',           icon: ArrowUpCircle,        path: PATHS.HR_PROMOTION_LETTER },
  { id: 'objection-letter',     label: 'Objection Letter',           icon: AlertTriangle,        path: PATHS.HR_OBJECTION_LETTER },
  { id: 'show-cause',           label: 'Show Cause Letter',          icon: MessageSquareWarning, path: PATHS.HR_SHOW_CAUSE },
  { id: 'warning-letter',       label: 'Warning Letter',             icon: AlertOctagon,         path: PATHS.HR_WARNING_LETTER },
  { id: 'dismissal-letter',     label: 'Letter of Dismissal',        icon: LogOut,               path: PATHS.HR_DISMISSAL_LETTER },
  { id: 'noc',                  label: 'No Objection Certificate',   icon: ShieldCheck,          path: PATHS.HR_NOC },
  { id: 'experience-cert',      label: 'Experience Certificate',     icon: Award,                path: PATHS.HR_EXPERIENCE_CERT },
  { id: 'employment-cert',      label: 'Employment Certificate',     icon: Briefcase,            path: PATHS.HR_EMPLOYMENT_CERT },
  { id: 'final-payment',        label: 'Final Payment Letter',       icon: Banknote,             path: PATHS.HR_FINAL_PAYMENT },
  { id: 'attendance-register',  label: 'Attendance Register',        icon: ClipboardCheck,       path: PATHS.HR_ATTENDANCE_REGISTER },
  { id: 'employee-register',    label: 'Employee Register (Form-8)', icon: UsersRound,           path: PATHS.HR_EMPLOYEE_REGISTER },
  { id: 'service-book-reg',     label: 'Service Book',               icon: BookMarkedAlt,        path: PATHS.HR_SERVICE_BOOK_REG },
  { id: 'incidents',            label: 'Incidents',                  icon: Siren,                path: PATHS.HR_INCIDENTS },
  { id: 'compliance',           label: 'Compliance',                 icon: Scale,                path: PATHS.HR_COMPLIANCE },
]
