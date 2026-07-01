import { useCallback, useEffect, useState } from 'react'
import {
  BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation,
} from 'react-router-dom'
import { supabase } from './supabase'
import { Analytics } from '@vercel/analytics/react'
import { applyBrandTheme, buildBrandTheme, DEFAULT_THEME, resolveBrandTheme } from './lib/branding'
import { setCurrency } from './lib/helpers'
import { can, ROLE_LABELS } from './lib/roles'
import { getTenantId, setTenantId } from './lib/tenant'
import { isModuleEnabled } from './lib/saasModules'
import { REPORT_CATEGORIES } from './lib/reporting/reportConfig'
import { getRoleDefaultReportCatalog } from './lib/reporting/tenantReporting'
import { SaasModuleBlocked, SaasModuleFrame } from './components/saas/SaasModuleFrame.jsx'
import { NAV_GROUPS } from './app/navigation/navGroups'
import {
  SIDEBAR_CMS_ENTITY_TABS,
  SIDEBAR_INVENTORY_TABS,
  SIDEBAR_POS_TABS,
  SIDEBAR_ACCOUNTING_TABS,
  SIDEBAR_HR_TABS,
} from './app/navigation/sidebarTabs'
import { getActiveNavGroupTitle, firstAccessiblePath } from './app/navigation/helpers'
import { PATHS } from './app/paths'
import { getVisibleSettingsSections } from './app/navigation/settingsSections'
import Login from './components/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Reservations from './pages/Reservations.jsx'
import Reservationmodule from './pages/Reservationmodule.jsx'
import Frontofficemodule from './pages/Frontofficemodule.jsx'
import ReservationPayments from './pages/ReservationPayments.jsx'
import BookingCalendar from './pages/BookingCalendar.jsx'
import HousekeepingHub from './pages/HousekeepingHub.jsx'
import RestaurantPOS, { GuestPosKiosk } from './pages/RestaurantPOS.jsx'
import PosPrintCenter from './pages/PosPrintCenter.jsx'
import VerifyBill from './pages/VerifyBill.jsx'
import Facilities from './pages/ServiceBills.jsx'
import InventoryHub from './pages/InventoryHub.jsx'
import ConsumptionEntry from './pages/ConsumptionEntry.jsx'
import MenuManagement from './pages/MenuManagement.jsx'
import VatCenter from './pages/VatCenter.jsx'
import VATReturn from "./pages/VATReturn";
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
import Reportmodule from './pages/Reportmodule.jsx'
import Settings from './pages/Settings.jsx'
import CmsPortal from './pages/CmsPortal.jsx'
import TaskManagement from './pages/TaskManagement.jsx'
import VendorPaymentTab from './components/VendorPaymentTab.jsx'
import GuestCRM from './pages/GuestCRM.jsx'
import { WelcomePopover } from './components/WelcomePopover.jsx'
import { PopoverDisplay } from './components/PopoverDisplay.jsx'
import { useWelcomePopover } from './hooks/useWelcomePopover'
import {
  Leaf, LayoutDashboard, CalendarDays, UtensilsCrossed, ShoppingBasket, Boxes,
  FileSpreadsheet, Calculator, Users, MoonStar, BarChart3, Settings2, LogOut, BedDouble, Building2,
  Menu, X, ListChecks, ChevronDown, Bot, ChefHat, ClipboardList,
  BookOpen, Scale, BookMarked, Landmark, Lock, ArrowLeftRight, CreditCard, Wallet,
  UserCog, CalendarCheck, BadgeDollarSign, FileStack, ClipboardCheck,
  PartyPopper, FileText, FileCheck, LogIn, CheckCircle, TrendingUp, ArrowUpCircle,
  AlertTriangle, MessageSquareWarning, AlertOctagon, ShieldCheck, Award, Briefcase,
  Banknote, UsersRound, Siren,
  Printer, UserSearch,
} from 'lucide-react'

function BrandLogo({ url, softwareName }) {
  const [ok, setOk] = useState(true)
  if (url && ok) return <img src={url} alt="logo" onError={() => setOk(false)} className="w-9 h-9 rounded-lg object-contain bg-white/90 p-0.5" />
  const abbr = (softwareName || 'AS').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return <div className="w-9 h-9 rounded-lg bg-amber-400 flex items-center justify-center shadow-sm flex-shrink-0"><span className="text-pine font-bold text-sm leading-none">{abbr}</span></div>
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
  
  function AppShell({ company, role, isAdmin, userName, userId, loadCompany, privileges }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false)
  const [openSystemMenu, setOpenSystemMenu] = useState(null)
  const [openNavGroup,   setOpenNavGroup]   = useState(() => getActiveNavGroupTitle(window.location.pathname.split('/').filter(Boolean)[0] || 'dashboard', window.location.pathname))
  const [modulesEnabled, setModulesEnabled] = useState(null)
  const [sidebarHidden,  setSidebarHidden]  = useState(false)

  const currentTopSegment = location.pathname.split('/').filter(Boolean)[0] || 'dashboard'
  const currentTopId = currentTopSegment === 'frontoffice' ? 'dashboard' : currentTopSegment
  const navPathById = (id) => {
    if (id === 'dashboard') return PATHS.FRONTOFFICE
    if (id === 'pos-print-center') return PATHS.POS_PRINT_CENTER
    return `/${id}`
  }
  const withId = (template, id) => template.replace(':id', encodeURIComponent(id))

  const openReservation  = (id, tab) => {
    const q = tab ? `?tab=${encodeURIComponent(tab)}` : ''
    navigate(`${withId(PATHS.RESERVATION_DETAIL, id)}${q}`)
  }
  const openFrontOfficeReservation = (id, tab) => {
    const q = tab ? `?tab=${encodeURIComponent(tab)}` : ''
    navigate(`${withId(PATHS.FRONTOFFICE_RESERVATION_DETAIL, id)}${q}`)
  }
  const startReservation = (prefill = {}) => navigate(PATHS.RESERVATIONS, { state: { prefill } })

  const softwareName    = company?.software_name || 'Aura Stay'
  const sidebarThemeStyle = { background: 'var(--sidebar-bg)' }
  const activeReportCode = new URLSearchParams(location.search).get('report')
  const sidebarReportCatalog = getRoleDefaultReportCatalog(role)

  useEffect(() => {
    const tenantId = getTenantId()
    if (!tenantId || role === 'SUPERUSER') {
      setModulesEnabled(null)
      return
    }
    supabase
      .from('tenant_subscriptions')
      .select('modules_enabled,status')
      .eq('tenant_id', tenantId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data || data.status === 'SUSPENDED') {
          setModulesEnabled(data?.status === 'SUSPENDED' ? {} : null)
          return
        }
        setModulesEnabled(data.modules_enabled || null)
      })
      .catch(() => setModulesEnabled(null))
  }, [role, company?.tenant_id])

  useEffect(() => { setMobileNavOpen(false) }, [location.pathname])
  useEffect(() => {
    setSidebarHidden(location.pathname === PATHS.CALENDAR)
  }, [location.pathname])
  useEffect(() => {
    const activeNavGroup = getActiveNavGroupTitle(currentTopId, location.pathname)
    if (activeNavGroup) setOpenNavGroup(activeNavGroup)
  }, [currentTopId, location.pathname])
  useEffect(() => {
    const isAccountingRoute = location.pathname.startsWith('/accounting') || location.pathname === '/vat' || location.pathname === '/vat-return'
    const isHrRoute = location.pathname.startsWith('/hr')
    const isPosPrintRoute = location.pathname.startsWith('/pos/print-center')
    if (['settings', 'cms', 'inventory', 'consumption', 'reports'].includes(currentTopId) || isAccountingRoute || isHrRoute || isPosPrintRoute) {
      setOpenSystemMenu(
        isPosPrintRoute ? 'pos-print-center' :
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
        <BrandLogo url={company?.logo_url} softwareName={softwareName} />
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold leading-tight truncate text-white">{softwareName}</div>
          <div className="text-[11px] text-white/60 truncate">{company?.name || ''}</div>
        </div>
        <button onClick={() => setMobileNavOpen(false)} className="lg:hidden text-white/50 hover:text-white shrink-0">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 py-3 px-3 overflow-y-auto">
        {NAV_GROUPS.map((g, gi) => {
          const items = g.items.filter((n) => {
            if (!isModuleEnabled(n.id, modulesEnabled, role)) return false
            if (n.superuserOnly)            return role === 'SUPERUSER'
            if (n.id === 'ai-tasker')       return can(role, 'tasks', privileges)
            if (n.id === 'cms')             return role === 'SUPERUSER'
            if (n.id === 'menu-management') return isAdmin || role === 'SUPERUSER' || role === 'RESTAURANT'
            if (n.id === 'pos-print-center') return isAdmin || role === 'SUPERUSER' || role === 'RESTAURANT'
            if (n.id === 'consumption')     return can(role, 'inventory', privileges)
            if (n.id === 'reservation-payments') return can(role, 'reservations', privileges)
            return can(role, n.id, privileges)
          })
          if (items.length === 0) return null
          return (
            <div key={g.title} className={gi > 0 ? 'mt-1 pt-1 border-t border-white/[0.08]' : ''}>
              <div className="space-y-0.5">
                  {items.map((n) => {
                    if (n.id === 'consumption' || n.id === 'vat') return null

                    const isExpandable = ['settings', 'cms', 'inventory', 'accounting', 'hr', 'reports', 'pos-print-center'].includes(n.id)
                    if (!isExpandable) {
                      return (
                        <button key={n.id}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-w-0 ${
                            currentTopId === n.id
                              ? 'bg-white/14 text-white ring-1 ring-white/20'
                              : 'text-white/75 hover:bg-white/10 hover:text-white'
                          }`}
                          onClick={() => navigate(navPathById(n.id))}>
                          <n.icon size={17} className="shrink-0" />
                          <span className="min-w-0 truncate whitespace-nowrap">{n.label}</span>
                        </button>
                      )
                    }

                    const isOpen = openSystemMenu === n.id
                    let nested = []
                    if (n.id === 'settings') {
                      nested = getVisibleSettingsSections({ role, isAdmin }).map((s) => ({
                        ...s,
                        path: `${PATHS.SETTINGS}?section=${s.id}`,
                        active: currentTopId === 'settings' && location.search.includes(`section=${s.id}`),
                      }))
                    } else if (n.id === 'cms') {
                      nested = SIDEBAR_CMS_ENTITY_TABS.map((s) => ({ ...s, path: `${PATHS.CMS}?entity=${s.id}`, active: currentTopId === 'cms' && location.search.includes(`entity=${s.id}`) }))
                    } else if (n.id === 'pos-print-center') {
                      nested = SIDEBAR_POS_TABS.map((s) => ({
                        ...s,
                        active: s.path === '/pos'
                          ? location.pathname === '/pos'
                          : location.pathname === '/pos/print-center' && s.path.includes(new URLSearchParams(location.search).get('tab') || 'receipt-preview'),
                      }))
                    } else if (n.id === 'inventory') {
                      nested = [
                        ...SIDEBAR_INVENTORY_TABS.map((s) => ({ ...s, path: `/inventory?tab=${encodeURIComponent(s.id)}`, active: currentTopId === 'inventory' && location.search.includes(`tab=${encodeURIComponent(s.id)}`) })),
                        { id: 'consumption', label: 'Consumption Entry', path: PATHS.CONSUMPTION, active: currentTopId === 'consumption' },
                      ]
                    } else if (n.id === 'accounting') {
                      nested = SIDEBAR_ACCOUNTING_TABS
                        .filter((s) => !s.adminOnly || isAdmin || role === 'SUPERUSER')
                        .map((s) => ({
                          ...s,
                          active: s.id === 'vat'
                            ? location.pathname === '/vat'
                            : s.id === 'vat-return'
                            ? location.pathname === '/vat-return'
                            : location.pathname === s.path,
                        }))
                    } else if (n.id === 'hr') {
                      nested = SIDEBAR_HR_TABS.map((s) => ({
                        ...s,
                        active: location.pathname === s.path,
                      }))
                    } else if (n.id === 'reports') {
                      nested = REPORT_CATEGORIES
                        .map((category) => ({
                          id: category.code,
                          label: category.name,
                          icon: category.icon,
                          active: currentTopId === 'reports' && sidebarReportCatalog.some((report) => report.category === category.code && report.code === activeReportCode),
                          children: sidebarReportCatalog
                            .filter((report) => report.category === category.code)
                            .map((report) => ({
                              id: report.code,
                              label: report.name,
                              path: `/reports?report=${encodeURIComponent(report.code)}`,
                              active: currentTopId === 'reports' && activeReportCode === report.code,
                            })),
                        }))
                        .filter((category) => category.children.length > 0)
                    }

                    return (
                      <div key={n.id} className="space-y-1">
                        <button
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isOpen ? 'bg-white/14 text-white ring-1 ring-white/20' : 'text-white/75 hover:bg-white/10 hover:text-white'
                          }`}
                          onClick={() => {
                            setOpenSystemMenu(isOpen ? null : n.id)
                            if (!isOpen && ['inventory', 'accounting', 'hr', 'reports'].includes(n.id)) {
                              navigate(navPathById(n.id))
                            } else if (!['inventory', 'accounting', 'hr', 'reports'].includes(n.id)) {
                              navigate(navPathById(n.id))
                            }
                          }}
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <n.icon size={17} className="shrink-0" />
                            <span className="min-w-0 truncate whitespace-nowrap">{n.label}</span>
                          </span>
                          <ChevronDown size={13} className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                        </button>
                        {isOpen && (
                          <div className="ml-6 space-y-0.5">
                            {nested.map((child) => child.children ? (
                              <HrSubGroup key={child.id} grp={child} navigate={navigate} location={location} />
                            ) : (
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
                </div>
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
      {/* Desktop sidebar — hidden on Booking Calendar for full-page view */}
      {!sidebarHidden && (
        <aside style={sidebarThemeStyle} className="hidden lg:flex w-60 text-white flex-col fixed inset-y-0 overflow-y-auto z-30 border-r border-white/10 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
          {SidebarContent}
        </aside>
      )}

      {/* Floating toggle to restore sidebar (desktop, Booking Calendar only) */}
      {sidebarHidden && (
        <button
          onClick={() => setSidebarHidden(false)}
          title="Show sidebar"
          className="hidden lg:flex fixed top-4 left-4 z-40 items-center justify-center w-9 h-9 rounded-lg bg-pine/80 hover:bg-pine text-white shadow-lg transition-colors"
        >
          <Menu size={18} />
        </button>
      )}

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
        <BrandLogo url={company?.logo_url} softwareName={softwareName} />
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold leading-tight truncate text-sm">{softwareName}</div>
        </div>
      </div>

      <main className="app-shell-main" style={sidebarHidden ? { marginLeft: 0 } : undefined}>
        {company?.maintenance_mode && (
          <div className="no-print app-shell-banner" style={{ background:'#b91c1c',
            color:'#fff', textAlign:'center', padding:'6px', fontWeight:600, fontSize:13 }}>
            ⚠ Maintenance mode — posting & edits are locked while accounts reconcile.
          </div>
        )}

        <Routes>
          <Route path={PATHS.ROOT} element={<Navigate to={PATHS.FRONTOFFICE} replace />} />

          {/* Dashboard */}
          <Route path={PATHS.DASHBOARD} element={<Navigate to={PATHS.FRONTOFFICE} replace />} />
          <Route path={PATHS.FRONTOFFICE} element={
            <SaasModuleRoute moduleId="frontoffice" role={role} navId="dashboard" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <Dashboard openReservation={openFrontOfficeReservation} userName={userName} role={role} isAdmin={isAdmin} company={company} />
            </SaasModuleRoute>
          } />

          {/* Reservations */}
          <Route path={PATHS.RESERVATIONS} element={
            <SaasModuleRoute moduleId="reservations" role={role} navId="reservations" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <ReservationsRoute openReservation={openReservation} userName={userName} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.RESERVATION_DETAIL} element={
            <SaasModuleRoute moduleId="reservations" role={role} navId="reservations" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <ReservationModuleRoute userName={userName} role={role} isAdmin={isAdmin} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.FRONTOFFICE_RESERVATION_DETAIL} element={
            <SaasModuleRoute moduleId="frontoffice" role={role} navId="dashboard" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <FrontOfficeReservationRoute userName={userName} role={role} isAdmin={isAdmin} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.RESERVATION_PAYMENTS} element={
            <SaasModuleRoute moduleId="reservations" role={role} navId="reservations" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <ReservationPayments userName={userName} isAdmin={isAdmin} />
            </SaasModuleRoute>
          } />

          {/* Guest CRM */}
          <Route path={PATHS.CRM} element={
            <SaasModuleRoute moduleId="reservations" role={role} navId="crm" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <GuestCRM userName={userName} isAdmin={isAdmin} role={role} />
            </SaasModuleRoute>
          } />

          {/* Booking Calendar */}
          <Route path={PATHS.CALENDAR} element={
            <SaasModuleRoute moduleId="reservations" role={role} navId="calendar" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <BookingCalendar
                openReservation={openReservation}
                onNewReservation={startReservation}
                onOpenReservations={() => navigate(PATHS.RESERVATIONS)}
              />
            </SaasModuleRoute>
          } />

          {/* Front Office */}
          <Route path={PATHS.NIGHTAUDIT} element={
            <SaasModuleRoute moduleId="nightaudit" role={role} navId="nightaudit" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <NightAudit userName={userName} isAdmin={isAdmin} role={role} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.HOUSEKEEPING} element={
            <SaasModuleRoute moduleId="housekeeping" role={role} navId="housekeeping" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <HousekeepingHub userName={userName} role={role} isAdmin={isAdmin} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.FACILITIES} element={
            <SaasModuleRoute moduleId="facilities" role={role} navId="facilities" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <Facilities userName={userName} isAdmin={isAdmin} />
            </SaasModuleRoute>
          } />

          {/* Restaurant */}
          <Route path={PATHS.POS} element={
            <SaasModuleRoute moduleId="pos" role={role} navId="pos" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <RestaurantPOS userName={userName} role={role} isAdmin={isAdmin} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.POS_PRINT_CENTER} element={
            <SaasModuleRoute moduleId="pos" role={role} navId="pos" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <PosPrintCenter company={company} userName={userName} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.GUEST_KIOSK} element={<GuestPosKiosk />} />
          <Route path={PATHS.VERIFY_BILL} element={<VerifyBill />} />
          <Route path={PATHS.MENU_MANAGEMENT} element={
            (isModuleEnabled('menu-management', modulesEnabled, role) && (isAdmin || role === 'SUPERUSER' || role === 'RESTAURANT'))
              ? <SaasModuleFrame moduleId="pos" company={company} role={role} userName={userName}><MenuManagement isAdmin={isAdmin} /></SaasModuleFrame>
              : <Navigate to={firstAccessiblePath(role, privileges, modulesEnabled)} replace />
          } />

          {/* Inventory */}
          <Route path={PATHS.INVENTORY} element={
            <SaasModuleRoute moduleId="inventory" role={role} navId="inventory" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <InventoryHub userName={userName} role={role} isAdmin={isAdmin} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.CONSUMPTION} element={
            <SaasModuleRoute moduleId="consumption" role={role} navId="inventory" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <ConsumptionEntry userName={userName} isAdmin={isAdmin} />
            </SaasModuleRoute>
          } />

         {/* Accounting — separate routes per section */}
          <Route path={PATHS.VAT} element={
            <SaasModuleRoute moduleId="accounting" role={role} navId="vat" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <VatCenter userName={userName} company={company} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.VAT_RETURN} element={
            <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <VATReturn />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.ACCOUNTING} element={<Navigate to={PATHS.ACCOUNTING_VOUCHER} replace />} />
          <Route path={PATHS.ACCOUNTING_VOUCHER} element={
            <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <VoucherEntryPage userName={userName} isAdmin={isAdmin} role={role} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.ACCOUNTING_TRIAL} element={
            <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <TrialBalancePage />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.ACCOUNTING_COA} element={
            <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <ChartOfAccountsPage isAdmin={isAdmin} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.ACCOUNTING_ASSETS} element={
            <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <FixedAssetsPage userName={userName} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.ACCOUNTING_OPENING} element={
            <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <OpeningBalancePage userName={userName} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.ACCOUNTING_TX_MAP} element={
            <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <TransactionMappingPage userName={userName} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.ACCOUNTING_VENDOR_PAYMENTS} element={
            <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
             <VendorPaymentPage role={role} />
            </SaasModuleRoute>
          } />

          {/* HR & Payroll */}
          <Route path="/hr" element={<Navigate to="/hr/employee-entry" replace />} />
          <Route path="/hr/employee-entry"      element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrEmployeeEntryPage      userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
          <Route path="/hr/service-book"        element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrServiceBookPage         userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
          <Route path="/hr/nominee"             element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrNomineePage             userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
          <Route path="/hr/leave-entry"         element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLeaveEntryPage          userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
          <Route path="/hr/comp-leave"          element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrCompLeavePage           userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
          <Route path="/hr/festival-leave"      element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrFestivalLeavePage       userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
          <Route path="/hr/payroll-config"      element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrPayrollConfigPage       userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
          <Route path="/hr/payroll-gen"         element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrPayrollGenPage          userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
          <Route path="/hr/payroll-register"    element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrPayrollRegisterPage     userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
          <Route path="/hr/offer-letter"        element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="OFFER_LETTER"        company={company} /></SaasModuleRoute>} />
          <Route path="/hr/appointment-letter"  element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="APPOINTMENT"        company={company} /></SaasModuleRoute>} />
          <Route path="/hr/joining-letter"      element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="JOINING"            company={company} /></SaasModuleRoute>} />
          <Route path="/hr/confirmation-letter" element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="CONFIRMATION"       company={company} /></SaasModuleRoute>} />
          <Route path="/hr/increment-letter"    element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="SALARY_INCREMENT"   company={company} /></SaasModuleRoute>} />
          <Route path="/hr/promotion-letter"    element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="PROMOTION"          company={company} /></SaasModuleRoute>} />
          <Route path="/hr/objection-letter"    element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="OBJECTION"          company={company} /></SaasModuleRoute>} />
          <Route path="/hr/show-cause"          element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="SHOW_CAUSE"         company={company} /></SaasModuleRoute>} />
          <Route path="/hr/warning-letter"      element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="WARNING"            company={company} /></SaasModuleRoute>} />
          <Route path="/hr/dismissal-letter"    element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="RELIEVING"          company={company} /></SaasModuleRoute>} />
          <Route path="/hr/noc"                 element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="NOC"                company={company} /></SaasModuleRoute>} />
          <Route path="/hr/experience-cert"     element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="EXP_CERT"           company={company} /></SaasModuleRoute>} />
          <Route path="/hr/employment-cert"     element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="SALARY_CERT"        company={company} /></SaasModuleRoute>} />
          <Route path="/hr/final-payment"       element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="FINAL_PAYMENT"      company={company} /></SaasModuleRoute>} />
          <Route path="/hr/attendance-register" element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrAttendanceRegisterPage flash={(m)=>m} /></SaasModuleRoute>} />
          <Route path="/hr/employee-register"   element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrEmployeeRegisterPage   role={role} /></SaasModuleRoute>} />
          <Route path="/hr/service-book-reg"    element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrServiceBookRegPage      userName={userName} /></SaasModuleRoute>} />
          <Route path="/hr/incidents"           element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrIncidentsPage           userName={userName} flash={(m)=>m} /></SaasModuleRoute>} />
          <Route path="/hr/compliance"          element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrCompliancePage          role={role} /></SaasModuleRoute>} />

          {/* Reports */}
          <Route path={PATHS.REPORTS_CASED_ALIAS} caseSensitive element={<Navigate to={PATHS.REPORTS} replace />} />
          <Route path={PATHS.TENANT_REPORTS_CASED_ALIAS} caseSensitive element={<TenantReportsRedirect />} />
          <Route path={PATHS.TENANT_REPORTS} element={
            <SaasModuleRoute moduleId="reports" role={role} navId="reports" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <Reportmodule userName={userName} userId={userId} role={role} company={company} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.REPORTS} element={
            <SaasModuleRoute moduleId="reports" role={role} navId="reports" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <Reportmodule userName={userName} userId={userId} role={role} company={company} />
            </SaasModuleRoute>
          } />

          {/* Tasks */}
          <Route path={PATHS.TASKS} element={
            <SaasModuleRoute moduleId="tasks" role={role} navId="tasks" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <TaskManagement userName={userName} role={role} isAdmin={isAdmin} />
            </SaasModuleRoute>
          } />
          <Route path={PATHS.AI_TASKER} element={
            <SaasModuleRoute moduleId="tasks" role={role} navId="tasks" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <TaskManagement userName={userName} role={role} isAdmin={isAdmin} aiTaskerMode />
            </SaasModuleRoute>
          } />

          {/* System — superuser only */}
          <Route path={PATHS.CMS} element={
            role === 'SUPERUSER'
              ? <SaasModuleFrame moduleId="settings" company={company} role={role} userName={userName}><CmsPortal role={role} isAdmin={isAdmin} /></SaasModuleFrame>
              : <Navigate to={firstAccessiblePath(role, privileges, modulesEnabled)} replace />
          } />
          <Route path={PATHS.SETTINGS} element={
            <SaasModuleRoute moduleId="settings" role={role} navId="settings" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
              <Settings userName={userName} role={role} isAdmin={isAdmin} reloadCompany={loadCompany} />
            </SaasModuleRoute>
          } />

          <Route path="*" element={<Navigate to={firstAccessiblePath(role, privileges, modulesEnabled)} replace />} />
        </Routes>

        <footer className="no-print mt-10 pt-4 border-t border-leaf/80 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-pine/45">
          <div>© {new Date().getFullYear()} Aura Stay</div>
          <div>Powered by <span className="font-semibold text-pine/60">Aura Stay</span></div>
        </footer>
      </main>

      {/* Popover display and welcome */}
      <PopoverDisplay />
      <AppWelcome userName={userName} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  WELCOME POPOVER                                                   */
/* ------------------------------------------------------------------ */
function AppWelcome({ userName }) {
  const { showWelcome, setShowWelcome } = useWelcomePopover()

  return (
    <WelcomePopover
      isOpen={showWelcome}
      userName={userName}
      onClose={() => setShowWelcome(false)}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  GUARDED ROUTE                                                       */
/* ------------------------------------------------------------------ */
// Use can() for both loaded privileges and fallback role defaults. This avoids
// blank guarded pages if the role_privileges query is still loading or fails.
function GuardedRoute({ role, navId, privileges, modulesEnabled = null, children }) {
  if (!isModuleEnabled(navId, modulesEnabled, role)) {
    return <SaasModuleBlocked moduleId={navId} />
  }
  if (!can(role, navId, privileges)) return <Navigate to={firstAccessiblePath(role, privileges, modulesEnabled)} replace />
  return children
}

function SaasModuleRoute({ moduleId, role, navId, privileges, modulesEnabled, company, userName, children }) {
  return (
    <GuardedRoute role={role} navId={navId || moduleId} privileges={privileges} modulesEnabled={modulesEnabled}>
      <SaasModuleFrame moduleId={moduleId} company={company} role={role} userName={userName}>
        {children}
      </SaasModuleFrame>
    </GuardedRoute>
  )
}

function TenantReportsRedirect() {
  const { slug } = useParams()
  return <Navigate to={PATHS.TENANT_REPORTS.replace(':slug', slug)} replace />
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

function ReservationModuleRoute({ userName, role, isAdmin }) {
  const { id }   = useParams()
  const navigate = useNavigate()
  return <Reservationmodule id={id} back={() => navigate(PATHS.RESERVATIONS)} userName={userName} role={role} isAdmin={isAdmin} />
}

function FrontOfficeReservationRoute({ userName, role, isAdmin }) {
  const { id }   = useParams()
  const navigate = useNavigate()
  return <Frontofficemodule id={id} back={() => navigate(PATHS.FRONTOFFICE)} userName={userName} role={role} isAdmin={isAdmin} />
}

/* ------------------------------------------------------------------ */
/*  APP ROOT                                                            */
/* ------------------------------------------------------------------ */
export default function App() {
  return (
    <BrowserRouter>
      <AppRoot />
      <Analytics />
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
    let tenantId = forceTenantId || getTenantId()
    if (!tenantId) {
      const firstPathPart = location.pathname.split('/').filter(Boolean)[0]
      const reservedPaths = new Set(Object.values(PATHS)
        .filter((path) => typeof path === 'string' && path.startsWith('/') && !path.startsWith('/:'))
        .map((path) => path.split('/').filter(Boolean)[0])
        .filter(Boolean))
      if (firstPathPart && !reservedPaths.has(firstPathPart.toLowerCase())) {
        const { data: slugProperty } = await supabase.from('properties').select('id').eq('slug', firstPathPart).maybeSingle()
        tenantId = slugProperty?.id || null
      }
    }
    if (!tenantId) {
      setCompany(null)
      return
    }
    const { data } = await supabase.from('company_settings').select('*').eq('tenant_id', tenantId).limit(1).maybeSingle()
    if (data) {
      setCurrency(data.currency || '৳')
      let propertyQuery = supabase.from('properties').select('slug')
      if (tenantId) propertyQuery = propertyQuery.eq('id', tenantId)
      const { data: prop } = await propertyQuery.limit(1).maybeSingle()
      setCompany({ ...data, slug: prop?.slug || null })
    }
  }, [location.pathname])

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
      .catch(() => {
        setProfile({ role: 'FRONT_OFFICE', full_name: session.user.email?.split('@')[0] })
        setTenantId(null)
        loadCompany(null)
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
  }, [
    company?.logo_url,
    company?.primary_color,
    company?.secondary_color,
    company?.accent_color,
    company?.brand_primary,
    company?.brand_accent,
    company?.sidebar_bg_color,
    company?.sidebar_text_color,
    company?.button_color,
    company?.table_header_color,
    company?.report_header_color,
    company?.font_family,
    company?.theme_mode,
  ])

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

  // No-show sweep is now handled server-side via the auto-no-show Supabase
  // Edge Function scheduled by pg_cron. See:
  //   supabase/functions/auto-no-show/index.ts
  //   supabase/migrations/20260701000007_noshow_pg_cron.sql

  if (session === undefined) return (
    <div className="min-h-screen flex items-center justify-center text-pine/60">Loading…</div>
  )

  if (location.pathname.endsWith(PATHS.LOGIN)) {
    const pathParts = location.pathname.split('/').filter(Boolean)
    const slug = pathParts.length > 1 ? pathParts[0] : undefined
    if (!session) return <Login slug={slug} />
    return <Navigate to={PATHS.FRONTOFFICE} replace />
  }

  if (!session && location.pathname.startsWith(PATHS.GUEST_KIOSK)) return <GuestPosKiosk />
  if (!session && location.pathname.startsWith(PATHS.VERIFY_BILL.replace(':id', ''))) return <VerifyBill />
  if (!session) return <Login />
  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center text-pine/60">Loading profile...</div>
  )

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
      userId={profile?.auth_id || profile?.id}
      loadCompany={loadCompany}
      privileges={privileges}
    />
  )
}
