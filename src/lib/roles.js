export const ROLES = ['ADMIN', 'MANAGER', 'FRONT_OFFICE', 'RESTAURANT', 'STORE', 'ACCOUNTS', 'HR']

export const ROLE_LABELS = {
  ADMIN: 'Administrator', MANAGER: 'Manager', FRONT_OFFICE: 'Front Office',
  RESTAURANT: 'Restaurant', STORE: 'Store', ACCOUNTS: 'Accounts', HR: 'HR & Admin',
}

// Which roles can open which module. ADMIN always passes.
export const NAV_ACCESS = {
  dashboard: ['MANAGER', 'FRONT_OFFICE', 'RESTAURANT', 'STORE', 'ACCOUNTS', 'HR'],
  reservations: ['MANAGER', 'FRONT_OFFICE'],
  calendar: ['MANAGER', 'FRONT_OFFICE'],
  nightaudit: ['MANAGER', 'FRONT_OFFICE'],
  housekeeping: ['MANAGER', 'FRONT_OFFICE', 'HOUSEKEEPING'],
  pos: ['MANAGER', 'RESTAURANT', 'FRONT_OFFICE'],
  facilities: ['MANAGER', 'FRONT_OFFICE', 'RESTAURANT'],
  inventory: ['MANAGER', 'STORE'],
  vat: ['MANAGER', 'ACCOUNTS'],
  accounting: ['MANAGER', 'ACCOUNTS'],
  hr: ['MANAGER', 'HR'],
  reports: ['MANAGER', 'ACCOUNTS'],
  settings: ['MANAGER'],
}

export const can = (role, pageId) =>
  role === 'ADMIN' || (NAV_ACCESS[pageId] || []).includes(role)
