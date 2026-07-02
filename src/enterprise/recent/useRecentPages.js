import { useCallback, useEffect, useState } from 'react';
import { loadRecentPages, saveRecentPages, MAX_RECENT } from './recent.storage';

/**
 * useRecentPages
 *
 * Tracks recently visited routes in localStorage (last MAX_RECENT,
 * most recent first). No backend dependency.
 *
 * Call `trackVisit({ path, label })` from a route-change effect (e.g.
 * inside AppLayout on location change) to record a visit. This hook
 * does not auto-detect route changes itself, keeping it router-agnostic.
 */
export function useRecentPages() {
  const [recentPages, setRecentPages] = useState(() => loadRecentPages());

  useEffect(() => {
    saveRecentPages(recentPages);
  }, [recentPages]);

  const trackVisit = useCallback((page) => {
    if (!page?.path) return;
    setRecentPages((prev) => {
      const withoutCurrent = prev.filter((p) => p.path !== page.path);
      const next = [
        { path: page.path, label: page.label || page.path, visitedAt: new Date().toISOString() },
        ...withoutCurrent,
      ];
      return next.slice(0, MAX_RECENT);
    });
  }, []);

  const clearRecent = useCallback(() => setRecentPages([]), []);

  return { recentPages, trackVisit, clearRecent };
}
