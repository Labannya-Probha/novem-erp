export const SETTINGS_SECTIONS = [
  { id: 'my-account', label: 'My Account' },
  { id: 'saas-admin', label: 'SaaS Tenants', superuserOnly: true },
  { id: 'branding', label: 'Branding', adminOnly: true },
  { id: 'pos-print', label: 'POS Print Settings', adminOnly: true },
  { id: 'tax-policy', label: 'Tax Policy' },
  { id: 'allowance', label: 'Allowance Configuration', superuserOnly: true },
  { id: 'role-permissions', label: 'Role Permissions', superuserOnly: true },
  { id: 'admin-feature-access', label: 'Admin Feature Access', superuserOnly: true },
  { id: 'staff', label: 'Staff Management' },
  { id: 'reservation-policy', label: 'Reservation Policy', adminOnly: true },
  { id: 'data-system', label: 'Data & System', superuserOnly: true },
]

export function canAccessSettingsSection(section, { role, isAdmin }) {
  if (section.superuserOnly) return role === 'SUPERUSER'
  if (section.adminOnly) return isAdmin || role === 'SUPERUSER'
  return true
}

export function getVisibleSettingsSections(context) {
  return SETTINGS_SECTIONS.filter((section) => canAccessSettingsSection(section, context))
}
