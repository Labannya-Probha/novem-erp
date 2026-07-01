import {
  Leaf, LayoutDashboard, CalendarDays, UtensilsCrossed, ShoppingBasket, Boxes,
  Calculator, Users, MoonStar, BarChart3, Settings2, BedDouble, Building2,
  ListChecks, Bot, ChefHat, ClipboardList, Wallet, Printer, UserSearch,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  NAV GROUPS — ordered list used to build the main sidebar.          */
/*  Each item.id matches the route segment and active-nav detection.   */
/* ------------------------------------------------------------------ */
export const NAV_GROUPS = [
  { title: 'Sales & Reservation', items: [
    { id: 'calendar',     label: 'Booking Calendar', icon: CalendarDays },
    { id: 'reservations', label: 'Reservations',     icon: BedDouble },
    { id: 'reservation-payments', label: 'Reservation Payments', icon: Wallet },
    { id: 'crm',          label: 'Guest CRM',        icon: UserSearch },
  ]},
  { title: 'Tasks', items: [
    { id: 'tasks',     label: 'Task Management', icon: ListChecks },
    { id: 'ai-tasker', label: 'AI Tasker',        icon: Bot },
  ]},
  { title: 'Front Office', items: [
    { id: 'dashboard',    label: 'Frontoffice Module', icon: LayoutDashboard },
    { id: 'nightaudit',   label: 'Night Audit',        icon: MoonStar },
    { id: 'housekeeping', label: 'Housekeeping',       icon: BedDouble },
    { id: 'facilities',   label: 'Service Bills',      icon: ShoppingBasket },
  ]},
  { title: 'Food & Beverage', items: [
    { id: 'pos',              label: 'Restaurant POS',  icon: UtensilsCrossed },
    { id: 'menu-management',  label: 'Menu Management', icon: ChefHat },
    { id: 'pos-print-center', label: 'POS Print Center', icon: Printer },
  ]},
  { title: 'Accounting', items: [
    { id: 'accounting', label: 'Accounting', icon: Calculator },
  ]},
  { title: 'Inventory', items: [
    { id: 'inventory',   label: 'Inventory',         icon: Boxes },
    { id: 'consumption', label: 'Consumption Entry', icon: ClipboardList },
  ]},
  { title: 'HR & Payroll', items: [
    { id: 'hr', label: 'HR & Payroll', icon: Users },
  ]},
  { title: 'Reports', items: [
    { id: 'reports', label: 'Reports Dashboard', icon: BarChart3 },
  ]},
  { title: 'System', items: [
    { id: 'cms',      label: 'Configuration', icon: Building2,  superuserOnly: true },
    { id: 'settings', label: 'Settings',       icon: Settings2, superuserOnly: true },
  ]},
]

export const ALL_NAV_IDS = NAV_GROUPS.flatMap((g) => g.items.map((n) => n.id))
