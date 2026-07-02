/* ------------------------------------------------------------------ */
/*  APP TOP BAR — sticky desktop header: module name + user identity   */
/* ------------------------------------------------------------------ */
import { useLocation } from 'react-router-dom'
import { NAV_GROUPS } from '../../app/navigation/navGroups'
import { ROLE_LABELS } from '../../lib/roles'

/* Map path segment → display label using the NAV_GROUPS config */
const NAV_MAP = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((n) => [n.id, n.label]))
)

/* Extra mappings for routes that don't directly match nav IDs */
const EXTRA_MAP = {
  frontoffice:   'Front Office',
  'front-office': 'Front Office',
  nightaudit:    'Front Office',
  consumption:   'Inventory',
  cms:           'Master Data',
  restaurant:    'Restaurant',
  pos:           'Restaurant',
  vat:           'Accounting',
  'vat-return':  'Accounting',
  'night-audit-reports': 'Reports',
  'ai-tasker':   'Tasks',
}

function getModuleLabel(pathname) {
  const seg = pathname.split('/').filter(Boolean)[0] || 'dashboard'
  return NAV_MAP[seg] || EXTRA_MAP[seg] || null
}

function getUserInitials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('')
}

export default function AppTopBar({ userName, role, company }) {
  const location = useLocation()
  const moduleLabel = getModuleLabel(location.pathname)
  const initials    = getUserInitials(userName)
  const roleLabel   = ROLE_LABELS?.[role] || role || ''
  const companyName = company?.name || ''

  return (
    <div className="app-topbar hidden lg:flex items-center justify-between gap-4 sticky top-0 z-[var(--z-sticky)] bg-white/95 backdrop-blur-sm border-b border-slate-200/80 shadow-[0_1px_0_rgba(0,0,0,0.04)] px-8 py-0 h-12 -mx-9 mb-6">

      {/* Left: module name */}
      <div className="flex items-center gap-3 min-w-0">
        {moduleLabel && (
          <span className="text-sm font-semibold text-slate-700 truncate">
            {moduleLabel}
          </span>
        )}
        {companyName && (
          <>
            <span className="text-slate-300 select-none">/</span>
            <span className="text-sm text-slate-400 truncate hidden xl:block">{companyName}</span>
          </>
        )}
      </div>

      {/* Right: user identity */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="text-right hidden sm:block">
          <div className="text-xs font-semibold text-slate-700 leading-tight truncate max-w-[140px]">{userName}</div>
          <div className="text-[10px] text-slate-400 leading-tight">{roleLabel}</div>
        </div>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
          style={{ background: 'var(--tenant-primary)' }}
          title={userName}
        >
          {initials || '?'}
        </div>
      </div>
    </div>
  )
}
