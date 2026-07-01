export const MASTER_DATA_TABS = [
  { id: 'companies', label: 'Companies / Property', entityId: 'companies' },
  { id: 'rooms', label: 'Rooms', entityId: 'rooms' },
  { id: 'guests', label: 'Guests', entityId: 'guests' },
  { id: 'vendors', label: 'Vendors', entityId: 'vendors' },
  { id: 'inventory-items', label: 'Inventory Items', entityId: 'inv_items' },
  { id: 'menu-categories', label: 'Menu Categories', entityId: 'menu_categories' },
  { id: 'menu-items', label: 'Menu Items', entityId: 'menu_items' },
  { id: 'chart-of-accounts', label: 'Chart of Accounts', entityId: 'chart_of_accounts' },
  { id: 'store-locations', label: 'Store Locations', entityId: 'store_locations' },
  { id: 'reservation-policies', label: 'Reservation Policies', entityId: 'reservation_policies' },
  { id: 'agencies-shareholders', label: 'Agencies / Shareholders', entityId: 'agencies' },
]

export const DEFAULT_MASTER_DATA_TAB = 'companies'

export const MASTER_DATA_TAB_IDS = new Set(MASTER_DATA_TABS.map((tab) => tab.id))

export const MASTER_DATA_LEGACY_TAB_MAP = {
  companies: 'companies',
  rooms: 'rooms',
  guests: 'guests',
  vendors: 'vendors',
  inv_items: 'inventory-items',
  menu_categories: 'menu-categories',
  menu_items: 'menu-items',
  chart_of_accounts: 'chart-of-accounts',
  store_locations: 'store-locations',
  reservation_policies: 'reservation-policies',
  agencies: 'agencies-shareholders',
  shareholders: 'agencies-shareholders',
}

export const MASTER_DATA_TAB_TO_ENTITY = {
  companies: 'companies',
  rooms: 'rooms',
  guests: 'guests',
  vendors: 'vendors',
  'inventory-items': 'inv_items',
  'menu-categories': 'menu_categories',
  'menu-items': 'menu_items',
  'chart-of-accounts': 'chart_of_accounts',
  'store-locations': 'store_locations',
  'reservation-policies': 'reservation_policies',
  'agencies-shareholders': 'agencies',
}
