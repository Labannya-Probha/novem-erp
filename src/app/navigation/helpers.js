import { NAV_GROUPS, ALL_NAV_IDS } from './navGroups'
import { can } from '../../lib/roles'
import { isModuleEnabled } from '../../lib/saasModules'
import { PATHS } from '../paths'

const NAV_ID_PATHS = {
  dashboard: PATHS.FRONTOFFICE,
  'pos-print-center': PATHS.POS_PRINT_CENTER,
}

function pathForNavId(id) {
  return NAV_ID_PATHS[id] || `/${id}`
}

export function getActiveNavGroupTitle(currentTopId, pathname) {
  if (pathname.startsWith('/accounting') || pathname === '/vat' || pathname === '/vat-return') return 'Modules'
  if (pathname.startsWith('/hr')) return 'Modules'
  if (
    pathname.startsWith('/frontoffice') ||
    pathname.startsWith('/verify/pos/') ||
    currentTopId === 'dashboard' ||
    currentTopId === 'nightaudit' ||
    currentTopId === 'housekeeping' ||
    currentTopId === 'facilities'
  ) return 'Modules'
  if (pathname.startsWith('/pos') || pathname.startsWith('/menu-management')) return 'Modules'
  const group = NAV_GROUPS.find((entry) => entry.items.some((item) => item.id === currentTopId))
  return group?.title || null
}

export function firstAccessiblePath(role, privileges, modulesEnabled = null) {
  for (const id of ALL_NAV_IDS) {
    if (!isModuleEnabled(id, modulesEnabled, role)) continue
    if (id === 'dashboard' || can(role, id, privileges)) {
      return pathForNavId(id)
    }
  }
  return PATHS.FRONTOFFICE
}
