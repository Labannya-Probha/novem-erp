import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { setCurrency } from './lib/helpers'
import { can, ROLE_LABELS } from './lib/roles'
import Login from './components/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Reservations from './pages/Reservations.jsx'
import ReservationDetail from './pages/ReservationDetail.jsx'
import BookingCalendar from './pages/BookingCalendar.jsx'
import HousekeepingHub from './pages/HousekeepingHub.jsx'
import RestaurantPOS from './pages/RestaurantPOS.jsx'
import Facilities from './pages/Facilities.jsx'
import InventoryHub from './pages/InventoryHub.jsx'
import VatCenter from './pages/VatCenter.jsx'
import AccountingHub from './pages/AccountingHub.jsx'
import HrOffice from './pages/HrOffice.jsx'
import NightAudit from './pages/NightAudit.jsx'
import ReportsHub from './pages/ReportsHub.jsx'
import Settings from './pages/Settings.jsx'
import {
  Leaf, LayoutDashboard, CalendarRange, CalendarDays, UtensilsCrossed, ShoppingBasket, Boxes,
  FileSpreadsheet, Calculator, Users, MoonStar, BarChart3, Settings2, LogOut, BedDouble,
} from 'lucide-react'

function BrandLogo({ url }) {
  const [ok, setOk] = useState(true)
  if (url && ok) return <img src={url} alt="logo" onError={() => setOk(false)} className="w-9 h-9 rounded-lg object-contain bg-white/90 p-0.5" />
  return <div className="w-9 h-9 rounded-lg bg-forest flex items-center justify-center"><Leaf size={18} /></div>
}

const NAV_GROUPS = [
  { title: 'Front Office', items: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reservations', label: 'Reservations', icon: CalendarRange },
    { id: 'calendar', label: 'Booking Calendar', icon: CalendarDays },
    { id: 'nightaudit', label: 'Night Audit', icon: MoonStar },
  ]},
  { title: 'Sales', items: [
    { id: 'pos', label: 'Restaurant POS', icon: UtensilsCrossed },
    { id: 'facilities', label: 'Facilities', icon: ShoppingBasket },
    { id: 'housekeeping', label: 'Housekeeping', icon: BedDouble },
  ]},
  { title: 'Back Office', items: [
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'vat', label: 'VAT Center', icon: FileSpreadsheet },
    { id: 'accounting', label: 'Accounting', icon: Calculator },
    { id: 'hr', label: 'HR & Office', icon: Users },
  ]},
  { title: 'Insight', items: [
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ]},
  { title: 'System', items: [
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ]},
]

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [company, setCompany] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [activeRes, setActiveRes] = useState(null)
  const [resPrefill, setResPrefill] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadCompany = async () => {
    const { data } = await supabase.from('company_settings').select('*').limit(1).single()
    if (data) { setCompany(data); setCurrency(data.currency || '৳') }
  }

  useEffect(() => {
    if (!session) return
    loadCompany()
    supabase.from('app_users').select('*').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setProfile(data || { role: 'FRONT_OFFICE', full_name: session.user.email?.split('@')[0] }))
  }, [session?.user?.id])

  if (session === undefined) return <div className="min-h-screen flex items-center justify-center text-pine/60">Loading…</div>
  if (!session) return <Login />

  const role = profile?.role || 'FRONT_OFFICE'
  const isAdmin = role === 'ADMIN'
  const userName = profile?.full_name || session.user?.email?.split('@')[0] || 'User'
  const openReservation = (id) => { setActiveRes(id); setPage('detail') }
  const startReservation = (prefill = null) => {
  setResPrefill(prefill)
  setPage('reservations')
}
  const softwareName = company?.software_name || 'Aura Stay'

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-pine text-white flex flex-col fixed inset-y-0 overflow-y-auto">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
          <BrandLogo url={company?.logo_url} />
          <div className="min-w-0">
            <div className="font-display font-bold leading-tight truncate">{softwareName}</div>
            <div className="text-[11px] text-white/50 truncate">{company?.name || ''}</div>
          </div>
        </div>
        <nav className="flex-1 py-3 px-3 space-y-3">
          {NAV_GROUPS.map((g) => {
            const items = g.items.filter((n) => can(role, n.id))
            if (items.length === 0) return null
            return (
              <div key={g.title}>
                <div className="px-3 pb-1 text-[10px] uppercase tracking-widest text-white/35 font-semibold">{g.title}</div>
                <div className="space-y-0.5">
                  {items.map((n) => (
                    <button key={n.id}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${page === n.id || (n.id === 'reservations' && page === 'detail') ? 'bg-forest text-white' : 'text-white/70 hover:bg-white/10'}`}
                      onClick={() => { setPage(n.id); if (n.id !== 'reservations') setActiveRes(null) }}>
                      <n.icon size={17} /> {n.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-xs text-white/60">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold text-white/80">{userName}</div>
              <div className="text-[10px] text-white/40">{ROLE_LABELS[role] || role}</div>
            </div>
            <button title="Sign out" onClick={() => supabase.auth.signOut()} className="hover:text-white shrink-0"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      <main className="flex-1 ml-60 p-6 lg:p-8 max-w-[1400px]">
        {company?.maintenance_mode && (
          <div className="no-print" style={{position:'sticky',top:0,zIndex:50,background:'#b91c1c',
               color:'#fff',textAlign:'center',padding:'6px',fontWeight:600,fontSize:13,
               margin:'-24px -24px 16px'}}>
            ⚠ Maintenance mode — posting & edits are locked while accounts reconcile.
          </div>
        )}
        
        {page === 'dashboard' && <Dashboard openReservation={openReservation} userName={userName} />}
        {page === 'reservations' && ( <Reservations openReservation={openReservation} userName={userName} prefill={resPrefill} clearPrefill={() => setResPrefill(null)} />)}
        {page === 'calendar' && ( <BookingCalendar openReservation={openReservation} onNewReservation={startReservation} />)}
        {page === 'detail' && activeRes && ( <ReservationDetail id={activeRes} back={() => setPage('reservations')} userName={userName} role={role} isAdmin={isAdmin} />)}
        {page === 'nightaudit' && can(role, 'nightaudit') && <NightAudit userName={userName} isAdmin={isAdmin} />}
        {page === 'housekeeping' && can(role, 'housekeeping') && <HousekeepingHub userName={userName} role={role} isAdmin={isAdmin} />}
        {page === 'pos' && can(role, 'pos') && <RestaurantPOS userName={userName} role={role} isAdmin={isAdmin} />}
        {page === 'facilities' && can(role, 'facilities') && <Facilities userName={userName} isAdmin={isAdmin} />}
        {page === 'inventory' && can(role, 'inventory') && <InventoryHub userName={userName} role={role} isAdmin={isAdmin} />}
        {page === 'vat' && can(role, 'vat') && <VatCenter userName={userName} company={company} />}
        {page === 'accounting' && can(role, 'accounting') && <AccountingHub userName={userName} isAdmin={isAdmin} />}
        {page === 'hr' && can(role, 'hr') && <HrOffice userName={userName} role={role} isAdmin={isAdmin} company={company} />}
        {page === 'reports' && can(role, 'reports') && <ReportsHub userName={userName} role={role} />}
        {page === 'settings' && can(role, 'settings') && <Settings userName={userName} role={role} isAdmin={isAdmin} reloadCompany={loadCompany} />}
      </main>
    </div>
  )
}
