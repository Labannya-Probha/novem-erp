import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Login from './components/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Reservations from './pages/Reservations.jsx'
import ReservationDetail from './pages/ReservationDetail.jsx'
import VatRegister from './pages/VatRegister.jsx'
import RestaurantPOS from './pages/RestaurantPOS.jsx'
import Settings from './pages/Settings.jsx'
import { Leaf, LayoutDashboard, CalendarRange, UtensilsCrossed, FileSpreadsheet, Settings2, LogOut } from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'reservations', label: 'Reservations', icon: CalendarRange },
  { id: 'pos', label: 'Restaurant POS', icon: UtensilsCrossed },
  { id: 'vat', label: 'VAT Register (6.2)', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

export default function App() {
  const [session, setSession] = useState(undefined)
  const [page, setPage] = useState('dashboard')
  const [activeRes, setActiveRes] = useState(null) // reservation id being viewed

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="min-h-screen flex items-center justify-center text-pine/60">Loading…</div>
  if (!session) return <Login />

  const openReservation = (id) => { setActiveRes(id); setPage('detail') }
  const userEmail = session.user?.email || ''
  const userName = userEmail.split('@')[0]

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-pine text-white flex flex-col fixed inset-y-0">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-forest flex items-center justify-center"><Leaf size={18} /></div>
          <div>
            <div className="font-display font-bold leading-tight">Novem ERP</div>
            <div className="text-[11px] text-white/50">Phase 2 · Front Office + POS</div>
          </div>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3">
          {NAV.map((n) => (
            <button key={n.id}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${page === n.id || (n.id === 'reservations' && page === 'detail') ? 'bg-forest text-white' : 'text-white/70 hover:bg-white/10'}`}
              onClick={() => { setPage(n.id); if (n.id !== 'reservations') setActiveRes(null) }}>
              <n.icon size={17} /> {n.label}
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-xs text-white/60 flex items-center justify-between">
          <span className="truncate">{userEmail}</span>
          <button title="Sign out" onClick={() => supabase.auth.signOut()} className="hover:text-white"><LogOut size={15} /></button>
        </div>
      </aside>

      <main className="flex-1 ml-60 p-8">
        {page === 'dashboard' && <Dashboard openReservation={openReservation} />}
        {page === 'reservations' && <Reservations openReservation={openReservation} userName={userName} />}
        {page === 'detail' && activeRes && (
          <ReservationDetail id={activeRes} back={() => setPage('reservations')} userName={userName} />
        )}
        {page === 'pos' && <RestaurantPOS userName={userName} />}
        {page === 'vat' && <VatRegister />}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  )
}
