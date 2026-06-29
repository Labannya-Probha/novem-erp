export const ROLES = ['SUPERUSER', 'ADMIN', 'MANAGER', 'FRONT_OFFICE', 'RESTAURANT', 'STORE', 'ACCOUNTS', 'HR', 'HOUSEKEEPING']

export const ROLE_LABELS = {
  SUPERUSER: 'Superuser', ADMIN: 'Administrator', MANAGER: 'Manager',
  FRONT_OFFICE: 'Front Office', RESTAURANT: 'Restaurant', STORE: 'Store',
  ACCOUNTS: 'Accounts', HR: 'HR Officer', HOUSEKEEPING: 'Housekeeping',
}

// Fallback map — used ONLY if role_privileges hasn't loaded yet (brief window
// right after login) or a module has no row for some reason. Mirrors what the
// hardcoded system used to allow, so there's never a moment of "blank page"
// while the real DB-driven privileges are still being fetched.
const NAV_ACCESS_FALLBACK = {
  dashboard:    ['MANAGER', 'FRONT_OFFICE', 'RESTAURANT', 'STORE', 'ACCOUNTS', 'HR', 'HOUSEKEEPING'],
  reservations: ['MANAGER', 'FRONT_OFFICE'],
  calendar:     ['MANAGER', 'FRONT_OFFICE'],
  nightaudit:   ['MANAGER', 'FRONT_OFFICE'],
  housekeeping: ['MANAGER', 'FRONT_OFFICE', 'HOUSEKEEPING'],
  pos:          ['MANAGER', 'RESTAURANT', 'FRONT_OFFICE'],
  facilities:   ['MANAGER', 'FRONT_OFFICE', 'RESTAURANT'],
  inventory:    ['MANAGER', 'STORE'],
  vat:          ['MANAGER', 'ACCOUNTS'],
  accounting:   ['MANAGER', 'ACCOUNTS'],
  hr:           ['MANAGER', 'HR'],
  reports:      ['MANAGER', 'FRONT_OFFICE', 'RESTAURANT', 'STORE', 'ACCOUNTS', 'HR', 'HOUSEKEEPING'],
  settings:     ['ADMIN', 'SUPERUSER'],
  cms:          ['ADMIN', 'SUPERUSER'],
}

// can(role, pageId, privileges?)
// - SUPERUSER/ADMIN always pass (matches their DB rows, which are always
//   full-access, and avoids any lockout risk if their rows are ever edited).
// - If `privileges` (the array loaded from role_privileges for the current
//   user's role+tenant) is provided, look up can_view for this module there.
// - If `privileges` is not yet loaded (undefined/null), fall back to the
//   static map above so navigation never goes blank during the load.
export const can = (role, pageId, privileges) => {
  if (role === 'SUPERUSER' || role === 'ADMIN') return true
  if (pageId === 'reports') return true
  if (privileges) {
    const row = privileges.find((p) => p.module === pageId)
    if (row) return !!row.can_view
    return false // module has an explicit row set but this one is missing — deny, don't guess
  }
  return (NAV_ACCESS_FALLBACK[pageId] || []).includes(role)
}

// Convenience helpers for the other three actions, same fallback behaviour.
// Used inside pages that want fine-grained create/edit/delete gating beyond
// just "can this role see the page" (e.g. hiding an Add/Delete button).
export const canCreate = (role, pageId, privileges) => {
  if (role === 'SUPERUSER' || role === 'ADMIN') return true
  if (!privileges) return can(role, pageId, privileges) // fallback has no create granularity — tie to view
  const row = privileges.find((p) => p.module === pageId)
  return !!row?.can_create
}
export const canEdit = (role, pageId, privileges) => {
  if (role === 'SUPERUSER' || role === 'ADMIN') return true
  if (!privileges) return can(role, pageId, privileges)
  const row = privileges.find((p) => p.module === pageId)
  return !!row?.can_edit
}
export const canDelete = (role, pageId, privileges) => {
  if (role === 'SUPERUSER' || role === 'ADMIN') return true
  if (!privileges) return false // never assume delete access during the fallback window
  const row = privileges.find((p) => p.module === pageId)
  return !!row?.can_delete
}
