import { can } from '../../lib/roles'

export const DEFAULT_RESERVATION_TAB = 'list'

const RESERVATION_TAB_DEFINITIONS = [
  {
    id: 'list',
    label: 'Reservations List',
    canAccess: ({ role, privileges }) => can(role, 'reservations', privileges),
  },
  {
    id: 'calendar',
    label: 'Booking Calendar',
    canAccess: ({ role, privileges }) => can(role, 'reservations', privileges) || can(role, 'calendar', privileges),
  },
  {
    id: 'availability',
    label: 'Availability',
    canAccess: ({ role, privileges }) => can(role, 'reservations', privileges),
  },
  {
    id: 'new',
    label: 'New Reservation',
    canAccess: ({ role, privileges }) => can(role, 'reservations', privileges),
  },
  {
    id: 'payments',
    label: 'Payments',
    canAccess: ({ role, privileges }) => can(role, 'reservations', privileges) || can(role, 'accounting', privileges) || role === 'ACCOUNTS',
  },
  {
    id: 'guest-crm',
    label: 'Guest CRM',
    canAccess: ({ role, privileges }) => can(role, 'crm', privileges) || can(role, 'reservations', privileges),
  },
  {
    id: 'quotations',
    label: 'Quotations',
    canAccess: ({ role, privileges }) => can(role, 'reservations', privileges),
  },
  {
    id: 'history',
    label: 'History',
    canAccess: ({ role, privileges }) => can(role, 'reservations', privileges),
  },
  {
    id: 'reports',
    label: 'Reports',
    canAccess: ({ role, privileges }) => can(role, 'reservations', privileges),
  },
]

export const RESERVATION_TABS = RESERVATION_TAB_DEFINITIONS.map(({ id, label }) => ({ id, label }))

export const RESERVATION_TAB_ALIASES = {
  crm: 'guest-crm',
  guestcrm: 'guest-crm',
}

const RESERVATION_TAB_MAP = new Map(RESERVATION_TAB_DEFINITIONS.map((tab) => [tab.id, tab]))

export function resolveReservationTab(tabId) {
  const normalized = String(tabId || '').trim().toLowerCase()
  if (!normalized) return DEFAULT_RESERVATION_TAB
  return RESERVATION_TAB_ALIASES[normalized] || RESERVATION_TAB_MAP.get(normalized)?.id || DEFAULT_RESERVATION_TAB
}

export function getReservationTabDefinition(tabId) {
  return RESERVATION_TAB_MAP.get(resolveReservationTab(tabId)) || RESERVATION_TAB_MAP.get(DEFAULT_RESERVATION_TAB)
}

export function canAccessReservationTab(tabId, context = {}) {
  return Boolean(getReservationTabDefinition(tabId)?.canAccess?.(context))
}

export function getVisibleReservationTabs(context = {}) {
  return RESERVATION_TAB_DEFINITIONS
    .filter((tab) => tab.canAccess(context))
    .map(({ id, label }) => ({ id, label }))
}
