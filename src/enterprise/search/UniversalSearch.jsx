import React from 'react';
import { useUniversalSearch } from './useUniversalSearch';
import { SEARCH_CONFIG } from './search.config';

/**
 * UniversalSearch
 *
 * Safe UI shell for cross-entity search (reservations, guests,
 * invoices, vouchers, rooms, employees, vendors, menu_items).
 *
 * No backend search service exists yet, so this always renders the
 * "not configured" empty state once a query is entered. It is safe to
 * mount anywhere (e.g. topbar) — it performs no network or Supabase
 * calls.
 *
 * @param {{ className?: string, placeholder?: string }} props
 */
export default function UniversalSearch({ className = '', placeholder = 'Search…' }) {
  const { query, setQuery, results, isConfigured } = useUniversalSearch();
  const hasQuery = query.trim().length >= SEARCH_CONFIG.minQueryLength;

  return (
    <div className={`aera-universal-search ${className}`} role="search">
      <label htmlFor="aera-universal-search-input" className="sr-only">
        Search reservations, guests, invoices, and more
      </label>
      <input
        id="aera-universal-search-input"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label="Universal search"
        autoComplete="off"
      />

      {hasQuery && (
        <div
          className="aera-universal-search-results"
          role="listbox"
          aria-label="Search results"
        >
          {!isConfigured || results.length === 0 ? (
            <p className="aera-empty-state" role="status">
              {SEARCH_CONFIG.notConfiguredMessage}
            </p>
          ) : (
            results.map((group) => (
              <div key={group.entityKey} role="group" aria-label={group.entityKey}>
                {/* Result rendering intentionally left minimal until a
                    backend search service is connected. */}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
