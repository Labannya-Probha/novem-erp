import React from 'react';
import { useFavorites } from './useFavorites';

/**
 * FavoritesMenu
 *
 * Dumb-ish dropdown listing favorited routes, with a star toggle for
 * the current page. localStorage-backed only, no backend dependency.
 *
 * @param {{
 *   currentPage?: { path: string, label: string },
 *   onNavigate?: (path: string) => void,
 * }} props
 */
export default function FavoritesMenu({ currentPage, onNavigate }) {
  const { favorites, removeFavorite, toggleCurrent, isCurrentFavorite } =
    useFavorites(currentPage);

  return (
    <div className="aera-favorites-menu" role="menu" aria-label="Favorites">
      {currentPage && (
        <button
          type="button"
          onClick={toggleCurrent}
          aria-pressed={isCurrentFavorite}
          aria-label={isCurrentFavorite ? 'Remove current page from favorites' : 'Add current page to favorites'}
        >
          {isCurrentFavorite ? '★ Favorited' : '☆ Add to favorites'}
        </button>
      )}

      {favorites.length === 0 ? (
        <p className="aera-empty-state" role="status">
          No favorites yet.
        </p>
      ) : (
        <ul>
          {favorites.map((fav) => (
            <li key={fav.path} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => onNavigate?.(fav.path)}
                aria-label={`Go to ${fav.label}`}
              >
                {fav.label}
              </button>
              <button
                type="button"
                onClick={() => removeFavorite(fav.path)}
                aria-label={`Remove ${fav.label} from favorites`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
