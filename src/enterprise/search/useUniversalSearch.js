import { useCallback, useState } from 'react';
import { SEARCH_CONFIG, SEARCH_ENTITIES } from './search.config';

/**
 * useUniversalSearch
 *
 * State/behavior hook for the Universal Search shell. Does NOT query
 * Supabase or any table directly — there is no backend search service
 * wired up yet. Calling `runSearch` will always resolve to an empty
 * result set with a "not configured" notice.
 *
 * Future integration:
 *   Replace the body of `runSearch` with a call to a real search
 *   function (e.g. a Supabase RPC like `search_all(term, tenant_id)`),
 *   and set `results` / `isConfigured` from its response.
 *
 * @returns {{
 *   query: string,
 *   setQuery: (q: string) => void,
 *   results: Array<{ entityKey: string, items: any[] }>,
 *   isSearching: boolean,
 *   isConfigured: boolean,
 *   entities: typeof SEARCH_ENTITIES,
 *   runSearch: (term?: string) => void,
 * }}
 */
export function useUniversalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // No backend search service exists yet. This stays false until one
  // is wired up (see search.config.js and the JSDoc above).
  const isConfigured = false;

  const runSearch = useCallback((term) => {
    const value = (term ?? query).trim();
    if (value.length < SEARCH_CONFIG.minQueryLength) {
      setResults([]);
      return;
    }

    if (!isConfigured) {
      // Intentionally a no-op: no direct table queries are performed
      // here. The UI shows SEARCH_CONFIG.notConfiguredMessage instead.
      setResults([]);
      return;
    }

    // Placeholder for future implementation:
    // setIsSearching(true);
    // const data = await search(value);
    // setResults(data);
    // setIsSearching(false);
  }, [query, isConfigured]);

  return {
    query,
    setQuery,
    results,
    isSearching,
    isConfigured,
    entities: SEARCH_ENTITIES,
    runSearch,
  };
}
