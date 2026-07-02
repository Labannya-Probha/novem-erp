// Canonical navigation configuration entry point.
// All navigation sources live in:
// - src/app/navigation/*
// - src/app/paths.js
export { NAV_GROUPS, ALL_NAV_IDS } from './app/navigation/navGroups'
export { getActiveNavGroupTitle, firstAccessiblePath } from './app/navigation/helpers'
export {
  SIDEBAR_SETTINGS_SECTIONS,
  SIDEBAR_MASTER_DATA_TABS,
  SIDEBAR_CMS_ENTITY_TABS,
  SIDEBAR_INVENTORY_TABS,
  SIDEBAR_POS_TABS,
  SIDEBAR_ACCOUNTING_TABS,
  SIDEBAR_HR_TABS,
} from './app/navigation/sidebarTabs'
export { getVisibleSettingsSections } from './app/navigation/settingsSections'
export { PATHS } from './app/paths'
