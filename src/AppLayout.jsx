/* ------------------------------------------------------------------ */
/*  APP LAYOUT — sidebar shell, mobile nav, AppWelcome                 */
/* ------------------------------------------------------------------ */
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import { can, ROLE_LABELS } from './lib/roles'
import { isModuleEnabled } from './lib/saasModules'
import { REPORT_CATEGORIES } from './lib/reporting/reportConfig'
import { getRoleDefaultReportCatalog } from './lib/reporting/tenantReporting'
import { NAV_GROUPS } from './app/navigation/navGroups'
import {
  SIDEBAR_ACCOUNTING_TABS,
  SIDEBAR_HR_TABS,
} from './app/navigation/sidebarTabs'
import { getActiveNavGroupTitle } from './app/navigation/helpers'
import { getVisibleSettingsSections } from './app/navigation/settingsSections'
import { PATHS } from './app/paths'
import { getTenantId } from './lib/tenant'
import { firstAccessiblePath } from './app/navigation/helpers'
import { WelcomePopover } from './components/WelcomePopover.jsx'
import { PopoverDisplay } from './components/PopoverDisplay.jsx'
import { useWelcomePopover } from './hooks/useWelcomePopover'
import AppRoutes from './AppRoutes.jsx'
import {
  LogOut, Menu, X, ChevronDown,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  BrandLogo                                                           */
/* ------------------------------------------------------------------ */
function BrandLogo({ url, softwareName }) {
  const [ok, setOk] = useState(true)
  if (url && ok) return <img src={url} alt="logo" onError={() => setOk(false)} className="w-9 h-9 rounded-lg object-contain bg-white/90 p-0.5" />
  const abbr = (softwareName || 'AS').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return <div className="w-9 h-9 rounded-lg bg-amber-400 flex items-center justify-center shadow-sm flex-shrink-0"><span className="text-pine font-bold text-sm leading-none">{abbr}</span></div>
}

/* ------------------------------------------------------------------ */
/*  HrSubGroup                                                          */
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

/* ------------------------------------------------------------------ */
/*  AppWelcome                                                          */
/* ------------------------------------------------------------------ */
export function AppWelcome({ userName }) {
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
/*  AppShell                                                            */
/* ------------------------------------------------------------------ */
export default function AppShell({ company, role, isAdmin, userName, userId, loadCompany, privileges }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false)
  const [openSystemMenu, setOpenSystemMenu] = useState(null)
  const [openNavGroup,   setOpenNavGroup]   = useState(() => getActiveNavGroupTitle(window.location.pathname.split('/').filter(Boolean)[0] || 'dashboard', window.location.pathname))
  const [modulesEnabled, setModulesEnabled] = useState(null)
  const [sidebarHidden,  setSidebarHidden]  = useState(false)

  const currentTopSegment = location.pathname.split('/').filter(Boolean)[0] || 'dashboard'
  const currentTopId = currentTopSegment === 'frontoffice' ? 'dashboard' : currentTopSegment === 'restaurant' ? 'pos' : currentTopSegment
  const navPathById = (id) => {
    if (id === 'dashboard') return PATHS.FRONTOFFICE
    if (id === 'pos') return PATHS.RESTAURANT
    if (id === 'pos-print-center') return PATHS.POS_PRINT_CENTER
    return `/${id}`
  }
  const withId = (template, id) => template.replace(':id', encodeURIComponent(id))

  const openReservation = (id, tab) => {
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
    const isReservationRoute = (
      location.pathname.startsWith('/reservations') ||
      location.pathname === PATHS.RESERVATION_PAYMENTS ||
      location.pathname === PATHS.CALENDAR ||
      location.pathname === PATHS.BOOKING_CALENDAR ||
      location.pathname === PATHS.CRM
    )
    const isFrontOfficeRoute = (
      location.pathname.startsWith('/frontoffice') ||
      location.pathname === PATHS.NIGHTAUDIT ||
      location.pathname === PATHS.FACILITIES
    )
    const isRestaurantRoute = (
      location.pathname.startsWith('/restaurant') ||
      location.pathname === PATHS.POS ||
      location.pathname === PATHS.MENU_MANAGEMENT ||
      location.pathname.startsWith('/pos/print-center') ||
      location.pathname === PATHS.GUEST_KIOSK ||
      location.pathname.startsWith('/verify/pos/')
    )
    const isAccountingRoute = location.pathname.startsWith('/accounting') || location.pathname === PATHS.VAT || location.pathname === PATHS.VAT_RETURN
    const isHrRoute = location.pathname.startsWith('/hr')
    const isReportsRoute = (
      location.pathname === PATHS.REPORTS ||
      location.pathname === PATHS.REPORTS_CASED_ALIAS ||
      location.pathname.endsWith('/reports') ||
      location.pathname.endsWith('/Reports')
    )
    const isTasksRoute = location.pathname === PATHS.TASKS || location.pathname === PATHS.AI_TASKER

    if (currentTopId === 'settings') setOpenSystemMenu('settings')
    else if (isTasksRoute) setOpenSystemMenu('tasks')
    else if (isReportsRoute) setOpenSystemMenu('reports')
    else if (isHrRoute) setOpenSystemMenu('hr')
    else if (isAccountingRoute) setOpenSystemMenu('accounting')
    else if (['inventory', 'consumption'].includes(currentTopId)) setOpenSystemMenu('inventory')
    else if (isRestaurantRoute) setOpenSystemMenu('pos')
    else if (isFrontOfficeRoute) setOpenSystemMenu('nightaudit')
    else if (isReservationRoute) setOpenSystemMenu('reservations')
    else setOpenSystemMenu(null)
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
            if (n.id === 'nightaudit') return (
              can(role, 'dashboard', privileges) ||
              can(role, 'nightaudit', privileges) ||
              can(role, 'facilities', privileges)
            )
            return can(role, n.id, privileges)
          })
          if (items.length === 0) return null
          return (
            <div key={g.title} className={gi > 0 ? 'mt-1 pt-1 border-t border-white/[0.08]' : ''}>
              <div className="space-y-0.5">
                {items.map((n) => {
                  const isExpandable = ['reservations', 'nightaudit', 'pos', 'inventory', 'accounting', 'hr', 'reports', 'tasks', 'settings'].includes(n.id)
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
                  } else if (n.id === 'reservations') {
                    const resTab = new URLSearchParams(location.search).get('tab')
                    const isResPath = location.pathname === PATHS.RESERVATIONS
                    nested = [
                      {
                        id: 'reservations-list',
                        label: 'Reservations',
                        path: `${PATHS.RESERVATIONS}?tab=list`,
                        active: isResPath && (!resTab || resTab === 'list'),
                      },
                      {
                        id: 'calendar',
                        label: 'Booking Calendar',
                        path: `${PATHS.RESERVATIONS}?tab=calendar`,
                        active: (isResPath && resTab === 'calendar') || location.pathname === PATHS.CALENDAR || location.pathname === PATHS.BOOKING_CALENDAR,
                      },
                      {
                        id: 'reservation-payments',
                        label: 'Reservation Payments',
                        path: `${PATHS.RESERVATIONS}?tab=payments`,
                        active: (isResPath && resTab === 'payments') || location.pathname === PATHS.RESERVATION_PAYMENTS,
                      },
                      {
                        id: 'crm',
                        label: 'Guest CRM',
                        path: `${PATHS.RESERVATIONS}?tab=crm`,
                        active: (isResPath && resTab === 'crm') || location.pathname === PATHS.CRM,
                      },
                    ]
                  } else if (n.id === 'nightaudit') {
                    nested = [
                      {
                        id: 'frontoffice-module',
                        label: 'Frontoffice Module',
                        path: PATHS.FRONTOFFICE,
                        active: location.pathname.startsWith('/frontoffice'),
                      },
                      {
                        id: 'nightaudit',
                        label: 'Night Audit',
                        path: PATHS.NIGHTAUDIT,
                        active: location.pathname === PATHS.NIGHTAUDIT,
                      },
                      {
                        id: 'facilities',
                        label: 'Service Bills',
                        path: PATHS.FACILITIES,
                        active: location.pathname === PATHS.FACILITIES,
                      },
                      {
                        id: 'verify-bill',
                        label: 'Verify Bill',
                        active: location.pathname.startsWith('/verify/pos/'),
                      },
                    ]
                  } else if (n.id === 'pos') {
                    nested = [
                      {
                        id: 'restaurant',
                        label: 'Restaurant',
                        path: PATHS.RESTAURANT,
                        active: (
                          location.pathname.startsWith('/restaurant') ||
                          location.pathname === PATHS.POS ||
                          location.pathname === PATHS.MENU_MANAGEMENT ||
                          location.pathname.startsWith('/pos/print-center') ||
                          location.pathname === PATHS.GUEST_KIOSK ||
                          location.pathname.startsWith('/verify/pos/')
                        ),
                      },
                    ]
                  } else if (n.id === 'inventory') {
                    nested = [
                      { id: 'inventory', label: 'Inventory', path: PATHS.INVENTORY, active: currentTopId === 'inventory' },
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
                    const groupByIds = (id) => SIDEBAR_HR_TABS.find((tab) => tab.id === id)
                    const toChild = (tab) => ({
                      id: tab.id,
                      label: tab.label,
                      path: tab.path,
                      icon: tab.icon,
                      active: location.pathname === tab.path,
                    })
                    const groups = [
                      { id: 'employee', label: 'Employee', tabIds: ['employee-entry', 'service-book', 'nominee'] },
                      { id: 'attendance', label: 'Attendance', tabIds: ['attendance-register', 'employee-register', 'service-book-reg'] },
                      { id: 'leave', label: 'Leave', tabIds: ['leave-entry', 'comp-leave', 'festival-leave'] },
                      { id: 'payroll', label: 'Payroll', tabIds: ['payroll-config', 'payroll-gen', 'payroll-register'] },
                      {
                        id: 'letters',
                        label: 'Letters',
                        tabIds: [
                          'offer-letter', 'appointment-letter', 'joining-letter', 'confirmation-letter',
                          'increment-letter', 'promotion-letter', 'objection-letter', 'show-cause',
                          'warning-letter', 'dismissal-letter', 'noc', 'experience-cert',
                          'employment-cert', 'final-payment',
                        ],
                      },
                      { id: 'compliance', label: 'Compliance', tabIds: ['incidents', 'compliance'] },
                    ]
                    nested = groups.map((grp) => {
                      const children = grp.tabIds.map(groupByIds).filter(Boolean).map(toChild)
                      return {
                        id: grp.id,
                        label: grp.label,
                        active: children.some((child) => child.active),
                        children,
                      }
                    })
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
                  } else if (n.id === 'tasks') {
                    nested = [
                      { id: 'tasks', label: 'Task Management', path: PATHS.TASKS, active: location.pathname === PATHS.TASKS },
                      { id: 'ai-tasker', label: 'AI Tasker', path: PATHS.AI_TASKER, active: location.pathname === PATHS.AI_TASKER },
                    ]
                  }

                  return (
                    <div key={n.id} className="space-y-1">
                      <button
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isOpen ? 'bg-white/14 text-white ring-1 ring-white/20' : 'text-white/75 hover:bg-white/10 hover:text-white'
                        }`}
                        onClick={() => {
                          setOpenSystemMenu(isOpen ? null : n.id)
                          if (!isOpen) {
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
                                child.active
                                  ? 'bg-white/14 text-white'
                                  : child.path
                                  ? 'text-white/65 hover:bg-white/10 hover:text-white'
                                  : 'text-white/45 cursor-default'
                              }`}
                              onClick={() => child.path && navigate(child.path)}
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

        <AppRoutes
          role={role}
          isAdmin={isAdmin}
          userName={userName}
          userId={userId}
          company={company}
          privileges={privileges}
          modulesEnabled={modulesEnabled}
          loadCompany={loadCompany}
          openReservation={openReservation}
          openFrontOfficeReservation={openFrontOfficeReservation}
          startReservation={startReservation}
          navigate={navigate}
        />

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
