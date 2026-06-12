import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { Analytics } from '@vercel/analytics/react'
import Login from './components/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Reservations from './pages/Reservations.jsx'
import ReservationDetail from './pages/ReservationDetail.jsx'
import RestaurantPOS from './pages/RestaurantPOS.jsx'
import VatRegister from './pages/VatRegister.jsx'
import Settings from './pages/Settings.jsx'
import NightAudit from './pages/NightAudit.jsx'
import NightAuditReports from './pages/NightAuditReports.jsx'
import {
  Leaf, LayoutDashboard, CalendarRange, UtensilsCrossed,
  FileSpreadsheet, Settings2, LogOut, Moon, ClipboardCheck,
  Lock, Unlock
} from 'lucide-react'

// Grouped Navigation per user requirement (Module-wise Entry & Reporting Panel)
const ENTRY_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'reservations', label: 'Reservations', icon: CalendarRange },
  { id: 'pos', label: 'Restaurant POS', icon: UtensilsCrossed },
  { id: 'nightaudit', label: 'Night Audit', icon: Moon },
]

const REPORT_NAV = [
  { id: 'vat', label: 'VAT Register (6.2)', icon: FileSpreadsheet },
  { id: 'auditreports', label: 'Night Audit Reports', icon: ClipboardCheck },
]

const CONFIG_NAV = [
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

// Modal for entering Admin PIN
function PinModal({ isOpen, onClose, onSuccess, title = "Admin Authorization Required" }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (pin === '1234') {
      onSuccess()
      onClose()
      setPin('')
      setError('')
    } else {
      setError('Invalid Admin PIN. Please try again.')
      setPin('')
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-leaf rounded-xl p-6 max-w-sm w-full shadow-lg">
        <h3 className="font-display font-bold text-pine text-lg mb-2">{title}</h3>
        <p className="text-xs text-pine/60 mb-4">Please enter the 4-digit Administrator PIN (`1234`) to authorize this action.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            maxLength={4}
            className="input text-center text-2xl tracking-widest font-mono font-bold"
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            autoFocus
          />
          {error && <p className="text-xs text-red-600 text-center font-medium">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1 justify-center" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center">Authorize</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [page, setPage] = useState('dashboard')
  const [activeRes, setActiveRes] = useState(null)
  
  // Role configuration
  const [role, setRole] = useState(() => localStorage.getItem('user_role') || 'Staff')
  const [pinRequest, setPinRequest] = useState(null) // { callback, title }
  const [roleSwitchPending, setRoleSwitchPending] = useState(false)

  // White-label dynamic branding settings
  const [branding, setBranding] = useState({
    productName: localStorage.getItem('branding_product_name') || 'Novem ERP',
    logoUrl: localStorage.getItem('branding_logo_url') || '',
    themeColor: localStorage.getItem('branding_theme_color') || 'forest',
  })

  // Listen to branding updates (dispatched from settings page)
  useEffect(() => {
    const handleBrandingChange = () => {
      setBranding({
        productName: localStorage.getItem('branding_product_name') || 'Novem ERP',
        logoUrl: localStorage.getItem('branding_logo_url') || '',
        themeColor: localStorage.getItem('branding_theme_color') || 'forest',
      })
    }
    window.addEventListener('storage', handleBrandingChange)
    window.addEventListener('branding_update', handleBrandingChange)
    return () => {
      window.removeEventListener('storage', handleBrandingChange)
      window.removeEventListener('branding_update', handleBrandingChange)
    }
  }, [])

  // Apply theme color class to body
  useEffect(() => {
    // Remove existing theme classes
    document.body.className = document.body.className
      .split(' ')
      .filter(c => !c.startsWith('theme-'))
      .join(' ')
    // Add current theme class
    document.body.classList.add(`theme-${branding.themeColor}`)
  }, [branding.themeColor])

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

  // Global authorization handler passed down to subcomponents
  const requestAdminPermission = (callback, title) => {
    if (role === 'Admin') {
      callback()
    } else {
      setPinRequest({ callback, title })
    }
  }

  // Handle switching roles
  const handleRoleToggle = (e) => {
    const targetRole = e.target.value
    if (targetRole === 'Admin') {
      setRoleSwitchPending(true)
    } else {
      setRole('Staff')
      localStorage.setItem('user_role', 'Staff')
    }
  }

  const renderNavButton = (n) => {
    const isActive = page === n.id || (n.id === 'reservations' && page === 'detail')
    return (
      <button key={n.id}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-forest text-white' : 'text-white/70 hover:bg-white/10'}`}
        onClick={() => { setPage(n.id); if (n.id !== 'reservations') setActiveRes(null) }}>
        <n.icon size={17} /> {n.label}
      </button>
    )
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-pine text-white flex flex-col fixed inset-y-0 shadow-lg">
        {/* White-labeled branding header */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="Logo" className="w-9 h-9 rounded-lg object-contain bg-white/10 p-1" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-forest flex items-center justify-center shadow-inner"><Leaf size={18} /></div>
          )}
          <div>
            <div className="font-display font-bold leading-tight truncate w-36 text-white">{branding.productName}</div>
            <div className="text-[10px] text-white/50 tracking-wider uppercase">Resort Management</div>
          </div>
        </div>

        {/* Sidebar Nav organized into Module-wise entry & Reporting Panel */}
        <div className="flex-1 py-4 overflow-y-auto px-3 space-y-4">
          <div>
            <div className="px-3 text-[10px] uppercase tracking-wider text-white/40 font-bold mb-2">Module Wise Entry</div>
            <nav className="space-y-1">{ENTRY_NAV.map(renderNavButton)}</nav>
          </div>

          <div>
            <div className="px-3 text-[10px] uppercase tracking-wider text-white/40 font-bold mb-2">Reporting Panel</div>
            <nav className="space-y-1">{REPORT_NAV.map(renderNavButton)}</nav>
          </div>

          <div>
            <div className="px-3 text-[10px] uppercase tracking-wider text-white/40 font-bold mb-2">Configuration</div>
            <nav className="space-y-1">{CONFIG_NAV.map(renderNavButton)}</nav>
          </div>
        </div>

        {/* Sidebar footer with Active Role switcher & Auth details */}
        <div className="p-4 border-t border-white/10 space-y-2 bg-black/10">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span className="truncate max-w-[120px]" title={userEmail}>{userEmail}</span>
            <button title="Sign out" onClick={() => supabase.auth.signOut()} className="hover:text-white transition-colors"><LogOut size={15} /></button>
          </div>
          
          <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-lg border border-white/10">
            {role === 'Admin' ? (
              <Unlock size={14} className="text-emerald-400 shrink-0" />
            ) : (
              <Lock size={14} className="text-amber-400 shrink-0" />
            )}
            <select
              className="bg-transparent text-xs text-white/80 font-medium w-full focus:outline-none cursor-pointer"
              value={role}
              onChange={handleRoleToggle}
            >
              <option className="bg-pine text-white" value="Staff">Role: Staff</option>
              <option className="bg-pine text-white" value="Admin">Role: Admin</option>
            </select>
          </div>
        </div>
      </aside>

      <main className="flex-1 ml-60 p-8 min-h-screen">
        {page === 'dashboard' && <Dashboard openReservation={openReservation} />}
        {page === 'reservations' && (
          <Reservations
            openReservation={openReservation}
            userName={userName}
            userRole={role}
            requestAdminPermission={requestAdminPermission}
          />
        )}
        {page === 'detail' && activeRes && (
          <ReservationDetail
            id={activeRes}
            back={() => setPage('reservations')}
            userName={userName}
            userRole={role}
            requestAdminPermission={requestAdminPermission}
          />
        )}
        {page === 'pos' && (
          <RestaurantPOS
            userName={userName}
            userRole={role}
            requestAdminPermission={requestAdminPermission}
          />
        )}
        {page === 'nightaudit' && (
          <NightAudit
            userName={userName}
            userRole={role}
            requestAdminPermission={requestAdminPermission}
          />
        )}
        {page === 'vat' && <VatRegister />}
        {page === 'auditreports' && <NightAuditReports />}
        {page === 'settings' && <Settings />}
      </main>

      {/* Role switch authorization */}
      <PinModal
        isOpen={roleSwitchPending}
        onClose={() => setRoleSwitchPending(false)}
        onSuccess={() => {
          setRole('Admin')
          localStorage.setItem('user_role', 'Admin')
        }}
        title="Elevate to Administrator"
      />

      {/* Action authorization */}
      <PinModal
        isOpen={!!pinRequest}
        onClose={() => setPinRequest(null)}
        onSuccess={() => {
          if (pinRequest?.callback) pinRequest.callback()
        }}
        title={pinRequest?.title}
      />

      {/* Vercel Web Analytics */}
      <Analytics />
    </div>
  )
}
