/**
 * Dashboard Personalization — config-driven widget registry.
 *
 * Defines which widgets a user COULD arrange; actual widget rendering
 * lives with existing dashboard components. This file only describes
 * the catalogue and default layout used for localStorage persistence.
 */

/** @typedef {{ id: string, label: string }} DashboardWidgetConfig */

/** @type {DashboardWidgetConfig[]} */
export const AVAILABLE_WIDGETS = [
  { id: 'occupancy', label: 'Occupancy Overview' },
  { id: 'revenue', label: 'Revenue Snapshot' },
  { id: 'arrivals', label: "Today's Arrivals" },
  { id: 'departures', label: "Today's Departures" },
  { id: 'pending_approvals', label: 'Pending Approvals' },
  { id: 'recent_activity', label: 'Recent Activity' },
];

export const DEFAULT_DASHBOARD_LAYOUT = AVAILABLE_WIDGETS.map((w) => w.id);
