/**
 * Universal Search — config-driven entity registry.
 *
 * AEDS v2.1 extension point. This file defines WHAT can be searched,
 * not HOW. Each entry describes a searchable entity type; the actual
 * query implementation is intentionally left unimplemented (see
 * useUniversalSearch.js) until a backend search service exists.
 *
 * To wire up real search later:
 *   1. Implement a `search(entityType, term)` function (Supabase RPC,
 *      Postgres full-text search, or an external search service).
 *   2. Pass it into <UniversalSearch searchFn={...} /> or update
 *      useUniversalSearch.js to call it directly.
 *   3. Do NOT query every table on every keystroke — add debouncing
 *      and prefer a single indexed view/RPC over N separate queries.
 */

/** @typedef {{ key: string, label: string, table: string, enabled: boolean }} SearchEntityConfig */

/** @type {SearchEntityConfig[]} */
export const SEARCH_ENTITIES = [
  { key: 'reservations', label: 'Reservations', table: 'reservations', enabled: true },
  { key: 'guests', label: 'Guests', table: 'guests', enabled: true },
  { key: 'invoices', label: 'Invoices', table: 'invoices', enabled: true },
  { key: 'vouchers', label: 'Vouchers', table: 'vouchers', enabled: true },
  { key: 'rooms', label: 'Rooms', table: 'rooms', enabled: true },
  { key: 'employees', label: 'Employees', table: 'employees', enabled: true },
  { key: 'vendors', label: 'Vendors', table: 'vendors', enabled: true },
  { key: 'menu_items', label: 'Menu Items', table: 'menu_items', enabled: true },
];

export const SEARCH_CONFIG = {
  /** Minimum characters before a search is attempted. */
  minQueryLength: 2,
  /** Debounce delay in ms once a backend is wired up. */
  debounceMs: 300,
  /** Max results per entity type, once a backend is wired up. */
  maxResultsPerEntity: 5,
  /** Shown when no search backend is configured yet. */
  notConfiguredMessage: 'Search service not configured yet.',
};
