import { useEffect, useState } from 'react'
import {
  BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation,
} from 'react-router-dom'
import { supabase } from './supabase'
import { applyBrandTheme, buildBrandTheme, DEFAULT_THEME, resolveBrandTheme } from './lib/branding'
import { setCurrency } from './lib/helpers'
import { can, ROLE_LABELS } from './lib/roles'
import { getTenantId, setTenantId } from './lib/tenant'
import Login from './components/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Reservations from './pages/Reservations.jsx'
import ReservationDetail from './pages/ReservationDetail.jsx'
import BookingCalendar from './pages/BookingCalendar.jsx'
import HousekeepingHub from './pages/HousekeepingHub.jsx'
import RestaurantPOS, { GuestPosKiosk } from './pages/RestaurantPOS.jsx'
import Facilities from './pages/Facilities.jsx'
import InventoryHub from './pages/InventoryHub.jsx'
import VatCenter from './pages/VatCenter.jsx'
import AccountingHub from './pages/AccountingHub.jsx'
import HrOffice from './pages/HrOffice.jsx'
import NightAudit from './pages/NightAudit.jsx'
import ReportsHub from './pages/ReportsHub.jsx'
import Settings from './pages/Settings.jsx'
import CmsPortal from './pages/CmsPortal.jsx'
import TaskManagement from './pages/TaskManagement.jsx'
import {
  Leaf, LayoutDashboard, CalendarDays, UtensilsCrossed, ShoppingBasket, Boxes,
  FileSpreadsheet, Calculator, Users, MoonStar, BarChart3, Settings2, LogOut, BedDouble, Building2,
  Menu, X, ListChecks, ChevronDown, Bot,
} from 'lucide-react'

function BrandLogo({ url }) {
  const [ok, setOk] = useState(true)
  if (url && ok) return <img src={url} alt="logo" onError={() => setOk(false)} className="w-9 h-9 rounded-lg object-contain bg-white/90 p-0.5" />
  return <div className="w-9 h-9 rounded-lg bg-forest flex items-center justify-center shadow-sm ring-1 ring-forest/15"><Leaf size={18} /></div>
}

const NAV_GROUPS = [
   { title: 'Sales & Reservation', items: [
    { id: 'calendar', label: 'Booking Calendar', icon: CalendarDays },
  ]},
  { title: 'Tasks', items: [
    { id: 'tasks', label: 'Task Management', icon: ListChecks },
    { id: 'ai-tasker', label: 'AI Tasker', icon: Bot },
  ]},
  { title: 'Front Office', items: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'nightaudit', label: 'Night Audit', icon: MoonStar },
    { id: 'housekeeping', label: 'Housekeeping', icon: BedDouble },
    { id: 'facilities', label: 'Facilities', icon: ShoppingBasket },
  ]},
  { title: 'Restaurant POS', items: [
    { id: 'pos', label: 'Restaurant POS', icon: UtensilsCrossed },
  ]},
  { title: 'Accounting', items: [
    { id: 'accounting', label: 'Accounting', icon: Calculator },
    { id: 'vat', label: 'VAT Center', icon: FileSpreadsheet },
  ]},
  { title: 'Inventory', items: [
    { id: 'inventory', label: 'Inventory', icon: Boxes },
  ]},
  { title: 'HR & Admin', items: [
    { id: 'hr', label: 'HR & Office', icon: Users },
  ]},   
  { title: 'Insight', items: [
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ]},
  { title: 'System', items: [
    { id: 'cms', label: 'Configuration', icon: Building2 },
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ]},
]

const ALL_NAV_IDS = NAV_GROUPS.flatMap((g) => g.items.map((n) => n.id))
const SIDEBAR_SETTINGS_SECTIONS = [
  { id: 'my-account', label: 'My Account', adminOnly: false, superuserOnly: false },
  { id: 'branding', label: 'Branding', adminOnly: true, superuserOnly: false },
  { id: 'tax', label: 'Tax Rates', adminOnly: false, superuserOnly: false },
  { id: 'allowance', label: 'Allowance Configuration', adminOnly: false, superuserOnly: true },
  { id: 'role-permissions', label: 'Role Permissions', adminOnly: false, superuserOnly: true },
  { id: 'staff', label: 'Staff Management', adminOnly: false, superuserOnly: false },
  { id: 'data-system', label: 'Data & System', adminOnly: false, superuserOnly: true },
]
const SIDEBAR_CMS_ENTITY_TABS = [
  { id: 'companies', label: 'Companies' },
  { id: 'agencies', label: 'Agencies' },
  { id: 'shareholders', label: 'Shareholders' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'inv_items', label: 'Inventory Items' },
  { id: 'menu_categories', label: 'Menu Categories' },
  { id: 'menu_items', label: 'Menu Items' },
  { id: 'facility_items', label: 'Facility Items' },
  { id: 'chart_of_accounts', label: 'Chart of Accounts' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'reservation_policies', label: 'Reservation Policies' },
]

const firstAccessiblePath = (role, privileges) => {
  for (const id of ALL_NAV_IDS) {
    if (id === 'dashboard' || can(role, id, privileges)) return `/${id}`
  }
  return '/dashboard'
}

function AppShell({ company, role, isAdmin, userName, loadCompany, privileges }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState(null)
  const [openSystemMenu, setOpenSystemMenu] = useState(null)
  const toggleGroup = (title) => setOpenGroup((prev) => (prev === title ? null : title))

  const currentTopId = location.pathname.split('/').filter(Boolean)[0] || 'dashboard'

  const openReservation = (id) => navigate(`/reservations/${id}`)
  const startReservation = (prefill = {}) => navigate('/reservations', { state: { prefill } })

  const softwareName = company?.software_name || 'Aura Stay'
  const sidebarThemeStyle = { background: 'var(--sidebar-bg)' }

  // Close the mobile drawer automatically whenever the route changes â€”
  // otherwise it stays open after tapping a nav link.
  useEffect(() => { setMobileNavOpen(false) }, [location.pathname])
  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((g) => g.items.some((n) => n.id === currentTopId))
    setOpenGroup(activeGroup?.title || null)
  }, [currentTopId])
  useEffect(() => {
    if (currentTopId === 'settings' || currentTopId === 'cms') setOpenSystemMenu(currentTopId)
    else setOpenSystemMenu(null)
  }, [currentTopId])

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
            if (n.id === 'ai-tasker') return can(role, 'tasks', privileges)
            if (n.id === 'cms') return isAdmin || role === 'SUPERUSER'
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
                    if (n.id !== 'settings' && n.id !== 'cms') {
                      return (
                        <button key={n.id}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentTopId === n.id ? 'bg-white/14 text-white ring-1 ring-white/20' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
                          onClick={() => navigate(`/${n.id}`)}>
                          <n.icon size={17} /> {n.label}
                        </button>
                      )
                    }
                    const isOpen = openSystemMenu === n.id
                    const nested = n.id === 'settings'
                      ? SIDEBAR_SETTINGS_SECTIONS.filter((s) => {
                        if (!s.adminOnly && !s.superuserOnly) return true
                        if (s.adminOnly) return isAdmin || role === 'SUPERUSER'
                        return role === 'SUPERUSER'
                      })
                      : SIDEBAR_CMS_ENTITY_TABS
                    return (
                      <div key={n.id} className="space-y-1">
                        <button
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentTopId === n.id ? 'bg-white/14 text-white ring-1 ring-white/20' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
                          onClick={() => {
                            setOpenSystemMenu(n.id)
                            navigate(`/${n.id}`)
                          }}
                        >
                          <span className="flex items-center gap-3">
                            <n.icon size={17} /> {n.label}
                          </span>
                          <ChevronDown size={13} className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                        </button>
                        {isOpen && (
                          <div className="ml-6 space-y-0.5">
                            {nested.map((child) => {
                              const isActiveChild = currentTopId === n.id && location.search.includes(`${n.id === 'settings' ? 'section' : 'entity'}=${child.id}`)
                              return (
                                <button
                                  key={child.id}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${isActiveChild ? 'bg-white/14 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}
                                  onClick={() => navigate(`/${n.id}?${n.id === 'settings' ? 'section' : 'entity'}=${child.id}`)}
                                >
                                  {child.label}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
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
            const slug = company?.slug
            await supabase.auth.signOut()
            window.location.href = slug ? `/${slug}/login` : '/login'
          }} className="text-white/55 hover:text-white shrink-0"><LogOut size={15} /></button>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar â€” always visible, fixed, unchanged from before */}
      <aside style={sidebarThemeStyle} className="hidden lg:flex w-60 text-white flex-col fixed inset-y-0 overflow-y-auto z-30 border-r border-white/10 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar â€” slide-in drawer + backdrop, only rendered when open */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink/35" onClick={() => setMobileNavOpen(false)} />
          <aside style={sidebarThemeStyle} className="absolute inset-y-0 left-0 w-72 max-w-[85vw] text-white flex flex-col shadow-2xl border-r border-white/10">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Mobile top bar â€” hamburger + brand, only visible below lg */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-20 bg-white/95 backdrop-blur text-pine flex items-center gap-3 px-4 py-3 shadow-sm border-b border-leaf/80">
        <button onClick={() => setMobileNavOpen(true)} className="text-pine/70 hover:text-forest">
          <Menu size={22} />
        </button>
        <BrandLogo url={company?.logo_url} />
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold leading-tight truncate text-sm">{softwareName}</div>
        </div>
      </div>

      <main className="flex-1 min-w-0 lg:ml-60 p-4 pt-20 lg:pt-8 lg:p-8 w-full overflow-x-hidden">
        {company?.maintenance_mode && (
          <div className="no-print" style={{position:'sticky',top:0,zIndex:50,background:'#b91c1c',
               color:'#fff',textAlign:'center',padding:'6px',fontWeight:600,fontSize:13,
               margin:'-16px -16px 16px'}}>
            âš  Maintenance mode â€” posting & edits are locked while accounts reconcile.
          </div>
        )}

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard openReservation={openReservation} userName={userName} role={role} isAdmin={isAdmin} />} />
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

          <Route path="/calendar" element={
            <GuardedRoute role={role} navId="calendar" privileges={privileges}>
              <BookingCalendar openReservation={openReservation} onNewReservation={startReservation} onOpenReservations={() => navigate('/reservations')} />
            </GuardedRoute>
          } />

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
          <Route path="/pos" element={
            <GuardedRoute role={role} navId="pos" privileges={privileges}>
              <RestaurantPOS userName={userName} role={role} isAdmin={isAdmin} />
            </GuardedRoute>
          } />
          <Route path="/kiosk/pos" element={<GuestPosKiosk />} />
          <Route path="/facilities" element={
            <GuardedRoute role={role} navId="facilities" privileges={privileges}>
              <Facilities userName={userName} isAdmin={isAdmin} />
            </GuardedRoute>
          } />
          <Route path="/inventory" element={
            <GuardedRoute role={role} navId="inventory" privileges={privileges}>
              <InventoryHub userName={userName} role={role} isAdmin={isAdmin} />
            </GuardedRoute>
          } />
          <Route path="/vat" element={
            <GuardedRoute role={role} navId="vat" privileges={privileges}>
              <VatCenter userName={userName} company={company} />
            </GuardedRoute>
          } />
          <Route path="/accounting" element={
            <GuardedRoute role={role} navId="accounting" privileges={privileges}>
              <AccountingHub userName={userName} isAdmin={isAdmin} role={role} />
            </GuardedRoute>
          } />
          <Route path="/hr" element={
            <GuardedRoute role={role} navId="hr" privileges={privileges}>
              <HrOffice userName={userName} role={role} isAdmin={isAdmin} company={company} />
            </GuardedRoute>
          } />
          <Route path="/reports" element={
            <GuardedRoute role={role} navId="reports" privileges={privileges}>
              <ReportsHub userName={userName} role={role} />
            </GuardedRoute>
          } />
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
          <Route path="/cms" element={
              (isAdmin || role === 'SUPERUSER')
                ? <CmsPortal role={role} isAdmin={isAdmin} />
                : <Navigate to={firstAccessiblePath(role, privileges)} replace />
          } />
          <Route path="/settings" element={
            <GuardedRoute role={role} navId="settings" privileges={privileges}>
              <Settings userName={userName} role={role} isAdmin={isAdmin} reloadCompany={loadCompany} />
            </GuardedRoute>
          } />

          <Route path="*" element={<Navigate to={firstAccessiblePath(role, privileges)} replace />} />
        </Routes>

        <footer className="no-print mt-10 pt-4 border-t border-leaf/80 flex items-center justify-between text-xs text-pine/45">
          <div>© {new Date().getFullYear()} Aura Stay</div>
          <div>Powered by <span className="font-semibold text-pine/60">Aura Stay</span></div>
        </footer>
      </main>
    </div>
  )
}

function GuardedRoute({ role, navId, privileges, children }) {
  if (!can(role, navId, privileges)) return <Navigate to={firstAccessiblePath(role, privileges)} replace />
  return children
}

function ReservationsRoute({ openReservation, userName }) {
  const location = useLocation()
  const navigate = useNavigate()
  const prefill = location.state?.prefill || null
  const clearPrefill = () => navigate(location.pathname, { replace: true, state: {} })
  return <Reservations openReservation={openReservation} userName={userName} prefill={prefill} clearPrefill={clearPrefill} />
}

function ReservationDetailRoute({ userName, role, isAdmin }) {
  const { id } = useParams()
  const navigate = useNavigate()
  return <ReservationDetail id={id} back={() => navigate('/reservations')} userName={userName} role={role} isAdmin={isAdmin} />
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoot />
    </BrowserRouter>
  )
}

function AppRoot() {
  const location = useLocation()
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [company, setCompany] = useState(null)
  const [privileges, setPrivileges] = useState(null)
  const [brandTheme, setBrandTheme] = useState(buildBrandTheme(DEFAULT_THEME))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

    const loadCompany = async () => {
    const tenantId = getTenantId()
    let query = supabase.from('company_settings').select('*')
    if (tenantId) query = query.eq('tenant_id', tenantId)
    const { data } = await query.limit(1).single()
    if (data) {
      setCurrency(data.currency || 'à§³')
      let propertyQuery = supabase.from('properties').select('slug')
      if (tenantId) propertyQuery = propertyQuery.eq('id', tenantId)
      const { data: prop } = await propertyQuery.limit(1).maybeSingle()
      setCompany({ ...data, slug: prop?.slug || null })
    }
  }

  useEffect(() => {
    if (!session) {
      setTenantId(null)
      setCompany(null)
      const fallbackTheme = buildBrandTheme(DEFAULT_THEME)
      setBrandTheme(fallbackTheme)
      applyBrandTheme(fallbackTheme)
      return
    }
    supabase.from('app_users').select('*').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => {
        const fallbackProfile = { role: 'FRONT_OFFICE', full_name: session.user.email?.split('@')[0] }
        const nextProfile = data || fallbackProfile
        setProfile(nextProfile)
        setTenantId(data?.tenant_id || null)
        loadCompany()
      })
  }, [session?.user?.id])

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
    let query = supabase.from('role_privileges').select('module, can_create, can_view, can_edit, can_delete').eq('role', role)
    const tenantId = getTenantId()
    if (tenantId) query = query.eq('tenant_id', tenantId)
    query
      .then(({ data }) => setPrivileges(data || []))
  }, [profile?.role])

  if (session === undefined) return <div className="min-h-screen flex items-center justify-center text-pine/60">Loadingâ€¦</div>

  if (location.pathname.endsWith('/login')) {
    const slug = location.pathname.split('/').filter(Boolean)[0]
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
    accent_color: company.accent_color || brandTheme.accent,
    brand_primary: company.brand_primary || brandTheme.printPrimary,
    brand_accent: company.brand_accent || brandTheme.printAccent,
  } : null

  return <AppShell company={themedCompany} role={role} isAdmin={isAdmin} userName={userName} loadCompany={loadCompany} privileges={privileges} />
}
