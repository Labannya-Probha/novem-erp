import React from 'react';
import { useRecentPages } from './useRecentPages';

/**
 * RecentPagesMenu
 *
 * Dropdown listing the last visited routes (localStorage-backed, no
 * backend dependency). Does not track visits itself — call
 * `useRecentPages().trackVisit(...)` from a route-change effect
 * elsewhere in the app to populate this list.
 *
 * @param {{ onNavigate?: (path: string) => void }} props
 */
export default function RecentPagesMenu({ onNavigate }) {
  const { recentPages, clearRecent } = useRecentPages();

  return (
    <div className="aera-recent-pages-menu" role="menu" aria-label="Recently visited pages">
      {recentPages.length === 0 ? (
        <p className="aera-empty-state" role="status">
          No recent pages yet.
        </p>
      ) : (
        <>
          <ul>
            {recentPages.map((page) => (
              <li key={page.path} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => onNavigate?.(page.path)}
                  aria-label={`Go to ${page.label}`}
                >
                  {page.label}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={clearRecent} aria-label="Clear recent pages">
            Clear
          </button>
        </>
      )}
    </div>
  );
}
