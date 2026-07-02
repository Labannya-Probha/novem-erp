/**
 * Favorites — localStorage persistence only. No backend dependency.
 */

const STORAGE_KEY = 'aera.enterprise.favorites.v1';

/** @typedef {{ path: string, label: string, addedAt: string }} FavoriteRoute */

/** @returns {FavoriteRoute[]} */
export function loadFavorites() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {FavoriteRoute[]} favorites */
export function saveFavorites(favorites) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — fail silently.
  }
}
