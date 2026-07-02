import { useCallback, useEffect, useState } from 'react';
import { loadFavorites, saveFavorites } from './favorites.storage';

/**
 * useFavorites
 *
 * Add/remove the current page to a localStorage-backed favorites list.
 * No backend dependency.
 *
 * @param {{ path: string, label: string }} [currentPage]
 */
export function useFavorites(currentPage) {
  const [favorites, setFavorites] = useState(() => loadFavorites());

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  const isFavorite = useCallback(
    (path) => favorites.some((f) => f.path === path),
    [favorites]
  );

  const addFavorite = useCallback((page) => {
    if (!page?.path) return;
    setFavorites((prev) => {
      if (prev.some((f) => f.path === page.path)) return prev;
      return [...prev, { path: page.path, label: page.label || page.path, addedAt: new Date().toISOString() }];
    });
  }, []);

  const removeFavorite = useCallback((path) => {
    setFavorites((prev) => prev.filter((f) => f.path !== path));
  }, []);

  const toggleFavorite = useCallback((page) => {
    if (!page?.path) return;
    setFavorites((prev) =>
      prev.some((f) => f.path === page.path)
        ? prev.filter((f) => f.path !== page.path)
        : [...prev, { path: page.path, label: page.label || page.path, addedAt: new Date().toISOString() }]
    );
  }, []);

  const toggleCurrent = useCallback(() => {
    if (currentPage) toggleFavorite(currentPage);
  }, [currentPage, toggleFavorite]);

  return {
    favorites,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    toggleCurrent,
    isCurrentFavorite: currentPage ? isFavorite(currentPage.path) : false,
  };
}
