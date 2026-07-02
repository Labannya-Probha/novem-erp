/**
 * Recent Pages — localStorage persistence only. No backend dependency.
 * Keeps at most the last MAX_RECENT entries, most recent first.
 */

const STORAGE_KEY = 'aera.enterprise.recentPages.v1';
export const MAX_RECENT = 10;

/** @typedef {{ path: string, label: string, visitedAt: string }} RecentPage */

/** @returns {RecentPage[]} */
export function loadRecentPages() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {RecentPage[]} pages */
export function saveRecentPages(pages) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pages.slice(0, MAX_RECENT)));
  } catch {
    // localStorage unavailable — fail silently.
  }
}
