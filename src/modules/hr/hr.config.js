import { Users, CalendarDays, Palmtree, Banknote, FileText, ShieldCheck } from 'lucide-react'

export const HR_TABS = [
  { key: 'employees',   label: 'Employees',           icon: Users,        views: ['', 'service-book', 'nominee'] },
  { key: 'attendance',  label: 'Attendance',           icon: CalendarDays, views: [''] },
  { key: 'leave',       label: 'Leave',                icon: Palmtree,     views: ['', 'comp-leave'] },
  { key: 'payroll',     label: 'Payroll',              icon: Banknote,     views: ['', 'config', 'generate', 'register', 'approve'] },
  { key: 'letters',     label: 'Letters & Documents',  icon: FileText,     views: ['', 'LETTER', 'MEMO', 'NOTICE', 'CIRCULAR', 'INWARD', 'OUTWARD'] },
  { key: 'compliance',  label: 'Compliance',           icon: ShieldCheck,  views: ['', 'incidents', 'employee-register', 'service-book-register'] },
]

export const VALID_TAB_KEYS = HR_TABS.map((t) => t.key)
