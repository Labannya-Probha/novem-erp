import { useCallback, useEffect, useState } from 'react'
import {
  BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation,
} from 'react-router-dom'
import { supabase } from './supabase'
import { applyBrandTheme, buildBrandTheme, DEFAULT_THEME, resolveBrandTheme } from './lib/branding'
import { setCurrency } from './lib/helpers'
import { runAutoNoShowSweep } from './lib/noShowAutomation'
import { can, ROLE_LABELS } from './lib/roles'
import { getTenantId, setTenantId } from './lib/tenant'
import Login from './components/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Reservations from './pages/Reservations.jsx'
import ReservationDetail from './pages/ReservationDetail.jsx'
import BookingCalendar from './pages/BookingCalendar.jsx'
import HousekeepingHub from './pages/HousekeepingHub.jsx'
import RestaurantPOS, { GuestPosKiosk } from './pages/RestaurantPOS.jsx'
import Facilities from './pages/ServiceBills.jsx'
import InventoryHub from './pages/InventoryHub.jsx'
import ConsumptionEntry from './pages/ConsumptionEntry.jsx'
import MenuManagement from './pages/MenuManagement.jsx'
import VatCenter from './pages/VatCenter.jsx'
import AccountingHub, {
  VoucherEntryPage,
  TrialBalancePage,
  ChartOfAccountsPage,
  FixedAssetsPage,
  OpeningBalancePage,
  TransactionMappingPage,
  VendorPaymentPage,
} from './pages/AccountingHub.jsx'
import HrOffice, {
  HrEmployeeEntryPage,
  HrServiceBookPage,
  HrNomineePage,
  HrLeaveEntryPage,
  HrCompLeavePage,
  HrFestivalLeavePage,
  HrPayrollConfigPage,
  HrPayrollGenPage,
  HrPayrollRegisterPage,
  HrLetterPage,
  HrAttendanceRegisterPage,
  HrEmployeeRegisterPage,
  HrServiceBookRegPage,
  HrIncidentsPage,
  HrCompliancePage,
} from './pages/HrOffice.jsx'
import NightAudit from './pages/NightAudit.jsx'
import ReportsHub from './pages/ReportsHub.jsx'
import Settings from './pages/Settings.jsx'
import CmsPortal from './pages/CmsPortal.jsx'
import TaskManagement from './pages/TaskManagement.jsx'
import VendorPaymentTab from './components/VendorPaymentTab.jsx'
import {
  Leaf, LayoutDashboard, CalendarDays, UtensilsCrossed, ShoppingBasket, Boxes,
  FileSpreadsheet, Calculator, Users, MoonStar, BarChart3, Settings2, LogOut, BedDouble, Building2,
  Menu, X, ListChecks, ChevronDown, Bot, ChefHat, ClipboardList,
  BookOpen, Scale, BookMarked, Landmark, Lock, ArrowLeftRight, CreditCard, Wallet,
  UserCog, CalendarCheck, BadgeDollarSign, FileStack, ClipboardCheck,
  PartyPopper, FileText, FileCheck, LogIn, CheckCircle, TrendingUp, ArrowUpCircle,
  AlertTriangle, MessageSquareWarning, AlertOctagon, ShieldCheck, Award, Briefcase,
  Banknote, UsersRound, Siren,
} from 'lucide-react'

function BrandLogo({ url }) {
  const [ok, setOk] = useState(true)
  if (url && ok) return <img src={url} alt="logo" onError={() => setOk(false)} className="w-9 h-9 rounded-lg object-contain bg-white/90 p-0.5" />
  return <div className="w-9 h-9 rounded-lg bg-forest flex items-center justify-center shadow-sm ring-1 ring-forest/15"><Leaf size={18} /></div>
}

/* ------------------------------------------------------------------ */
/*  NAV GROUPS                                                          */
/* ------------------------------------------------------------------ */
const NAV_GROUPS = [
  { title: 'Sales & Reservation', items: [
    { id: 'calendar',     label: 'Booking Calendar', icon: CalendarDays },
    { id: 'reservations', label: 'Reservations',     icon: BedDouble },
  ]},
  { title: 'Tasks', items: [
    { id: 'tasks',     label: 'Task Management', icon: ListChecks },
    { id: 'ai-tasker', label: 'AI Tasker',        icon: Bot },
  ]},
  { title: 'Front Office', items: [
    { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
    { id: 'nightaudit',   label: 'Night Audit',  icon: MoonStar },
    { id: 'housekeeping', label: 'Housekeeping', icon: BedDouble },
    { id: 'facilities', label: 'Service Bills', icon: ShoppingBasket },
  ]},
  { title: 'Food & Beverage', items: [
    { id: 'pos',             label: 'Restaurant POS',  icon: UtensilsCrossed },
    { id: 'menu-management', label: 'Menu Management', icon: ChefHat },
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
  { title: 'Insight', items: [
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ]},
  { title: 'System', items: [
    { id: 'cms',      label: 'Configuration', icon: Building2,  superuserOnly: true },
    { id: 'settings', label: 'Settings',       icon: Settings2, superuserOnly: true },
  ]},
]

const ALL_NAV_IDS = NAV_GROUPS.flatMap((g) => g.items.map((n) => n.id))

/* ------------------------------------------------------------------ */
/*  SIDEBAR NESTED MENUS                                               */
/* ------------------------------------------------------------------ */
const SIDEBAR_SETTINGS_SECTIONS = [
  { id: 'my-account',           label: 'My Account',              adminOnly: false, superuserOnly: false },
  { id: 'branding',             label: 'Branding',                adminOnly: true,  superuserOnly: false },
  { id: 'tax-policy',           label: 'Tax Policy',              adminOnly: false, superuserOnly: false },
  { id: 'allowance',            label: 'Allowance Configuration', adminOnly: false, superuserOnly: true  },
  { id: 'role-permissions',     label: 'Role Permissions',        adminOnly: false, superuserOnly: true  },
  { id: 'admin-feature-access', label: 'Admin Feature Access',    adminOnly: false, superuserOnly: true  },
  { id: 'staff',                label: 'Staff Management',        adminOnly: false, superuserOnly: false },
  { id: 'data-system',          label: 'Data & System',           adminOnly: false, superuserOnly: true  },
]

const SIDEBAR_CMS_ENTITY_TABS = [
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

const SIDEBAR_INVENTORY_TABS = [
  { id: 'Items & Stock',    label: 'Items & Stock' },
  { id: 'Vendors',          label: 'Vendors' },
  { id: 'Requisitions',     label: 'Requisitions' },
  { id: 'Purchase Orders',  label: 'Purchase Orders' },
  { id: 'Goods Receipt',    label: 'Goods Receipt' },
  { id: 'Transfers',        label: 'Transfers' },
  { id: 'Returns',          label: 'Returns' },
]

const SIDEBAR_ACCOUNTING_TABS = [
  { id: 'voucher-entry',       label: 'Voucher Entry',       icon: BookOpen,       path: '/accounting/voucher-entry' },
  { id: 'trial-balance',       label: 'Trial Balance',       icon: Scale,          path: '/accounting/trial-balance' },
  { id: 'chart-of-accounts',   label: 'Chart of Accounts',   icon: BookMarked,     path: '/accounting/chart-of-accounts' },
  { id: 'fixed-assets',        label: 'Fixed Assets',        icon: Landmark,       path: '/accounting/fixed-assets' },
  { id: 'opening-balance',     label: 'Opening Balance',     icon: Lock,           path: '/accounting/opening-balance', adminOnly: true },
  { id: 'transaction-mapping', label: 'Transaction Mapping', icon: ArrowLeftRight, path: '/accounting/transaction-mapping', adminOnly: true },
  { id: 'vendor-payments',     label: 'Vendor Payments',     icon: CreditCard,     path: '/accounting/vendor-payments' },
  { id: 'vat',                 label: 'VAT Centre',          icon: Wallet,         path: '/vat' },
]

const SIDEBAR_HR_TABS = [
  { id: 'employee-entry',       label: 'Employee Entry',          icon: UserCog,        path: '/hr/employee-entry' },
  { id: 'service-book',         label: 'Service Book Entry',      icon: BookOpen,       path: '/hr/service-book' },
  { id: 'nominee',              label: 'Nominee Declaration',     icon: Users,          path: '/hr/nominee' },
  { id: 'leave-entry',          label: 'Leave Entry',             icon: CalendarCheck,  path: '/hr/leave-entry' },
  { id: 'comp-leave',           label: 'Comp Leave Mgmt',         icon: CalendarDays,   path: '/hr/comp-leave' },
  { id: 'festival-leave',       label: 'Festival Leave Mgmt',     icon: PartyPopper,    path: '/hr/festival-leave' },
  { id: 'payroll-config',       label: 'Payroll Configuration',   icon: BadgeDollarSign, path: '/hr/payroll-config' },
  { id: 'payroll-gen',          label: 'Payroll Generation',      icon: Calculator,     path: '/hr/payroll-gen' },
  { id: 'payroll-register',     label: 'Payroll Register',        icon: ClipboardList,  path: '/hr/payroll-register' },
  { id: 'offer-letter',         label: 'Offer Letter',            icon: FileText,       path: '/hr/offer-letter' },
  { id: 'appointment-letter',   label: 'Appointment Letter',      icon: FileCheck,      path: '/hr/appointment-letter' },
  { id: 'joining-letter',       label: 'Joining Letter',          icon: LogIn,          path: '/hr/joining-letter' },
  { id: 'confirmation-letter',  label: 'Confirmation Letter',     icon: CheckCircle,    path: '/hr/confirmation-letter' },
  { id: 'increment-letter',     label: 'Salary Increment Letter', icon: TrendingUp,     path: '/hr/increment-letter' },
  { id: 'promotion-letter',     label: 'Promotion Letter',        icon: ArrowUpCircle,  path: '/hr/promotion-letter' },
  { id: 'objection-letter',     label: 'Objection Letter',        icon: AlertTriangle,  path: '/hr/objection-letter' },
  { id: 'show-cause',           label: 'Show Cause Letter',       icon: MessageSquareWarning, path: '/hr/show-cause' },
  { id: 'warning-letter',       label: 'Warning Letter',          icon: AlertOctagon,   path: '/hr/warning-letter' },
  { id: 'dismissal-letter',     label: 'Letter of Dismissal',     icon: LogOut,         path: '/hr/dismissal-letter' },
  { id: 'noc',                  label: 'No Objection Certificate',icon: ShieldCheck,    path: '/hr/noc' },
  { id: 'experience-cert',      label: 'Experience Certificate',  icon: Award,          path: '/hr/experience-cert' },
  { id: 'employment-cert',      label: 'Employment Certificate',  icon: Briefcase,      path: '/hr/employment-cert' },
  { id: 'final-payment',        label: 'Final Payment Letter',    icon: Banknote,       path: '/hr/final-payment' },
  { id: 'attendance-register',  label: 'Attendance Register',     icon: ClipboardCheck, path: '/hr/attendance-register' },
  { id: 'employee-register',    label: 'Employee Register (Form-8)', icon: UsersRound,  path: '/hr/employee-register' },
  { id: 'service-book-reg',     label: 'Service Book',            icon: BookMarked,     path: '/hr/service-book-reg' },
  { id: 'incidents',            label: 'Incidents',               icon: Siren,          path: '/hr/incidents' },
  { id: 'compliance',           label: 'Compliance',              icon: Scale,          path: '/hr/compliance' },
]

function firstAccessiblePath(role, privileges) {
  for (const id of ALL_NAV_IDS) {
    if (id === 'dashboard' || can(role, id, privileges)) return `/${id}`
  }
  return '/dashboard'
}

/* ------------------------------------------------------------------ */
/*  APP SHELL                                                           */
/* ------------------------------------------------------------------ */
  function HrSubGroup({ grp, navigate, location }) {
    const [open, setOpen] = useState(grp.active)
    return (
      <div>
        <button
          onClick={() => setOpen((p) => !p)}
          className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between gap-2 ${
            grp.active ? 'text-white font-semibold' : 'text-white/65 hover:text-white'
          }`}>
          <span className="flex items-center gap-2">
            {grp.icon && <grp.icon size={12} className="shrink-0 opacity-70" />}
            {grp.label}
          </span>
          <ChevronDown size={10} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
        {open && (
          <div className="ml-4 space-y-0.5 mt-0.5">
            {grp.children.map((c) => (
              <button key={c.id}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 ${
                  c.active ? 'bg-white/14 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
                onClick={() => navigate(c.path)}>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }
  
  function AppShell({ company, role, isAdmin, userName, loadCompany, privileges }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false)
  const [openGroup,      setOpenGroup]      = useState(null)
  const [openSystemMenu, setOpenSystemMenu] = useState(null)
  const toggleGroup = (title) => setOpenGroup((prev) => (prev === title ? null : title))

  const currentTopId = location.pathname.split('/').filter(Boolean)[0] || 'dashboard'

  const openReservation  = (id)          => navigate(`/reservations/${id}`)
  const startReservation = (prefill = {}) => navigate('/reservations', { state: { prefill } })

  const softwareName    = company?.software_name || 'Aura Stay'
  const sidebarThemeStyle = { background: 'var(--sidebar-bg)' }

  useEffect(() => { setMobileNavOpen(false) }, [location.pathname])
  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((g) => g.items.some((n) => n.id === currentTopId))
    setOpenGroup(activeGroup?.title || null)
  }, [currentTopId])
  useEffect(() => {
    const isAccountingRoute = location.pathname.startsWith('/accounting') || location.pathname === '/vat'
    const isHrRoute = location.pathname.startsWith('/hr')
    if (['settings', 'cms', 'inventory', 'consumption'].includes(currentTopId) || isAccountingRoute || isHrRoute) {
      setOpenSystemMenu(
        ['inventory', 'consumption'].includes(currentTopId) ? 'inventory' :
        isAccountingRoute ? 'accounting' :
        isHrRoute ? 'hr' :
        currentTopId
      )
    } else setOpenSystemMenu(null)
  }, [currentTopId, location.pathname])

  const SidebarContent = (
    <>
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
        <BrandLogo url={company?.logo_url} />
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold leading-tight truncate text-white">{softwareName}</div>
          <div className="text-[11px] text-white/60 truncate">{company?.name || ''}</div>
        </div>
        <button onClick={() => setMobileNavOpen(false)} className="lg:hidden text-white/50 hover:text-white shrink-0">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
        {NAV_GROUPS.map((g) => {
          const items = g.items.filter((n) => {
            if (n.superuserOnly)            return role === 'SUPERUSER'
            if (n.id === 'ai-tasker')       return can(role, 'tasks', privileges)
            if (n.id === 'cms')             return role === 'SUPERUSER'
            if (n.id === 'menu-management') return isAdmin || role === 'SUPERUSER' || role === 'RESTAURANT'
            if (n.id === 'consumption')     return can(role, 'inventory', privileges)
            return can(role, n.id, privileges)
          })
          if (items.length === 0) return null
          const isOpenGroup = openGroup === g.title
          return (
            <div key={g.title}>
              <button
                onClick={() => toggleGroup(g.title)}
                className="w-full px-3 py-1.5 flex items-center justify-between text-[10px] uppercase tracking-widest text-white/45 font-semibold hover:text-white/85 transition-colors"
              >
                <span>{g.title}</span>
                <ChevronDown size={11} className={`transition-transform duration-200 ${isOpenGroup ? '' : '-rotate-90'}`} />
              </button>

              {isOpenGroup && (
                <div className="space-y-0.5 mb-1">
                  {items.map((n) => {
                    // Items that are folded into a parent's sub-nav are hidden at top level
                    if (n.id === 'consumption' || n.id === 'vat') return null

                    const isExpandable = ['settings', 'cms', 'inventory', 'accounting', 'hr'].includes(n.id)
                    if (!isExpandable) {
                      return (
                        <button key={n.id}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            currentTopId === n.id
                              ? 'bg-white/14 text-white ring-1 ring-white/20'
                              : 'text-white/75 hover:bg-white/10 hover:text-white'
                          }`}
                          onClick={() => navigate(`/${n.id}`)}>
                          <n.icon size={17} /> {n.label}
                        </button>
                      )
                    }

                    const isOpen = openSystemMenu === n.id
                    // Build the sub-item list for this expandable nav item
                    let nested = []
                    let paramKey = 'section'
                    if (n.id === 'settings') {
                      paramKey = 'section'
                      nested = SIDEBAR_SETTINGS_SECTIONS.filter((s) => {
                        if (!s.adminOnly && !s.superuserOnly) return true
                        if (s.adminOnly) return isAdmin || role === 'SUPERUSER'
                        return role === 'SUPERUSER'
                      }).map((s) => ({ ...s, path: `/settings?section=${s.id}`, active: currentTopId === 'settings' && location.search.includes(`section=${s.id}`) }))
                    } else if (n.id === 'cms') {
                      paramKey = 'entity'
                      nested = SIDEBAR_CMS_ENTITY_TABS.map((s) => ({ ...s, path: `/cms?entity=${s.id}`, active: currentTopId === 'cms' && location.search.includes(`entity=${s.id}`) }))
                    } else if (n.id === 'inventory') {
                      nested = [
                        ...SIDEBAR_INVENTORY_TABS.map((s) => ({ ...s, path: `/inventory?tab=${encodeURIComponent(s.id)}`, active: currentTopId === 'inventory' && location.search.includes(`tab=${encodeURIComponent(s.id)}`) })),
                        { id: 'consumption', label: 'Consumption Entry', path: '/consumption', active: currentTopId === 'consumption' },
                      ]
                    } else if (n.id === 'accounting') {
                      nested = SIDEBAR_ACCOUNTING_TABS
                        .filter((s) => !s.adminOnly || isAdmin || role === 'SUPERUSER')
                        .map((s) => ({
                          ...s,
                          active: s.id === 'vat'
                            ? currentTopId === 'vat'
                            : location.pathname === s.path,
                        }))
                    } else if (n.id === 'hr') {
                      nested = SIDEBAR_HR_TABS.map((s) => ({
                        ...s,
                        active: location.pathname === s.path,
                      }))
                    }

                    return (
                      <div key={n.id} className="space-y-1">
                        <button
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isOpen ? 'bg-white/14 text-white ring-1 ring-white/20' : 'text-white/75 hover:bg-white/10 hover:text-white'
                          }`}
                          onClick={() => {
                            setOpenSystemMenu(isOpen ? null : n.id)
                            if (!isOpen && ['inventory', 'accounting'].includes(n.id)) {
                              // Navigate to the first sub-item when opening
                              navigate(`/${n.id}`)
                            } else if (!['inventory', 'accounting'].includes(n.id)) {
                              navigate(`/${n.id}`)
                            }
                          }}
                        >
                          <span className="flex items-center gap-3"><n.icon size={17} /> {n.label}</span>
                          <ChevronDown size={13} className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                        </button>
                        {isOpen && (
                          <div className="ml-6 space-y-0.5">
                            {nested.map((child) => (
                              <button
                                key={child.id}
                                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 ${
                                  child.active ? 'bg-white/14 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'
                                }`}
                                onClick={() => navigate(child.path)}
                              >
                                {child.icon && <child.icon size={13} aria-hidden="true" className="shrink-0 opacity-70" />}
                                {child.label}
                              </button>
                            ))}
                          </div>
                        )}
            </div>
          )
        })}
      </nav>

      <div className="px-5 py-4 border-t border-white/10 text-xs text-white/65">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-semibold text-white">{userName}</div>
            <div className="text-[10px] text-white/50">{ROLE_LABELS[role] || role}</div>
          </div>
          <button title="Sign out" onClick={async () => {
            const tenantId = getTenantId()
            await supabase.auth.signOut()
              const { data: prop } = await supabase
              .from('properties')
              .select('slug')
              .eq('id', tenantId)
              .maybeSingle()
            const slug = prop?.slug
            window.location.href = slug ? `/${slug}/login` : '/login'
          }} className="text-white/55 hover:text-white shrink-0"><LogOut size={15} /></button>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex app-shell">
      {/* Desktop sidebar */}
      <aside style={sidebarThemeStyle} className="hidden lg:flex w-60 text-white flex-col fixed inset-y-0 overflow-y-auto z-30 border-r border-white/10 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink/35" onClick={() => setMobileNavOpen(false)} />
          <aside style={sidebarThemeStyle} className="absolute inset-y-0 left-0 w-72 max-w-[85vw] text-white flex flex-col shadow-2xl border-r border-white/10">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-20 bg-white/95 backdrop-blur text-pine flex items-center gap-3 px-4 shadow-sm border-b border-leaf/80 app-shell-mobile-bar">
        <button onClick={() => setMobileNavOpen(true)} className="text-pine/70 hover:text-forest">
          <Menu size={22} />
        </button>
        <BrandLogo url={company?.logo_url} />
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold leading-tight truncate text-sm">{softwareName}</div>
        </div>
      </div>

      <main className="app-shell-main">
        {company?.maintenance_mode && (
          <div className="no-print app-shell-banner" style={{ background:'#b91c1c',
            color:'#fff', textAlign:'center', padding:'6px', fontWeight:600, fontSize:13 }}>
            ⚠ Maintenance mode — posting & edits are locked while accounts reconcile.
          </div>
        )}

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Dashboard */}
          <Route path="/dashboard" element={
            <Dashboard openReservation={openReservation} userName={userName} role={role} isAdmin={isAdmin} />
          } />

          {/* Reservations */}
          <Route path="/reservations" element={
            <GuardedRoute role={role} navId="reservations" privileges={privileges}>
              <ReservationsRoute openReservation={openReservation} userName={userName} />
            </GuardedRoute>
          } />
          <Route path="/reservations/:id" element={
            <GuardedRoute role={role} navId="reservations" privileges={privileges}>
              <ReservationDetailRoute userName={userName} role={role} isAdmin={isAdmin} />
            </GuardedRoute>
          } />

          {/* Booking Calendar */}
          <Route path="/calendar" element={
            <GuardedRoute role={role} navId="calendar" privileges={privileges}>
              <BookingCalendar
                openReservation={openReservation}
                onNewReservation={startReservation}
                onOpenReservations={() => navigate('/reservations')}
              />
            </GuardedRoute>
          } />

          {/* Front Office */}
          <Route path="/nightaudit" element={
            <GuardedRoute role={role} navId="nightaudit" privileges={privileges}>
              <NightAudit userName={userName} isAdmin={isAdmin} role={role} />
            </GuardedRoute>
          } />
          <Route path="/housekeeping" element={
            <GuardedRoute role={role} navId="housekeeping" privileges={privileges}>
              <HousekeepingHub userName={userName} role={role} isAdmin={isAdmin} />
            </GuardedRoute>
          } />
          <Route path="/facilities" element={
            <GuardedRoute role={role} navId="facilities" privileges={privileges}>
              <Facilities userName={userName} isAdmin={isAdmin} />
            </GuardedRoute>
          } />

          {/* Restaurant */}
          <Route path="/pos" element={
            <GuardedRoute role={role} navId="pos" privileges={privileges}>
              <RestaurantPOS userName={userName} role={role} isAdmin={isAdmin} />
            </GuardedRoute>
          } />
          <Route path="/kiosk/pos" element={<GuestPosKiosk />} />
          <Route path="/menu-management" element={
            (isAdmin || role === 'SUPERUSER' || role === 'RESTAURANT')
              ? <MenuManagement isAdmin={isAdmin} />
              : <Navigate to={firstAccessiblePath(role, privileges)} replace />
          } />

          {/* Inventory */}
          <Route path="/inventory" element={
            <GuardedRoute role={role} navId="inventory" privileges={privileges}>
              <InventoryHub userName={userName} role={role} isAdmin={isAdmin} />
            </GuardedRoute>
          } />
          <Route path="/consumption" element={
            <GuardedRoute role={role} navId="inventory" privileges={privileges}>
              <ConsumptionEntry userName={userName} isAdmin={isAdmin} />
            </GuardedRoute>
          } />

         {/* Accounting — separate routes per section */}
          <Route path="/vat" element={
            <GuardedRoute role={role} navId="vat" privileges={privileges}>
              <VatCenter userName={userName} company={company} />
            </GuardedRoute>
          } />
          <Route path="/accounting" element={<Navigate to="/accounting/voucher-entry" replace />} />
          <Route path="/accounting/voucher-entry" element={
            <GuardedRoute role={role} navId="accounting" privileges={privileges}>
              <VoucherEntryPage userName={userName} isAdmin={isAdmin} role={role} />
            </GuardedRoute>
          } />
          <Route path="/accounting/trial-balance" element={
            <GuardedRoute role={role} navId="accounting" privileges={privileges}>
              <TrialBalancePage />
            </GuardedRoute>
          } />
          <Route path="/accounting/chart-of-accounts" element={
            <GuardedRoute role={role} navId="accounting" privileges={privileges}>
              <ChartOfAccountsPage isAdmin={isAdmin} />
            </GuardedRoute>
          } />
          <Route path="/accounting/fixed-assets" element={
            <GuardedRoute role={role} navId="accounting" privileges={privileges}>
              <FixedAssetsPage userName={userName} />
            </GuardedRoute>
          } />
          <Route path="/accounting/opening-balance" element={
            <GuardedRoute role={role} navId="accounting" privileges={privileges}>
              <OpeningBalancePage userName={userName} />
            </GuardedRoute>
          } />
          <Route path="/accounting/transaction-mapping" element={
            <GuardedRoute role={role} navId="accounting" privileges={privileges}>
              <TransactionMappingPage userName={userName} />
            </GuardedRoute>
          } />
          <Route path="/accounting/vendor-payments" element={
            <GuardedRoute role={role} navId="accounting" privileges={privileges}>
             <VendorPaymentPage role={role} />
            </GuardedRoute>
          } />

          {/* HR & Payroll */}
          <Route path="/hr" element={<Navigate to="/hr/employee-entry" replace />} />
          <Route path="/hr/employee-entry"      element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrEmployeeEntryPage      userName={userName} role={role} isAdmin={isAdmin} company={company} /></GuardedRoute>} />
          <Route path="/hr/service-book"        element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrServiceBookPage         userName={userName} role={role} isAdmin={isAdmin} company={company} /></GuardedRoute>} />
          <Route path="/hr/nominee"             element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrNomineePage             userName={userName} role={role} isAdmin={isAdmin} company={company} /></GuardedRoute>} />
          <Route path="/hr/leave-entry"         element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLeaveEntryPage          userName={userName} role={role} isAdmin={isAdmin} company={company} /></GuardedRoute>} />
          <Route path="/hr/comp-leave"          element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrCompLeavePage           userName={userName} role={role} isAdmin={isAdmin} company={company} /></GuardedRoute>} />
          <Route path="/hr/festival-leave"      element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrFestivalLeavePage       userName={userName} role={role} isAdmin={isAdmin} company={company} /></GuardedRoute>} />
          <Route path="/hr/payroll-config"      element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrPayrollConfigPage       userName={userName} role={role} isAdmin={isAdmin} company={company} /></GuardedRoute>} />
          <Route path="/hr/payroll-gen"         element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrPayrollGenPage          userName={userName} role={role} isAdmin={isAdmin} company={company} /></GuardedRoute>} />
          <Route path="/hr/payroll-register"    element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrPayrollRegisterPage     userName={userName} role={role} isAdmin={isAdmin} company={company} /></GuardedRoute>} />
          <Route path="/hr/offer-letter"        element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLetterPage type="OFFER_LETTER"        company={company} /></GuardedRoute>} />
          <Route path="/hr/appointment-letter"  element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLetterPage type="APPOINTMENT"        company={company} /></GuardedRoute>} />
          <Route path="/hr/joining-letter"      element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLetterPage type="JOINING"            company={company} /></GuardedRoute>} />
          <Route path="/hr/confirmation-letter" element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLetterPage type="CONFIRMATION"       company={company} /></GuardedRoute>} />
          <Route path="/hr/increment-letter"    element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLetterPage type="SALARY_INCREMENT"   company={company} /></GuardedRoute>} />
          <Route path="/hr/promotion-letter"    element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLetterPage type="PROMOTION"          company={company} /></GuardedRoute>} />
          <Route path="/hr/objection-letter"    element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLetterPage type="OBJECTION"          company={company} /></GuardedRoute>} />
          <Route path="/hr/show-cause"          element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLetterPage type="SHOW_CAUSE"         company={company} /></GuardedRoute>} />
          <Route path="/hr/warning-letter"      element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLetterPage type="WARNING"            company={company} /></GuardedRoute>} />
          <Route path="/hr/dismissal-letter"    element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLetterPage type="RELIEVING"          company={company} /></GuardedRoute>} />
          <Route path="/hr/noc"                 element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLetterPage type="NOC"                company={company} /></GuardedRoute>} />
          <Route path="/hr/experience-cert"     element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLetterPage type="EXP_CERT"           company={company} /></GuardedRoute>} />
          <Route path="/hr/employment-cert"     element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLetterPage type="SALARY_CERT"        company={company} /></GuardedRoute>} />
          <Route path="/hr/final-payment"       element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrLetterPage type="FINAL_PAYMENT"      company={company} /></GuardedRoute>} />
          <Route path="/hr/attendance-register" element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrAttendanceRegisterPage flash={(m)=>m} /></GuardedRoute>} />
          <Route path="/hr/employee-register"   element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrEmployeeRegisterPage   role={role} /></GuardedRoute>} />
          <Route path="/hr/service-book-reg"    element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrServiceBookRegPage      userName={userName} /></GuardedRoute>} />
          <Route path="/hr/incidents"           element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrIncidentsPage           userName={userName} flash={(m)=>m} /></GuardedRoute>} />
          <Route path="/hr/compliance"          element={<GuardedRoute role={role} navId="hr" privileges={privileges}><HrCompliancePage          role={role} /></GuardedRoute>} />

          {/* Reports */}
          <Route path="/reports" element={
            <GuardedRoute role={role} navId="reports" privileges={privileges}>
              <ReportsHub userName={userName} role={role} />
            </GuardedRoute>
          } />

          {/* Tasks */}
          <Route path="/tasks" element={
            <GuardedRoute role={role} navId="tasks" privileges={privileges}>
              <TaskManagement userName={userName} role={role} isAdmin={isAdmin} />
            </GuardedRoute>
          } />
          <Route path="/ai-tasker" element={
            <GuardedRoute role={role} navId="tasks" privileges={privileges}>
              <TaskManagement userName={userName} role={role} isAdmin={isAdmin} aiTaskerMode />
            </GuardedRoute>
          } />

          {/* System — superuser only */}
          <Route path="/cms" element={
            role === 'SUPERUSER'
              ? <CmsPortal role={role} isAdmin={isAdmin} />
              : <Navigate to={firstAccessiblePath(role, privileges)} replace />
          } />
          <Route path="/settings" element={
            role === 'SUPERUSER'
              ? <Settings userName={userName} role={role} isAdmin={isAdmin} reloadCompany={loadCompany} />
              : <Navigate to={firstAccessiblePath(role, privileges)} replace />
          } />

          <Route path="*" element={<Navigate to={firstAccessiblePath(role, privileges)} replace />} />
        </Routes>

        <footer className="no-print mt-10 pt-4 border-t border-leaf/80 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-pine/45">
          <div>© {new Date().getFullYear()} Aura Stay</div>
          <div>Powered by <span className="font-semibold text-pine/60">Aura Stay</span></div>
        </footer>
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  GUARDED ROUTE                                                       */
/* ------------------------------------------------------------------ */
// FIX 3: Return null while privileges are still loading (null = not yet fetched).
// Previously this would immediately redirect every protected route on first load,
// causing a flash/redirect before the role_privileges query completed.
function GuardedRoute({ role, navId, privileges, children }) {
  if (privileges === null) return null
  if (!can(role, navId, privileges)) return <Navigate to={firstAccessiblePath(role, privileges)} replace />
  return children
}

/* ------------------------------------------------------------------ */
/*  ROUTE HELPERS                                                       */
/* ------------------------------------------------------------------ */
function ReservationsRoute({ openReservation, userName }) {
  const location    = useLocation()
  const navigate    = useNavigate()
  const prefill     = location.state?.prefill || null
  const clearPrefill = () => navigate(location.pathname, { replace: true, state: {} })
  return <Reservations openReservation={openReservation} userName={userName} prefill={prefill} clearPrefill={clearPrefill} />
}

function ReservationDetailRoute({ userName, role, isAdmin }) {
  const { id }   = useParams()
  const navigate = useNavigate()
  return <ReservationDetail id={id} back={() => navigate('/reservations')} userName={userName} role={role} isAdmin={isAdmin} />
}

/* ------------------------------------------------------------------ */
/*  APP ROOT                                                            */
/* ------------------------------------------------------------------ */
export default function App() {
  return (
    <BrowserRouter>
      <AppRoot />
    </BrowserRouter>
  )
}

function AppRoot() {
  const location = useLocation()
  const [session,    setSession]    = useState(undefined)
  const [profile,    setProfile]    = useState(null)
  const [company,    setCompany]    = useState(null)
  const [privileges, setPrivileges] = useState(null)
  const [brandTheme, setBrandTheme] = useState(buildBrandTheme(DEFAULT_THEME))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // FIX 1 & 2: loadCompany defined BEFORE the useEffect that calls it,
  // and wrapped in useCallback so it has a stable reference for the dep array.
  const loadCompany = useCallback(async (forceTenantId) => {
    const tenantId = forceTenantId || getTenantId()
    let query = supabase.from('company_settings').select('*')
    if (tenantId) query = query.eq('tenant_id', tenantId)
    const { data } = await query.limit(1).single()
    if (data) {
      setCurrency(data.currency || '৳')
      let propertyQuery = supabase.from('properties').select('slug')
      if (tenantId) propertyQuery = propertyQuery.eq('id', tenantId)
      const { data: prop } = await propertyQuery.limit(1).maybeSingle()
      setCompany({ ...data, slug: prop?.slug || null })
    }
  }, []) // no external deps — uses getTenantId() at call time

  useEffect(() => {
    if (!session) {
      setTenantId(null)
      setCompany(null)
      const fallbackTheme = buildBrandTheme(DEFAULT_THEME)
      setBrandTheme(fallbackTheme)
      applyBrandTheme(fallbackTheme)
      return
    }
    supabase.from('app_users').select('*').eq('auth_id', session.user.id).maybeSingle() 
      .then(({ data }) => {
        const fallbackProfile = { role: 'FRONT_OFFICE', full_name: session.user.email?.split('@')[0] }
        const nextProfile = data || fallbackProfile
        setProfile(nextProfile)
        const tid = data?.tenant_id || null
        setTenantId(tid)
        loadCompany(tid)
      })
  }, [session?.user?.id, loadCompany])

  useEffect(() => {
    let active = true
    resolveBrandTheme(company)
      .then((theme) => {
        if (!active) return
        setBrandTheme(theme)
        applyBrandTheme(theme)
      })
      .catch(() => {
        if (!active) return
        const fallbackTheme = buildBrandTheme(DEFAULT_THEME)
        setBrandTheme(fallbackTheme)
        applyBrandTheme(fallbackTheme)
      })
    return () => { active = false }
  }, [company?.logo_url, company?.primary_color, company?.accent_color, company?.brand_primary, company?.brand_accent])

  useEffect(() => {
    const role = profile?.role
    if (!role) return

    const tenantId = getTenantId()

    let query = supabase
      .from('role_privileges')
      .select('module, can_create, can_view, can_edit, can_delete')
      .eq('role', role)
    if (tenantId) query = query.eq('tenant_id', tenantId)

    // FIX 4 (confirmed): callback is async — await inside .then() is safe here.
    // Also replaced the nested supabase.auth.getUser() call with a direct userId
    // captured from session at effect-run time, avoiding an extra round-trip.
    const userId = profile?.id  // app_users.id matches auth user id
    query.then(async ({ data: basePrivs }) => {
      let privs = basePrivs || []

      if (role === 'ADMIN') {
        const { data: accessRows } = await supabase
          .from('admin_feature_access')
          .select('module, can_access')
          .eq('user_id', userId) // ✅ FIX 4: no extra getUser() call needed

        if (accessRows && accessRows.length > 0) {
          const restricted = new Set(
            accessRows.filter(r => r.can_access === false).map(r => r.module)
          )
          if (restricted.size > 0) {
            privs = privs.map(p =>
              restricted.has(p.module)
                ? { ...p, can_view: false, can_create: false, can_edit: false, can_delete: false }
                : p
            )
          }
        }
      }

      setPrivileges(privs)
    })
  }, [profile?.role, profile?.id])

  useEffect(() => {
    if (!session || !profile?.role) return

    let running = false
    const sweep = async () => {
      if (running) return
      running = true
      try {
        await runAutoNoShowSweep()
      } catch (error) {
        console.error('Auto no-show sweep failed:', error.message)
      } finally {
        running = false
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') sweep()
    }

    sweep()
    window.addEventListener('focus', sweep)
    document.addEventListener('visibilitychange', handleVisibility)
    const timer = window.setInterval(sweep, 60 * 1000)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', sweep)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [session?.user?.id, profile?.role])

  if (session === undefined) return (
    <div className="min-h-screen flex items-center justify-center text-pine/60">Loading…</div>
  )

  if (location.pathname.endsWith('/login')) {
    const pathParts = location.pathname.split('/').filter(Boolean)
    const slug = pathParts.length > 1 ? pathParts[0] : undefined
    if (!session) return <Login slug={slug} />
    return <Navigate to="/dashboard" replace />
  }

  if (!session && location.pathname.startsWith('/kiosk/pos')) return <GuestPosKiosk />
  if (!session) return <Login />

  const role     = profile?.role || 'FRONT_OFFICE'
  const isAdmin  = role === 'ADMIN' || role === 'SUPERUSER'
  const userName = profile?.full_name || session.user?.email?.split('@')[0] || 'User'

  const themedCompany = company ? {
    ...company,
    primary_color: company.primary_color || brandTheme.primary,
    accent_color:  company.accent_color  || brandTheme.accent,
    brand_primary: company.brand_primary || brandTheme.printPrimary,
    brand_accent:  company.brand_accent  || brandTheme.printAccent,
  } : null

  return (
    <AppShell
      company={themedCompany}
      role={role}
      isAdmin={isAdmin}
      userName={userName}
      loadCompany={loadCompany}
      privileges={privileges}
    />
  )
}
