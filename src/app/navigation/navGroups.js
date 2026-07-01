import {
  LayoutDashboard, CalendarDays, UtensilsCrossed, Boxes,
  Calculator, Users, BarChart3, Settings2, BedDouble, Building2, ListChecks, Database,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  NAV GROUPS — ordered list used to build the main sidebar.          */
/*  Each item.id matches the route segment and active-nav detection.   */
/* ------------------------------------------------------------------ */
export const NAV_GROUPS = [
  { title: 'Modules', items: [
    { id: 'dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
    { id: 'reservations', label: 'Reservations',   icon: CalendarDays },
    { id: 'nightaudit',   label: 'Front Office',   icon: Building2 },
    { id: 'housekeeping', label: 'Housekeeping',   icon: BedDouble },
    { id: 'pos',          label: 'Restaurant',     icon: UtensilsCrossed },
    { id: 'inventory',    label: 'Inventory',      icon: Boxes },
    { id: 'accounting',   label: 'Accounting',     icon: Calculator },
    { id: 'hr',           label: 'HR & Payroll',   icon: Users },
    { id: 'reports',      label: 'Reports Center', icon: BarChart3 },
    { id: 'tasks',        label: 'Tasks',          icon: ListChecks },
    { id: 'master-data',  label: 'Master Data',    icon: Database },
    { id: 'settings',     label: 'Settings',       icon: Settings2 },
  ]},
]

export const ALL_NAV_IDS = NAV_GROUPS.flatMap((g) => g.items.map((n) => n.id))
