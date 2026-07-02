import { useCallback, useContext } from 'react';
import { DashboardPersonalizationContext } from './DashboardPersonalizationProvider';

/**
 * useDashboardLayout
 *
 * Convenience hook around DashboardPersonalizationContext. Must be
 * used within <DashboardPersonalizationProvider>.
 *
 * @returns {{
 *   layout: string[],
 *   getLayout: () => string[],
 *   saveLayout: (layout: string[]) => void,
 *   resetLayout: () => void,
 * }}
 */
export function useDashboardLayout() {
  const ctx = useContext(DashboardPersonalizationContext);
  if (!ctx) {
    throw new Error('useDashboardLayout must be used within a DashboardPersonalizationProvider');
  }
  const { layout, setLayout, defaultLayout } = ctx;

  const getLayout = useCallback(() => layout, [layout]);
  const saveLayout = useCallback((next) => setLayout(next), [setLayout]);
  const resetLayout = useCallback(() => setLayout(defaultLayout), [setLayout, defaultLayout]);

  return { layout, getLayout, saveLayout, resetLayout };
}
