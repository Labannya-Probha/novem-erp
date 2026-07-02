import React, { createContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_DASHBOARD_LAYOUT } from './dashboard.widgets.config';

const STORAGE_KEY = 'aera.enterprise.dashboardLayout.v1';

/**
 * DashboardPersonalizationContext
 *
 * Holds the current widget layout (an ordered array of widget ids)
 * plus a setter. Persisted to localStorage only — no drag-and-drop
 * dependency, no backend.
 */
export const DashboardPersonalizationContext = createContext(null);

function loadLayout() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DASHBOARD_LAYOUT;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_DASHBOARD_LAYOUT;
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT;
  }
}

/**
 * DashboardPersonalizationProvider
 *
 * Wrap the dashboard page with this to enable useDashboardLayout().
 * Exposes getLayout / saveLayout / resetLayout via the hook.
 *
 * @param {{ children: React.ReactNode }} props
 */
export default function DashboardPersonalizationProvider({ children }) {
  const [layout, setLayoutState] = useState(() => loadLayout());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // localStorage unavailable — fail silently.
    }
  }, [layout]);

  function setLayout(next) {
    setLayoutState(Array.isArray(next) && next.length > 0 ? next : DEFAULT_DASHBOARD_LAYOUT);
  }

  const value = useMemo(
    () => ({ layout, setLayout, defaultLayout: DEFAULT_DASHBOARD_LAYOUT }),
    [layout]
  );

  return (
    <DashboardPersonalizationContext.Provider value={value}>
      {children}
    </DashboardPersonalizationContext.Provider>
  );
}
